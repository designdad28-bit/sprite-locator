/**
 * Abstraction over the underlying map TILE provider.
 *
 * The map renders as a real XYZ tile pyramid (Leaflet `TileLayer` over
 * `CRS.Simple`).
 *
 * ACTIVE PROVIDER: fortnite.gg's public map tiles.
 *
 * Verified directly (curl, no browser/session):
 *   - `https://fortnite.gg/maps/<mapVersion>/{z}/{x}/{y}.webp` returns
 *     HTTP 200 with a real `image/webp` tile — no Cloudflare challenge,
 *     no auth, no signed params, no referer/hotlink check, long-lived
 *     cache headers (`max-age=31536000`) meant for embedding.
 *   - `robots.txt` does not disallow `/maps/` or `/data/`.
 *   - Only the HTML *pages* (e.g. fortnite.gg/map) sit behind Cloudflare's
 *     bot challenge — the static tile/JS/data assets do not.
 *   - Confirmed via fortnite.gg's own `map.js` (and the Fngg-Map-Studio
 *     research writeup, https://github.com/wavedropmaps/Fngg-Map-Studio):
 *     256px tiles, standard XYZ addressing, native zoom 0–7 (32,768px
 *     master at z7), main battle-royale map served as `.webp`.
 *
 * `mapVersion` below is fortnite.gg's current patch folder
 * (`window.Data.map` from https://fortnite.gg/data/en.js). It changes
 * every season/patch — bump it when the map goes stale. There's no
 * "latest" alias on their CDN, so this has to be updated by hand (or by
 * a small script that fetches `data/en.js` and extracts `Data.map`).
 */
export interface MapTileProviderConfig {
  id: string;
  label: string;
  /** XYZ tile URL template, e.g. "/tiles/{z}/{x}/{y}.png" or a remote host. */
  urlTemplate: string;
  /** Pixel size of one tile. */
  tileSize: number;
  /** Native zoom level the tile pyramid was authored/rendered at. */
  nativeZoom: number;
  minZoom: number;
  /** Allow zooming past nativeZoom by upscaling the native tiles (Leaflet overzoom). */
  maxZoom: number;
  attribution?: string;
}

const FORTNITE_GG_MAP_VERSION = "42.03"; // fortnite.gg current patch folder — bump each season

export const FORTNITE_GG_PROVIDER: MapTileProviderConfig = {
  id: "fortnite-gg",
  label: `The Island — fortnite.gg map ${FORTNITE_GG_MAP_VERSION}`,
  urlTemplate: `https://fortnite.gg/maps/${FORTNITE_GG_MAP_VERSION}/{z}/{x}/{y}.webp`,
  tileSize: 256,
  nativeZoom: 7,
  // Negative on purpose (CRS.Simple has no zoom floor of its own). It lets the
  // fit shrink the island below one native z0 tile (256px) so the whole island
  // still fits a narrow map container — e.g. beside the open sidebar in a small
  // window. Below z0 the tile layer just scales z0 down (minNativeZoom), and
  // TileWorldSetup raises the effective floor to the fitted zoom, so users
  // still can't zoom out past "the whole island".
  minZoom: -4,
  maxZoom: 9,
  attribution: 'Map imagery &copy; <a href="https://fortnite.gg" target="_blank" rel="noopener noreferrer">fortnite.gg</a>',
};

export const ACTIVE_MAP_PROVIDER: MapTileProviderConfig = FORTNITE_GG_PROVIDER;

export interface NormalizedBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * How much larger than a plain "fit the island" the initial view is.
 * Applied by shrinking the fitted box around its own center, so the framing
 * stays centered. 1 = the whole island fits inside the map container; >1
 * zooms past that and crops the island's tips at the container's edges.
 */
export const ISLAND_FIT_SCALE = 1;

/**
 * The island's actual extent within the tile square, as [0,1] fractions.
 *
 * The tile pyramid is a square, but the island only fills ~84% x 86% of it and
 * isn't centered in it (its center is ~0.451, 0.504). Fitting the *square*
 * therefore renders the island smaller than it needs to be and centers the
 * void rather than the land. Fitting these bounds instead makes it as large as
 * possible and genuinely centered.
 *
 * Measured, not estimated: the z=3 tiles were stitched into a 2048px composite
 * and the bounding box of every non-void pixel taken (void being the flat
 * MAP_BACKGROUND_COLOR the tiles paint outside the coastline). Re-measure when
 * the season's map changes.
 */
export const ISLAND_BOUNDS: NormalizedBounds = {
  minX: 0.030273,
  minY: 0.075195,
  maxX: 0.871094,
  maxY: 0.932617,
};

/**
 * Background color shown wherever the map has no tile — letterboxing around
 * the island when its aspect ratio doesn't fill the container.
 *
 * This is NOT a free style choice: fortnite.gg's own tiles paint their void
 * area (ocean/edge-of-map, outside the island's coastline) as a flat
 * `rgb(46, 49, 55)` — sampled directly from their tile pixels (e.g.
 * https://fortnite.gg/maps/42.03/7/0/0.webp), not invented. Setting our
 * letterbox to that exact color makes the seam between "real tile" and "our
 * background" disappear, since both areas are now the same real color
 * instead of us trying to fade our own color into theirs.
 *
 * If fortnite.gg ever changes their void color, re-sample a corner tile at
 * native zoom and update this constant to match — don't guess.
 */
export const MAP_BACKGROUND_COLOR = "#2e3137";

/** Full map width/height in pixels at the provider's native zoom. */
export function worldSizePx(provider: MapTileProviderConfig): number {
  return provider.tileSize * 2 ** provider.nativeZoom;
}
