"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { CRS } from "leaflet";
import { Plus, Minus, RotateCcw } from "@/components/icons";
import {
  ACTIVE_MAP_PROVIDER,
  ISLAND_BOUNDS,
  ISLAND_FIT_SCALE,
  worldSizePx,
} from "./map-provider";
import { Finding } from "@/lib/findings";
import { Poi } from "@/lib/map/pois";
import { isOnIsland } from "@/lib/map/island-outline";
import { LAND_OUTLINE } from "@/lib/map/land-outline";
import { WATER_LAYERS, WATER_REACH } from "@/lib/map/water-rings";
import { Button } from "@/components/ui/button";
import { rarityAccent } from "@/lib/rarity";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { displayName } from "@/lib/sprite-name";
import { titleCase } from "@/lib/title-case";
import { lootSourceById } from "@/lib/loot-sources";
import { VARIANT_NAME, variantKey, variantLabel, variantLabelColor } from "@/lib/variant-colors";

/**
 * The island's box, shrunk around its center by ISLAND_FIT_SCALE. Fitting a
 * smaller box yields a proportionally larger view with the same center, which
 * is how the initial framing gets its extra scale without drifting off-center.
 */
function islandFitBounds(worldSize: number, nativeZoom: number) {
  const cx = (ISLAND_BOUNDS.minX + ISLAND_BOUNDS.maxX) / 2;
  const cy = (ISLAND_BOUNDS.minY + ISLAND_BOUNDS.maxY) / 2;
  // Plus the water's reach past the coast, so the fitted view frames the
  // water too instead of cropping it.
  const ringReach = WATER_REACH;
  const halfW = (ISLAND_BOUNDS.maxX - ISLAND_BOUNDS.minX) / 2 / ISLAND_FIT_SCALE + ringReach;
  const halfH = (ISLAND_BOUNDS.maxY - ISLAND_BOUNDS.minY) / 2 / ISLAND_FIT_SCALE + ringReach;
  return L.latLngBounds(
    CRS.Simple.pointToLatLng(L.point((cx - halfW) * worldSize, (cy + halfH) * worldSize), nativeZoom),
    CRS.Simple.pointToLatLng(L.point((cx + halfW) * worldSize, (cy - halfH) * worldSize), nativeZoom)
  );
}

/**
 * Zoom used when focusing a single pin. Two steps below nativeZoom frames a
 * named location and its immediate surroundings — close enough to read the
 * terrain, wide enough to keep the POI's neighbours in view.
 */
const POI_ZOOM = 5;

/**
 * Clear space kept around the island when it's fitted. Leaflet rounds the map
 * pane to whole pixels, so an exact edge-to-edge fit at a fractional zoom can
 * land a pixel or two off and clip one of the island's tips; a few px of margin
 * absorbs that, so the whole island is always inside the map container.
 */
const FIT_PADDING = 4;

function makePoiLabel(name: string) {
  return L.divIcon({
    className: "poi-label-wrapper",
    html: `<span class="poi-label">${name}</span>`,
    iconSize: [0, 0],
  });
}

/**
 * One location name. `hidden` fades it out (a class on Leaflet's own element,
 * so the fade is a CSS transition rather than a rebuilt marker) when it would
 * collide with a name nearer the front — see the layout in IslandMap.
 *
 * Names draw above pins (zIndexOffset): a pin steps off a name where it can,
 * and where it can't (a small map, a crowded corner) the name stays readable
 * on top rather than being covered. A hovered pin rises above both.
 */
function PoiLabel({ poi, hidden, worldSize, nativeZoom }: { poi: Poi; hidden: boolean; worldSize: number; nativeZoom: number }) {
  const [marker, setMarker] = useState<L.Marker | null>(null);
  const latlng = useMemo(
    () => CRS.Simple.pointToLatLng(L.point(poi.x * worldSize, poi.y * worldSize), nativeZoom),
    [poi.x, poi.y, worldSize, nativeZoom]
  );
  const icon = useMemo(() => makePoiLabel(poi.name), [poi.name]);
  useEffect(() => {
    const el = marker?.getElement();
    if (!el) return;
    el.classList.toggle("is-hidden", hidden);
    el.setAttribute("aria-hidden", hidden ? "true" : "false");
  }, [marker, hidden]);
  return (
    <Marker
      ref={setMarker}
      position={latlng}
      icon={icon}
      interactive={false}
      keyboard={false}
      zIndexOffset={1000}
      eventHandlers={{ add: (e) => (e.target as L.Marker).getElement()?.classList.toggle("is-hidden", hidden) }}
    />
  );
}

function PoiLabels({
  pois,
  hiddenIds,
  worldSize,
  nativeZoom,
}: {
  pois: Poi[];
  hiddenIds: Set<string>;
  worldSize: number;
  nativeZoom: number;
}) {
  return (
    <>
      {pois.map((poi) => (
        <PoiLabel key={poi.id} poi={poi} hidden={hiddenIds.has(poi.id)} worldSize={worldSize} nativeZoom={nativeZoom} />
      ))}
    </>
  );
}

/**
 * Pins that share a location fan out into a ring instead of stacking, and
 * shrink as the ring grows so the cluster stays roughly the size of a single
 * pin. All of this is screen-space: a cluster looks the same at every zoom.
 */
// 46, not the old round marker's 60: the pin is a 60x80 box (see makeIcon),
// so 60 here made an 80px-tall pin — visibly bigger than the marker it
// replaced even though it was meant to read at the same scale. 46 gives a
// 46x61 pin, closer to the old marker's footprint.
const MARKER_BASE_SIZE = 46;
/**
 * The same pin on a small map — a phone, or a narrow window — where the whole
 * island is only 300-400px across and a 46px pin buries the names around it.
 */
const MARKER_COMPACT_SIZE = 36;
/** Map widths below this draw compact pins. */
const COMPACT_MAP_WIDTH = 520;
const MARKER_MIN_SIZE = 22;
/** Clear space between neighbouring pins in a ring. */
const MARKER_GAP = 3;
/** Clear air kept between a pin and any location name it steps away from. */
const POI_LABEL_GAP = 3;
/**
 * A name label's box, measured from its CSS (.poi-label): Anton caps at 16px
 * are ~12px tall, plus the 2.5px visible ink stroke each side, the 3px hard
 * drop below and a little of the line box. The width is measured per name (see useLabelWidths).
 */
const POI_LABEL_HEIGHT = 23;
const POI_LABEL_PAD_X = 3;

/**
 * The pin's drawn extent around its tip, as fractions of the icon (a 60x80
 * box, tip at (30, 72) — see makeIcon): the teardrop spans x 4..56 and
 * y 2..72, the ground ring reaches y 78.5.
 */
const PIN_HALF_WIDTH = 26 / 60;
const PIN_ABOVE_TIP = 70 / 80;
const PIN_BELOW_TIP = 6.5 / 80;

