/**
 * Where a sprite can be found, for the Add finding modal's Loot source field.
 *
 * A fixed, authored list (the same for every sprite), in display order. It
 * replaces the catalog's per-sprite dropRates keys, which only ever listed
 * "SPRITE CHEST".
 *
 * Icons are real game art with transparent backgrounds, downloaded once into
 * public/loot-sources/ so the app never fetches them at runtime. Sources, via
 * the Fortnite Fandom wiki's API:
 *   - standard-chest.png  ← File:Chest - Container - Fortnite.png (512×512)
 *   - sprite-chest.png    ← File:Sprite Chest - Container - Fortnite.png (512×512)
 * The wiki has no image for the Relic Chest or any Cheat Code (the Cheat Code
 * files its pages link to were never uploaded), so those are `null` rather
 * than a stand-in or a recolored copy of another icon.
 */
export interface LootSource {
  /** Stored on a finding as `lootSource`. Stable: never change an existing id. */
  id: string;
  label: string;
  /** Public path to a transparent icon, or null when no real image exists. */
  icon: string | null;
}

export const LOOT_SOURCES: LootSource[] = [
  { id: "standard-chest", label: "Standard Chest", icon: "/loot-sources/standard-chest.png" },
  { id: "relic-chest", label: "Relic Chest", icon: null },
  { id: "rare-cheat-code", label: "Rare Cheat Code", icon: null },
  { id: "epic-cheat-code", label: "Epic Cheat Code", icon: null },
  { id: "legendary-cheat-code", label: "Legendary Cheat Code", icon: null },
  { id: "sprite-chest", label: "Sprite Chest", icon: "/loot-sources/sprite-chest.png" },
];

export function lootSourceById(id: string | null | undefined): LootSource | null {
  return LOOT_SOURCES.find((s) => s.id === id) ?? null;
}
