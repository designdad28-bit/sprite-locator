/**
 * fortnite.gg source adapter — PRIMARY source.
 *
 * fortnite.gg extracts and republishes Fortnite's own game data (the same
 * pipeline it uses for its map tiles) within hours of a patch, well ahead of
 * the community-edited wiki. Its `/sprites` page renders one `.sprite-card`
 * element per Sprite *variant* with clean data-* attributes — effectively a
 * structured API baked into the DOM:
 *
 *   <div class="sprite-card" data-sprite="179" data-parent-name="Klombo"
 *        data-rarity="mythic" data-variant="base" data-season="42">
 *     <a href="/sprites/179-klombo-sprite">
 *       <img data-src="/img/x/sprites/icons/T_Icon_BR_Creature_Sprite_Klombo_L.webp" alt="Klombo Sprite">
 *
 * (the art is lazy-loaded: `data-src` until the card scrolls into view,
 * at which point it is copied into `src`, so read either)
 *
 * The HTML pages sit behind a Cloudflare bot check that blocks plain
 * fetch/curl — but not real browser navigation, no CAPTCHA-solving or
 * challenge-bypassing needed. That's why this adapter requires Playwright
 * (a real, unmodified Chromium) rather than a plain HTTP client. The static
 * image assets themselves are NOT behind that check (same as fortnite.gg's
 * map tiles) — only the HTML document responses are.
 *
 * We do not scrape at runtime — this only runs offline, in
 * scripts/scrape-fortnite-gg-sprites.mjs, to produce public/data/sprites.json.
 */

const BASE_URL = "https://fortnite.gg";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Numeric fields on fortnite.gg's Sprite detail pages read as exactly 0
 * whenever the real value hasn't been published yet — confirmed by
 * comparison: current-season (42) sprites uniformly show summon cost 0 /
 * drop chance 0%, while last-season (41) sprites that we know are live show
 * real values (e.g. Duck Sprite: 2,700 dust, 6.48%). So 0 here means
 * "unknown", never a real zero — we normalize it to `null` rather than
 * fabricate a false "definitely zero" reading.
 */
function nullIfZero(n) {
  return n === 0 ? null : n;
}

async function collectListCards(page) {
  const byId = new Map();
  async function snapshot() {
    const cards = await page.$$eval(".sprite-card", (els) =>
      els.map((el) => {
        const a = el.querySelector("a.sprite-art");
        const img = el.querySelector("img");
        return {
          fortniteGGId: el.dataset.sprite,
          family: el.dataset.parentName,
          rarity: el.dataset.rarity,
          variant: el.dataset.variant,
          season: el.dataset.season,
          isNew: el.dataset.isNew === "1",
          href: a ? a.getAttribute("href") : null,
          // src OR data-src: the grid lazy-loads its art, so a card that
          // hasn't scrolled into view yet carries only data-src and an
          // empty src. Reading src alone silently dropped the icon for
          // every card the scroll below never reached — which, because new
          // sprites land at the end of the grid, meant exactly the newest
          // ones (27 of them after the Bounty Hunter patch) came through
          // with no image at all.
          iconPath: img ? img.getAttribute("src") || img.getAttribute("data-src") : null,
          name: img ? img.getAttribute("alt") : null,
        };
      })
    );
    for (const c of cards) byId.set(c.fortniteGGId, c);
  }

  await snapshot();
  // The grid is virtualized/lazy — scroll to force the rest to render.
  let stableRounds = 0;
  let lastSize = byId.size;
  for (let i = 0; i < 80 && stableRounds < 5; i++) {
    await page.mouse.wheel(0, 1200);
    await page.waitForTimeout(120);
    await snapshot();
    if (byId.size === lastSize) stableRounds++;
    else stableRounds = 0;
    lastSize = byId.size;
  }

  return [...byId.values()];
}

/**
 * Parses the detail page's plain rendered text. Deliberately avoids DOM
 * structure (nextElementSibling etc.) — that turned out to shift between
 * loads (responsive layout / hydration timing), while the rendered text
 * itself is stable. All parsing here is plain string slicing between the
 * page's own section headings, in the order they always render:
 *   <NAME>\n<RARITY>\n<pct>%\n\n<ability text>\n\nLOCATION\n<location>\n
 *   VARIANT\n<variant>\nSUMMON COST\n<cost>\nDROP CHANCES\n<SOURCE\npct%>*\nVARIANTS\n...
 */
function parseDetailText(bodyText) {
  const locationIdx = bodyText.indexOf("LOCATION");
  const variantIdx = bodyText.indexOf("VARIANT", locationIdx);
  const summonIdx = bodyText.indexOf("SUMMON COST", variantIdx);
  const dropIdx = bodyText.indexOf("DROP CHANCES", summonIdx);
  const variantsListIdx = bodyText.indexOf("VARIANTS", dropIdx);

  const rarityLineMatch = bodyText.match(/\n(COMMON|UNCOMMON|RARE|EPIC|LEGENDARY|MYTHIC|SPECIAL)\n([\d.]+)%\n/);
  let ability = null;
  if (rarityLineMatch && locationIdx > -1) {
    const start = rarityLineMatch.index + rarityLineMatch[0].length;
    ability = bodyText.slice(start, locationIdx).trim() || null;
  }

  let location = null;
  if (locationIdx > -1 && variantIdx > locationIdx) {
    location = bodyText.slice(locationIdx + "LOCATION".length, variantIdx).trim() || null;
  }

  let summonCost = null;
  if (summonIdx > -1 && dropIdx > summonIdx) {
    const raw = bodyText.slice(summonIdx + "SUMMON COST".length, dropIdx).trim();
    const num = Number(raw.replace(/,/g, ""));
    summonCost = Number.isFinite(num) ? num : null;
  }

  const dropRates = {};
  if (dropIdx > -1) {
    const section = bodyText.slice(dropIdx + "DROP CHANCES".length, variantsListIdx > -1 ? variantsListIdx : undefined);
    const lines = section.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let i = 0; i < lines.length - 1; i++) {
      const pctMatch = lines[i + 1].match(/^([\d.]+)%$/);
      if (pctMatch && !/^[\d.]+%$/.test(lines[i])) {
        dropRates[lines[i]] = Number(pctMatch[1]);
        i++;
      }
    }
  }

  return { ability, location, summonCost, dropRates };
}

