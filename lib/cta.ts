/**
 * The primary action's look, shared by every button that performs it: the one
 * over the map, the one on the phone's bottom bar, and the dialog's own
 * confirm. One constant so the three cannot drift apart.
 *
 * Yellow on the app's darkest blue — the highest-contrast pair the palette
 * holds, which is what the single action on a screen should be.
 *
 * Weight is Button's own font-medium rather than an override. Equal weight
 * does not read as equal across a polarity flip: antialiased edge pixels
 * composite in non-linear sRGB, so dark text on the yellow lays down measurably
 * less ink than light text on a panel. Rasterised both ways, 400 on the yellow
 * came out 13.5% lighter than the app's body text; 500 lands within 0.4%.
 *
 * Worth knowing: --sprite-gold is also the mastery colour (crowns, the
 * mastered tile ring, the mastery bar), so it marks two things.
 */
export const ADD_FINDING_STYLE =
  // Sprite Scout's primary button: a yellow-to-amber pill in thick ink
  // outline with a hard drop shadow, labelled in the display caps. It sinks
  // into its shadow when pressed (see the pop utility in globals.css).
  "pop display-caps bg-[linear-gradient(180deg,#ffd84d,#f5a623)] text-pop-ink text-lg hover:brightness-105 focus-visible:ring-pop-yellow/50";

/**
 * The stroke the primary action's icon takes, where the app's baseline is
 * 1.875 at 16px. Not polarity compensation — a stroke loses only 1.1% across
 * the flip, measured — but pairing: beside 500-weight text, a baseline-weight
 * icon reads thin. 2.2 at 16px is 1.467px of ink against the app's 1.25px.
 */
export const ADD_FINDING_ICON_STROKE = 2.2;
