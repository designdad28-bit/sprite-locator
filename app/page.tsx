"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin } from "lucide-react";
import IslandMapCanvas from "@/components/map/island-map-canvas";
import { Button } from "@/components/ui/button";
import { SpriteCatalogBrowser } from "@/components/sprite-panel/sprite-catalog-browser";
import { SpriteDetailPanel } from "@/components/sprite-panel/sprite-detail-panel";
import { useFindings } from "@/hooks/use-findings";
import { usePois } from "@/hooks/use-pois";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { displayName } from "@/lib/sprite-name";
import { AddFindingDialog, type AddFindingValues } from "@/components/add-finding-dialog";
import { cn } from "@/lib/utils";

// The open sidebar's width. The map lives in its own container to the right of
// it (see the map wrapper below), so the island is fitted and centered in the
// space the sidebar doesn't cover, rather than padded around the panel.
//
// Sized to cut the variant row mid-tile, so the row visibly continues past the
// panel edge and invites the horizontal scroll rather than looking complete:
// the row's 12px left pad + 3 tiles x 72px + 3 gaps x 8px + half of the
// fourth tile = 288, plus the 2px border on the map-facing edge = 290.
//
// Deliberately not 418, which is what all five tiles need to fit. A half-tile
// is the cue; a whole one would read as the last one and hide that two more
// follow. The row itself already scrolls (overflow-x-auto, scrollbar hidden)
// — see the variant row in sprite-catalog-browser.tsx.
const SIDEBAR_WIDTH = 290;

/**
 * How far the sidebar can be dragged.
 *
 * The floor is 240. At exactly that width the variant row shows two whole
 * tiles and 92% of a third — measured — so the cue that the row continues
 * survives. Any narrower and the third tile starts disappearing.
 *
 * The ceiling is whichever is smaller — 640, or half the window, so dragging
 * can never squeeze the map into a sliver on a narrow screen.
 */
const SIDEBAR_MIN_WIDTH = 240;
const SIDEBAR_MAX_WIDTH = 640;

/** Remembers the dragged width between visits, like the collection state does. */
const SIDEBAR_WIDTH_KEY = "sprite-radar:sidebar-width";

function clampSidebarWidth(width: number) {
  const ceiling = Math.min(SIDEBAR_MAX_WIDTH, Math.round(window.innerWidth / 2));
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(ceiling, Math.round(width)));
}

/** The border each panel draws on its map-facing edge (border-r-2 / border-l-2). */
const PANEL_BORDER = 2;