/**
 * Fetches one detail page on a brand-new page/tab, closed immediately after.
 * Reusing a single page object across many sequential navigations turned
 * out to be flaky against this specific site (the first 2-3 navigations
 * would succeed, then `waitForFunction` would reliably time out on later
 * ones despite the content actually being there — some client-side-routing
 * interaction we didn't fully root-cause). A fresh page per fetch costs a
 * little overhead but has been reliable across the full run.
 */
async function scrapeDetailPage(browser, href) {
  const page = await browser.newPage({ userAgent: USER_AGENT, viewport: { width: 1400, height: 1000 } });
  try {
    const url = `${BASE_URL}${href}`;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForFunction(() => document.body.innerText.includes("DROP CHANCES"), { timeout: 15000 }).catch(() => {});
    const bodyText = await page.evaluate(() => document.body.innerText);
    return parseDetailText(bodyText);
  } finally {
    await page.close();
  }
}

/**
 * Scrapes fortnite.gg's live Sprite roster. Requires the `playwright`
 * package (dev dependency) and a Chromium binary
 * (`npx playwright install chromium`).
 *
 * @param {object} opts
 * @param {(msg: string) => void} [opts.log]
 * @param {boolean} [opts.fetchAllSeasonDetails] - by default only the
 *   current season's variants get their detail page scraped (ability,
 *   location, summon cost, drop rates) to keep runtime reasonable; older
 *   seasons rely on the wiki adapter for that narrative detail instead.
 *   Set true to fetch every season's detail pages too.
 */
export async function fetchFortniteGGCatalog({ log = () => {}, fetchAllSeasonDetails = false } = {}) {
  const { chromium } = await import("playwright");

  log("[fortnite.gg] Launching headless Chromium…");
  const browser = await chromium.launch();
  const page = await browser.newPage({ userAgent: USER_AGENT, viewport: { width: 1400, height: 1000 } });

  try {
    log("[fortnite.gg] Loading /sprites…");
    const resp = await page.goto(`${BASE_URL}/sprites`, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!resp || !resp.ok()) {
      throw new Error(`fortnite.gg/sprites returned ${resp ? resp.status() : "no response"}`);
    }
    await page.waitForSelector(".sprite-card", { timeout: 15000 });

    log("[fortnite.gg] Scrolling to load the full (virtualized) Sprite grid…");
    const cards = await collectListCards(page);
    log(`[fortnite.gg] Found ${cards.length} Sprite variant cards.`);

    const seasons = cards.map((c) => Number(c.season)).filter((n) => Number.isFinite(n));
    const currentSeason = seasons.length > 0 ? Math.max(...seasons) : null;
    log(`[fortnite.gg] Seasons present: ${[...new Set(seasons)].sort((a, b) => b - a).join(", ")} — current = ${currentSeason}`);

    const detailTargets = fetchAllSeasonDetails ? cards : cards.filter((c) => Number(c.season) === currentSeason);
    log(`[fortnite.gg] Fetching ${detailTargets.length} detail page(s)…`);

    const detailsById = new Map();
    for (const card of detailTargets) {
      if (!card.href) continue;
      try {
        const detail = await scrapeDetailPage(browser, card.href);
        detailsById.set(card.fortniteGGId, detail);
      } catch (err) {
        log(`[fortnite.gg]   detail fetch failed for ${card.href}: ${err.message}`);
      }
    }

    const results = cards.map((card) => {
      const detail = detailsById.get(card.fortniteGGId) ?? null;
      return {
        fortniteGGId: card.fortniteGGId,
        family: card.family,
        name: card.name,
        rarity: card.rarity ? card.rarity.toLowerCase() : null,
        variant: card.variant === "base" ? null : card.variant,
        season: Number(card.season),
        isCurrentSeason: Number(card.season) === currentSeason,
        isNew: card.isNew,
        icon: card.iconPath ? `${BASE_URL}${card.iconPath}` : null,
        detailUrl: card.href ? `${BASE_URL}${card.href}` : null,
        ability: detail?.ability ?? null,
        acquisitionHint: detail?.location ?? null,
        summonCostSpriteDust: detail ? nullIfZero(detail.summonCost) : null,
        dropRates: detail
          ? Object.fromEntries(Object.entries(detail.dropRates).map(([k, v]) => [k, nullIfZero(v)]))
          : null,
      };
    });

    return { sprites: results, currentSeason };
  } finally {
    await browser.close();
  }
}
