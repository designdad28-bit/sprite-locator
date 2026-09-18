/**
 * Fixed per-variant tile colors. The first three are the 500 step of their hue
 * from the Atlassian Design System's dark theme (values read from
 * @atlaskit/tokens, artifacts/tokens-raw/atlassian-dark) — one rung of a
 * single ramp, so the columns read as equals rather than one shouting over
 * the others.
 *
 * `reaper` (the Bounty Hunter variant, added with the 2026-09-17 patch) is
 * NOT a token value: it is derived to sit on that same rung, at the mean
 * lightness and chroma of the three above (OKLCH L 0.691 / C 0.159) with the
 * hue placed at 350° — the point furthest from the hues already in use
 * (gold 87°, cheat 129°, hacker 259°). Labelled honestly rather than
 * attributed to a token it doesn't come from.
 */
const VARIANT_COLOR: Record<string, string> = {
  gold: "#CF9F02", // Yellow500
  cheatmaster: "#82B536", // Lime500
  hacker: "#4688EC", // Blue500
  reaper: "#E26EA9", // derived, see above
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