/** One pin is full size; each extra one at the same spot shrinks them all. */
function markerSize(count: number, base = MARKER_BASE_SIZE): number {
  if (count <= 1) return base;
  return Math.max(MARKER_MIN_SIZE, Math.round(base / Math.sqrt(count)));
}

/** How much of its slice a pin may wander within, as a fraction. */
const ANGLE_JITTER = 0.35;

/**
 * Smallest radius at which neighbouring pins still can't touch.
 *
 * Adjacent pins are a chord apart, and a chord of `2r*sin(dTheta/2)` has to
 * clear one pin's width plus the gap. The angle used is the *worst case* after
 * jitter — two pins leaning toward each other close their slices to
 * `(1 - ANGLE_JITTER)` of nominal — so the guarantee holds for every draw, not
 * just for pins sitting at their slice centers.
 */
function ringRadius(count: number, size: number): number {
  if (count <= 1) return 0;
  return (size + MARKER_GAP) / (2 * Math.sin((Math.PI * (1 - ANGLE_JITTER)) / count));
}

/**
 * Each POI's invisible fence: the area its pins scatter within.
 *
 * fortnite.gg publishes only a point per named location, no extent — so rather
 * than invent a radius per POI, each fence is sized from the real data: a share
 * of the distance to the nearest other POI, capped. Crowded parts of the island
 * get tight fences, isolated ones get room, and no two fences overlap.
 */
const FENCE_NEIGHBOR_SHARE = 0.4;
const FENCE_MAX = 0.045;

function buildFences(pois: Poi[]): Map<string, number> {
  const fences = new Map<string, number>();
  for (const poi of pois) {
    let nearest = Infinity;
    for (const other of pois) {
      if (other.id === poi.id) continue;
      nearest = Math.min(nearest, Math.hypot(other.x - poi.x, other.y - poi.y));
    }
    const radius = Number.isFinite(nearest) ? nearest * FENCE_NEIGHBOR_SHARE : FENCE_MAX;
    fences.set(poi.id, Math.min(radius, FENCE_MAX));
  }
  return fences;
}

/**
 * Two stable pseudo-randoms in [0,1) from a finding's id.
 *
 * Seeded rather than Math.random so a pin keeps its spot: an unseeded draw
 * would send it somewhere new on every render — every zoom, every radar
 * toggle — and a sighting that moves is a sighting you can't trust.
 */
function seedFrom(id: string): [number, number] {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 100000) / 100000;
  const b = ((Math.imul(h, 48271) >>> 0) % 100000) / 100000;
  return [a, b];
}

/** How many times the separation pass sweeps a cluster before giving up. */
const RELAX_PASSES = 32;

/** Steps walked back toward a location when a pin lands off the coastline. */
const LAND_PULL_STEPS = 16;

/**
 * Keeps a pin on the island.
 *
 * The scatter works in screen pixels and knows nothing about what it is
 * scattering over, so a roomy fence — or a crowded location whose cluster had
 * to grow to fit — can put a pin out to sea. That is most obvious in demo mode,
 * where every Sprite gets a finding and the busier locations push hardest, but
 * it is not specific to it.
 *
 * Fixed by walking the offset back toward the location it belongs to, which is
 * on land by definition, and stopping at the first step that is inside the
 * coastline. Stepped rather than solved: the coastline is a 285-point polygon
 * and an inlet can be any shape, so walking in finds a real inside position
 * where projecting onto an edge would not. A pin with nowhere valid to go ends
 * up on the location itself.
 *
 * Only the outer coastline is known (see isOnIsland), so this cannot keep pins
 * out of the island's own rivers and lakes — that would need the land mask
 * behind fortnite.gg's tiles, which our origin cannot read.
 */
function pullOntoLand(
  dx: number,
  dy: number,
  origin: { x: number; y: number },
  pxPerFraction: number
): [number, number] {
  if (pxPerFraction <= 0) return [dx, dy];
  const onLand = (t: number) =>
    isOnIsland(origin.x + (dx * t) / pxPerFraction, origin.y + (dy * t) / pxPerFraction);
  for (let step = 0; step <= LAND_PULL_STEPS; step++) {
    const t = 1 - step / LAND_PULL_STEPS;
    if (!onLand(t)) continue;
    // One step further in than the first position that qualifies. Stopping at
    // the first would leave every pulled pin hugging the coastline — and since
    // the outline is biased seaward to keep the coastal glow, "just inside it"
    // can still be surf. Only taken if that step is on land too, so a narrow
    // spit doesn't push the pin out the far side.
    const inset = Math.max(0, t - 1 / LAND_PULL_STEPS);
    const settled = onLand(inset) ? inset : t;
    return [dx * settled, dy * settled];
  }
  return [0, 0];
}

/**
 * Where each pin of a cluster sits relative to its POI, in screen pixels.
 *
 * Pins are scattered, not arranged. An earlier version gave every pin an equal
 * slice of a circle and drew its angle within that slice, over a radius floor
 * that guaranteed no two could touch. That made overlap impossible by
 * construction, but it also made the arrangement a ring by construction: equal
 * slices are equal angles, and wherever the fence was tight the floor was the
 * only radius available, so five or six sightings at one location drew a
 * perfect circle around it.
 *
 * Here the draw is free — any angle, any radius inside the fence — and the
 * separation is enforced afterwards instead, by pushing overlapping pairs
 * apart until they clear. Nothing about the result repeats from one location
 * to the next.
 *
 * Still deterministic, which is the property that actually matters: a pin that
 * moved on every render would be a sighting you couldn't trust. Positions come
 * only from the finding ids, and the ids are sorted before placing, so the
 * layout doesn't depend on the order rows came back from the database either.
 */
