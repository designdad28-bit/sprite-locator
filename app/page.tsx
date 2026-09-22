"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Layers, FlaskConical } from "lucide-react";
import IslandMapCanvas from "@/components/map/island-map-canvas";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SpriteThumb } from "@/components/sprite-catalog/sprite-thumb";
import { SpriteCatalogBrowser } from "@/components/sprite-panel/sprite-catalog-browser";
import { SpriteDetailPanel } from "@/components/sprite-panel/sprite-detail-panel";
import { useFindings } from "@/hooks/use-findings";
import { usePois } from "@/hooks/use-pois";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { displayName } from "@/lib/sprite-name";
import { AddFindingDialog, type AddFindingValues } from "@/components/add-finding-dialog";
import { VARIANT_NAME, VARIANT_SLOTS, variantKey } from "@/lib/variant-colors";
import { buildDemoFindings } from "@/lib/demo-findings";
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
 * The floor is 264, chosen so the third variant tile lands whole and the
 * fourth still peeks: the 12px left pad + 3 tiles x 72 + 2 gaps x 8 puts the
 * third tile's right edge at 244 and the fourth's left edge at 252, leaving a
 * 12px sliver of it (10px of tile inside the 2px border). Narrower than this
 * and the third tile itself gets cut, which reads as a broken card rather
 * than as a row that scrolls.
 *
 * The ceiling is the width at which the row finally completes: the 12px left
 * pad + 5 tiles x 72 + 4 gaps x 8 + a matching 12px on the right = 416, plus
 * the 2px border on the map-facing edge. Dragging past that would only add
 * empty panel, since the row has nothing left to reveal.
 *
 * Still capped at half the window as well, so a drag can never squeeze the map
 * into a sliver on a narrow screen.
 */
const SIDEBAR_MIN_WIDTH = 264;
const SIDEBAR_MAX_WIDTH = 418;

/** Remembers the dragged width between visits, like the collection state does. */
const SIDEBAR_WIDTH_KEY = "sprite-radar:sidebar-width";

/** Remembers whether demo findings are switched on. */
const DEMO_MODE_KEY = "sprite-radar:demo-mode";

/** Below Tailwind's `md`, so JS and the `max-md:` classes agree on the breakpoint. */
const MOBILE_QUERY = "(max-width: 767px)";

function subscribeToWidth(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  // Belt and braces: a viewport that changes without firing the media query's
  // own change event — a device-emulating preview, say — still lands here.
  window.addEventListener("resize", onChange);
  return () => {
    query.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

function isMobileWidth() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * Phone width, where the app is the Sprite catalog and nothing else.
 *
 * A media query rather than CSS classes because the map is not hidden on a
 * phone, it is never mounted: Leaflet would otherwise initialise, fit itself
 * and start pulling 256px tiles for a view no one can see. The detail panel
 * needs it too — it animates its own width open on desktop, and an inline
 * width from Framer Motion cannot be overridden by a `max-md:` class.
 *
 * useSyncExternalStore rather than state plus an effect, which is what this
 * was first written as. A deferred read cannot be trusted for layout: it
 * happens after the first paint, so it races anything that sets the viewport
 * around load time, and a phone-width load came up desktop because of it.
 * Subscribing reads the real width during render instead, and the server's
 * snapshot is false so hydration still has something stable to match.
 */
function useIsMobile() {
  return useSyncExternalStore(subscribeToWidth, isMobileWidth, () => false);
}

/** Height the mobile Add finding bar occupies, which the catalog pads clear of. */
const MOBILE_CTA_HEIGHT = 68;

function clampSidebarWidth(width: number) {
  const ceiling = Math.min(SIDEBAR_MAX_WIDTH, Math.round(window.innerWidth / 2));
  return Math.max(SIDEBAR_MIN_WIDTH, Math.min(ceiling, Math.round(width)));
}

/**
 * The variant filter's "no filter" option. A Select item needs a value, and
 * the state's own "show everything" is null, so the two are bridged here
 * rather than by a magic string repeated at both ends.
 */
const ALL_VARIANTS = "all";

/**
 * Stands in for a variant's artwork on the "All variants" row, which has no
 * one variant to show. Sized like a SpriteThumb so every label in the list
 * starts on the same edge.
 */
function AllVariantsThumb() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <Layers className="size-4 text-muted-foreground" strokeWidth={1.5} />
    </span>
  );
}

