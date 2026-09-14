#!/usr/bin/env node
/**
 * Standalone rebuild of the WIKI-ONLY Sprite dataset, for debugging/cross-
 * reference. Writes public/data/sprites.wiki.json — NOT the file the app
 * reads (that's public/data/sprites.json, produced by the primary
 * fortnite.gg pipeline: scripts/scrape-fortnite-gg-sprites.mjs).
 *
 * Run this when you want to inspect what the wiki alone currently has,
 * independent of fortnite.gg:
 *   node scripts/build-sprite-catalog.mjs
 */
import { writeFile } from "node:fs/promises";
import { fetchWikiCatalog } from "../lib/sprite-catalog/sources/wiki.mjs";

const OUT_FILE = new URL("../public/data/sprites.wiki.json", import.meta.url);

async function main() {
  const sprites = await fetchWikiCatalog({ log: console.log });
  const familyCount = new Set(sprites.map((s) => s.familyId)).size;

  const catalog = {
    source: "https://fortnite.fandom.com (Category:Sprites, MediaWiki Action API)",
    generated: new Date().toISOString(),
    familyCount,
    variantCount: sprites.length,
    sprites,
  };

  await writeFile(OUT_FILE, JSON.stringify(catalog, null, 2));
  console.log(`\nWrote ${sprites.length} sprite entries (${familyCount} families) to ${OUT_FILE.pathname}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
