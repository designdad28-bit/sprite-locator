/**
 * A user-submitted finding. This is OUR data (would live in our own
 * database once there is a backend) — it references a Sprite by id only
 * and never duplicates Sprite metadata (name/rarity/image/etc.), which
 * always comes from the Sprite catalog (see lib/sprite-catalog).
 */
export interface Finding {
  id: string;
  spriteId: string;
  /**
   * The named location this finding was logged against, when it was placed
   * by picking a location rather than clicking an exact spot. Records what
   * `x`/`y` were anchored to, so a finding stays traceable if the POI list
   * is re-scraped and coordinates shift. Absent for map-click findings,
   * where the point itself is what the user meant.
   */
  poiId?: string;
  /**
   * Where the sprite was obtained: one of the fixed LOOT_SOURCES ids in
   * lib/loot-sources.ts (e.g. "sprite-chest"), never free text. Optional:
   * findings logged before this field existed have none.
   */
  lootSource?: string;
  /** Position as a fraction of map width/height, each in [0, 1]. Resolution-independent — works with any tile provider. */
  x: number;
  y: number;
  notes?: string;
  timestamp: number;
  /**
   * Where the finding came from. "demo" marks synthetic data generated for
   * looking at the map (see lib/demo-findings.ts) — it is never written to the
   * database and never leaves the browser, and the type carries the
   * distinction so the two can't be confused in code either.
   */
  source: "user-submitted" | "demo";
}

/** When the log below was handed over — not a claimed discovery date, which the log didn't carry. */
const IMPORTED_AT = Date.parse("2026-09-11T00:00:00Z");

/**
 * Findings imported from the user's own log.
 *
 * NO LONGER READ BY THE APP. These 17 were uploaded to the Supabase
 * sprite_locations table on 2026-09-15 and now load from there like any other
 * finding (see hooks/use-findings.ts). Kept only as the original record of
 * what was imported, and as the fallback if the table is ever lost.
 *
 * Every `spriteId` and every `x`/`y` here was resolved programmatically
 * against the real catalog (public/data/sprites.json) and the real named
 * locations (public/data/pois.json) rather than typed by hand, so nothing
 * in this file is an invented id or an approximated coordinate. Each entry
 * sits at its location's center point — the log recorded findings by named
 * location, so that is the precision we have and the precision we store.
 *
 * `notes` carries the log's own "How Acquired" value verbatim.
 */
export const SEED_FINDINGS: Finding[] = [
  { id: "seed-01", spriteId: "8-bit-sprite", poiId: "stone-sanctum", x: 0.4169921875, y: 0.6396875, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-02", spriteId: "jonesy-sprite", poiId: "stone-sanctum", x: 0.4169921875, y: 0.6396875, notes: "Chest", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-03", spriteId: "onigiri-sprite", poiId: "stone-sanctum", x: 0.4169921875, y: 0.6396875, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-04", spriteId: "sonic-sprite", poiId: "golden-grove", x: 0.7308984375, y: 0.549375, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-05", spriteId: "bush-sprite", poiId: "golden-grove", x: 0.7308984375, y: 0.549375, notes: "Chest", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-06", spriteId: "bush-sprite", poiId: "cluster-coast", x: 0.6775390625, y: 0.8130859375, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-07", spriteId: "jonesy-sprite", poiId: "golden-grove", x: 0.7308984375, y: 0.549375, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-08", spriteId: "shadow-sprite", poiId: "cluster-coast", x: 0.6775390625, y: 0.8130859375, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-09", spriteId: "storm-scout-sprite", poiId: "cluster-coast", x: 0.6775390625, y: 0.8130859375, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-10", spriteId: "8-bit-sprite", poiId: "cluster-coast", x: 0.6775390625, y: 0.8130859375, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-11", spriteId: "tails-sprite", poiId: "green-hill-zone", x: 0.2819921875, y: 0.49875, notes: "Chest", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-12", spriteId: "shadow-sprite", poiId: "green-hill-zone", x: 0.2819921875, y: 0.49875, notes: "Chest", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-13", spriteId: "shadow-sprite", poiId: "green-hill-zone", x: 0.2819921875, y: 0.49875, notes: "Boss", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-14", spriteId: "8-bit-sprite", poiId: "green-hill-zone", x: 0.2819921875, y: 0.49875, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-15", spriteId: "8-bit-sprite", poiId: "latte-landing", x: 0.563515625, y: 0.2417578125, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-16", spriteId: "mega-man-sprite", poiId: "wonkeeland", x: 0.69609375, y: 0.322890625, notes: "Code", timestamp: IMPORTED_AT, source: "user-submitted" },
  { id: "seed-17", spriteId: "adventure-sprite", poiId: "golden-grove", x: 0.7308984375, y: 0.549375, notes: "Chest", timestamp: IMPORTED_AT, source: "user-submitted" },
];
