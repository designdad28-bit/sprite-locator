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
} from "@hugeicons/core-free-icons";

/**
 * The app's icon set: Hugeicons, wrapped so call sites read like the lucide
 * components they replaced (className, strokeWidth, fill all pass through).
 * The default stroke is a heavy 2.25 to sit with the 3px ink outlines.
 */
type IconProps = Omit<ComponentProps<typeof HugeiconsIcon>, "icon">;

function make(icon: IconSvgElement) {
  return function Icon({ strokeWidth = 2.25, ...props }: IconProps) {
    return <HugeiconsIcon icon={icon} strokeWidth={strokeWidth} {...props} />;
  };
}

export const Crown = make(CrownIcon);
export const X = make(Cancel01Icon);
export const Plus = make(Add01Icon);
export const Minus = make(Remove01Icon);
export const RotateCcw = make(Refresh01Icon);
export const Radar = make(Radar01Icon);
export const Info = make(InformationCircleIcon);
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
