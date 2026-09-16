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
 * The catalog badge and the map pin both use `solid`, the hue's 700 palette
 * step, as one flat fill (the pin's outline too), so the two come from one
 * source per rarity and can't drift apart. bg, border and fg are no longer
 * read by either.
 */
export interface RarityAccent {
  /** Dark ground: map-pin fill. */
  bg: string;
  /** Mid-tone ring: map-pin ring. */
  border: string;
  /** Light foreground on the dark ground. */
  fg: string;
  /**
   * Solid fill for the catalog badge and the map pin, both of which carry the
   * sprite's rarity as one flat color: the hue's 700 palette step. That's the
   * lightest step where white text clears WCAG AA's 4.5:1 for small text (the
   * badge label is 10px). The brighter 400 steps only reached 2.0–2.8:1.
   * Contrast with white is noted per entry below.
   */
  solid: string;
}

export const RARITY_ACCENT: Record<string, RarityAccent> = {
  common: { bg: "#164555", border: "#42B2D7", fg: "#C6EDFB", solid: "#227D9B" }, // teal, Teal700 4.69:1
  uncommon: { bg: "#164B35", border: "#2ABB7F", fg: "#BAF3DB", solid: "#1F845A" }, // green, Green700 4.66:1
  rare: { bg: "#123263", border: "#4688EC", fg: "#CFE1FD", solid: "#1868DB" }, // blue, Blue700 5.20:1
  epic: { bg: "#48245D", border: "#BF63F3", fg: "#EED7FC", solid: "#964AC0" }, // purple, Purple700 5.20:1
  legendary: { bg: "#693200", border: "#F68909", fg: "#FCE4A6", solid: "#BD5B00" }, // orange, Orange700 4.51:1
  mythic: { bg: "#5D1F1A", border: "#F15B50", fg: "#FFD5D2", solid: "#C9372C" }, // red, Red700 5.16:1
  special: { bg: "#533F04", border: "#CF9F02", fg: "#F5E989", solid: "#946F00" }, // yellow, Yellow700 4.63:1
};

const UNKNOWN_ACCENT: RarityAccent = { bg: "#4B4D51", border: "#7E8188", fg: "#E2E3E4", solid: "#6B6E76" }; // gray, Neutral700 5.10:1

export function rarityAccent(rarity: string | null | undefined): RarityAccent {
  if (!rarity) return UNKNOWN_ACCENT;
  return RARITY_ACCENT[rarity.toLowerCase()] ?? UNKNOWN_ACCENT;
}
