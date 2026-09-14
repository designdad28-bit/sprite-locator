"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, X } from "lucide-react";
import IslandMapCanvas from "@/components/map/island-map-canvas";
import { MAP_BACKGROUND_COLOR } from "@/components/map/map-provider";
import { Button } from "@/components/ui/button";
import { SpriteCatalogBrowser } from "@/components/sprite-panel/sprite-catalog-browser";
import { SpriteDetailPanel } from "@/components/sprite-panel/sprite-detail-panel";
import { useFindings } from "@/hooks/use-findings";
import { usePois } from "@/hooks/use-pois";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { rarityColor } from "@/lib/rarity";
import { cn } from "@/lib/utils";

// Sidebar overlays the map: 280px panel + 8px margin + 8px breathing room.
// The map fits and centers the island to the right of this, so no part of the
// island ends up hidden behind the panel.
const SIDEBAR_INSET = 296;

export default function Home() {
  const { findings, addFinding } = useFindings();
  const { pois } = usePois();
  const { getSprite } = useSpriteCatalog();
  const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
  // Which Sprites' findings are pinned on the map. Driven only by the Radar
  // toggle — deliberately separate from `selectedSpriteId`, which is just
  // "what the detail panel is showing".
  const [visibleSpriteIds, setVisibleSpriteIds] = useState<Set<string>>(new Set());
  const [isAddMode, setIsAddMode] = useState(false);
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  const selectedSprite = selectedSpriteId ? getSprite(selectedSpriteId) : null;

  function toggleSpriteVisibility(id: string) {
    setVisibleSpriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function placeFinding(x: number, y: number, poiId?: string) {
    if (!selectedSpriteId) return;
    addFinding(selectedSpriteId, x, y, poiId);
    // Drop a pin and you should see it, even if this Sprite's Radar was off.
    setVisibleSpriteIds((prev) => new Set(prev).add(selectedSpriteId));
    setLastAdded(selectedSpriteId);
    window.setTimeout(() => setLastAdded(null), 1800);
  }

  function handleMapClick(x: number, y: number) {
    if (!isAddMode) return;
    placeFinding(x, y);
  }

  function handleLocationSelect(poiId: string) {
    const poi = pois.find((p) => p.id === poiId);
    if (!poi) return;
    placeFinding(poi.x, poi.y, poi.id);
  }

  return (
    // h-dvh, not h-screen: 100vh can resolve to a stale or oversized height
    // (browser UI, zoom), which leaves the shell not matching the window.
    <div className="relative flex h-dvh w-full overflow-hidden" style={{ backgroundColor: MAP_BACKGROUND_COLOR }}>
      {/* Floats over the map like the zoom + Add finding controls, so the map
          runs full-bleed underneath instead of being cropped by a layout column. */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-2 bottom-2 left-2 z-[600] flex w-[280px] flex-col overflow-hidden rounded-2xl border-2 border-border bg-card"
      >
        <SpriteCatalogBrowser
          selectedSpriteId={selectedSpriteId}
          onSelect={setSelectedSpriteId}
          visibleSpriteIds={visibleSpriteIds}
          onToggleVisibility={toggleSpriteVisibility}
        />
      </motion.aside>

      <div className="relative flex-1">
        <IslandMapCanvas
          findings={findings}
          visibleSpriteIds={visibleSpriteIds}
          isAddMode={isAddMode}
          pois={pois}
          onMapClick={handleMapClick}
          insetLeft={SIDEBAR_INSET}
        />

        <div className="pointer-events-none absolute inset-x-0 top-2 z-[500] flex items-center justify-end px-2">
          <Button
            variant="outline"
            onClick={() => setIsAddMode((v) => !v)}
            disabled={!selectedSprite && !isAddMode}
            // dark:bg-* is required: the outline variant sets dark:bg-transparent,
            // which an unprefixed background utility would lose to.
            // disabled:opacity-100 overrides the Button's disabled:opacity-50 —
            // half-opacity would let the map show through and stop the fill
            // matching the sidebar. Dim the label instead of the whole control.
            className={cn(
              "pointer-events-auto gap-2 bg-card text-foreground shadow-lg disabled:opacity-100 disabled:text-muted-foreground dark:bg-card",
              isAddMode && "border-ring bg-muted dark:bg-muted"
            )}
          >
            {isAddMode ? <X className="size-4" strokeWidth={1.5} /> : <MapPin className="size-4" strokeWidth={1.5} />}
            {isAddMode ? "Cancel placement" : "Add finding"}
          </Button>
        </div>

        <AnimatePresence>
          {isAddMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="pointer-events-none absolute left-1/2 top-16 z-[500] flex -translate-x-1/2 flex-col items-center gap-2"
            >
              <div className="rounded-full border border-primary/40 bg-card/90 px-4 py-1.5 text-xs font-medium tracking-wide text-foreground shadow-lg backdrop-blur">
                Click the map to drop a{" "}
                <span style={{ color: rarityColor(selectedSprite?.rarity) }}>{selectedSprite?.name}</span> finding
              </div>
              {pois.length > 0 && (
                <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">or pick a spot</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) handleLocationSelect(e.target.value);
                      e.target.value = "";
                    }}
                    defaultValue=""
                    className="rounded-full border border-border bg-input/30 px-2 py-1 text-xs text-foreground outline-none focus:border-ring"
                  >
                    <option value="" disabled>
                      Named location…
                    </option>
                    {pois.map((poi) => (
                      <option key={poi.id} value={poi.id} className="bg-card">
                        {poi.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {lastAdded && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-none absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-xl"
            >
              Finding added — {getSprite(lastAdded)?.name}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedSpriteId && (
          <motion.aside
            key={selectedSpriteId}
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 340, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="m-2 flex shrink-0 flex-col overflow-hidden rounded-2xl border-2 border-border bg-card"
          >
            <div className="h-full w-[340px]">
              <SpriteDetailPanel
                spriteId={selectedSpriteId}
                findings={findings}
                onBack={() => {
                  setSelectedSpriteId(null);
                  setIsAddMode(false);
                }}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
