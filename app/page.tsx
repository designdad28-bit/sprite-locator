"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { CheckIcon, Layers, FlaskConical, SidebarToggleIcon } from "@/components/icons";
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
import { Logo } from "@/components/logo";
import { AccountControl } from "@/components/account-control";
import { VARIANT_NAME, VARIANT_SLOTS, variantKey } from "@/lib/variant-colors";
import { buildDemoFindings } from "@/lib/demo-findings";
import { ADD_FINDING_STYLE } from "@/lib/cta";
import { cn } from "@/lib/utils";

// The open sidebar's width. The map lives in its own container to the right
// of it, so the island is fitted and centred in the space the sidebar doesn't
// cover.
//
// The default and the drag floor are the same width: 375, a phone's width,
// so the sidebar holds exactly what the phone shows. The sprite tiles flex to
// fill each card (see sprite-catalog-browser.tsx), so all five variants are
// always in view and a wider drag only makes them bigger.
//
// The ceiling is where the tiles reach 80px: 28 + 5 x 80 + 4 x 8 + 12 + 16 + 3.
// Still capped at half the window too, so a drag never squeezes the map.
const SIDEBAR_WIDTH = 375;
const SIDEBAR_MIN_WIDTH = 375;
const SIDEBAR_MAX_WIDTH = 491;

/** Remembers the dragged width between visits, like the collection state does. */
const SIDEBAR_WIDTH_KEY = "sprite-radar:sidebar-width";

/** Remembers whether the sidebar is shown or hidden (desktop). */
const SIDEBAR_OPEN_KEY = "sprite-radar:sidebar-open";

/**
 * Hiding and showing the sidebar: the panel slides out to the left while it
 * fades, and the map's column widens into the space over the same 0.3s, on
 * one fast-in, soft-landing curve.
 */
const SIDEBAR_EASE = [0.2, 0.8, 0.2, 1] as const;
const SIDEBAR_SLIDE_S = 0.3;
const SIDEBAR_FADE_S = 0.2;

/** Remembers whether demo findings are switched on. */
const DEMO_MODE_KEY = "sprite-radar:demo-mode";

/**
 * Demo findings exist for development only and are not deployed.
 *
 * They are synthetic — one invented sighting per Sprite (see
 * lib/demo-findings.ts) — and the live site must never offer a way to put data
 * nobody logged on the map, whatever a visitor's localStorage happens to hold.
 * Next inlines NODE_ENV at build time, so the toggle and the findings it makes
 * are both dead code in a production bundle.
 */
const DEMO_AVAILABLE = process.env.NODE_ENV !== "production";

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

const noSubscription = () => () => {};

/**
 * False on the server and during hydration, true from the first client render
 * after it. The layout depends on the window's width, which the server can't
 * know, so until this is true the app shows AppSplash rather than guessing:
 * guessing desktop painted phones a broken desktop layout for as long as the
 * JS took to load.
 */
function useHydrated() {
  return useSyncExternalStore(noSubscription, () => true, () => false);
}

/** The first paint on every device: the wordmark on the app's own indigo. */
function AppSplash() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-card" aria-busy="true">
      <Logo className="text-3xl motion-safe:animate-pulse" />
      <span className="sr-only" role="status">Loading Sprite Radar…</span>
    </div>
  );
}

/** Height the mobile Add finding bar occupies, which the catalog pads clear of. */
const MOBILE_CTA_HEIGHT = 72;

/**
 * Add finding's fill, shared by the desktop and phone buttons so the two
 * cannot drift apart.
 *
 * Yellow on the app's darkest blue — the highest-contrast pair the palette
 * holds, which is what the one action on the screen should be. Worth knowing:
 * --sprite-gold is also the mastery colour (crowns, the mastered tile ring,
 * the mastery bar), so it now marks two things rather than one.
 */

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
 * starts on the same edge. Takes the text colour it sits in: ink on the white
 * trigger, white in the indigo list.
 */
function AllVariantsThumb() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center">
      <Layers className="size-4" />
    </span>
  );
}

