#!/usr/bin/env node
/**
 * PRIMARY Sprite catalog pipeline. Produces public/data/sprites.json — the
 * one file the app actually reads (see lib/sprite-catalog/repository.ts).
 * The app never talks to fortnite.gg or the wiki directly; this script is
 * meant to be re-run offline (locally or in CI) after Fortnite patches.
 *
 *   fortnite.gg/sprites (Playwright)  ──┐
 *                                       ├─→ merge (fortnite.gg wins for
 *   fortnite.fandom.com (wiki, HTTP)  ──┘    current identity/rarity/image/
 *                                            season; wiki fills narrative
 *                                            gaps) → public/data/sprites.json
 *
 * Usage:
 *   npm run sprites:scrape
 *
 * Safe to run repeatedly — it fully regenerates the output file each time
 * rather than patching it incrementally, so there's no drift between runs.
 */
import { writeFile } from "node:fs/promises";
import { fetchFortniteGGCatalog } from "../lib/sprite-catalog/sources/fortnite-gg.mjs";
import { fetchWikiCatalog, slugify } from "../lib/sprite-catalog/sources/wiki.mjs";

const OUT_FILE = new URL("../public/data/sprites.json", import.meta.url);

function familyKey(name) {
  return slugify(name).replace(/-sprite$/, "");
}

function variantKey(variant) {
  return variant ? variant.toLowerCase().replace(/[^a-z0-9]/g, "") : "base";
}

/** Groups wiki entries by (family, variant) for O(1) cross-reference lookups. */
function indexWiki(wikiSprites) {
  const index = new Map();
  for (const w of wikiSprites) {
    const key = `${familyKey(w.family)}::${variantKey(w.variant)}`;
    index.set(key, w);
  }
  return index;
}

function mergeSprite(fgg, wikiMatch, { currentSeason, now }) {
  const availability = fgg.isCurrentSeason
    ? "live"
    : fgg.season != null
      ? "vaulted"
      : "unknown";

  const name = fgg.name ?? wikiMatch?.name ?? fgg.family;

  return {
    id: slugify(name),
    name,
    family: fgg.family,
    variant: fgg.variant,
    rarity: fgg.rarity ?? wikiMatch?.rarity ?? null,
    icon: fgg.icon ?? wikiMatch?.icon ?? null,
    description: wikiMatch?.description ?? fgg.ability ?? null,
    ability: fgg.ability ?? null,
    boons: wikiMatch?.boons ?? [],
    acquisitionHint: fgg.acquisitionHint ?? wikiMatch?.acquisitionMethod ?? null,
    summonCostSpriteDust: fgg.summonCostSpriteDust ?? wikiMatch?.summonCostSpriteDust ?? null,
    dropRates: fgg.dropRates && Object.keys(fgg.dropRates).length > 0 ? fgg.dropRates : null,
    season: fgg.season,
    seasonDate: wikiMatch?.seasonDate ?? null,
    existsInGameData: true,
    currentlyLive: fgg.isCurrentSeason,
    availability,
    source: wikiMatch ? "fortnite.gg+wiki" : "fortnite.gg",
    lastVerified: now,
  };
}

function wikiOnlySprite(w, now) {
  return {
    id: w.id,
    name: w.name,
    family: w.family,
    variant: w.variant,
    rarity: w.rarity,
    icon: w.icon,
    description: w.description,
    ability: null,
    boons: w.boons,
    acquisitionHint: w.acquisitionMethod,
    summonCostSpriteDust: w.summonCostSpriteDust,
    dropRates: null,
    season: w.season,
    seasonDate: w.seasonDate,
    existsInGameData: true,
    currentlyLive: false,
    availability: w.enabled ? "unknown" : "vaulted",
    source: "wiki",
    lastVerified: now,
  };
}

function printReport(sprites, currentSeason, generated) {
  const families = new Set(sprites.map((s) => s.family));
  const live = sprites.filter((s) => s.currentlyLive);
  const unavailable = sprites.filter((s) => !s.currentlyLive);
  const withImages = sprites.filter((s) => s.icon);
  const withDescriptions = sprites.filter((s) => s.description);
  const withAbilities = sprites.filter((s) => s.ability);
  const withDropRates = sprites.filter((s) => s.dropRates && Object.values(s.dropRates).some((v) => v != null));

  console.log("\n=== Sprite catalog build report ===");
  console.log(`Total Sprite families:            ${families.size}`);
  console.log(`Total variants:                   ${sprites.length}`);
  console.log(`Currently live variants:          ${live.length}`);
  console.log(`Unavailable / non-current:        ${unavailable.length}`);
  console.log(`Variants with images:             ${withImages.length}`);
  console.log(`Variants with descriptions:       ${withDescriptions.length}`);
  console.log(`Variants with ability text:       ${withAbilities.length}`);
  console.log(`Variants with drop-rate data:     ${withDropRates.length}`);
  console.log(`Current Fortnite season detected: ${currentSeason ?? "unknown"}`);
  console.log(`Last verification timestamp:      ${generated}`);
  console.log("====================================\n");
}

async function main() {
  const now = new Date().toISOString();

  console.log("Step 1/3 — scraping fortnite.gg (primary source)…");
  const { sprites: fggSprites, currentSeason } = await fetchFortniteGGCatalog({ log: console.log });

  console.log("\nStep 2/3 — scraping fortnite.fandom.com (fallback/cross-reference)…");
  let wikiSprites = [];
  try {
    wikiSprites = await fetchWikiCatalog({ log: console.log });
  } catch (err) {
    console.log(`[wiki] Skipping wiki cross-reference — fetch failed: ${err.message}`);
  }
  const wikiIndex = indexWiki(wikiSprites);

  console.log("\nStep 3/3 — merging sources…");
  const merged = fggSprites.map((fgg) => {
    const key = `${familyKey(fgg.family)}::${variantKey(fgg.variant)}`;
    const wikiMatch = wikiIndex.get(key) ?? null;
    if (wikiMatch) wikiIndex.delete(key); // consumed — remaining entries are wiki-only
    return mergeSprite(fgg, wikiMatch, { currentSeason, now });
  });

  // Wiki families/variants fortnite.gg doesn't currently list at all (e.g. it
  // hasn't been re-tracked, or is old enough fortnite.gg dropped it) — keep
  // them so we don't silently lose data the wiki alone documents.
  const wikiOnly = [...wikiIndex.values()].map((w) => wikiOnlySprite(w, now));

  const allSprites = [...merged, ...wikiOnly];
  const familyCount = new Set(allSprites.map((s) => s.family)).size;

  const catalog = {
    source: "fortnite.gg (primary) + fortnite.fandom.com (fallback/cross-reference)",
    generated: now,
    currentSeason,
    familyCount,
    variantCount: allSprites.length,
    sprites: allSprites,
  };

  await writeFile(OUT_FILE, JSON.stringify(catalog, null, 2));
  console.log(`\nWrote ${allSprites.length} sprite entries (${familyCount} families) to ${OUT_FILE.pathname}`);

  printReport(allSprites, currentSeason, now);

  const example = allSprites.find((s) => s.currentlyLive && s.source === "fortnite.gg+wiki") ?? allSprites[0];
  console.log("Example record:");
  console.log(JSON.stringify(example, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