function scatterOffsets(
  ids: string[],
  size: number,
  fencePx: number,
  /** The location's own position in normalized [0,1] map space. */
  origin: { x: number; y: number },
  /** Screen pixels per unit of normalized map space, for the land test below. */
  pxPerFraction: number
): Map<string, [number, number]> {
  // Sorted so the relaxation below — which is order-sensitive — is fed the
  // same sequence on every render regardless of fetch order.
  const order = [...ids].sort();
  const minDist = size + MARKER_GAP;
  // How far the cluster may spread: the fence where it has room, otherwise the
  // radius a ring of this many pins would have needed. A fence too small to
  // hold everyone makes the cluster grow rather than letting pins overlap.
  const spread = Math.max(fencePx - size / 2, ringRadius(order.length, size));

  const pts: [number, number][] = order.map((id) => {
    const [a, b] = seedFrom(id);
    const angle = a * 2 * Math.PI;
    // sqrt keeps the draw uniform over the fence's area rather than bunching
    // pins toward the middle.
    const radius = spread * Math.sqrt(b);
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });

  for (let pass = 0; pass < RELAX_PASSES; pass++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const dx = pts[j][0] - pts[i][0];
        const dy = pts[j][1] - pts[i][1];
        const d = Math.hypot(dx, dy);
        if (d >= minDist) continue;
        let ux: number;
        let uy: number;
        if (d < 1e-6) {
          // Two pins on the same point have no direction to separate along.
          // Taking one from the pair's own ids keeps it deterministic and
          // keeps different pairs from all splitting the same way.
          const [a] = seedFrom(order[i] + order[j]);
          ux = Math.cos(a * 2 * Math.PI);
          uy = Math.sin(a * 2 * Math.PI);
        } else {
          ux = dx / d;
          uy = dy / d;
        }
        const push = (minDist - d) / 2;
        pts[i][0] -= ux * push;
        pts[i][1] -= uy * push;
        pts[j][0] += ux * push;
        pts[j][1] += uy * push;
        moved = true;
      }
    }
    if (!moved) break;
  }

  // Re-centre on the POI. Separation pushes outward from wherever the crowding
  // happened to be, which can leave the whole cluster sitting off to one side
  // of the location it belongs to. Clamping pins back inside the fence would
  // have been the other option, but that piles them against the boundary —
  // which is the ring again.
  let cx = 0;
  let cy = 0;
  for (const [x, y] of pts) {
    cx += x;
    cy += y;
  }
  cx /= pts.length;
  cy /= pts.length;

  const out = new Map<string, [number, number]>();
  order.forEach((id, i) => {
    let dx = pts[i][0] - cx;
    let dy = pts[i][1] - cy;
    [dx, dy] = pullOntoLand(dx, dy, origin, pxPerFraction);
    out.set(id, [dx, dy]);
  });
  return out;
}

interface LabelBox {
  id: string;
  /** Centre, in screen px at the current zoom (map fraction x pxPerFraction). */
  x: number;
  y: number;
  halfW: number;
}

/**
 * Which location names to show at this zoom. Names keep their pixel size
 * while the island scales, so on a small map (a narrow window, a phone, the
 * fitted overview) neighbouring names collide and stack into an unreadable
 * pile. Greedy, in priority order: a name is shown unless it would overlap
 * one already shown, so the front of the list always wins its space.
 */
function visibleLabels(labels: LabelBox[], priority: (id: string) => number): Set<string> {
  const pad = 4;
  const halfH = POI_LABEL_HEIGHT / 2;
  const kept: LabelBox[] = [];
  const ordered = [...labels].sort((a, b) => priority(a.id) - priority(b.id));
  for (const l of ordered) {
    const clash = kept.some(
      (k) => Math.abs(k.x - l.x) < k.halfW + l.halfW + pad && Math.abs(k.y - l.y) < halfH * 2 + pad
    );
    if (!clash) kept.push(l);
  }
  return new Set(kept.map((l) => l.id));
}

/**
 * The furthest a pin may be moved to step off a name, as a multiple of its
 * own height. Further than this and the pin would stand somewhere it wasn't
 * found (on a small map a column of stacked names once pushed a Green Hill
 * Zone pin up past Lifty Lodge); it stays put instead, under the name.
 */
const MAX_DODGE = 1.25;
/** Lifts a hovered pin above the names (which sit at +1000). */
const PIN_RISE = 2000;

/**
 * Steps a pin clear of every location name it would cover, at every zoom.
 *
 * `tip` is the pin's tip in the same screen space as the labels. The pin's
 * drawn box is its teardrop above the tip plus the ground ring just below, so
 * a pin tucked under a name still covers it with its body: it has to sit fully
 * above a name (tip at the name's top) or fully below it (the pin's top at the
 * name's bottom). Every such spot for every name in the pin's column is a
 * candidate, and the pin takes the nearest one that covers no name at all —
 * so two names stacked close together never trap it bouncing between them.
 * It keeps its horizontal place. Returns the vertical shift to add.
 */
function clearLabels(tipX: number, tipY: number, size: number, labels: LabelBox[]): number {
  const height = (size * 80) / 60;
  const halfW = size * PIN_HALF_WIDTH;
  const above = height * PIN_ABOVE_TIP;
  const below = height * PIN_BELOW_TIP;
  const halfH = POI_LABEL_HEIGHT / 2 + POI_LABEL_GAP;
  // Only names whose span overlaps the pin's column can ever be in the way.
  const column = labels.filter((l) => Math.abs(tipX - l.x) < halfW + l.halfW + POI_LABEL_GAP);
  const covers = (y: number) => column.some((l) => y - above < l.y + halfH && y + below > l.y - halfH);
  if (!covers(tipY)) return 0;
  const candidates = column
    .flatMap((l) => [l.y - halfH - below, l.y + halfH + above])
    .filter((y) => !covers(y) && Math.abs(y - tipY) <= height * MAX_DODGE)
    .sort((p, q) => Math.abs(p - tipY) - Math.abs(q - tipY));
  return candidates.length > 0 ? candidates[0] - tipY : 0;
}

/**
 * Half the drawn width of each location name, measured in its real face
 * (Anton caps, 16px, 0.04em tracking — see .poi-label) on a canvas. Measured
 * again once the web font has loaded, since the fallback face is narrower.
 */
