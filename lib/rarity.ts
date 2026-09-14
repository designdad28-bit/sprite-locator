/**
 * Presentation-only helpers for the `rarity` string the Sprite API returns
 * (e.g. "common", "rare", "epic", "legendary", "special"). Not part of the
 * API data itself — purely how we color/badge it in our UI.
 */
export const RARITY_COLOR: Record<string, string> = {
  common: "#8fd6ff",
  uncommon: "#8fe6a8",
  rare: "#4f7cff",
  epic: "#e332ee",
  legendary: "#ffb238",
  mythic: "#ff6b6b",
  special: "#fdc700",
};

export function rarityColor(rarity: string | null | undefined): string {
  if (!rarity) return "#9ca3af";
  return RARITY_COLOR[rarity.toLowerCase()] ?? "#9ca3af";
}

/**
 * Rarity accents from the Atlassian Design System's dark theme, three steps per
 * hue: `color.background.accent.<hue>.subtler` as the ground,
 * `color.border.accent.<hue>` as the ring, and
 * `color.text.accent.<hue>.bolder` as the foreground.
 *
 * Values are the published token values, read out of @atlaskit/tokens
 * (artifacts/tokens-raw/atlassian-dark), not eyeballed from a screenshot.
 * Hues keep each rarity's established association, so nothing changes meaning.
 *
 * One source for both surfaces: the catalog badge paints bg/fg directly, and a
 * map pin uses bg as its fill and fg as its ring, so the two can't drift.
 */
export interface RarityAccent {
  /** Dark ground: badge background, map-pin fill. */
  bg: string;
  /** Mid-tone ring: badge border. */
  border: string;
  /** Light foreground: badge text, map-pin ring. */
  fg: string;
}

export const RARITY_ACCENT: Record<string, RarityAccent> = {
  common: { bg: "#164555", border: "#42B2D7", fg: "#C6EDFB" }, // teal
  uncommon: { bg: "#164B35", border: "#2ABB7F", fg: "#BAF3DB" }, // green
  rare: { bg: "#123263", border: "#4688EC", fg: "#CFE1FD" }, // blue
  epic: { bg: "#48245D", border: "#BF63F3", fg: "#EED7FC" }, // purple
  legendary: { bg: "#693200", border: "#F68909", fg: "#FCE4A6" }, // orange
  mythic: { bg: "#5D1F1A", border: "#F15B50", fg: "#FFD5D2" }, // red
  special: { bg: "#533F04", border: "#CF9F02", fg: "#F5E989" }, // yellow
};

const UNKNOWN_ACCENT: RarityAccent = { bg: "#4B4D51", border: "#7E8188", fg: "#E2E3E4" }; // gray

export function rarityAccent(rarity: string | null | undefined): RarityAccent {
  if (!rarity) return UNKNOWN_ACCENT;
  return RARITY_ACCENT[rarity.toLowerCase()] ?? UNKNOWN_ACCENT;
}
