/**
 * Wiki source adapter — https://fortnite.fandom.com (Category:Sprites).
 *
 * FALLBACK / cross-reference source. Good for long-form ability text, boon
 * descriptions, and historical variants — but it lags real patches by days
 * to weeks (community-edited), so it must never override fortnite.gg for
 * current identity/rarity/image/season. See sources/fortnite-gg.mjs for the
 * primary source and README-SPRITE-CATALOG.md for the merge rules.
 *
 * Exports `fetchWikiCatalog()` returning a flat array of raw wiki-sourced
 * sprite variant records, keyed loosely (by family name) so the orchestrator
 * (scripts/scrape-fortnite-gg-sprites.mjs) can cross-reference them.
 */

const WIKI_API = "https://fortnite.fandom.com/api.php";

async function api(params) {
  const url = new URL(WIKI_API);
  url.search = new URLSearchParams({ format: "json", ...params }).toString();
  const res = await fetch(url, { headers: { "User-Agent": "sprite-locator-catalog-builder/1.0" } });
  if (!res.ok) throw new Error(`Wiki API ${url} failed: ${res.status}`);
  return res.json();
}

async function getCategoryMembers(category) {
  const data = await api({ action: "query", list: "categorymembers", cmtitle: category, cmlimit: "500" });
  return data.query.categorymembers.map((m) => m.title);
}

async function getWikitext(title) {
  const data = await api({ action: "query", prop: "revisions", titles: title, rvprop: "content", rvslots: "main" });
  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  return page?.revisions?.[0]?.slots?.main?.["*"] ?? null;
}

function normalizeFilename(name) {
  return name.replace(/\s+/g, " ").trim();
}

async function getImageUrls(filenames) {
  const result = {};
  const batchSize = 50;
  const unique = [...new Set(filenames.map(normalizeFilename))];
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const titles = batch.map((f) => `File:${f}`).join("|");
    const data = await api({ action: "query", titles, prop: "imageinfo", iiprop: "url" });
    if (!data.query?.pages) continue;
    for (const page of Object.values(data.query.pages)) {
      if (page.imageinfo?.[0]?.url) {
        result[normalizeFilename(page.title.replace(/^File:/, ""))] = page.imageinfo[0].url;
      }
    }
  }
  return result;
}

function stripWikiLinks(text) {
  if (!text) return null;
  return text
    .replace(/\{\{Shield\|([^}|]+)[^}]*\}\}/gi, "$1 Shield")
    .replace(/\{\{Level\|([^}|]+)[^}]*\}\}/gi, "Level $1")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]+)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts the body of a `{{TemplateName ... }}` block by tracking brace
 * depth, rather than regex-matching for a closing `\n}}` — some infoboxes
 * put their last field's value right up against the closing braces with no
 * newline (e.g. `|date=August 20th 2026}}`), which made the old
 * newline-anchored regex run past the real end and swallow the rest of the
 * page into that field's value.
 */
function extractBracedBlock(wikitext, startMarker) {
  const start = wikitext.indexOf(startMarker);
  if (start === -1) return null;
  let depth = 0;
  let i = start;
  for (; i < wikitext.length; i++) {
    if (wikitext.startsWith("{{", i)) {
      depth++;
      i++;
    } else if (wikitext.startsWith("}}", i)) {
      depth--;
      i++;
      if (depth === 0) break;
    }
  }
  return wikitext.slice(start + startMarker.length, i - 1);
}

function parseInfobox(wikitext) {
  const body = extractBracedBlock(wikitext, "{{Infobox Weaponry");
  if (body === null) return {};
  const fields = {};
  const re = /\|\s*([a-zA-Z_]+)\s*=\s*([\s\S]*?)(?=\n\|[a-zA-Z_]+\s*=|$)/g;
  let m;
  while ((m = re.exec(body))) {
    fields[m[1].trim()] = m[2].trim();
  }
  return fields;
}

function parseAbilityQuote(wikitext) {
  const body = extractBracedBlock(wikitext, "{{Quotation|");
  return body !== null ? stripWikiLinks(body) : null;
}