function useLabelWidths(pois: Poi[]): Map<string, number> {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);
  return useMemo(() => {
    const widths = new Map<string, number>();
    if (typeof document === "undefined") return widths;
    const ctx = document.createElement("canvas").getContext("2d");
    const family = getComputedStyle(document.documentElement).getPropertyValue("--font-display").trim() || "sans-serif";
    if (ctx) ctx.font = `400 16px ${family}`;
    for (const poi of pois) {
      const text = poi.name.toUpperCase();
      const w = (ctx ? ctx.measureText(text).width : text.length * 8) + text.length * 0.64;
      widths.set(poi.id, w / 2 + POI_LABEL_PAD_X);
    }
    return widths;
    // fontsReady re-runs the measure with the loaded face.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois, fontsReady]);
}

/**
 * flyTo, with the pan clamp (maxBounds) lifted for the length of the flight.
 *
 * Leaflet re-clamps the view on every `moveend` by panning it back inside
 * maxBounds — and that pan's own `setView` stops any flight in progress. Right
 * after the map fits itself, a short clamp pan is often still running; flyTo
 * stops it, which fires `moveend`, which starts another clamp pan, which lands
 * a quarter-second into the flight and cancels it. (A profile's location row
 * on a phone mounts the map and flies in the same moment, and never arrived.)
 * The destination is always on the island, so nothing needs clamping on the
 * way; the bounds go back the moment the flight lands.
 */
function flyUnclamped(map: L.Map, latlng: L.LatLng, zoom: number) {
  const bounds = map.options.maxBounds;
  if (bounds) {
    map.setMaxBounds(null as unknown as L.LatLngBounds);
    // Back on when the flight has actually landed (at its zoom): stopping the
    // clamp pan at take-off fires its own move events, so the first
    // zoomend/moveend isn't the landing. A timeout covers a flight the user
    // interrupts.
    let done = false;
    const restore = () => {
      if (done) return;
      done = true;
      map.off("moveend", onMoveEnd);
      window.clearTimeout(fallback);
      map.setMaxBounds(bounds);
    };
    const onMoveEnd = () => {
      if (Math.abs(map.getZoom() - zoom) < 0.01) restore();
    };
    const fallback = window.setTimeout(restore, 2000);
    map.on("moveend", onMoveEnd);
  }
  map.flyTo(latlng, zoom, { duration: 0.6 });
}

/**
 * `accent` is the Sprite's RARITY colour: the same solid as its rarity band
 * in the sidebar, so the pin's fill matches the heading the Sprite sits
 * under. The variant still shows in the art inside the pin's head.
 */
function makeIcon(
  accent: string,
  icon: string | null,
  isNew: boolean | undefined,
  size: number,
  offset: [number, number]
) {
  // A location pin, drawn in a 60x80 box: a solid teardrop in the variant's
  // colour, the Sprite's art in a circle in its head, and a ground ring under
  // the tip — the ring is where the pin touches the island, so the tip (not
  // the head) is what sits on the coordinate. The ring carries the ping.
  const height = Math.round((size * 80) / 60);
  const art = icon
    ? `<span class="sprite-pin__art"><img src="${icon}" alt="" /></span>`
    : "";
  return L.divIcon({
    className: "sprite-marker-wrapper",
    html: `
      <span class="sprite-pin ${isNew ? "sprite-pin--new" : ""}" style="--pin-color:${accent};width:${size}px;height:${height}px">
        <svg class="sprite-pin__svg" viewBox="0 0 60 80" aria-hidden="true">
          <ellipse class="sprite-pin__ping" cx="30" cy="72" rx="20" ry="6.5" />
          <ellipse class="sprite-pin__ground" cx="30" cy="72" rx="20" ry="6.5" />
          <path class="sprite-pin__body" d="M30 72C30 72 4 46 4 28A26 26 0 1 1 56 28C56 46 30 72 30 72Z" />
        </svg>
        ${art}
      </span>
    `,
    iconSize: [size, height],
    // The tip, at (30, 72) of the 60x80 box, is pinned to the coordinate;
    // shifting the anchor the other way slides the pin to its cluster slot.
    iconAnchor: [size / 2 - offset[0], (height * 72) / 80 - offset[1]],
    // Tooltips open from the top of the pin's head (y 2 of 80), wherever the
    // scatter moved it — relative to the anchor above, so the offset rides
    // along.
    tooltipAnchor: [offset[0], offset[1] - (height * 70) / 80 - 2],
  });
}

/**
 * Groups findings that share a location, tagging each with its slot in the
 * cluster. A Sprite appears at most once per location: repeat sightings of the
 * same Sprite in the same place say nothing extra on the map, and they'd shrink
 * the whole cluster to make room for a duplicate of a pin already there.
 */
function clusterFindings(
  findings: Finding[]
): { finding: Finding; index: number; count: number; atPoi: boolean }[] {
  const byLocation = new Map<string, Finding[]>();
  const seen = new Set<string>();
  for (const f of findings) {
    // poiId when the finding was dropped on a named location, exact coordinates
    // otherwise — two hand-placed pins only cluster if they're truly identical.
    const key = f.poiId ?? `${f.x},${f.y}`;
    const spriteHere = `${key}::${f.spriteId}`;
    if (seen.has(spriteHere)) continue;
    seen.add(spriteHere);
    const bucket = byLocation.get(key);
    if (bucket) bucket.push(f);
    else byLocation.set(key, [f]);
  }
  return [...byLocation.values()].flatMap((bucket) =>
    bucket.map((finding, index) => ({
      finding,
      index,
      count: bucket.length,
      atPoi: finding.poiId != null,
    }))
  );
}

/**
 * The coastline as an SVG mask, built once: a 0-1 viewBox filled white with
 * the island punched out of it, then blurred so the hole's edge falls off
 * instead of stopping dead.
 *
 * This is the INVERSE of the island on purpose. The obvious approach — mask
 * the tile pane down to the island — is a dead end: Leaflet's panes are
 * zero-size boxes, and a CSS mask is clipped to its element's box, so masking
 * the pane hides every tile. Giving the pane a box does work, but only while
 * the tile square sits in positive layer coordinates; zoom into a corner and
 * they go negative and the island gets clipped away.
 *
 * So instead of cutting the tiles down, we paint OVER them: an overlay the
 * size of the map container, filled with the page's own ground, showing
 * everywhere except the island. The container is a real, always-positive box,
 * which sidesteps both problems.
 *
 * fill-rule evenodd is what makes the island a hole: the outer rectangle and
 * the coastline are subpaths of one path, so the coastline subtracts.
 *
 * The blur is in viewBox units, so the coast keeps the same softness relative
 * to the island at every zoom. sRGB interpolation is set explicitly; the
 * filter default is linearRGB, which makes the falloff look bitten-into
 * rather than soft.
 */

/**
 * How far the mask image extends past the tile square, as a fraction of it.
 *
 * The cover has to overhang the tiles. Leaflet draws a retained tile level
 * scaled by CSS for fractional zooms, so the rendered tiles don't land exactly
 * where projecting the square's corners says they will — measured 2-3px out,
 * which showed as a thin line of their grey down the east side of the map.
 *
 * The overhang is built into the SVG's viewBox rather than into mask-size, and
 * that distinction matters: scaling the mask up would drag the coastline hole
 * out with it and open a ring of void around the island. Widening the viewBox
 * leaves the hole exactly where it belongs and pads opaque white around it.
 *
 * 0.2 rather than the few percent the overhang alone needs: the cover also
 * carries the water layers, whose outermost lobes reach well past the tile
 * square, and anything outside the cover's box would be clipped.
 */
const VOID_COVER_BLEED = 0.2;

/**
 * The cover's edge now follows LAND_OUTLINE (the beach), not ISLAND_OUTLINE
 * (the outside of fortnite.gg's dark shoreline water), so their water is
 * hidden and our rings meet the sand. Only a hairline of softening, in
 * viewBox units, so the stair-stepped trace doesn't show as jaggies.
 */
const LAND_EDGE_FEATHER = 0.0012;

const VOID_MASK_URL = (() => {
  const island = LAND_OUTLINE.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join("") + "Z";
  const B = VOID_COVER_BLEED;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-B} ${-B} ${1 + 2 * B} ${1 + 2 * B}" preserveAspectRatio="none">` +
    `<filter id="f" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur stdDeviation="${LAND_EDGE_FEATHER}"/>` +
    `</filter>` +
    // The outer rectangle runs past the viewBox on every side. Drawn flush to
    // it, the blur feathers ITS edges too, so the cover turned semi-transparent
    // along its own border and fortnite.gg's grey showed through as a line down
    // the side of the map. Pushing it out means only the coastline hole is ever
    // blurred inside the visible area; the SVG canvas clips the overshoot away.
    `<path fill="#fff" fill-rule="evenodd" filter="url(#f)" d="M${-3 * B} ${-3 * B}H${1 + 3 * B}V${1 + 3 * B}H${-3 * B}Z${island}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

/**
 * The water around the island, traced from Fortnite's own in-game map: a
 * light band and a mid band whose edges swing in and out independently, with
 * deep rounded bays, thin necks and small puddles of one colour inside the
 * next, each a flat colour with a crisp edge.
 *
 * The shapes are vectors (lib/map/water-rings.ts, traced by
 * scripts/trace-water-rings.py from a screenshot of the game's map, where
 * the method and colours are documented), painted outermost first and filled even-odd so puddles and
 * holes show through. Vectors rather than live filters, which browsers
 * rasterise at low resolution. The void mask's hole hides whatever falls over
 * the land itself.
 */
const VOID_RINGS_URL = (() => {
  const B = VOID_COVER_BLEED;
  const path = (loop: ReadonlyArray<readonly [number, number]>) =>
    loop.map(([x, y], j) => `${j ? "L" : "M"}${x} ${y}`).join("") + "Z";
  const layers = WATER_LAYERS.map(
    (layer) => `<path fill-rule="evenodd" fill="${layer.color}" d="${layer.loops.map(path).join("")}"/>`
  ).join("");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-B} ${-B} ${1 + 2 * B} ${1 + 2 * B}" preserveAspectRatio="none" shape-rendering="geometricPrecision">` +
    layers +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

/**
 * Hides fortnite.gg's flat grey void by covering it with the app's own ground,
 * feathered along the coastline so the island blends out rather than ending on
 * the trace's staircase. See lib/map/island-outline.ts for why the grey can't
 * simply be recoloured.
 *
 * The cover lives INSIDE the map pane, in its own Leaflet pane above the tiles
 * (z 200) and below the markers (z 600), so findings and POI labels still draw
 * on top of it.
 *
 * Two things keep it registered with the tiles.
 *
 * Position and size are in layer points, which hold steady through a pan — the
 * map pane moves instead — so the box is only laid out again when the view
 * resets under it, not per frame.
 *
 * Zoom is the harder half. Leaflet animates a zoom per LAYER, not by scaling
 * the map pane: each animated layer transforms itself and the shared CSS
 * transition carries them together. A cover that ignores this jumps straight to
 * the destination geometry while the tiles are still travelling — measured at
 * 0.57x the tiles' width 200ms in, with the cover's edge inside theirs, which
 * is the mask sweeping across the map mid-zoom. So it animates itself the same
 * way Leaflet's own overlays do: `leaflet-zoom-animated` for the transition,
 * and a zoomanim handler that transforms to the destination.
 *
 * `_latLngToNewLayerPoint` is private, but it is the documented-by-use way to
 * do this — ImageOverlay, Marker and Path all animate through it.
 */
function IslandClip({ worldSize, nativeZoom }: { worldSize: number; nativeZoom: number }) {
  const map = useMap();

  useEffect(() => {
    const pane = map.createPane("voidCover");
    pane.style.zIndex = "450";
    pane.style.pointerEvents = "none";

    const cover = document.createElement("div");
    cover.dataset.slot = "void-cover";
    cover.className = "leaflet-zoom-animated";
    Object.assign(cover.style, {
      position: "absolute",
      transformOrigin: "0 0",
      // The water rings over the surround colour (see VOID_RINGS_URL).
      background: `${VOID_RINGS_URL} 0 0 / 100% 100% no-repeat, var(--map-field)`,
      maskImage: VOID_MASK_URL,
      webkitMaskImage: VOID_MASK_URL,
      maskRepeat: "no-repeat",
      webkitMaskRepeat: "no-repeat",
      maskSize: "100% 100%",
      webkitMaskSize: "100% 100%",
    } as Partial<CSSStyleDeclaration>);
    pane.appendChild(cover);

    // The cover's own corners in fraction space: the tile square grown by the
    // bleed, which is exactly what the mask's viewBox spans.
    const B = VOID_COVER_BLEED;
    const cornerLatLng = (f: number) =>
      CRS.Simple.pointToLatLng(L.point(f * worldSize, f * worldSize), nativeZoom);
    const northWest = cornerLatLng(-B);

    function layout() {
      const topLeft = map.latLngToLayerPoint(northWest);
      const bottomRight = map.latLngToLayerPoint(cornerLatLng(1 + B));
      cover.style.width = `${bottomRight.x - topLeft.x}px`;
      cover.style.height = `${bottomRight.y - topLeft.y}px`;
      L.DomUtil.setPosition(cover, topLeft);
    }

    function onZoomAnim(e: L.ZoomAnimEvent) {
      const scale = map.getZoomScale(e.zoom, map.getZoom());
      const offset = (
        map as unknown as {
          _latLngToNewLayerPoint: (ll: L.LatLng, zoom: number, center: L.LatLng) => L.Point;
        }
      )._latLngToNewLayerPoint(northWest, e.zoom, e.center);
      L.DomUtil.setTransform(cover, offset, scale);
    }

    layout();
    map.on("zoomanim", onZoomAnim);
    map.on("zoomend viewreset resize", layout);
    return () => {
      map.off("zoomanim", onZoomAnim);
      map.off("zoomend viewreset resize", layout);
      cover.remove();
      pane.remove();
    };
  }, [map, worldSize, nativeZoom]);


  return null;
}

/**
 * Sets up the CRS.Simple <-> pixel-space world for the tile pyramid and
 * fits/constrains the view to it. Runs once the underlying Leaflet map
 * instance exists.
 *
 * Always shows the full island uncropped ("contain" fit via `fitBounds`),
 * recalculated on container resize (e.g. opening the Sprite detail panel
 * narrows the map). The container paints the app's own background, which is
 * what shows around the clipped coastline. Zooming in
 * past the fit level is still fine — that's a deliberate zoom, not a crop.
 */
function TileWorldSetup({
  worldSize,
  nativeZoom,
  minZoom,
  insetLeft,
}: {
  worldSize: number;
  nativeZoom: number;
  minZoom: number;
  /** Width the overlaying sidebar covers, so the island fits+centers in what is actually visible. */
  insetLeft: number;
}) {
  const map = useMap();

  useEffect(() => {
    // The land itself — what the view is sized and centered on, so the island
    // fills the window instead of the square's surrounding void.
    const bounds = islandFitBounds(worldSize, nativeZoom);

    // Panning is clamped to the island itself, NOT to the tile square.
    //
    // Leaflet treats maxBounds two ways: when the view is LARGER than the
    // bounds on an axis it centers the bounds in the view; when smaller it
    // clamps the edges. Any bounds taller or wider than the island therefore
    // leaves slack for the clamp to pin the view against an edge, and the fit
    // loses — the island ends up shoved against one side with its far edge
    // cropped (~80px low at some window sizes; this is the bug that kept
    // coming back as the sidebar width changed). Clamping to exactly what we
    // fit to removes that slack entirely: the two agree by construction, so
    // "centered" is the only state that satisfies both.
    //
    // The tradeoff is that panning no longer reaches the open ocean outside
    // the coastline. Since minZoom is the fitted zoom, the only time the
    // clamp does anything is when the user has deliberately zoomed in, and
    // keeping them over land is the better behaviour there anyway.
    const panBounds = bounds;

    /**
     * `preserveZoom`: a resize keeps a view the user zoomed into. Opening a
     * profile or hiding the sidebar changes the map's width, and re-framing
     * the whole island every time threw away whatever they had zoomed in on.
     * At the fitted zoom there is nothing to keep, so it re-frames as before.
     */
    function applyFit(preserveZoom = false) {
      const zoomedIn = map.getZoom() > map.getMinZoom() + 1e-3;
      // getBoundsZoom() clamps what it returns to the map's CURRENT minZoom
      // (leaflet-src.js: `return Math.max(min, Math.min(max, zoom))`), and we
      // then use that result as the new minZoom. Leaving the old floor in place
      // therefore makes minZoom a one-way ratchet: it rises when the container
      // grows but can never come back down, so after the window (or the map
      // column, when the detail panel opens) gets smaller, the stale floor
      // keeps the map zoomed in too far and the island is cropped. Dropping to
      // the provider's floor first makes the measurement honest.
      map.setMinZoom(minZoom);
      // getBoundsZoom's padding is the TOTAL to subtract from the container
      // size, so it's twice the per-side FIT_PADDING that fitBounds applies
      // below — the two must agree or the floor and the fit disagree.
      const fitZoom = map.getBoundsZoom(
        bounds,
        false,
        L.point(insetLeft + 2 * FIT_PADDING, 2 * FIT_PADDING)
      );
      map.setMinZoom(fitZoom);
      // Fit before re-clamping: maxBounds pins the center, which fights
      // fitBounds while the view is still the old size. Unanimated because
      // resizes can arrive in a stream (the detail panel animates its width)
      // and queued fly-animations would race each other.
      if (!(preserveZoom && zoomedIn && map.getZoom() > fitZoom + 1e-3)) {
        map.fitBounds(bounds, {
          animate: false,
          paddingTopLeft: [insetLeft + FIT_PADDING, FIT_PADDING],
          paddingBottomRight: [FIT_PADDING, FIT_PADDING],
        });
      }
      map.setMaxBounds(panBounds);
      syncDragging();
    }
    const onResize = () => applyFit(true);

    // Dragging is only offered once the user has actually zoomed in.
    //
    // At the fitted zoom the whole island is already on screen and maxBounds
    // is that same box, so a drag has nowhere to go — it can only strain
    // against the clamp. Leaflet still swaps in its grab/grabbing cursor and
    // still fires the drag, which reads as an interaction that does nothing.
    // Turning the handler off at the floor makes the map plainly static until
    // there is something off-screen to reach.
    //
    // The floor is minZoom, which applyFit has just set to the fitted zoom;
    // the epsilon is because zoomSnap is 0, so the zoom is a float and
    // fitBounds can land a hair either side of the floor it just computed.
    function syncDragging() {
      if (map.getZoom() > map.getMinZoom() + 1e-6) map.dragging.enable();
      else map.dragging.disable();
    }

    // Deferred by a frame rather than called inline. TileWorldSetup is a CHILD
    // of MapContainer, and React runs a child's effects BEFORE its parent's,
    // so react-leaflet finishes initialising the map — applying its `center`
    // and `zoom` props — AFTER this effect body. Fitting inline therefore gets
    // overwritten, leaving the view framed on the initial center: the island
    // ends up ~74px low with its southern tip cut off.
    //
    // Development hid this completely. StrictMode re-runs child effects after
    // mount, so a second fit always landed after react-leaflet was done, and
    // only a production build showed the bug.
    const firstFit = requestAnimationFrame(() => applyFit());
    map.on("resize", onResize);
    map.on("zoomend", syncDragging);

    // Leaflet's own "resize" event only fires from `invalidateSize()` — it is
    // NOT a browser resize listener. Without this, Leaflet keeps using the
    // container size from its first render (e.g. before the Sprite detail
    // panel opens/closes and changes the map's width), so it positions tiles
    // for the old, smaller box while our CSS background already fills the
    // new, larger one — showing up as a plain black gap where a tile should
    // be. A ResizeObserver is what actually notices the container changed.
    const container = map.getContainer();
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
      // Refit explicitly rather than relying on Leaflet's "resize" event: that
      // only fires when Leaflet's cached size differs from the new one. On
      // page load the layout can settle after the first fit while Leaflet
      // already reports the settled size, so no event fired and the island
      // stayed framed for the pre-settle box — off-center and cut off. The
      // observer's first callback, delivered right after observe(), now
      // always lands a fit for the real, settled container.
      applyFit(true);
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(firstFit);
      map.off("resize", onResize);
      map.off("zoomend", syncDragging);
      resizeObserver.disconnect();
    };
  }, [map, worldSize, nativeZoom, minZoom, insetLeft]);

  return null;
}

function ClickCatcher({
  worldSize,
  nativeZoom,
  onMapClick,
}: {
  worldSize: number;
  nativeZoom: number;
  onMapClick: (xFrac: number, yFrac: number) => void;
}) {
  useMapEvents({
    click(e) {
      const point = CRS.Simple.latLngToPoint(e.latlng, nativeZoom);
      onMapClick(point.x / worldSize, point.y / worldSize);
    },
  });
  return null;
}

/** A request to fly the map to a point (map fractions). A new `key` re-flies to the same point. */
export interface MapFocusRequest {
  x: number;
  y: number;
  key: number;
}

export interface IslandMapProps {
  findings: Finding[];
  /** Sprite ids whose Radar toggle is on. Only their findings get pins — an empty set means an empty map. */
  visibleSpriteIds: Set<string>;
  isAddMode: boolean;
  pois: Poi[];
  onMapClick: (xFrac: number, yFrac: number) => void;
  /** Horizontal space the overlaying sidebar occupies; the island is fitted and centered to the right of it. */
  insetLeft?: number;
  /** A pin was clicked: the id of the Sprite (variant) it stands for. */
  onSelectSprite?: (spriteId: string) => void;
  /** Fly here. Used by the profile's location rows. */
  focusRequest?: MapFocusRequest | null;
}

export default function IslandMap({
  findings,
  visibleSpriteIds,
  isAddMode,
  pois,
  onMapClick,
  insetLeft = 0,
  onSelectSprite,
  focusRequest,
}: IslandMapProps) {
  const provider = ACTIVE_MAP_PROVIDER;
  const worldSize = useMemo(() => worldSizePx(provider), [provider]);
  const { getSprite } = useSpriteCatalog();
  // Held so the map controls below can live outside MapContainer as ordinary
  // React buttons — Leaflet's own zoom control renders "+"/"−" as text, which
  // can't be swapped for real Lucide icons.
  const [map, setMap] = useState<L.Map | null>(null);
  // Tracked so pins re-lay-out on zoom: the scatter widens as you zoom in, and
  // location names keep their pixel size, so what a pin covers changes.
  const [zoom, setZoom] = useState<number | null>(null);
  // Smaller pins on a small map (see MARKER_COMPACT_SIZE).
  const [compact, setCompact] = useState(false);
  const pinBase = compact ? MARKER_COMPACT_SIZE : MARKER_BASE_SIZE;

  useEffect(() => {
    if (!map) return;
    const update = () => {
      setZoom(map.getZoom());
      setCompact(map.getSize().x < COMPACT_MAP_WIDTH);
    };
    update();
    map.on("zoomend", update);
    map.on("resize", update);
    return () => {
      map.off("zoomend", update);
      map.off("resize", update);
    };
  }, [map]);

  const visibleFindings = useMemo(
    () => findings.filter((f) => visibleSpriteIds.has(f.spriteId)),
    [findings, visibleSpriteIds]
  );
  const clustered = useMemo(() => clusterFindings(visibleFindings), [visibleFindings]);
  const fences = useMemo(() => buildFences(pois), [pois]);
  // CRS.Simple: one unit of normalized map fraction is this many screen px at
  // the current zoom. Converting the fence here is what makes the scatter widen
  // as you zoom into a location instead of staying a fixed pixel blob.
  const pxPerFraction = worldSize * 2 ** ((zoom ?? provider.minZoom) - provider.nativeZoom);

  /**
   * Every pin's offset from its POI, keyed by finding id.
   *
   * Placed a whole cluster at a time rather than a pin at a time: pins are now
   * separated by pushing overlapping pairs apart (see scatterOffsets), and a
   * pin can't be pushed off another one it can't see.
   */
  const labelWidths = useLabelWidths(pois);
  const { offsets, hiddenLabels } = useMemo(() => {
    const groups = new Map<string, typeof clustered>();
    for (const item of clustered) {
      // The same key clusterFindings groups on, so the two always agree on
      // what counts as "the same place".
      const key = item.finding.poiId ?? `${item.finding.x},${item.finding.y}`;
      const bucket = groups.get(key);
      if (bucket) bucket.push(item);
      else groups.set(key, [item]);
    }
    // Every location name, in screen px at this zoom. Names keep their pixel
    // size while the island scales, so this is redone per zoom.
    const allLabels: LabelBox[] = pois.map((poi) => ({
      id: poi.id,
      x: poi.x * pxPerFraction,
      y: poi.y * pxPerFraction,
      halfW: labelWidths.get(poi.id) ?? poi.name.length * 4,
    }));
    // Names of places with pins on them go first: they're what the map is
    // being asked about. The rest keep the list's own order.
    const pinnedPois = new Set(clustered.map((c) => c.finding.poiId).filter(Boolean));
    const order = new Map(pois.map((p, i) => [p.id, i]));
    const shown = visibleLabels(allLabels, (id) => (pinnedPois.has(id) ? 0 : 1000) + (order.get(id) ?? 0));
    const labels = allLabels.filter((l) => shown.has(l.id));

    const all = new Map<string, [number, number]>();
    for (const group of groups.values()) {
      const first = group[0].finding;
      const size = markerSize(group.length, pinBase);
      const fencePx = first.poiId ? (fences.get(first.poiId) ?? 0) * pxPerFraction : 0;
      const placed = scatterOffsets(
        group.map((g) => g.finding.id),
        size,
        fencePx,
        { x: first.x, y: first.y },
        pxPerFraction
      );
      // Then off any name it would cover: its own location's or a neighbour's.
      for (const [id, [dx, dy]] of placed) {
        const tipX = first.x * pxPerFraction + dx;
        const tipY = first.y * pxPerFraction + dy;
        const shift = clearLabels(tipX, tipY, size, labels);
        all.set(id, [dx, dy + shift]);
      }
    }
    const hidden = new Set(pois.map((p) => p.id).filter((id) => !shown.has(id)));
    return { offsets: all, hiddenLabels: hidden };
  }, [clustered, fences, pxPerFraction, pois, labelWidths, pinBase]);

  // How many times each Sprite (variant) was logged at each place, for the
  // pin's tooltip — the map draws one pin per Sprite per place.
  const sightingsAt = useMemo(() => {
    const counts = new Map<string, Finding[]>();
    for (const f of visibleFindings) {
      const key = `${f.poiId ?? `${f.x},${f.y}`}::${f.spriteId}`;
      const list = counts.get(key);
      if (list) list.push(f);
      else counts.set(key, [f]);
    }
    return counts;
  }, [visibleFindings]);

  /**
   * Flies to a pin and zooms in on its surroundings. The target is shifted left
   * by half the sidebar's width so the pin lands centered in the *visible* map,
   * not behind the panel that overlays it.
   */
  function focusOn(latlng: L.LatLng) {
    if (!map) return;
    const zoom = Math.min(provider.maxZoom, POI_ZOOM);
    const shifted = map.project(latlng, zoom).subtract(L.point(insetLeft / 2, 0));
    flyUnclamped(map, map.unproject(shifted, zoom), zoom);
  }

  function resetView() {
    if (!map) return;
    // Same padding as the initial fit, so "reset" lands on identical framing.
    map.fitBounds(islandFitBounds(worldSize, provider.nativeZoom), {
      paddingTopLeft: [insetLeft + FIT_PADDING, FIT_PADDING],
      paddingBottomRight: [FIT_PADDING, FIT_PADDING],
    });
  }

  // A location picked outside the map (a profile's location row): fly there.
  // Keyed on the request's own key, so picking the same place twice still
  // flies back to it after the user has panned away.
  const focusKey = focusRequest?.key;
  useEffect(() => {
    if (!map || !focusRequest) return;
    const latlng = CRS.Simple.pointToLatLng(
      L.point(focusRequest.x * worldSize, focusRequest.y * worldSize),
      provider.nativeZoom
    );
    const zoom = Math.min(provider.maxZoom, POI_ZOOM);
    // After the map's own first fit: on a phone the map mounts in the same
    // moment the request is made, and its fit-to-island (a frame later, then
    // again on its first resize) would otherwise cancel the flight midway.
    const timer = window.setTimeout(() => flyUnclamped(map, latlng, zoom), 250);
    return () => window.clearTimeout(timer);
    // Only a new request should fly; the request object itself is replaced
    // together with its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, focusKey]);

  return (
    <div className="relative h-full w-full">
      <MapContainer
        ref={setMap}
        crs={CRS.Simple}
        center={[0, 0]}
        zoom={0}
        minZoom={provider.minZoom}
        maxZoom={provider.maxZoom}
        zoomSnap={0}
        maxBoundsViscosity={1.0}
        zoomControl={false}
        attributionControl={false}
        className={`h-full w-full ${isAddMode ? "cursor-crosshair" : ""}`}
        // The island is clipped to its coastline (see IslandClip), so nothing
        // here has to match fortnite.gg's void grey any more. --card rather
        // than --background so the field around the island reads as the same
        // surface as the panels either side of it. --map-background still
        // feeds the tile-seam patch in globals.css, so it tracks this.
        style={{ backgroundColor: "var(--map-field)", "--map-background": "var(--map-field)" } as CSSProperties}
      >
      <TileWorldSetup
        worldSize={worldSize}
        nativeZoom={provider.nativeZoom}
        minZoom={provider.minZoom}
        insetLeft={insetLeft}
      />
      <IslandClip worldSize={worldSize} nativeZoom={provider.nativeZoom} />
      <TileLayer
        url={provider.urlTemplate}
        tileSize={provider.tileSize}
        minZoom={provider.minZoom}
        maxZoom={provider.maxZoom}
        maxNativeZoom={provider.nativeZoom}
        minNativeZoom={0}
        noWrap
        attribution={provider.attribution ?? ""}
        // Out-of-range grid tiles at the edges 404 (there's no coverage past
        // the island's bounds) — without this, failed tiles fall back to the
        // browser's default "broken image" glyph. This 1x1 PNG must be a
        // genuinely transparent RGBA pixel so MAP_BACKGROUND_COLOR shows
        // through: an opaque greyscale pixel (the easy mistake) paints every
        // failed tile as a solid black 256x256 square instead.
        errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABeqhXUAAAAABJRU5ErkJggg=="
      />
      {isAddMode && (
        <ClickCatcher worldSize={worldSize} nativeZoom={provider.nativeZoom} onMapClick={onMapClick} />
      )}
      <PoiLabels pois={pois} hiddenIds={hiddenLabels} worldSize={worldSize} nativeZoom={provider.nativeZoom} />
      {clustered.map(({ finding: f, count }) => {
        const sprite = getSprite(f.spriteId);
        if (!sprite) return null;
        const latlng = L.CRS.Simple.pointToLatLng(
          L.point(f.x * worldSize, f.y * worldSize),
          provider.nativeZoom
        );
        // The pin wears its Sprite's rarity: the same solid as that rarity's
        // band in the sidebar, so a blue pin is a Rare one.
        const rarity = rarityAccent(sprite.rarity);
        const size = markerSize(count, pinBase);
        const here = sightingsAt.get(`${f.poiId ?? `${f.x},${f.y}`}::${f.spriteId}`) ?? [f];
        const place = f.poiId ? pois.find((p) => p.id === f.poiId) : null;
        const placeName = place ? titleCase(place.name) : "Unnamed spot";
        const sources = [...new Set(here.map((h) => lootSourceById(h.lootSource)?.label).filter(Boolean))];
        const variant = variantLabel(sprite.variant);
        const name = displayName(sprite.name);
        // What a screen reader announces for the focused pin, and the same
        // facts the tooltip shows — the variant's full name here, not the
        // tile caption's short caps.
        const label = `${name}, ${VARIANT_NAME[variantKey(sprite.variant)] ?? variant}, ${sprite.rarity ?? ""} — ${placeName}, ${
          here.length
        } ${here.length === 1 ? "sighting" : "sightings"}. Open profile.`;
        return (
          <Marker
            key={f.id}
            position={latlng}
            riseOnHover
            riseOffset={PIN_RISE}
            icon={makeIcon(
              rarity.solid,
              sprite.icon,
              f.id.startsWith("f-"),
              size,
              offsets.get(f.id) ?? [0, 0]
            )}
            // Click (or Enter on a focused pin) flies in on it and opens the
            // Sprite's profile: the pin is a way into what it stands for.
            eventHandlers={{
              click: (e) => {
                focusOn(latlng);
                onSelectSprite?.(sprite.id);
                // Leaflet opens the tooltip on click too; the profile now says
                // everything it did, and it would otherwise ride along with
                // the pin through the fly-in until the pointer next moved.
                const marker = e.target as L.Marker;
                window.setTimeout(() => marker.closeTooltip(), 0);
              },
              add: (e) => (e.target as L.Marker).getElement()?.setAttribute("aria-label", label),
            }}
          >
            <Tooltip direction="top" offset={[0, 0]} opacity={1} className="sprite-tooltip">
              <span className="sprite-tooltip__head">
                <span className="sprite-tooltip__name">{name}</span>
                <span
                  className="sprite-tooltip__variant"
                  style={{ color: variantLabelColor(sprite.variant) ?? undefined }}
                >
                  {variant}
                </span>
              </span>
              <span className="sprite-tooltip__place">
                {placeName}
                <span className="sprite-tooltip__count">
                  {here.length} {here.length === 1 ? "sighting" : "sightings"}
                </span>
              </span>
              {sources.length > 0 && <span className="sprite-tooltip__source">{sources.join(" · ")}</span>}
            </Tooltip>
          </Marker>
        );
      })}
      </MapContainer>

      {/* 16px in from the edge and 24px up, the same insets as the other map
          chrome. */}
      <div className="absolute right-4 bottom-6 z-[500] flex flex-col items-center gap-2">
        {/* Compact: every control is exactly 32px wide outside, ink outline
            included. Reset is a 32px disc; the zoom stack is a 32px pill
            whose two 26px buttons sit inside its 3px outline. */}
        <Button
          variant="ghost"
          size="icon-lg"
          onClick={resetView}
          aria-label="Reset view"
          className="material size-8 rounded-full text-pop-ink hover:text-pop-ink"
        >
          <RotateCcw className="size-3.5" />
        </Button>
        <div className="material flex w-8 flex-col overflow-hidden rounded-full">
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => map?.zoomIn()}
            aria-label="Zoom in"
            className="size-[26px] rounded-none text-pop-ink hover:!bg-pop-yellow hover:text-pop-ink focus-visible:ring-inset"
          >
            <Plus className="size-3.5" />
          </Button>
          <div className="h-[3px] w-full bg-pop-ink" />
          <Button
            variant="ghost"
            size="icon-lg"
            onClick={() => map?.zoomOut()}
            aria-label="Zoom out"
            className="size-[26px] rounded-none text-pop-ink hover:!bg-pop-yellow hover:text-pop-ink focus-visible:ring-inset"
          >
            <Minus className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
