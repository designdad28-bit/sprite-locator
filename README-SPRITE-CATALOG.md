# Sprite catalog data pipeline

## Data sources

**Primary: fortnite.gg** (`fortnite.gg/sprites`). fortnite.gg extracts Fortnite's
own game data and republishes it within hours of a patch — the same pipeline
it's used for years for its map tiles. Every Sprite *variant* renders as a
`.sprite-card` element carrying clean structured attributes, effectively a
structured API baked into the DOM:

```html
<div class="sprite-card" data-sprite="179" data-parent-name="Klombo"
     data-rarity="mythic" data-variant="base" data-season="42">
  <a href="/sprites/179-klombo-sprite">
    <img src="/img/x/sprites/icons/T_Icon_BR_Creature_Sprite_Klombo_L.webp" alt="Klombo Sprite">
```

Its detail pages (`/sprites/179-klombo-sprite`) add ability text, a spawn
location hint, summon cost, and drop chance by source.

fortnite.gg's *HTML pages* sit behind a Cloudflare bot check that blocks
plain `fetch`/`curl` (403) — but a real, unmodified browser passes it with no
interaction, no CAPTCHA-solving, no bypassing. That's the only reason this
adapter needs Playwright instead of a plain HTTP client. The static image
assets are **not** behind that check (same as fortnite.gg's map tiles).

**Fallback / cross-reference: the Fortnite Fandom wiki** (`fortnite.fandom.com`,
`Category:Sprites`), via the public, unauthenticated MediaWiki API. Good for
long-form ability text, boon descriptions, and historical variants, but it's
community-edited and lags real patches by days to weeks — it never overrides
fortnite.gg for current identity, rarity, image, season, or live/vaulted
status. See `lib/sprite-catalog/sources/wiki.mjs`.

Neither source needs an API key.

## Architecture

```
fortnite.gg/sprites (Playwright)  ──┐
                                     ├─→ merge → public/data/sprites.json → SpriteLocker
fortnite.fandom.com (wiki, HTTP)  ──┘
```

```
lib/sprite-catalog/
  types.ts                 — NormalizedSprite / SpriteCatalog (what the app consumes)
  repository.ts             — loadSpriteCatalog(): fetches /data/sprites.json — the ONLY
                               thing the running app calls
  sources/
    fortnite-gg.mjs         — Playwright scraper (primary)
    wiki.mjs                — MediaWiki API scraper (fallback)
scripts/
  scrape-fortnite-gg-sprites.mjs  — orchestrator: runs both sources, merges,
                                     writes public/data/sprites.json (npm run sprites:scrape)
  build-sprite-catalog.mjs        — wiki-only rebuild, for debugging/inspection;
                                     writes public/data/sprites.wiki.json, NOT the
                                     file the app reads (npm run sprites:build)
```

**The running app never calls fortnite.gg or the wiki.** It only ever fetches
the static `public/data/sprites.json` — instant load, no Cloudflare, no
external dependency at runtime. See `lib/sprite-catalog/repository.ts`.

## Merge rules

For each Sprite variant fortnite.gg reports, we look up a matching wiki entry
by `(family name, variant slug)` and merge:

| Field | Winner |
|---|---|
| existence, variant, rarity, icon, season, `currentlyLive`/`availability` | **fortnite.gg** always |
| `ability` (short blurb) | fortnite.gg |
| `description` (long-form) | wiki, falls back to fortnite.gg's `ability` |
| `boons` | wiki only (fortnite.gg's current variant scheme doesn't expose these separately) |
| `acquisitionHint` | fortnite.gg's location hint, falls back to wiki's "how to obtain" text |
| `summonCostSpriteDust`, `dropRates` | fortnite.gg, falls back to wiki |

Wiki entries with **no** fortnite.gg match at all (families/variants
fortnite.gg isn't currently tracking) are kept as `source: "wiki"` records
with `currentlyLive: false`, rather than silently dropped.

## Handling "0% means unknown, not zero"

fortnite.gg's detail pages show `0` for summon cost and `0%` for every drop
source on **every current-season Sprite**, while sprites from the *previous*
season show real, non-zero published numbers (verified directly: Duck
Sprite, season 41, shows 6.48% / 2,700 Sprite Dust). That's a strong, direct
signal that `0` means "not yet published," not a real zero. `fortnite-gg.mjs`
converts any exact `0` to `null` (`nullIfZero()`) rather than store a
fabricated zero probability.

## The normalized model

```ts
interface NormalizedSprite {
  id, name, family, variant, rarity, icon,
  description, ability, boons, acquisitionHint,
  summonCostSpriteDust, dropRates,           // null fields = genuinely unknown, never fabricated
  season, seasonDate,
  existsInGameData, currentlyLive, availability,  // "live" | "coming_soon" | "vaulted" | "unreleased" | "unknown"
  source, lastVerified,
}
```

`existsInGameData` is true for anything either source has ever seen.
`currentlyLive` is true only for the season fortnite.gg reports as the
current maximum `data-season` value across all cards — **never hardcoded**;
each run detects the live season dynamically.

## Running it locally

```bash
npm install
npx playwright install chromium   # one-time, downloads a Chromium build
npm run sprites:scrape            # writes public/data/sprites.json (primary pipeline)
npm run sprites:build             # optional: wiki-only refresh, for debugging (sprites.wiki.json)
```

`sprites:scrape` prints a data-quality report (family/variant counts, how
many are currently live, how many have images/descriptions/abilities/drop
rates, detected season, timestamp) and one full example record at the end.

## Updating the catalog

Re-run `npm run sprites:scrape` any time — it fully regenerates
`public/data/sprites.json` from scratch each time (no incremental patching),
so it's safe to run repeatedly. [.github/workflows/update-sprites.yml](.github/workflows/update-sprites.yml)
runs it on a schedule (every 6 hours) and commits the file if it changed —
deliberately simple, no matrix builds, no release process. Trigger it
manually from the Actions tab (`workflow_dispatch`) after a patch if you
don't want to wait for the schedule.

No environment variables or secrets are required — both sources are public.

## Adding another data source later

Add `lib/sprite-catalog/sources/<name>.mjs` exporting an async function that
returns raw records in whatever shape that source naturally gives you (see
`fortnite-gg.mjs`/`wiki.mjs` for the pattern — no need to normalize inside
the adapter). Then wire it into `scripts/scrape-fortnite-gg-sprites.mjs`'s
merge step, deciding where it sits in the precedence order. The app itself
(`lib/sprite-catalog/repository.ts` onward) never needs to change — it only
ever reads the merged `public/data/sprites.json`.
