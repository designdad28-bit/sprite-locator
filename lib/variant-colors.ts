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
 * Per-variant tile gradients: the same colour, shaded top-dark to bottom-light.
 *
 * Expressed in OKLCH so the intent is legible — every stop keeps its variant's
 * measured artwork hue and only lightness moves, by -0.09 at the top and +0.09
 * at the bottom of the solid value in VARIANT_COLOR above. The solid therefore
 * remains the gradient's midpoint, so a tile still reads as the same colour it
 * was.
 *
 * Chroma is not constant across the two stops: it is capped at whatever sRGB
 * holds at each lightness, which is why the lighter stop of indigo (0.236 from
 * 0.295) and purple (0.223 from 0.308) is less saturated than its solid. Those
 * hues run out of gamut as they lighten — the alternative would be letting the
 * browser gamut-map them for us, with less control over where.
 *
 * VARIANT_COLOR stays the single solid value, since the detail panel paints it
 * on borders and text where a gradient is not a valid value.
 */
const VARIANT_GRADIENT: Record<string, string> = {
  gold: "linear-gradient(to bottom, oklch(0.636 0.130 86), oklch(0.816 0.149 86))",
  cheatmaster: "linear-gradient(to bottom, oklch(0.637 0.205 140), oklch(0.817 0.234 140))",
  hacker: "linear-gradient(to bottom, oklch(0.395 0.245 276.9), oklch(0.575 0.236 276.9))",
  reaper: "linear-gradient(to bottom, oklch(0.546 0.265 318), oklch(0.726 0.223 318))",
};

/**
 * The base tile's gradient. Its stops live beside the solid in globals.css
 * rather than here, so the three cannot drift apart — that value is chosen by
 * measurement against the artwork (see the comment there) and is the one most
 * likely to be retuned.
 */
const BASE_VARIANT_GRADIENT =
  "linear-gradient(to bottom, var(--sprite-base-collected-top), var(--sprite-base-collected-bottom))";

/** The tile fill for a variant: its colour shaded dark-to-light, top to bottom. */
export function variantGradient(variant: string | null): string | null {
  if (!variant) return BASE_VARIANT_GRADIENT;
  return VARIANT_GRADIENT[variantKey(variant)] ?? null;
}

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

/**
 * The colour of the caption above a collected tile, matching the fill the
 * sprite sits on.
 *
 * Three of the five can use their tile colour verbatim. Two cannot: as 10px
 * text on the panel (--card, #18181B) the indigo solid measures 2.36:1 and
 * the purple 4.38:1, below the 4.5:1 needed for small text — indigo in
 * particular being all but unreadable. Both are lifted in lightness, and only
 * as far as clearing 4.5:1 requires, keeping their hue and chroma so they
 * still read as the same colour as the tile: indigo L 0.485 -> 0.620,
 * purple 0.636 -> 0.645 (the latter barely perceptible). Indigo's chroma is
 * also pulled to 0.207, the most its hue holds at that lightness, so the value
 * is inside sRGB and the browser is not left to gamut-map it somewhere
 * unpredictable.
 *
 * Applied whether or not the sprite is collected, so the row reads as a legend
 * of the five variants rather than only labelling what you own. The dashed
 * placeholder slots are the exception and stay dimmed: a family with no such
 * variant has no fill to match.
 */
const VARIANT_LABEL_COLOR: Record<string, string> = {
  gold: "#D09E00", // the tile colour, 7.23:1
  cheatmaster: "#3EC700", // the tile colour, 7.91:1
  hacker: "oklch(0.625 0.204 276.9)", // lifted from L 0.485 for legibility, 4.59:1
  reaper: "oklch(0.65 0.295 318)", // lifted from L 0.636, 4.59:1
};

/** Matches the caption above a tile to the fill beneath it. Null when there is no variant colour to match. */
export function variantLabelColor(variant: string | null): string | null {
  if (!variant) return "var(--sprite-base-collected)";
  return VARIANT_LABEL_COLOR[variantKey(variant)] ?? null;
}

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
