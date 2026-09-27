/**
 * The primary action's look, shared by every button that performs it: the one
 * over the map, the one on the phone's bottom bar, and the dialog's confirm.
 * One constant so the three cannot drift apart.
 *
 * Yellow on the app's indigo: the highest-contrast pair the palette holds,
 * which is what the single action on a screen should be. The same yellow is
 * also mastery gold and the map pins, so "yellow" means "yours / do this".
 */
export const ADD_FINDING_STYLE =
  // The primary sticker-button: a yellow-to-amber pill in a thick ink outline
  // with a hard ink drop, labelled in Anton caps. Hover brightens it and lifts
  // it a pixel off its shadow; press sinks it in (the pop utility). Disabled,
  // it drops the gradient for the sidebar's own indigo with lavender type, so
  // it reads as "not yet" rather than as a broken, faded yellow.
  "pop !rounded-full !shadow-[0_4px_0_var(--pop-ink)] active:!shadow-[0_1px_0_var(--pop-ink)] display-caps !font-normal bg-[linear-gradient(180deg,#ffd84d,#f5a623)] text-pop-ink text-lg transition-[filter,translate,box-shadow] hover:-translate-y-px hover:brightness-105 hover:!shadow-[0_5px_0_var(--pop-ink)] focus-visible:ring-3 focus-visible:ring-white/70 disabled:bg-none disabled:bg-card disabled:text-muted-foreground disabled:opacity-100 disabled:hover:translate-y-0 disabled:hover:brightness-100";