function parseVariantBoons(wikitext) {
  const boons = {};
  const re = /^\*''([^']+)''\s*-\s*(.+)$/gm;
  let m;
  while ((m = re.exec(wikitext))) {
    boons[m[1].trim().toLowerCase()] = stripWikiLinks(m[2]);
  }
  return boons;
}

function parseVariantsTable(wikitext) {
  const sectionMatch = wikitext.match(/==\s*Variants\s*==([\s\S]*?)(?=\n==[^=]|\n\{\{HistoryScrollbox|$)/);
  if (!sectionMatch) return [];
  const section = sectionMatch[1];

  const rows = section.split(/\n\|-/).slice(1);
  const variants = [];
  let unreleased = false;

  for (const row of rows) {
    if (/Unreleased Sprites/i.test(row)) {
      unreleased = true;
      continue;
    }
    const imageMatch = row.match(/\[\[File:([^\]|]+)(?:\|[^\]]+)?\]\]/);
    const nameMatch = row.match(/<(?:hr|br)\s*\/?>\s*\n?([^\n|]+)/);
    const rarityMatch = row.match(/\{\{(\w[\w ]*)\}\}\s*\n\|/) ?? row.match(/\{\{(\w[\w ]*)\}\}/);
    const costMatch = row.match(/\{\{Sprite Dust\|([\d,]+)/);

    if (!nameMatch) continue;
    variants.push({
      name: nameMatch[1].trim(),
      image: imageMatch ? imageMatch[1].trim() : null,
      rarity: rarityMatch ? rarityMatch[1].trim() : null,
      summonCostSpriteDust: costMatch ? Number(costMatch[1].replace(/,/g, "")) : null,
      enabled: !unreleased,
    });
  }
  return variants;
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function variantLabel(variantName, familyName) {
  const prefix = variantName.replace(familyName, "").trim().toLowerCase();
  return prefix.length > 0 ? prefix : null;
}

function parseObtaining(wikitext) {
  const body = extractBracedBlock(wikitext, "{{Obtaining|");
  if (body === null) return { method: null, lootSourceTags: [] };

  const methodMatch = body.match(/\bmethod\s*=\s*([\s\S]*)$/);
  const method = methodMatch ? stripWikiLinks(methodMatch[1]) : null;

  const tags = [];
  const text = (method ?? "").toLowerCase();
  if (/\bchest/.test(text)) tags.push("Chests");
  if (/rare chest/.test(text)) tags.push("Rare Chests");
  if (/sprite chest/.test(text)) tags.push("Sprite Chests");
  if (/wander|roam/.test(text)) tags.push("Roaming Spawns");
  if (/eliminat.*boss|boss.*eliminat|drop from eliminated/.test(text)) tags.push("Boss Drops");
  if (/quest/.test(text)) tags.push("Quest Reward");
  if (/extracting \d+ sprites|by extracting/.test(text)) tags.push("Extraction Milestone");

  return { method, lootSourceTags: [...new Set(tags)] };
}

function isFamilyRetired(wikitext) {
  const head = wikitext.slice(0, wikitext.indexOf("{{Infobox"));
  return /\{\{\s*(Vaulted|Inaccessible|Retired)\b/i.test(head);
}

async function buildFamily(title) {
  const wikitext = await getWikitext(title);
  if (!wikitext || !/\{\{Infobox Weaponry/.test(wikitext)) return null;

  const familyRetired = isFamilyRetired(wikitext);
  const infobox = parseInfobox(wikitext);
  const ability = parseAbilityQuote(wikitext);
  const boonsByVariant = parseVariantBoons(wikitext);
  const variantRows = parseVariantsTable(wikitext);
  const obtaining = parseObtaining(wikitext);

  const familyName = infobox.name ?? title;
  const addedIn = infobox.added_in ? stripWikiLinks(infobox.added_in) : null;
  const date = infobox.date ?? null;

  const rows = variantRows.length > 0
    ? variantRows
    : [{ name: familyName, image: infobox.image ?? null, rarity: infobox.rarity ?? null, summonCostSpriteDust: null, enabled: true }];

  return rows.map((row) => {
    const variant = variantLabel(row.name, familyName);
    const boonText = variant ? boonsByVariant[variant] ?? null : null;
    return {
      id: slugify(row.name),
      familyId: slugify(familyName),
      name: row.name,
      family: familyName,
      variant,
      rarity: row.rarity ? row.rarity.toLowerCase() : null,
      imageFile: row.image,
      icon: null,
      description: ability,
      boons: boonText ? [{ id: `${slugify(familyName)}-${variant}`, description: boonText }] : [],
      summonCostSpriteDust: row.summonCostSpriteDust,
      season: addedIn,
      seasonDate: date,
      enabled: row.enabled && !familyRetired,
      acquisitionMethod: obtaining.method,
      lootSourceTags: obtaining.lootSourceTags,
    };
  });
}

/** Fetches and normalizes the full wiki-sourced Sprite catalog. */
export async function fetchWikiCatalog({ log = () => {} } = {}) {
  log("[wiki] Fetching Category:Sprites members…");
  const titles = await getCategoryMembers("Category:Sprites");
  const familyTitles = titles.filter((t) => !t.includes("/"));
  log(`[wiki] Found ${familyTitles.length} family pages (of ${titles.length} total category members).`);

  const allSprites = [];
  for (const title of familyTitles) {
    try {
      const entries = await buildFamily(title);
      if (entries) allSprites.push(...entries);
    } catch (err) {
      log(`[wiki] ERROR parsing ${title}: ${err.message}`);
    }
  }

  log("[wiki] Resolving image URLs…");
  const filenames = [...new Set(allSprites.map((s) => s.imageFile).filter(Boolean))];
  const imageUrls = await getImageUrls(filenames);
  for (const sprite of allSprites) {
    if (sprite.imageFile) sprite.icon = imageUrls[normalizeFilename(sprite.imageFile)] ?? null;
    delete sprite.imageFile;
  }

  log(`[wiki] Done — ${allSprites.length} variant entries across ${familyTitles.length} families.`);
  return allSprites;
}
