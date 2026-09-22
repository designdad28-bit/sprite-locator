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
  // gold-light (globals.css): top-lit gradient and a one-time sheen. The glow
  // beneath is the button's own gold, so it reads as lit rather than shadowed.
  // Press scales down a touch, the way a physical key gives.
  "gold-light bg-sprite-gold text-card shadow-[0_10px_28px_-10px_var(--sprite-gold)] hover:brightness-[1.06] hover:shadow-[0_12px_32px_-8px_var(--sprite-gold)] active:scale-[0.97] focus-visible:ring-sprite-gold/40";

/**
 * The stroke the primary action's icon takes, where the app's baseline is
 * 1.875 at 16px. Not polarity compensation — a stroke loses only 1.1% across
 * the flip, measured — but pairing: beside 500-weight text, a baseline-weight
 * icon reads thin. 2.2 at 16px is 1.467px of ink against the app's 1.25px.
 */
export const ADD_FINDING_ICON_STROKE = 2.2;
