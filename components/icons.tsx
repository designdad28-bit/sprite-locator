import type { ComponentProps } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  BanIcon,
  Add01Icon,
  Cancel01Icon,
  CrownIcon,
  FlaskConicalIcon,
  InformationCircleIcon,
  Layers01Icon,
  Location01Icon,
  Radar01Icon,
  Refresh01Icon,
  Remove01Icon,
  Search01Icon,
  SidebarLeft01Icon,
  Tick02Icon,
  Touch01Icon,
} from "@hugeicons/core-free-icons";

/**
 * The app's icon set: Hugeicons, wrapped so call sites read like the lucide
 * components they replaced (className, strokeWidth, fill all pass through).
 * Every icon is drawn at one heavy stroke, ignoring any strokeWidth a call
 * site passes, so the set stays uniform and sits with the 3px ink outlines.
 */
type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon">;

const STROKE = 3.25;

function make(icon: IconSvgElement, stroke = STROKE) {
  return function Icon(props: IconProps) {
    return <HugeiconsIcon {...props} icon={icon} strokeWidth={stroke} />;
  };
}

export const Crown = make(CrownIcon);
/** Filled crown for the mastered badge: a light stroke, so it reads as a solid shape. */
export const CrownSolid = make(CrownIcon, 1);
export const X = make(Cancel01Icon);
export const Plus = make(Add01Icon);
export const Minus = make(Remove01Icon);
export const RotateCcw = make(Refresh01Icon);
export const Radar = make(Radar01Icon, 2.5) // fine detail: full weight fills it in;
export const Info = make(InformationCircleIcon, 2.75);
export const Search = make(Search01Icon);
export const Ban = make(BanIcon);
export const PanelLeftClose = make(SidebarLeft01Icon);
export const PanelLeftOpen = make(SidebarLeft01Icon);
export const MapPin = make(Location01Icon);
export const Layers = make(Layers01Icon);
export const FlaskConical = make(FlaskConicalIcon);
export const ChevronDownIcon = make(ArrowDown01Icon);
export const ChevronUpIcon = make(ArrowUp01Icon);
export const CheckIcon = make(Tick02Icon);
export const XIcon = make(Cancel01Icon);
export const TapIcon = make(Touch01Icon, 2.25);

/**
 * Discord's own "Clyde" glyph, not a Hugeicons stand-in — a sign-in button
 * for a specific provider carries that provider's real mark (the same
 * convention every "Sign in with X" button follows). currentColor, so it
 * takes whatever colour its button sets rather than always being blurple.
 */
export function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className ?? "size-4"} aria-hidden="true">
      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.927 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.057c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028ZM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z" />
    </svg>
  );
}
