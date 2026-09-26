"use client";

import { useMemo } from "react";
import { CrownSolid } from "@/components/icons";
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
        // Flat gold fill, no outer glow: the track is a flat ink-outlined
        // pill with the same hard drop shadow as the buttons, no inner shadow.
        className="gap-1.5 [&_[data-slot=progress-indicator]]:bg-sprite-gold [&_[data-slot=progress-indicator]]:rounded-full [&_[data-slot=progress-track]]:h-3.5 [&_[data-slot=progress-track]]:border-[3px] [&_[data-slot=progress-track]]:border-pop-ink [&_[data-slot=progress-track]]:bg-card [&_[data-slot=progress-track]]:shadow-[0_3px_0_var(--pop-ink)]"
      >
        <ProgressLabel className="display-caps flex items-center gap-1.5 text-lg leading-none text-sprite-gold">
          {/* The same badge as a mastered tile: a gold disc, ink outline and
              hard drop shadow, holding a solid crown in the sidebar's colour. */}
          <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-pop-ink bg-sprite-gold shadow-[0_2px_0_var(--pop-ink)]"
          >
            <CrownSolid className="size-3 text-card" fill="currentColor" />
          </span>
          Mastered
        </ProgressLabel>
        {/* Children is a render fn; the default would print the percentage,
            but the count is what belongs here. */}
        {/* Only the count you've earned is gold (matching the bar and the tile
            crowns); the total stays muted so it reads as the denominator. */}
        <ProgressValue className="display-caps text-lg leading-none text-muted-foreground">
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