/** The ink border each panel draws on its map-facing edge (border-r-3 / border-l-3). */
const PANEL_BORDER = 3;

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
  // The phone has no map beside the catalog, so there is nothing to hide
  // it for: it is always shown there.
  const panelShown = sidebarOpen || isMobile;
  const hydrated = useHydrated();
  const [storedDemoMode, setDemoMode] = useState(false);
  // Never on in production, however the stored value was left.
  const demoMode = DEMO_AVAILABLE && storedDemoMode;
  useEffect(() => {
    if (!DEMO_AVAILABLE) return;
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
    if (!DEMO_AVAILABLE) return;
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
  // True while the edge is being dragged, so the map's column tracks the
  // pointer directly instead of easing after it.
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    // Remembered like the width: hidden stays hidden across a reload.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.localStorage.getItem(SIDEBAR_OPEN_KEY) === "0") setSidebarOpen(false);
  }, []);

  function toggleSidebar() {
    setSidebarOpen((open) => {
      try {
        window.localStorage.setItem(SIDEBAR_OPEN_KEY, open ? "0" : "1");
      } catch {
        // Storage blocked: the toggle still works for this visit.
      }
      return !open;
    });
  }

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
    setResizing(true);
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
      setResizing(false);
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

  if (!hydrated) return <AppSplash />;

  return (
    // h-dvh, not h-screen: 100vh can resolve to a stale or oversized height
    // (browser UI, zoom), which leaves the shell not matching the window.
    // reducedMotion="user": every Framer animation in the app (the load-in,
    // the card stagger, the panel slides) drops to a fade or nothing when the
    // OS asks for reduced motion.
    <MotionConfig reducedMotion="user">
    <div className="relative flex h-dvh w-full overflow-hidden bg-card">
      {/* Pinned to the window's left edge, outside the map's container below.
          Hidden (desktop only), it slides fully off to the left as it fades,
          and goes inert so nothing in it can be tabbed to. */}
      <motion.aside
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: panelShown ? 1 : 0, x: panelShown ? 0 : "-100%" }}
        transition={{
          x: { duration: SIDEBAR_SLIDE_S, ease: SIDEBAR_EASE },
          opacity: { duration: SIDEBAR_FADE_S },
        }}
        inert={!panelShown}
        aria-hidden={!panelShown}
        className={cn(
          // Flush to the window: no margin, no radius. The border only runs
          // along the edge that faces the map — on the window's own edges it
          // would just draw a line around the screen.
          "panel-wash absolute top-0 bottom-0 left-0 z-[600] flex flex-col overflow-hidden border-pop-ink bg-card",
          // On a phone the catalog IS the app: full width, and no right border
          // because there is no map beside it for one to divide. The padding
          // keeps the last card clear of the Add finding bar below.
          isMobile ? "w-full" : "border-r-[3px]"
        )}
        // From the same state the map container reserves, so the two can't
        // drift apart. Left off entirely on a phone, so the w-full class above
        // isn't fighting an inline width.
        style={{
          width: isMobile ? undefined : sidebarWidth,
          paddingBottom: isMobile ? MOBILE_CTA_HEIGHT : undefined,
        }}
      >
        <SpriteCatalogBrowser
          selectedSpriteId={selectedSpriteId}
          onSelect={setSelectedSpriteId}
          visibleSpriteIds={visibleSpriteIds}
          onSetVisibility={setSpriteVisibility}
          showAccount={isMobile}
        />

        {/* The drag handle, sitting on the panel's own edge. Only its middle
            band is grabbable so it doesn't fight the sidebar's scrollbar
            gutter, and it widens on hover rather than being visible at rest —
            the border it sits on is the affordance. */}
        {panelShown && !isMobile && (
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
            className="absolute inset-y-0 right-0 z-10 w-[5px] translate-x-[3px] cursor-col-resize touch-none bg-transparent transition-colors hover:bg-ring/60 focus-visible:bg-ring/60 focus-visible:outline-none"
          />
        )}
      </motion.aside>

      {/* The map's container: everything the sidebar doesn't cover. The margin
          reserves the open sidebar's width, so the map — and the controls and
          hints overlaid on it — are sized and centered in the visible space.
          Hiding the sidebar eases the margin to 0 on the sidebar's own curve,
          so the map widens into the space as the panel slides away; Leaflet
          re-fits the island on every frame of it (its ResizeObserver). While
          the edge is being dragged the margin follows the pointer directly. */}
      {/* The map is not merely hidden on a phone, it is never mounted:
          Leaflet would otherwise initialise, fit itself and start pulling
          256px tiles for a view nobody can see. */}
      {!isMobile && (
      <div
        data-slot="map-container"
        className="relative min-w-0 flex-1"
        style={{
          marginLeft: sidebarOpen ? sidebarWidth : 0,
          transition: resizing ? "none" : `margin-left ${SIDEBAR_SLIDE_S}s cubic-bezier(${SIDEBAR_EASE.join(",")})`,
        }}
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

        <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2">
          {/* Hide / show the sidebar. First in the map's own control row, so
              it sits right against the sidebar's edge when open and stays in
              the map's top-left corner when it's hidden. Its chevron turns to
              point the way the panel will move. */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleSidebar}
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-pressed={sidebarOpen}
            // Dressed as a piece of the sidebar rather than a white sticker:
            // the sidebar's own fill inside the ink outline (no drop), with the
            // glyph in the same lavender as the cards' Radar icons, turning
            // yellow on hover like them.
            className="pointer-events-auto !size-9 rounded-full border-[3px] border-pop-ink !bg-card text-muted-foreground transition-[color,transform] duration-150 hover:!bg-card hover:!text-pop-yellow active:scale-95 focus-visible:ring-3 focus-visible:ring-pop-yellow/60"
          >
            <SidebarToggleIcon open={sidebarOpen} className="size-[18px]" />
          </Button>
          {/* Only present once something is pinned. With every Radar off the
              map has no findings on it, so narrowing them to one variant is a
              control over nothing — and one that would otherwise sit there
              inviting a click that changes nothing visible.

              Styled exactly like the Sign In pill opposite it — 36px, white
              sticker, 3px ink outline and drop, Anton caps, yellow on hover —
              so the two read as one row of map controls. A chosen variant
              adds its Sprite's thumbnail; "All variants" is words only. */}
          {visibleSpriteIds.size > 0 && (
          <Select
            value={variantFilter ?? ALL_VARIANTS}
            onValueChange={(value) =>
              setVariantFilter(value === ALL_VARIANTS ? null : (value as string))
            }
          >
            <SelectTrigger
              aria-label="Filter the map by variant"
              // The ! overrides: SelectTrigger's own base classes (bg-input/50,
              // a 1px transparent border, its data-size heights) sit later in
              // the generated stylesheet than the material utility, so they
              // win the cascade at equal specificity without them. Hover turns
              // it yellow via material, like Sign In.
              className="material display-caps !bg-white hover:!bg-pop-yellow !border-[3px] !border-pop-ink pointer-events-auto !h-9 gap-1.5 rounded-full py-0 pr-3 pl-4 !text-base text-pop-ink"
            >
              <SelectValue>
                {(value: string) => {
                  // A chosen variant shows its Sprite beside the name, so the
                  // pill says at a glance which one the map is narrowed to.
                  // "All variants" stays words only.
                  const chosen = variantOptions.find((v) => v.slot === value);
                  if (!chosen) return "All variants";
                  return (
                    <span className="flex items-center gap-1.5">
                      <SpriteThumb id={chosen.id} icon={chosen.icon} />
                      {chosen.label}
                    </span>
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent align="start">
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

          {/* Always present in development, so the mode can be left as easily
              as it is entered — but it never looks the same in both states.
              Lit and labelled while on, because the map is then showing data
              nobody logged and that must not be a quiet state. Absent in
              production entirely. */}
          {DEMO_AVAILABLE && (
          <Button
            variant="ghost"
            onClick={toggleDemoMode}
            aria-pressed={demoMode}
            className={cn(
              "material pointer-events-auto h-11 rounded-full hover:text-pop-ink",
              demoMode ? "!bg-pop-yellow text-pop-ink" : "text-pop-ink"
            )}
          >
            <FlaskConical strokeWidth={1.875} />
            {demoMode ? "Demo data — on" : "Demo data"}
          </Button>
          )}
          </div>
          {/* The account button, in the site's top-right corner: 16px from the top
              and right, the same inset as the sidebar's logo. */}
          <AccountControl className="pointer-events-auto self-start" />
        </div>

        {/* Centred along the bottom of the map rather than tucked in the top
            corner with the filters: it is the one thing the page asks you to
            do, so it reads as the page's action instead of a third control in
            a row of them. Clear of the zoom cluster in the bottom-right and of
            the confirmation toast, which now sits above it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[500] flex justify-center px-4">
          <Button
            onClick={() => {
              setAddKey((k) => k + 1);
              setAddOpen(true);
            }}
            className={cn("pointer-events-auto h-12 gap-2 rounded-full px-7 text-base", ADD_FINDING_STYLE)}
          >
            Add Sprite Location
          </Button>
        </div>

      </div>
      )}

      {/* The phone's one action, where a thumb reaches. The map's own
          Add finding button lives in the controls overlaid on the map, so
          without this there would be no way to log a finding at all. */}
      {isMobile && (
        <div
          // --muted, the same fill as the header strip at the top of the
          // catalog — not --card, which is what the content itself uses.
          // HIG's materials guidance puts controls and navigation on a layer
          // that is visibly distinct from the content layer; painting this bar
          // in the content's own colour left it reading as part of the list
          // rather than as a bar floating above it.
          className="fixed inset-x-0 bottom-0 z-[650] border-t-[3px] border-pop-ink bg-muted px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          style={{ minHeight: MOBILE_CTA_HEIGHT }}
        >
          <Button
            onClick={() => {
              setAddKey((k) => k + 1);
              setAddOpen(true);
            }}
            // text-base: this Button's own default is text-sm (14px), same
            // as the desktop map CTA — but there is nothing on a phone
            // screen for it to visually match at that size, and 14px reads
            // as noticeably smaller than the sheet it opens once that sheet
            // is also fixed. One step up, same as everything else scaled
            // for a phone this session.
            className={cn("h-12 w-full gap-2 text-base", ADD_FINDING_STYLE)}
          >
            Add Sprite Location
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
              // Above the Add finding button below it, which now occupies the
              // bottom-centre this used to have to itself.
              role="status"
              className="material pointer-events-none absolute bottom-24 left-1/2 z-[500] flex -translate-x-1/2 items-center gap-2 rounded-full py-2 pr-5 pl-2 text-sm font-semibold whitespace-nowrap text-pop-ink"
            >
              {/* The same yellow sticker disc as the mastered badge, with a tick. */}
              <span aria-hidden className="flex size-6 items-center justify-center rounded-full border-2 border-pop-ink bg-pop-yellow">
                <CheckIcon className="size-3.5" />
              </span>
              Sprite location added — {displayName(getSprite(lastAdded)?.name)}
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
              "panel-wash flex flex-col overflow-hidden border-pop-ink bg-card",
              isMobile ? "fixed inset-0 z-[700] w-full" : "shrink-0 border-l-[3px]"
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
    </MotionConfig>
  );
}
