"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Radar } from "lucide-react"; // the cards' own radar glyph (see sprite-catalog-browser.tsx)
import {
  AlertIcon,
  CheckIcon,
  FlaskConical,
  Layers,
  ListIcon,
  MapIcon,
  SidebarToggleIcon,
  X,
} from "@/components/icons";
import IslandMapCanvas from "@/components/map/island-map-canvas";
import type { MapFocusRequest } from "@/components/map/island-map";
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
import { titleCase } from "@/lib/title-case";
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

/**
 * The narrowest the map may be squeezed to by an open profile. Beside the
 * catalog, a profile takes a second sidebar's width out of the window, and
 * below this the island shrinks until its names pile up and the map's own
 * controls collide (a 1000px window left it 250px wide). Under it, the
 * profile opens over the catalog's column instead — drilling into the list,
 * the way a phone does — and the map keeps its size.
 */
const MIN_MAP_WIDTH = 560;

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
 * Phone width, where the app is the Sprite catalog first and the map a view
 * you switch to.
 *
 * A media query rather than CSS classes because the map is not merely hidden
 * on a phone, it is only mounted while you're looking at it: Leaflet would
 * otherwise initialise, fit itself and start pulling 256px tiles for a view no
 * one can see. The detail panel needs it too — it animates its own width open
 * on desktop, and an inline width from Framer Motion cannot be overridden by a
 * `max-md:` class.
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

/** The window's width, for deciding whether a profile fits beside the map. */
function useWindowWidth() {
  return useSyncExternalStore(subscribeToWidth, () => window.innerWidth, () => 1280);
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

/** Height the mobile Add finding bar occupies before it's measured (it grows by the home indicator's inset). */
const MOBILE_CTA_HEIGHT = 72;

/** An element's rendered height, kept current. */
function useElementHeight(fallback: number) {
  const [height, setHeight] = useState(fallback);
  const [node, setNode] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(Math.round(node.getBoundingClientRect().height)));
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  return [height, setNode] as const;
}

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

/** How a save is going, for the one toast that reports it. */
type SaveToast =
  | { kind: "saving"; spriteId: string }
  | { kind: "saved"; spriteId: string; poiId: string }
  | { kind: "error"; spriteId: string; values: AddFindingValues };

/** The map's primary controls' sticker: white, ink outline and drop, Anton caps (see Sign In). */
const MAP_PILL =
  "material display-caps pointer-events-auto flex h-9 items-center rounded-full text-base leading-none text-pop-ink";

