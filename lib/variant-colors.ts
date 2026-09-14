/**
 * Fixed per-variant tile colors, from the Atlassian Design System's dark theme
 * (values read from @atlaskit/tokens, artifacts/tokens-raw/atlassian-dark).
 *
 * All three are the 500 step of their hue — one rung of a single ramp, so the
 * columns read as equals rather than one shouting over the others.
 */
const VARIANT_COLOR: Record<string, string> = {
  gold: "#CF9F02", // Yellow500
  cheatmaster: "#82B536", // Lime500
  hacker: "#4688EC", // Blue500
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