export default function Home() {
  const { findings, addFinding } = useFindings();
  const { pois } = usePois();
  const { getSprite } = useSpriteCatalog();
  const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
  // Which Sprites' findings are pinned on the map. Driven only by the Radar
  // toggle — deliberately separate from `selectedSpriteId`, which is just
  // "what the detail panel is showing".
  const [visibleSpriteIds, setVisibleSpriteIds] = useState<Set<string>>(new Set());
  // The Add finding modal. Bumping the key remounts it, so every open starts
  // from a blank form (pre-picked with the sprite whose panel is open).
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Starts at the default so the server and the first client render agree;
  // any remembered width is applied just after, in the effect below.
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (!Number.isFinite(saved) || saved <= 0) return;
    // Applied on the next frame rather than straight from the effect body: a
    // synchronous setState here costs an extra render pass before paint
    // (react-hooks/set-state-in-effect).
    const frame = requestAnimationFrame(() => setSidebarWidth(clampSidebarWidth(saved)));
    return () => cancelAnimationFrame(frame);
  }, []);

  /**
   * Drag-to-resize. Pointer capture means the drag survives the cursor leaving
   * the 5px handle — without it, moving faster than React re-renders drops the
   * drag. Width is read straight from the pointer's x rather than accumulated
   * from deltas, so it can't drift over a long drag.
   */
  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);

    const onMove = (move: PointerEvent) => setSidebarWidth(clampSidebarWidth(move.clientX));
    const onUp = () => {
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      setSidebarWidth((width) => {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
        return width;
      });
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
  }

  function nudgeResize(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 48 : 16;
    const delta = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    if (!delta) return;
    event.preventDefault();
    setSidebarWidth((width) => {
      const next = clampSidebarWidth(width + delta);
      window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(next));
      return next;
    });
  }
  const [lastAdded, setLastAdded] = useState<string | null>(null);


  function toggleSpriteVisibility(id: string) {
    setVisibleSpriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmFinding({ poiId, spriteId, variant, lootSource }: AddFindingValues) {
    // Close first: the insert is a network round-trip, and the form has
    // nothing left to show while it runs.
    setAddOpen(false);
    const saved = await addFinding({ poiId, spriteId, variant, lootSource });
    if (!saved) return;
    // Log a finding and you should see it, even if this Sprite's Radar was off.
    setVisibleSpriteIds((prev) => new Set(prev).add(spriteId));
    setLastAdded(spriteId);
    window.setTimeout(() => setLastAdded(null), 1800);
  }

  return (
    // h-dvh, not h-screen: 100vh can resolve to a stale or oversized height
    // (browser UI, zoom), which leaves the shell not matching the window.
    <div className="relative flex h-dvh w-full overflow-hidden bg-card">
      {/* Pinned to the window's left edge, outside the map's container below. */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          // Flush to the window: no margin, no radius. The border only runs
          // along edges that face the map — on the window's own edges it
          // would just draw a line around the screen.
          "panel-wash absolute top-0 left-0 z-[600] flex flex-col overflow-hidden border-border border-r-2 bg-card",
          // Open: the full-height 280px panel. Collapsed: no width or height of
          // its own, so it hugs its open button in the corner; it then needs
          // a bottom edge too, since the map sits below it.
          sidebarOpen ? "bottom-0" : "w-auto border-b-2"
        )}
        // From the same state the map container reserves, so the two can't
        // drift apart.
        style={{ width: sidebarOpen ? sidebarWidth : undefined }}
      >
        <SpriteCatalogBrowser
          selectedSpriteId={selectedSpriteId}
          onSelect={setSelectedSpriteId}
          visibleSpriteIds={visibleSpriteIds}
          onToggleVisibility={toggleSpriteVisibility}
          collapsed={!sidebarOpen}
          onToggleCollapsed={() => setSidebarOpen((open) => !open)}
        />

        {/* The drag handle, sitting on the panel's own edge. Only its middle
            band is grabbable so it doesn't fight the sidebar's scrollbar
            gutter, and it widens on hover rather than being visible at rest —
            the border it sits on is the affordance. */}
        {sidebarOpen && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuenow={sidebarWidth}
            aria-valuemin={SIDEBAR_MIN_WIDTH}
            aria-valuemax={SIDEBAR_MAX_WIDTH}
            tabIndex={0}
            onPointerDown={startResize}
            onKeyDown={nudgeResize}
            className="absolute inset-y-0 right-0 z-10 w-[5px] translate-x-[2px] cursor-col-resize touch-none bg-transparent transition-colors hover:bg-ring/60 focus-visible:bg-ring/60 focus-visible:outline-none"
          />
        )}
      </motion.aside>

      {/* The map's container: everything the sidebar doesn't cover. The margin
          reserves the open sidebar's width, so the map — and the controls and
          hints overlaid on it — are sized and centered in the visible space.
          When the sidebar collapses to its corner button, the container spans
          the full width. Leaflet re-fits the island whenever this box resizes. */}
      <div
        data-slot="map-container"
        className="relative min-w-0 flex-1"
        style={{ marginLeft: sidebarOpen ? sidebarWidth : 0 }}
      >
        <IslandMapCanvas
          findings={findings}
          visibleSpriteIds={visibleSpriteIds}
          // Findings are logged through the Add finding modal now, not by
          // clicking the map, so map-click placement stays off.
          isAddMode={false}
          pois={pois}
          onMapClick={() => {}}
        />

        <div className="pointer-events-none absolute inset-x-0 top-2 z-[500] flex items-center justify-end px-2">
          <Button
            variant="outline"
            onClick={() => {
              setAddKey((k) => k + 1);
              setAddOpen(true);
            }}
            // dark:bg-card is required: the outline variant sets
            // dark:bg-transparent, which an unprefixed background would lose to.
            className="pointer-events-auto gap-2 bg-card text-foreground shadow-lg dark:bg-card"
          >
            <MapPin className="size-4" strokeWidth={1.5} />
            Add finding
          </Button>
        </div>

        <AddFindingDialog
          key={addKey}
          open={addOpen}
          onOpenChange={setAddOpen}
          pois={pois}
          defaultSpriteId={selectedSpriteId}
          onConfirm={confirmFinding}
        />

        <AnimatePresence>
          {lastAdded && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="pointer-events-none absolute bottom-6 left-1/2 z-[500] -translate-x-1/2 rounded-full border border-border bg-card/95 px-4 py-2 text-xs font-semibold text-foreground shadow-xl"
            >
              Finding added — {displayName(getSprite(lastAdded)?.name)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selectedSpriteId && (
          <motion.aside
            key={selectedSpriteId}
            initial={{ width: 0, opacity: 0 }}
            // Same width as the left sidebar, from the same constant.
            animate={{ width: sidebarWidth, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            // Flush to the window like the left sidebar: no margin, no radius,
            // and a border only on the edge that faces the map.
            className="panel-wash flex shrink-0 flex-col overflow-hidden border-border border-l-2 bg-card"
          >
            {/* Fixed width, so the panel's contents don't reflow while the
                aside animates its own width open or shut — but minus the 2px
                border, which the aside's width includes and this div's does
                not. Without that it overhung by exactly 2px at every sidebar
                width, giving the panel a hairline horizontal scroll. */}
            <div className="h-full" style={{ width: sidebarWidth - PANEL_BORDER }}>
              <SpriteDetailPanel
                spriteId={selectedSpriteId}
                findings={findings}
                onBack={() => setSelectedSpriteId(null)}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
