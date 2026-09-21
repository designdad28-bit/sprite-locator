import type { Finding } from "./findings";
import type { Poi } from "./map/pois";

/**
 * Synthetic findings — one per live Sprite variant, each at a randomly chosen
 * location — for seeing the whole map populated at once.
 *
 * THIS IS NOT REAL DATA AND MUST NEVER BE TREATED AS ANY. It exists to look at
 * the map with every variant colour on it, nothing else. Three things keep it
 * from being mistaken for a real sighting:
 *
 *   - it is never written to Supabase, only built in the browser;
 *   - every id is prefixed `demo-` and every `source` is "demo", which the
 *     Finding type spells out as a separate case from "user-submitted";
 *   - it only exists at all when the page is opened with `?demo=1`, and the
 *     UI says so while it is on.
 *
 * No metadata is invented beyond the placement itself: `lootSource` is left
 * unset rather than filled with a plausible-looking guess, so nothing here
 * claims a Sprite drops from anything.
 */

/** A stable pseudo-random in [0,1) from a string — same FNV-1a as the map's pin scatter. */
function seedFrom(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export interface DemoSprite {
  id: string;
  currentlyLive: boolean;
}

/**
 * One finding per live Sprite, spread over the given locations.
 *
 * Deterministic: the same catalog and POI list always produce the same layout,
 * so the map doesn't reshuffle on every render or reload. Findings sit at their
 * location's centre point, exactly as real ones do — the pin scatter is what
 * spreads them out (see scatterOffsets in components/map/island-map.tsx).
 */
export function buildDemoFindings(sprites: DemoSprite[], pois: Poi[]): Finding[] {
  if (pois.length === 0) return [];
  return sprites
    .filter((s) => s.currentlyLive)
    .map((sprite) => {
      const poi = pois[Math.floor(seedFrom(sprite.id) * pois.length) % pois.length];
      return {
        id: `demo-${sprite.id}`,
        spriteId: sprite.id,
        poiId: poi.id,
        x: poi.x,
        y: poi.y,
        // Fixed rather than Date.now(): a timestamp that changed every render
        // would make these look like a stream of fresh sightings.
        timestamp: 0,
        source: "demo" as const,
      };
    });
}
