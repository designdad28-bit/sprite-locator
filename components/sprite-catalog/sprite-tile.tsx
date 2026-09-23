"use client";

import type { CSSProperties } from "react";
import { Crown } from "lucide-react";
import type { NormalizedSprite } from "@/lib/sprite-catalog/types";
import { displayName } from "@/lib/sprite-name";
import { spriteIconScale } from "@/lib/sprite-icon-metrics";
import { variantGradient } from "@/lib/variant-colors";
import { cn } from "@/lib/utils";

export type TileStatus = "default" | "collected" | "mastered" | string;

/**
 * A Sprite's square tile: the one way a single Sprite is drawn, shared by the
 * sidebar grid and the profile's variant row so the two can't drift apart.
 *
 * Uncollected: the Reef duotone on the empty-slot fill, full colour on hover.
 * Collected: the variant's gradient, the art centred on a glossy floor
 * (a -webkit-box-reflect mirror, absent in Firefox), and a cast shadow.
 * Mastered: all of that plus the gold outline and a crown over the head.
 *
 * Expects an ancestor with the `group` class for the hover states.
 */
export function SpriteTileArt({ sprite, status }: { sprite: NormalizedSprite; status: TileStatus }) {
  const isColored = status !== "default";
  const accent = variantGradient(sprite.variant);
  const scale = spriteIconScale(sprite.id);
  return (
    <span
      className={cn(
        "relative block aspect-square w-full overflow-clip rounded-sm outline -outline-offset-1 transition-all duration-200 ease-out",
        status === "mastered" ? "outline-2 outline-sprite-gold" : "outline-[0.5px] outline-border",
        isColored && "shadow-[0_1px_2px_rgba(0,0,0,0.55),0_6px_14px_-4px_rgba(0,0,0,0.65)]",
        !isColored && "bg-muted/40"
      )}
      style={isColored ? { background: accent ?? undefined } : undefined}
    >
      {sprite.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sprite.icon}
          alt={displayName(sprite.name)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-all duration-150 group-hover:scale-110",
            !isColored && "sprite-unowned group-hover:[filter:none]"
          )}
          style={
            isColored
              ? ({
                  transform: `scale(${scale * 0.92})`,
                  WebkitBoxReflect: "below -13px linear-gradient(transparent 52%, rgb(255 255 255 / 0.4))",
                } as CSSProperties)
              : { transform: `scale(${scale})` }
          }
        />
      ) : (
        <span className="absolute inset-0 bg-input/30" />
      )}
      {status === "mastered" && (
        <Crown
          aria-hidden
          className="absolute top-1 left-1/2 size-5 -translate-x-1/2 text-sprite-gold drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] [&>path:last-child]:hidden"
          strokeWidth={1.5}
          fill="currentColor"
        />
      )}
    </span>
  );
}
