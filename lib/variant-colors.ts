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
 * Each hue then takes the MOST SATURATED form sRGB can give it, at the
 * highest lightness that still reaches gold's vibrancy (HSV saturation
 * >= 0.95, capped at gold's own OKLCH L 0.727). An earlier pass put all four
 * on one lightness rung instead, which looked even in the abstract but left
 * green, indigo and purple visibly pastel beside gold — equal OKLCH chroma
 * is not equal vibrancy, because sRGB holds far less chroma for those hues
 * than it does for yellow.
 *
 * The cost is that lightness now varies: indigo bottoms out at L 0.485
 * because hue 277° simply cannot be vivid any lighter — at gold's 0.727 its
 * ceiling is HSV 0.43, which is the pastel we were trying to escape. So the
 * indigo tile is noticeably darker than the other three. That is a real
 * tradeoff, chosen deliberately: vibrancy matched, lightness sacrificed.
 */
const VARIANT_COLOR: Record<string, string> = {
  gold: "#D09E00", // artwork 86°,  L 0.727 — unchanged in practice
  cheatmaster: "#3EC700", // artwork 140°, L 0.727
  hacker: "#4B0CFF", // artwork 277°, L 0.485 — darker so it can be vivid
  reaper: "#D203FF", // artwork 318°, L 0.637
};

/**
 * The base/normal variant's accent: grey, because base Sprites — unlike the
 * four variants — share no colour to borrow (their artwork hues span the whole
 * wheel; see --sprite-base-collected in app/globals.css for the measurement).
 * It is pitched at the mean lightness of the four coloured tiles so the
 * neutral column reads as their peer rather than as an empty slot.
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