/** The border each panel draws on its map-facing edge (border-r-2 / border-l-2). */
const PANEL_BORDER = 2;

export default function Home() {
  const { findings: savedFindings, addFinding } = useFindings();
  const { pois } = usePois();
  const { sprites, getSprite } = useSpriteCatalog();
  const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
  // Which Sprites' findings are pinned on the map. Driven only by the Radar
  // toggle — deliberately separate from `selectedSpriteId`, which is just
  // "what the detail panel is showing".
  /**
   * Which Sprites' findings are pinned, as an override the Radar toggles own
   * once the user has touched one. Null until then, meaning "whatever has been
   * found" — see visibleSpriteIds below.
   */
  const [pinnedOverride, setPinnedOverride] = useState<Set<string> | null>(null);
  // The Add finding modal. Bumping the key remounts it, so every open starts
  // from a blank form (pre-picked with the sprite whose panel is open).
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Which variant the map is narrowed to, as a slot key ("gold"). null shows
  // every variant of whatever the Radar toggles have turned on.
  const [variantFilter, setVariantFilter] = useState<string | null>(null);
  /**
   * Demo mode adds one synthetic finding per live Sprite so the map can be seen
   * fully populated. Off unless switched on, and never written to the database
   * — see lib/demo-findings.ts.
   *
   * Remembered between visits like the sidebar width, so looking around doesn't
   * end at the next reload. That it persists is exactly why the control stays
   * visible and lit while it is on: the map is showing data nobody logged, and
   * that must never be a quiet state.
   *
   * Starts false so the server's render and the first client one agree; the
   * stored value is applied just after, in the effect.
   */
  const isMobile = useIsMobile();
  const [demoMode, setDemoMode] = useState(false);
  useEffect(() => {
    // Read synchronously, NOT deferred to requestAnimationFrame.
    //
    // Deferring was the original shape here, purely to satisfy
    // react-hooks/set-state-in-effect — and it quietly breaks in a background
    // tab, because rAF callbacks do not run while a page is hidden. The app
    // then boots with demo mode off however the setting was left, and only
    // catches up when the tab is focused. The extra render pass the rule warns
    // about is the cheaper problem.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDemoMode(window.localStorage.getItem(DEMO_MODE_KEY) === "1");
  }, []);

  function toggleDemoMode() {
    const next = !demoMode;
    window.localStorage.setItem(DEMO_MODE_KEY, next ? "1" : "0");
    setDemoMode(next);
    if (!next) return;
    // Switching demo on has to pin it too. The visible set is seeded once from
    // whatever findings existed at load, so a Sprite with no real sighting has
    // its Radar off — and most Sprites have no real sighting, which is the
    // whole point of demo mode. Without this the map would answer a toggle
    // with a handful of new pins instead of a full island.
    // Only when the user has taken over the pinning. Before that the visible
    // set is derived from the findings themselves, so demo's arrive pinned.
    setPinnedOverride((prev) => {
      if (prev === null) return null;
      const ids = new Set(prev);
      for (const finding of buildDemoFindings(sprites, pois)) ids.add(finding.spriteId);
      return ids;
    });
  }

  // Demo findings are appended to the real ones rather than replacing them, so
  // turning the mode on never hides a genuine sighting.
  const findings = useMemo(
    () => (demoMode ? [...savedFindings, ...buildDemoFindings(sprites, pois)] : savedFindings),
    [demoMode, savedFindings, sprites, pois]
  );
  /**
   * What is pinned before the user has touched a Radar: nothing, so the island
   * opens clean and every pin on it is there because someone asked for it.
   *
   * Demo mode is the exception, and the only one. Its whole purpose is to show
   * the map populated, so switching it on with no Radars set pins what it
   * adds — otherwise the toggle would appear to do nothing at all.
   *
   * Derived, not seeded into state by an effect. Seeding was the first
   * approach and it was quietly unreliable: the effect had to wait for
   * findings to load, defer a frame to keep out of the render pass, and guard
   * itself against re-seeding over a Radar the user had switched off — and any
   * change to `findings` landing in that same frame cancelled the pending seed
   * through the effect's own cleanup. It usually won that race and sometimes
   * did not, which is the worst kind of bug to own.
   *
   * There is nothing to race here. With no override the answer is computed
   * from whatever findings currently exist, so it is right on the first render
   * and right again the moment more arrive. The first Radar click installs an
   * override and the toggles own it from then on.
   */
  const autoVisibleSpriteIds = useMemo(
    () => (demoMode ? new Set(findings.map((f) => f.spriteId)) : new Set<string>()),
    [demoMode, findings]
  );
  const visibleSpriteIds = pinnedOverride ?? autoVisibleSpriteIds;

  // Starts at the default so the server and the first client render agree;
  // any remembered width is applied just after, in the effect below.
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_WIDTH);


  useEffect(() => {
    const saved = Number(window.localStorage.getItem(SIDEBAR_WIDTH_KEY));
    if (!Number.isFinite(saved) || saved <= 0) return;
    // Synchronous for the same reason as demo mode above: a frame-deferred
    // read never happens in a hidden tab, which left the sidebar at its
    // default width instead of the remembered one.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSidebarWidth(clampSidebarWidth(saved));
  }, []);

  /**
   * Drag-to-resize.
   *
   * The move and up listeners go on the window, not the handle, so the drag
   * keeps working however fast the cursor leaves the 5px strip. Pointer
   * capture would usually cover that too, but it is best-effort here: it
   * throws when there is no live pointer for the id, and having it throw
   * before the listeners were attached is exactly how a drag silently does
   * nothing. Window listeners work with or without it.
   *
   * Width is read straight from the pointer's x rather than accumulated from
   * deltas, so it cannot drift over a long drag.
   */
  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const handle = event.currentTarget;
    const pointerId = event.pointerId;
    try {
      handle.setPointerCapture(pointerId);
    } catch {
      // No live pointer for this id — carry on with the window listeners.
    }

    const onMove = (move: PointerEvent) => setSidebarWidth(clampSidebarWidth(move.clientX));
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        handle.releasePointerCapture(pointerId);
      } catch {
        // Nothing was captured; nothing to release.
      }
      setSidebarWidth((width) => {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
        return width;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
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


  /**
   * The filter's rows: one per variant slot, each carrying a real icon of that
   * variant rather than a colour swatch — the same thumb + name the Add
   * finding dialog's variant picker uses.
   *
   * Which Sprite's artwork stands for a variant is decided by what you are
   * watching: with a Radar on, the rows show that Sprite's own gold / cheat
   * master / loot hacker / bounty hunter icons, so the question reads as
   * "which variant of this am I looking at". With nothing on — or a variant
   * none of the watched Sprites has — it falls back to the first live Sprite
   * that has it, so every row still carries real artwork instead of a gap.
   */
  const variantOptions = useMemo(() => {
    const live = sprites.filter((s) => s.currentlyLive);
    const watched = live.filter((s) => visibleSpriteIds.has(s.id));
    return VARIANT_SLOTS.map((slot) => {
      const match =
        watched.find((s) => variantKey(s.variant) === slot) ??
        live.find((s) => variantKey(s.variant) === slot);
      return {
        slot,
        label: VARIANT_NAME[slot] ?? slot,
        // The scale is measured per sprite id, so the id has to be the one the
        // icon belongs to — see SpriteThumb.
        id: match?.id ?? "",
        icon: match?.icon ?? null,
      };
    });
  }, [sprites, visibleSpriteIds]);

  /**
   * What the map actually pins: the Sprites whose Radar is on, narrowed to one
   * variant when the filter asks for one.
   *
   * The two controls answer different questions and are kept separate on
   * purpose — the Radar is "which Sprites am I hunting", the filter is "which
   * variant of them am I looking at". Combining them here rather than in the
   * map keeps IslandMap's contract as a plain set of ids.
   */
  const pinnedSpriteIds = useMemo(() => {
    if (variantFilter === null) return visibleSpriteIds;
    const next = new Set<string>();
    for (const id of visibleSpriteIds) {
      if (variantKey(getSprite(id)?.variant ?? null) === variantFilter) next.add(id);
    }
    return next;
  }, [visibleSpriteIds, variantFilter, getSprite]);

  // A Sprite's Radar covers every variant it has, so `ids` is that Sprite's
  // whole set of ids.
  function setSpriteVisibility(ids: string[], visible: boolean) {
    const next = new Set(visibleSpriteIds);
    for (const id of ids) {
      if (visible) next.add(id);
      else next.delete(id);
    }
    setPinnedOverride(next);
    // Turning off the last Radar takes the variant filter off screen with it
    // (it has nothing left to narrow), so the filter resets too. A control the
    // user can no longer see must not keep narrowing the map from behind it —
    // otherwise the next Radar they switch on comes back to a map still
    // filtered to one variant, with no visible cause.
    if (next.size === 0) setVariantFilter(null);
  }

  async function confirmFinding({ poiId, spriteId, variant, lootSource }: AddFindingValues) {
    // Close first: the insert is a network round-trip, and the form has
    // nothing left to show while it runs.
    setAddOpen(false);
    const saved = await addFinding({ poiId, spriteId, variant, lootSource });
    if (!saved) return;
    // Log a finding and you should see it, even if this Sprite's Radar was off.
    // Same reasoning as demo mode: with no override the new finding is already
    // pinned by derivation.
    setPinnedOverride((prev) => (prev === null ? null : new Set(prev).add(spriteId)));
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
          "panel-wash absolute top-0 left-0 z-[600] flex flex-col overflow-hidden border-border bg-card",
          // Open: the full-height 280px panel. Collapsed: no width or height of
          // its own, so it hugs its open button in the corner; it then needs
          // a bottom edge too, since the map sits below it.
          sidebarOpen ? "bottom-0" : "w-auto border-b-2",
          // On a phone the catalog IS the app: full width, and no right border
          // because there is no map beside it for one to divide. The padding
          // keeps the last card clear of the Add finding bar below.
          isMobile ? "w-full" : "border-r-2"
        )}
        // From the same state the map container reserves, so the two can't
        // drift apart. Left off entirely on a phone, so the w-full class above
        // isn't fighting an inline width.
        style={{
          width: isMobile ? undefined : sidebarOpen ? sidebarWidth : undefined,
          paddingBottom: isMobile ? MOBILE_CTA_HEIGHT : undefined,
        }}
      >
        <SpriteCatalogBrowser
          selectedSpriteId={selectedSpriteId}
          onSelect={setSelectedSpriteId}
          visibleSpriteIds={visibleSpriteIds}
          onSetVisibility={setSpriteVisibility}
          collapsed={!sidebarOpen}
          onToggleCollapsed={() => setSidebarOpen((open) => !open)}
        />

        {/* The drag handle, sitting on the panel's own edge. Only its middle
            band is grabbable so it doesn't fight the sidebar's scrollbar
            gutter, and it widens on hover rather than being visible at rest —
            the border it sits on is the affordance. */}
        {sidebarOpen && !isMobile && (
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
      {/* The map is not merely hidden on a phone, it is never mounted:
          Leaflet would otherwise initialise, fit itself and start pulling
          256px tiles for a view nobody can see. */}
      {!isMobile && (
      <div
        data-slot="map-container"
        className="relative min-w-0 flex-1"
        style={{ marginLeft: sidebarOpen ? sidebarWidth : 0 }}
      >
        <IslandMapCanvas
          findings={findings}
          visibleSpriteIds={pinnedSpriteIds}
          // Findings are logged through the Add finding modal now, not by
          // clicking the map, so map-click placement stays off.
          isAddMode={false}
          pois={pois}
          onMapClick={() => {}}
        />

        <div className="pointer-events-none absolute inset-x-0 top-2 z-[500] flex items-center justify-between gap-2 px-2">
          <div className="flex min-w-0 items-center gap-2">
          {/* Only present once something is pinned. With every Radar off the
              map has no findings on it, so narrowing them to one variant is a
              control over nothing — and one that would otherwise sit there
              inviting a click that changes nothing visible.

              Styled to match Add finding opposite it — same height, radius,
              card fill and shadow — so the two read as one layer of map
              controls rather than a control and a form field. */}
          {visibleSpriteIds.size > 0 && (
          <Select
            value={variantFilter ?? ALL_VARIANTS}
            onValueChange={(value) =>
              setVariantFilter(value === ALL_VARIANTS ? null : (value as string))
            }
          >
            <SelectTrigger
              aria-label="Filter the map by variant"
              className="pointer-events-auto h-9 gap-2 rounded-md border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg dark:bg-card"
            >
              <SelectValue>
                {(value: string) => {
                  const chosen = variantOptions.find((v) => v.slot === value);
                  return (
                    <span className="flex items-center gap-2">
                      {chosen ? (
                        <SpriteThumb id={chosen.id} icon={chosen.icon} />
                      ) : (
                        <AllVariantsThumb />
                      )}
                      {chosen ? chosen.label : "All variants"}
                    </span>
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value={ALL_VARIANTS}>
                  <span className="flex items-center gap-2">
                    <AllVariantsThumb />
                    All variants
                  </span>
                </SelectItem>
                {variantOptions.map((v) => (
                  <SelectItem key={v.slot} value={v.slot}>
                    <span className="flex items-center gap-2">
                      <SpriteThumb id={v.id} icon={v.icon} />
                      {v.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          )}

          {/* Always present, so the mode can be left as easily as it is
              entered — but it never looks the same in both states. Lit and
              labelled while on, because the map is then showing data nobody
              logged and that must not be a quiet state. */}
          <button
            type="button"
            onClick={toggleDemoMode}
            aria-pressed={demoMode}
            className={cn(
              "pointer-events-auto flex h-9 shrink-0 items-center gap-2 rounded-md border bg-card px-4 text-sm font-medium whitespace-nowrap shadow-lg transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50",
              demoMode
                ? "border-sprite-gold/60 text-sprite-gold"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <FlaskConical className="size-4" strokeWidth={1.5} />
            {demoMode ? "Demo data — on" : "Demo data"}
          </button>
          </div>

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


      </div>
      )}

      {/* The phone's one action, where a thumb reaches. The map's own
          Add finding button lives in the controls overlaid on the map, so
          without this there would be no way to log a finding at all. */}
      {isMobile && (
        <div
          className="fixed inset-x-0 bottom-0 z-[650] border-t-2 border-border bg-card px-3 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          style={{ minHeight: MOBILE_CTA_HEIGHT }}
        >
          <Button
            onClick={() => {
              setAddKey((k) => k + 1);
              setAddOpen(true);
            }}
            className="h-11 w-full gap-2 text-[15px] font-medium"
          >
            <MapPin className="size-4" strokeWidth={1.5} />
            Add finding
          </Button>
        </div>
      )}

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

      <AnimatePresence>
        {selectedSpriteId && (
          <motion.aside
            key={selectedSpriteId}
            // On a phone it covers the catalog rather than sitting beside it —
            // there is no room for two panels — so it slides in over the top
            // and is dismissed by its own close button. Width is not animated
            // there: it is already the whole screen, and Framer writes the
            // animated width inline where a class could not override it.
            initial={isMobile ? { x: "100%", opacity: 1 } : { width: 0, opacity: 0 }}
            // Same width as the left sidebar, from the same constant.
            animate={isMobile ? { x: 0, opacity: 1 } : { width: sidebarWidth, opacity: 1 }}
            exit={isMobile ? { x: "100%", opacity: 1 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            // Flush to the window like the left sidebar: no margin, no radius,
            // and a border only on the edge that faces the map.
            className={cn(
              "panel-wash flex flex-col overflow-hidden border-border bg-card",
              isMobile ? "fixed inset-0 z-[700] w-full" : "shrink-0 border-l-2"
            )}
          >
            {/* Fixed width, so the panel's contents don't reflow while the
                aside animates its own width open or shut — but minus the 2px
                border, which the aside's width includes and this div's does
                not. Without that it overhung by exactly 2px at every sidebar
                width, giving the panel a hairline horizontal scroll. */}
            <div
              className={cn("h-full", isMobile && "w-full")}
              style={{ width: isMobile ? undefined : sidebarWidth - PANEL_BORDER }}
            >
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