export default function Home() {
  const { findings: savedFindings, addFinding, error: saveError } = useFindings();
  const { pois } = usePois();
  const { sprites, getSprite } = useSpriteCatalog();
  const [selectedSpriteId, setSelectedSpriteId] = useState<string | null>(null);
  /**
   * Which Sprites' findings are pinned, as an override the Radar toggles own
   * once the user has touched one. Null until then, meaning "whatever has been
   * found" — see visibleSpriteIds below.
   */
  const [pinnedOverride, setPinnedOverride] = useState<Set<string> | null>(null);
  // The Add finding modal. Bumping the key remounts it, so every open starts
  // from a blank form (pre-picked with the sprite whose panel is open), or
  // from a failed save's answers when it's being retried.
  const [addOpen, setAddOpen] = useState(false);
  const [addKey, setAddKey] = useState(0);
  const [retryValues, setRetryValues] = useState<AddFindingValues | null>(null);
  const [toast, setToast] = useState<SaveToast | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Phone only: the map is a view you switch to from the bottom bar.
  const [mobileMap, setMobileMap] = useState(false);
  // A place to fly the map to, from a profile's location rows.
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);
  // Which variant the map is narrowed to, as a slot key ("gold"). null shows
  // every variant of whatever the Radar toggles have turned on.
  const [variantFilter, setVariantFilter] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const windowWidth = useWindowWidth();
  const hydrated = useHydrated();
  const [barHeight, setBarNode] = useElementHeight(MOBILE_CTA_HEIGHT);

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
  const [storedDemoMode, setDemoMode] = useState(false);
  // Never on in production, however the stored value was left.
  const demoMode = DEMO_AVAILABLE && storedDemoMode;
  useEffect(() => {
    if (!DEMO_AVAILABLE) return;
    // Read synchronously, NOT deferred to requestAnimationFrame: rAF callbacks
    // do not run while a page is hidden, so a background tab booted with demo
    // mode off however the setting was left.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDemoMode(window.localStorage.getItem(DEMO_MODE_KEY) === "1");
  }, []);

  function toggleDemoMode() {
    if (!DEMO_AVAILABLE) return;
    const next = !demoMode;
    window.localStorage.setItem(DEMO_MODE_KEY, next ? "1" : "0");
    setDemoMode(next);
    if (!next) return;
    // Switching demo on has to pin it too, once the user has taken over the
    // pinning; before that the visible set is derived and demo's arrive pinned.
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
   * opens clean and every pin on it is there because someone asked for it —
   * the map's own hint offers "Show all sightings" as the one-tap way in.
   * Demo mode is the exception: its whole purpose is to show the map
   * populated.
   *
   * Derived, not seeded into state by an effect (which raced the findings
   * loading). The first Radar click installs an override and the toggles own
   * it from then on.
   */
  const autoVisibleSpriteIds = useMemo(
    () => (demoMode ? new Set(findings.map((f) => f.spriteId)) : new Set<string>()),
    [demoMode, findings]
  );
  const visibleSpriteIds = pinnedOverride ?? autoVisibleSpriteIds;

  // Every live variant id, by family: a Radar, "Show on map" and a new
  // sighting all pin a whole Sprite, never one variant of it.
  const liveSprites = useMemo(() => sprites.filter((s) => s.currentlyLive), [sprites]);
  const familyIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of liveSprites) {
      const list = map.get(s.family);
      if (list) list.push(s.id);
      else map.set(s.family, [s.id]);
    }
    return map;
  }, [liveSprites]);
  const baseIdOf = useCallback(
    (id: string) => {
      const family = getSprite(id)?.family;
      if (!family) return id;
      return liveSprites.find((s) => s.family === family && s.variant === null)?.id ?? id;
    },
    [getSprite, liveSprites]
  );

  // How many sightings each Sprite has, for the cards' radar counts and the
  // map's "Show all sightings".
  const sightingsByFamily = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of findings) {
      const family = getSprite(f.spriteId)?.family;
      if (family) counts.set(family, (counts.get(family) ?? 0) + 1);
    }
    return counts;
  }, [findings, getSprite]);

  // The Sprites whose Radar is on, by family.
  const pinnedFamilies = useMemo(() => {
    const set = new Set<string>();
    for (const id of visibleSpriteIds) {
      const family = getSprite(id)?.family;
      if (family) set.add(family);
    }
    return set;
  }, [visibleSpriteIds, getSprite]);

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
    // Synchronous for the same reason as demo mode above.
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

  /**
   * The filter's rows: one per variant slot, each carrying a real icon of that
   * variant rather than a colour swatch — the same thumb + name the Add
   * finding dialog's variant picker uses. With a Radar on, the rows show that
   * Sprite's own variants; with nothing on, the first live Sprite that has
   * each, so every row still carries real artwork.
   */
  const variantOptions = useMemo(() => {
    const watched = liveSprites.filter((s) => visibleSpriteIds.has(s.id));
    return VARIANT_SLOTS.map((slot) => {
      const match =
        watched.find((s) => variantKey(s.variant) === slot) ??
        liveSprites.find((s) => variantKey(s.variant) === slot);
      return {
        slot,
        label: VARIANT_NAME[slot] ?? slot,
        // The scale is measured per sprite id, so the id has to be the one the
        // icon belongs to — see SpriteThumb.
        id: match?.id ?? "",
        icon: match?.icon ?? null,
      };
    });
  }, [liveSprites, visibleSpriteIds]);

  /**
   * What the map actually pins: the Sprites whose Radar is on, narrowed to one
   * variant when the filter asks for one. The Radar is "which Sprites am I
   * hunting", the filter "which variant of them am I looking at".
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
    // Turning off the last Radar takes the variant filter off screen with it,
    // so the filter resets too: a control the user can no longer see must not
    // keep narrowing the map from behind it.
    if (next.size === 0) setVariantFilter(null);
  }

  /** Every Sprite that has at least one sighting, on the map at once. */
  function showAllSightings() {
    const ids = new Set<string>();
    for (const [family, count] of sightingsByFamily) {
      if (count > 0) for (const id of familyIds.get(family) ?? []) ids.add(id);
    }
    setPinnedOverride(ids);
  }

  function clearPins() {
    setPinnedOverride(new Set());
    setVariantFilter(null);
  }

  // Where focus was when a profile opened, to hand it back when it closes.
  const returnFocusRef = useRef<HTMLElement | null>(null);

  /** Opens a Sprite's profile — always its family's, whichever variant was picked. */
  function openProfile(id: string) {
    if (!selectedSpriteId) returnFocusRef.current = document.activeElement as HTMLElement | null;
    setSelectedSpriteId(baseIdOf(id));
  }

  const closeProfile = useCallback(() => {
    setSelectedSpriteId(null);
    const back = returnFocusRef.current;
    returnFocusRef.current = null;
    if (back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }, []);

  // Escape closes the profile, as it does the Add finding dialog — unless that
  // dialog is what's open, in which case Escape is its.
  useEffect(() => {
    if (!selectedSpriteId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !addOpen && !e.defaultPrevented) closeProfile();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedSpriteId, addOpen, closeProfile]);

  const selectedFamily = selectedSpriteId ? (getSprite(selectedSpriteId)?.family ?? null) : null;

  /** The profile's "Show on map": pins or unpins the whole Sprite. */
  function toggleProfileOnMap() {
    if (!selectedFamily) return;
    const on = !pinnedFamilies.has(selectedFamily);
    setSpriteVisibility(familyIds.get(selectedFamily) ?? [], on);
    // On a phone the map is a separate view: go and look.
    if (on && isMobile) {
      setMobileMap(true);
      closeProfile();
    }
  }

  /** A profile's location row: pin the Sprite and fly the map to that place. */
  function focusPlace(poiId: string) {
    const poi = pois.find((p) => p.id === poiId);
    if (!poi || !selectedFamily) return;
    if (!pinnedFamilies.has(selectedFamily)) setSpriteVisibility(familyIds.get(selectedFamily) ?? [], true);
    setFocusRequest({ x: poi.x, y: poi.y, key: Date.now() });
    if (isMobile) {
      setMobileMap(true);
      closeProfile();
    }
  }

  function openAddFinding(values: AddFindingValues | null = null) {
    setRetryValues(values);
    setAddKey((k) => k + 1);
    setAddOpen(true);
  }

  async function confirmFinding(values: AddFindingValues) {
    // Close first: the insert is a network round-trip, and the form has
    // nothing left to show while it runs. The toast says it's under way.
    setAddOpen(false);
    setToast({ kind: "saving", spriteId: values.spriteId });
    const saved = await addFinding(values);
    if (!saved) {
      setToast({ kind: "error", spriteId: values.spriteId, values });
      return;
    }
    // Log a sighting and you should see it: its Sprite goes on the map,
    // whether or not its Radar was on (or any Radar had been touched yet).
    const family = getSprite(values.spriteId)?.family;
    const ids = (family && familyIds.get(family)) || [values.spriteId];
    setPinnedOverride((prev) => {
      const next = new Set(prev ?? autoVisibleSpriteIds);
      for (const id of ids) next.add(id);
      return next;
    });
    setToast({ kind: "saved", spriteId: values.spriteId, poiId: values.poiId });
  }

  // The save hook's own message, once a save has failed.
  const toastMessage = toast?.kind === "error" ? (saveError ?? "Something went wrong.") : "";

  // Saved toasts clear themselves; an error waits a while longer so its
  // "Try again" can be reached.
  useEffect(() => {
    if (!toast || toast.kind === "saving") return;
    const current = toast;
    const timer = window.setTimeout(
      () => setToast((t) => (t === current ? null : t)),
      toast.kind === "saved" ? 2600 : 9000
    );
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!hydrated) return <AppSplash />;

  // Room for the map beside both panels? If not, a profile opens over the
  // catalog's column instead of beside it (see MIN_MAP_WIDTH).
  const stacked = !isMobile && windowWidth - sidebarWidth * 2 < MIN_MAP_WIDTH;
  const profileOpen = selectedSpriteId !== null;
  // The left column is showing: the catalog, or (stacked) a profile over it.
  const leftColumnOpen = sidebarOpen || (stacked && profileOpen);
  // The catalog itself: shown, and not covered by the stacked profile or the
  // phone's map view.
  const catalogShown = (sidebarOpen || isMobile) && !(stacked && profileOpen) && !(isMobile && mobileMap);
  const catalogVisible = sidebarOpen || isMobile;
  const mapShown = !isMobile || mobileMap;

  const pinnedCount = pinnedFamilies.size;
  const anySightings = findings.length > 0;

  /** The map's hint and pinned-state chip, shared by the desktop map and the phone's map view. */
  const mapHint = (
    <AnimatePresence>
      {pinnedCount === 0 && (
        <motion.div
          key="map-hint"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="pointer-events-auto mx-auto flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border-[3px] border-pop-ink bg-card py-2 pr-2 pl-3 shadow-[0_3px_0_var(--pop-ink)]"
          role="note"
        >
          <Radar aria-hidden className="size-5 shrink-0 text-sprite-gold" strokeWidth={1.75} />
          <p className="text-sm leading-snug text-foreground">
            {anySightings ? (
              <>Turn on a Sprite&rsquo;s radar to see where it&rsquo;s been found.</>
            ) : (
              <>No sightings logged yet. Found one? Add its location.</>
            )}
          </p>
          {anySightings && (
            <Button
              variant="ghost"
              onClick={showAllSightings}
              className={cn(MAP_PILL, "h-8 shrink-0 px-3 text-sm hover:text-pop-ink")}
            >
              Show all
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  const pinnedChip =
    pinnedCount > 0 ? (
      <Button
        variant="ghost"
        onClick={clearPins}
        aria-label={`Clear ${pinnedCount} ${pinnedCount === 1 ? "Sprite" : "Sprites"} from the map`}
        title="Clear the map"
        className={cn(MAP_PILL, "gap-1.5 !border-[3px] !border-pop-ink !bg-white pr-2.5 pl-3 hover:!bg-pop-yellow hover:text-pop-ink")}
      >
        <Radar aria-hidden className="size-4" strokeWidth={2.25} />
        <span className="tabular-nums">{pinnedCount}</span> on map
        <X className="ml-0.5 size-3.5" />
      </Button>
    ) : null;

  const variantFilterControl =
    visibleSpriteIds.size > 0 ? (
      <Select
        value={variantFilter ?? ALL_VARIANTS}
        onValueChange={(value) => setVariantFilter(value === ALL_VARIANTS ? null : (value as string))}
      >
        <SelectTrigger
          aria-label="Filter the map by variant"
          // The ! overrides: SelectTrigger's own base classes (bg-input/50, a
          // 1px transparent border, its data-size heights) sit later in the
          // generated stylesheet than the material utility.
          className="material display-caps !bg-white hover:!bg-pop-yellow !border-[3px] !border-pop-ink pointer-events-auto !h-9 gap-1.5 rounded-full py-0 pr-3 pl-4 !text-base text-pop-ink"
        >
          <SelectValue>
            {(value: string) => {
              // A chosen variant shows its Sprite beside the name, so the pill
              // says at a glance which one the map is narrowed to.
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
    ) : null;

  const demoToggle = DEMO_AVAILABLE ? (
    <Button
      variant="ghost"
      onClick={toggleDemoMode}
      aria-pressed={demoMode}
      className={cn(
        "material pointer-events-auto h-9 rounded-full hover:text-pop-ink",
        demoMode ? "!bg-pop-yellow text-pop-ink" : "text-pop-ink"
      )}
    >
      <FlaskConical strokeWidth={1.875} />
      {demoMode ? "Demo data — on" : "Demo data"}
    </Button>
  ) : null;

  const map = (
    <IslandMapCanvas
      findings={findings}
      visibleSpriteIds={pinnedSpriteIds}
      // Findings are logged through the Add finding modal, not by clicking
      // the map, so map-click placement stays off.
      isAddMode={false}
      pois={pois}
      onMapClick={() => {}}
      onSelectSprite={openProfile}
      focusRequest={focusRequest}
    />
  );

  /** The one toast: saving, saved, or failed with a way to try again. */
  const toastView = (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.kind}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
          role={toast.kind === "error" ? "alert" : "status"}
          className={cn(
            "material pointer-events-auto flex max-w-[min(28rem,calc(100vw-2rem))] items-center gap-2 py-1.5 pl-1.5 text-sm font-semibold text-pop-ink",
            // An error has more to say and a button to reach: it may take two
            // lines, so it's a rounded card rather than a pill.
            toast.kind === "error" ? "rounded-2xl pr-1.5" : "rounded-full pr-4"
          )}
        >
          {toast.kind === "saving" && (
            <>
              <span
                aria-hidden
                className="size-6 shrink-0 animate-spin rounded-full border-[3px] border-pop-ink border-t-transparent motion-reduce:animate-none"
              />
              <span className="truncate">Saving location…</span>
            </>
          )}
          {toast.kind === "saved" && (
            <>
              {/* The same yellow sticker disc as the mastered badge, with a tick. */}
              <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-pop-ink bg-pop-yellow">
                <CheckIcon className="size-3.5" />
              </span>
              <span className="truncate">
                Location saved — {displayName(getSprite(toast.spriteId)?.name)}
                {(() => {
                  const poi = pois.find((p) => p.id === toast.poiId);
                  return poi ? `, ${titleCase(poi.name)}` : "";
                })()}
              </span>
            </>
          )}
          {toast.kind === "error" && (
            <>
              <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-pop-ink bg-destructive text-white">
                <AlertIcon className="size-3.5" />
              </span>
              <span className="line-clamp-2 min-w-0 flex-1 leading-snug">
                Couldn&rsquo;t save that location. <span className="font-medium">{toastMessage}</span>
              </span>
              <Button
                variant="ghost"
                onClick={() => {
                  const values = toast.values;
                  setToast(null);
                  openAddFinding(values);
                }}
                className={cn("h-8 shrink-0 rounded-full px-3 text-sm", ADD_FINDING_STYLE)}
              >
                Try again
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setToast(null)}
                aria-label="Dismiss"
                className="size-8 shrink-0 rounded-full text-pop-ink hover:!bg-pop-ink/10"
              >
                <X className="size-3.5" />
              </Button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

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
        animate={{ opacity: catalogVisible ? 1 : 0, x: catalogVisible ? 0 : "-100%" }}
        transition={{
          x: { duration: SIDEBAR_SLIDE_S, ease: SIDEBAR_EASE },
          opacity: { duration: SIDEBAR_FADE_S },
        }}
        inert={!catalogShown}
        aria-hidden={!catalogShown}
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
          paddingBottom: isMobile ? barHeight : undefined,
        }}
      >
        <SpriteCatalogBrowser
          selectedFamily={selectedFamily}
          onSelect={openProfile}
          visibleSpriteIds={visibleSpriteIds}
          onSetVisibility={setSpriteVisibility}
          sightingsByFamily={sightingsByFamily}
          statusBarTone={isMobile && mobileMap ? "muted" : null}
          showAccount={isMobile}
        />

        {/* The drag handle, sitting on the panel's own edge. It widens on
            hover rather than being visible at rest — the border it sits on is
            the affordance. */}
        {catalogShown && !isMobile && (
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

      {/* The map's container: everything the left column doesn't cover. The
          margin reserves the column's width, so the map — and the controls
          overlaid on it — are sized and centred in the visible space. Hiding
          the sidebar eases the margin to 0 on the sidebar's own curve, and
          Leaflet re-fits the island as it widens (its ResizeObserver). While
          the edge is being dragged the margin follows the pointer directly.

          On a phone it's a view of its own, over the catalog and above the
          bottom bar, mounted only while it's showing. */}
      {mapShown && (
      <div
        data-slot="map-container"
        className={cn(isMobile ? "fixed inset-x-0 top-0 z-[640] bg-map-field" : "relative min-w-0 flex-1")}
        style={
          isMobile
            ? { bottom: barHeight }
            : {
                marginLeft: leftColumnOpen ? sidebarWidth : 0,
                transition: resizing ? "none" : `margin-left ${SIDEBAR_SLIDE_S}s cubic-bezier(${SIDEBAR_EASE.join(",")})`,
              }
        }
      >
        {map}

        {/* The map's own controls, over its top edge. Two columns: the
            account pinned right, and everything else in a left group that
            wraps rather than sliding under it when the map is narrow. */}
        <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] flex flex-col gap-3 px-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {/* Hide / show the sidebar. First in the map's own control row,
                  so it sits right against the sidebar's edge when open and
                  stays in the map's top-left corner when it's hidden. Desktop
                  only: on a phone the bottom bar switches views. */}
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={toggleSidebar}
                  aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                  title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                  aria-pressed={sidebarOpen}
                  // Dressed as a piece of the sidebar rather than a white
                  // sticker: the sidebar's own fill inside the ink outline
                  // (no drop), the glyph in the cards' Radar lavender,
                  // yellow on hover like them.
                  className="pointer-events-auto !size-9 rounded-full border-[3px] border-pop-ink !bg-card text-muted-foreground transition-[color,transform] duration-150 hover:!bg-card hover:!text-pop-yellow active:scale-95 focus-visible:ring-3 focus-visible:ring-pop-yellow/60"
                >
                  <SidebarToggleIcon open={sidebarOpen} className="size-[18px]" />
                </Button>
              )}
              {variantFilterControl}
              {pinnedChip}
              {demoToggle}
            </div>
            {/* The account button, in the site's top-right corner (desktop;
                on a phone it's in the catalog's header). */}
            {!isMobile && <AccountControl className="pointer-events-auto self-start" />}
          </div>
          {mapHint}
        </div>

        {/* Centred along the bottom of the map: it is the one thing the page
            asks you to do. Desktop only — the phone's lives in its bottom
            bar, where a thumb reaches. */}
        {!isMobile && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[500] flex justify-center px-4">
            <Button
              onClick={() => openAddFinding()}
              className={cn("pointer-events-auto h-12 gap-2 rounded-full px-7 text-base", ADD_FINDING_STYLE)}
            >
              Add Sprite Location
            </Button>
          </div>
        )}

        {/* Above the Add Sprite Location button, centred on the map it
            reports on rather than on the whole window. */}
        {!isMobile && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[88px] z-[510] flex justify-center px-4">
            {toastView}
          </div>
        )}
      </div>
      )}

      {/* The phone's bottom bar: the list/map switch, and the one action,
          where a thumb reaches. */}
      {isMobile && (
        <div
          ref={setBarNode}
          // --muted, a step lighter than the catalog: controls sit on a layer
          // visibly distinct from the content they scroll over.
          className="fixed inset-x-0 bottom-0 z-[650] flex items-center gap-3 border-t-[3px] border-pop-ink bg-muted px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          style={{ minHeight: MOBILE_CTA_HEIGHT }}
        >
          <Button
            variant="ghost"
            onClick={() => setMobileMap((on) => !on)}
            aria-label={mobileMap ? "Show the Sprite list" : "Show the map"}
            aria-pressed={mobileMap}
            className="material relative size-12 shrink-0 rounded-full text-pop-ink hover:text-pop-ink"
          >
            {mobileMap ? <ListIcon className="size-5" /> : <MapIcon className="size-5" />}
            {/* How many Sprites are on the map: the Radars' effect, visible
                from the list. Pops when it changes. */}
            <AnimatePresence initial={false}>
              {!mobileMap && pinnedCount > 0 && (
                <motion.span
                  key={pinnedCount}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  aria-hidden
                  className="display-caps absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-pop-ink bg-pop-yellow px-1 text-xs leading-none text-pop-ink tabular-nums"
                >
                  {pinnedCount}
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
          <Button
            onClick={() => openAddFinding()}
            // text-base: one step up from the Button's own 14px, so the bar's
            // action reads at the size of the sheet it opens.
            className={cn("h-12 min-w-0 flex-1 gap-2 text-base", ADD_FINDING_STYLE)}
          >
            Add Sprite Location
          </Button>
        </div>
      )}

      {/* Phone: the toast floats just above the bottom bar, over whichever
          view is showing — the profile sheet (z-700) included. */}
      {isMobile && (
        <div
          className="pointer-events-none fixed inset-x-0 z-[710] flex justify-center px-4"
          style={{ bottom: barHeight + 12 }}
        >
          {toastView}
        </div>
      )}

      <AddFindingDialog
        key={addKey}
        open={addOpen}
        onOpenChange={setAddOpen}
        pois={pois}
        defaultSpriteId={selectedSpriteId}
        initialValues={retryValues}
        onConfirm={confirmFinding}
      />

      <AnimatePresence>
        {selectedSpriteId !== null && (
          <motion.aside
            // Keyed by layout, not by Sprite: switching Sprites keeps the
            // panel open and cross-fades its contents (SpriteDetailPanel keys
            // itself), instead of collapsing and reopening the whole panel.
            key={isMobile ? "phone" : stacked ? "stacked" : "beside"}
            aria-label="Sprite profile"
            // Phone: slides in over everything from the right. Stacked: over
            // the catalog's column, a short slide from the left like a drill-
            // in. Beside: opens its own width next to the map.
            initial={
              isMobile ? { x: "100%", opacity: 1 } : stacked ? { x: -16, opacity: 0 } : { width: 0, opacity: 0 }
            }
            animate={isMobile ? { x: 0, opacity: 1 } : stacked ? { x: 0, opacity: 1 } : { width: sidebarWidth, opacity: 1 }}
            exit={isMobile ? { x: "100%", opacity: 1 } : stacked ? { x: -16, opacity: 0 } : { width: 0, opacity: 0 }}
            transition={{ duration: stacked ? 0.22 : 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "panel-wash flex flex-col overflow-hidden border-pop-ink bg-card",
              isMobile
                ? "fixed inset-0 z-[700] w-full"
                : stacked
                  ? "absolute top-0 bottom-0 left-0 z-[620] border-r-[3px]"
                  : "shrink-0 border-l-[3px]"
            )}
            style={stacked ? { width: sidebarWidth } : undefined}
          >
            {/* Fixed width beside the map, so the panel's contents don't
                reflow while the aside animates its own width — minus the
                border, which the aside's width includes and this div's does
                not. */}
            <div
              className={cn("h-full", (isMobile || stacked) && "w-full")}
              style={{ width: isMobile || stacked ? undefined : sidebarWidth - PANEL_BORDER }}
            >
              <SpriteDetailPanel
                spriteId={selectedSpriteId}
                findings={findings}
                pois={pois}
                onBack={closeProfile}
                shownOnMap={selectedFamily !== null && pinnedFamilies.has(selectedFamily)}
                onToggleMap={toggleProfileOnMap}
                onFocusPlace={focusPlace}
              />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
    </MotionConfig>
  );
}
