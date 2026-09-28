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
  // The primary sticker-button, built exactly like every other sticker (the
  // Sign In pill, the map controls, the rarity bands): one flat fill — the
  // palette's yellow, no gloss or gradient — a 3px ink outline and a hard 4px
  // ink drop, labelled in Anton caps a step up from the other buttons. Hover
  // lifts it a pixel off its shadow (it is already yellow, so it has nowhere
  // to turn); press sinks it into the drop. Disabled, it takes the sidebar's
  // own indigo with lavender type, so it reads as "not yet" rather than as a
  // broken, faded yellow.
  "pop !rounded-full !shadow-[0_4px_0_var(--pop-ink)] active:!shadow-[0_1px_0_var(--pop-ink)] display-caps !font-normal bg-pop-yellow text-pop-ink text-xl hover:bg-pop-yellow hover:text-pop-ink transition-[translate,box-shadow] hover:-translate-y-px hover:!shadow-[0_5px_0_var(--pop-ink)] active:translate-y-[3px] focus-visible:ring-3 focus-visible:ring-white/70 disabled:bg-card disabled:text-muted-foreground disabled:opacity-100 disabled:hover:translate-y-0 disabled:hover:!shadow-[0_4px_0_var(--pop-ink)]";
