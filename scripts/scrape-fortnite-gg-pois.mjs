#!/usr/bin/env node
/**
 * Builds public/data/pois.json — the island's named locations (POIs), from
 * fortnite.gg's own map data file (`data/en.js`), the same source our real
 * map tiles come from. Unlike the Sprite pages, this file is a plain static
 * asset (not behind Cloudflare's bot check), so this script needs nothing
 * beyond `fetch` — no Playwright, no browser.
 *
 * Coordinate conversion: fortnite.gg's own Leaflet map uses CRS.Simple with
 * bounds [[-256, 0], [0, 256]] (lat, lng) at native zoom 7 — the exact same
 * native zoom and 256px tile size our own map uses (components/map/island-map.tsx),
 * so the standard CRS.Simple relationship holds directly:
 *   lat = -pixelY / 2^zoom,  lng = pixelX / 2^zoom   (zoom = 7, scale = 128)
 * Inverting to our normalized [0,1] map-fraction coordinates:
 *   xFrac = lng / 256,   yFrac = -lat / 256
 *
 * Re-run whenever the map/season changes (POI names and positions do rotate
 * between seasons, same as everything else here):
 *   node scripts/scrape-fortnite-gg-pois.mjs
 */
import { writeFile } from "node:fs/promises";

const OUT_FILE = new URL("../public/data/pois.json", import.meta.url);
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Fetching fortnite.gg/data/en.js…");
  const res = await fetch("https://fortnite.gg/data/en.js", { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`fortnite.gg/data/en.js failed: ${res.status}`);
  const text = await res.text();

  const marker = '"markers":[{"name":"';
  const idx = text.indexOf(marker);
  if (idx === -1) throw new Error("Could not find the named-locations markers array in data/en.js");

  // Bracket-depth scan for the array's real end — the naive "first ]}" match
  // stops at the first marker's own `coords` array instead of the whole list.
  const arrayStart = idx + '"markers":'.length;
  let depth = 0;
  let i = arrayStart;
  for (; i < text.length; i++) {
    if (text[i] === "[") depth++;
    else if (text[i] === "]") {
      depth--;
      if (depth === 0) {
        i++;
        break;
      }
    }
  }
  const arrayText = text.slice(arrayStart, i);
  const rawMarkers = JSON.parse(arrayText);

  const pois = rawMarkers.map((m) => {
    const [lat, lng] = m.coords;
    return {
      id: slugify(m.name),
      name: m.name,
      x: lng / 256,
      y: -lat / 256,
    };
  });

  const out = {
    source: "fortnite.gg (data/en.js, Locations > Named Locations)",
    generated: new Date().toISOString(),
    count: pois.length,
    pois,
  };

  await writeFile(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`Wrote ${pois.length} named locations to ${OUT_FILE.pathname}`);
  for (const p of pois) console.log(`  ${p.name}  ->  (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
