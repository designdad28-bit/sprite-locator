/**
 * Fixed per-variant tile colors, taken from the variants' own artwork.
 *
 * Each hue is measured, not chosen: for every variant slot, all 20 of this
 * season's icons were sampled in-browser (same-origin canvas read on
 * fortnite.gg, so the pixels are readable), averaging the colored pixels —
 * alpha > 200 and saturation > 0.30, which skips the shared white/grey body
 * and keeps the part that actually distinguishes a variant. Measured hues:
 * gold 86°, cheat master 140° (green), loot hacker 277° (indigo), bounty
 * hunter 318° (purple).
 *
 * Those raw averages are too dark to sit under the artwork (L ≈ 0.53), so
 * each is lifted to the rung the gold tile already occupied — OKLCH
 * L 0.727 / C 0.148 — keeping its own hue. That rung is not arbitrary: the
 * shipped gold tile (#CF9F02) turns out to be exactly its artwork's hue
 * (86.8° measured vs 86.0° sampled) at that lightness and chroma, so this
 * generalizes what gold was already doing to the other three rather than
 * inventing a new treatment.
 *
 * Hacker's chroma is clamped to 0.143, the most its hue holds at this
 * lightness before falling outside sRGB; left at 0.148 the blue channel
 * clipped and the hue skewed.
 */
const VARIANT_COLOR: Record<string, string> = {
  gold: "#D09E05", // artwork 86°  — within a hair of the previous #CF9F02
  cheatmaster: "#71BD60", // artwork 140°
  hacker: "#919DFF", // artwork 277°, chroma clamped to sRGB
  reaper: "#CD87E2", // artwork 318° — the Bounty Hunter art is purple
};

/**
 * The base/normal variant's accent: the same grey as the search field, so the
 * neutral column reads as collected without borrowing a hue that would imply a
 * fourth variant type. See --sprite-base-collected in app/globals.css.
 */
const BASE_VARIANT_COLOR = "var(--sprite-base-collected)";

export function variantColor(variant: string | null): string | null {
  if (!variant) return BASE_VARIANT_COLOR;
  const key = variant.toLowerCase().replace(/[^a-z]/g, "");
  return VARIANT_COLOR[key] ?? null;
}

/** Normalizes a catalog variant string to a stable slot key ("gold", "cheatmaster", …). */
export function variantKey(variant: string | null): string {
  return variant ? variant.toLowerCase().replace(/[^a-z]/g, "") : "normal";
}

/**
 * The five variant slots, in display order. Shared by the catalog tiles and the
 * detail panel's summon costs so the two always agree on order.
 *
 * "reaper" is the catalog's own key for the variant shown as "Bounty Hunter"
 * — the game's internal name and its display name simply differ, so the key
 * is left as the data spells it rather than renamed to match the label.
 */
export const VARIANT_SLOTS = ["normal", "gold", "cheatmaster", "hacker", "reaper"];

/**
 * The variant's full name, as the catalog itself spells it ("Gold Jonesy
 * Sprite", "Cheat Master Jonesy Sprite", "Loot Hacker Jonesy Sprite") — for
 * places with room for words rather than the four-letter tile caption below.
 * Keyed by slot, because a family's base name is not always a prefix of its
 * variants' ("Bush" vs "Loot Hacker Bushranger").
 */
export const VARIANT_NAME: Record<string, string> = {
  normal: "Base",
  gold: "Gold",
  cheatmaster: "Cheat Master",
  hacker: "Loot Hacker",
  reaper: "Bounty Hunter",
};

/** The short label a variant is shown under everywhere in the UI. */
export function variantLabel(variant: string | null): string {
  const key = variantKey(variant);
  if (key === "normal") return "BASE";
  if (key === "cheatmaster") return "CHEAT";
  // "BOUNTY", not "REAPER": the tile caption should match the name players
  // see in game, even though the catalog's key for it is "reaper".
  if (key === "reaper") return "BOUNTY";
  return key.toUpperCase();
}
