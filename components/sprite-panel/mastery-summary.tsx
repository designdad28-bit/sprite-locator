"use client";

import { useMemo } from "react";
import { Crown } from "lucide-react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { useCollectionStatus } from "@/hooks/use-collection-status";
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress";

/**
 * Mastery progress across the whole live catalog.
 *
 * Everything here is mastered-out-of-every-live-variant (61 this season: 15
 * families with four variants each, plus Mega Man's single one) — the count,
 * the bar, and the caption all report the same figure.
 */
export function MasterySummary() {
  const { sprites } = useSpriteCatalog();
  const { getStatus } = useCollectionStatus();

  const { mastered, total } = useMemo(() => {
    const live = sprites.filter((s) => s.currentlyLive);
    let masteredCount = 0;
    for (const sprite of live) {
      if (getStatus(sprite.id) === "mastered") masteredCount += 1;
    }
    return { mastered: masteredCount, total: live.length };
  }, [sprites, getStatus]);

  // Share of the whole live catalog, not of what's been collected — the caption
  // says "of Sprites", so the denominator has to be every Sprite.
  const percentOfAll = total > 0 ? Math.round((mastered / total) * 100) : 0;

  return (
    // No card chrome of its own: it sits inside the sidebar panel, which already
    // supplies the border, fill and gutters.
    <div data-slot="mastery-summary" className="w-full">
      {/* Progress renders its own track + indicator after `children`, so they
          can only be restyled from the root via their data-slot hooks. */}
      <Progress
        value={percentOfAll}
        // The track is bg-card, not the component's default bg-muted: the header
        // strip behind it is itself --muted, so the default left the empty part
        // of the bar invisible.
        className="gap-1.5 [&_[data-slot=progress-indicator]]:bg-sprite-gold [&_[data-slot=progress-track]]:h-1 [&_[data-slot=progress-track]]:bg-card"
      >
        <ProgressLabel className="flex items-center gap-1 leading-none text-sprite-gold">
          <Crown
            aria-hidden
            // Inherits the label's gold via currentColor. Nudged down 1px:
            // hiding the base bar leaves the remaining shape sitting high in
            // the 24-unit box, so box-centering alone reads as too high.
            className="size-4 shrink-0 translate-y-px [&>path:last-child]:hidden"
            strokeWidth={1.5}
            fill="currentColor"
          />
          Mastered
        </ProgressLabel>
        {/* Children is a render fn; the default would print the percentage,
            but the count is what belongs here. */}
        {/* Only the count you've earned is gold (matching the bar and the tile
            crowns); the total stays muted so it reads as the denominator. */}
        <ProgressValue className="font-medium leading-none text-muted-foreground">
          {() => (
            <>
              <span className="text-sprite-gold">{mastered}</span> / {total}
            </>
          )}
        </ProgressValue>
      </Progress>
    </div>
  );
}
