"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L, { CRS } from "leaflet";
import { Plus, Minus, RotateCcw } from "lucide-react";
import {
  ACTIVE_MAP_PROVIDER,
  ISLAND_BOUNDS,
  ISLAND_FIT_SCALE,
  MAP_BACKGROUND_COLOR,
  worldSizePx,
} from "./map-provider";
import { Finding } from "@/lib/findings";
import { Poi } from "@/lib/map/pois";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { rarityAccent, type RarityAccent } from "@/lib/rarity";

/**
 * The island's box, shrunk around its center by ISLAND_FIT_SCALE. Fitting a
 * smaller box yields a proportionally larger view with the same center, which
 * is how the initial framing gets its extra scale without drifting off-center.
 */
function islandFitBounds(worldSize: number, nativeZoom: number) {
  const cx = (ISLAND_BOUNDS.minX + ISLAND_BOUNDS.maxX) / 2;
  const cy = (ISLAND_BOUNDS.minY + ISLAND_BOUNDS.maxY) / 2;
  const halfW = (ISLAND_BOUNDS.maxX - ISLAND_BOUNDS.minX) / 2 / ISLAND_FIT_SCALE;
  const halfH = (ISLAND_BOUNDS.maxY - ISLAND_BOUNDS.minY) / 2 / ISLAND_FIT_SCALE;
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

function PoiLabels({ pois, worldSize, nativeZoom }: { pois: Poi[]; worldSize: number; nativeZoom: number }) {
  return (
    <>
      {pois.map((poi) => {
        const latlng = CRS.Simple.pointToLatLng(L.point(poi.x * worldSize, poi.y * worldSize), nativeZoom);
        return (
          <Marker
            key={poi.id}
            position={latlng}
            icon={makePoiLabel(poi.name)}
            interactive={false}
            keyboard={false}
          />
        );
      })}
    </>
  );
}

/**
 * Pins that share a location fan out into a ring instead of stacking, and
 * shrink as the ring grows so the cluster stays roughly the size of a single
 * pin. All of this is screen-space: a cluster looks the same at every zoom.
 */
const MARKER_BASE_SIZE = 60;
const MARKER_MIN_SIZE = 26;
/** Clear space between neighbouring pins in a ring. */
const MARKER_GAP = 3;
/**
 * Vertical clearance between a POI's name label and the pins above it. The
 * label is a ~16px line centered on the POI's point (see .poi-label), so half
 * of it plus a few px of air is what a pin has to stay above.
 */
const POI_LABEL_CLEARANCE = 12;
/**
 * Zoom at which pins start lifting clear of POI name labels. Below this the map
 * is the whole-island overview, where a pin sitting over a label is fine — the
 * pin is the thing you're looking for, and the island's shape gives you your
 * bearings. From POI_ZOOM up you're reading a single location, so its name
 * matters. Matching the two means clicking a pin always lands you in the
 * lifted layout.
 */
const POI_LABEL_ZOOM = POI_ZOOM;

/** One pin is full size; each extra one at the same spot shrinks them all. */
function markerSize(count: number): number {
  if (count <= 1) return MARKER_BASE_SIZE;
  return Math.max(MARKER_MIN_SIZE, Math.round(MARKER_BASE_SIZE / Math.sqrt(count)));
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

/**
 * Where the nth pin of a cluster sits relative to its POI: a stable random spot
 * inside the fence, in screen pixels.
 *
 * Angles are drawn within the pin's own slice of the circle and radii start at
 * the tightest non-overlapping ring, so "random" can never put two pins on top
 * of each other — at low zoom, where the fence is only a few pixels across,
 * that floor is all there is and the scatter degrades into an even ring.
 */
function markerOffset(
  index: number,
  count: number,
  size: number,
  fencePx: number,
  seed: [number, number],
  clearsLabel: boolean
): [number, number] {
  const minRadius = ringRadius(count, size);
  const maxRadius = Math.max(minRadius, fencePx - size / 2);
  // sqrt keeps the draw uniform over the fence's area rather than bunching
  // pins toward the middle.
  const radius = minRadius + (maxRadius - minRadius) * Math.sqrt(seed[1]);

  const slice = (2 * Math.PI) / count;
  // Bounded by ANGLE_JITTER, the same figure ringRadius() assumed when it
  // worked out the minimum separation — the two have to agree or pins touch.
  const angle = index * slice + (seed[0] - 0.5) * slice * ANGLE_JITTER - Math.PI / 2;

  const dx = radius * Math.cos(angle);
  let dy = radius * Math.sin(angle);

  if (clearsLabel) {
    // The label is one horizontal line centered on the POI. Push any pin that
    // lands on it out to the nearer side rather than re-rolling, so the pin
    // stays where its seed put it horizontally.
    const bandY = POI_LABEL_CLEARANCE + size / 2;
    if (Math.abs(dy) < bandY) dy = dy >= 0 ? bandY : -bandY;
  }
  return [dx, dy];
}

function makeIcon(
  accent: RarityAccent,
  icon: string | null,
  isNew: boolean | undefined,
  size: number,
  offset: [number, number]
) {
  const inner = icon
    ? `<span class="sprite-marker__badge"><img src="${icon}" alt="" /></span>`
    : `<span class="sprite-marker__dot"></span>`;
  return L.divIcon({
    className: "sprite-marker-wrapper",
    html: `
      <span class="sprite-marker ${isNew ? "sprite-marker--new" : ""}" style="--marker-fill:${accent.solid};--marker-ring:${accent.solid};--marker-size:${size}px">
        <span class="sprite-marker__ping"></span>
        ${inner}
      </span>
    `,
    iconSize: [size, size],
    // The anchor is the point in the icon pinned to the coordinate, so shifting
    // it the other way slides the pin out to its place in the ring.
    iconAnchor: [size / 2 - offset[0], size / 2 - offset[1]],
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
 * Sets up the CRS.Simple <-> pixel-space world for the tile pyramid and
 * fits/constrains the view to it. Runs once the underlying Leaflet map
 * instance exists.
 *
 * Always shows the full island uncropped ("contain" fit via `fitBounds`),
 * recalculated on container resize (e.g. opening the Sprite detail panel
 * narrows the map). The container background is set to MAP_BACKGROUND_COLOR
 * so any letterboxing from an aspect-ratio
 * mismatch blends in rather than reading as a rendering bug. Zooming in
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
    // What panning is clamped to: the tile square, widened on its short sides
    // just enough to be centered on the island rather than on the square.
    //
    // When the view is wider (or taller) than these bounds, Leaflet's
    // maxBounds (viscosity 1) re-centers the bounds in the view, overriding
    // fitBounds. With the bare square, the island, which sits left of the
    // square's middle (x ≈ 0.451), landed ~50px off-center whenever the map
    // container outgrew the square, e.g. with the sidebar collapsed. Centering
    // the bounds on the island keeps it centered in every case, and they still
    // contain every tile, so nothing that could be panned to before is lost.
    const cx = (ISLAND_BOUNDS.minX + ISLAND_BOUNDS.maxX) / 2;
    const cy = (ISLAND_BOUNDS.minY + ISLAND_BOUNDS.maxY) / 2;
    const halfW = Math.max(cx, 1 - cx);
    const halfH = Math.max(cy, 1 - cy);
    const panBounds = L.latLngBounds(
      CRS.Simple.pointToLatLng(L.point((cx - halfW) * worldSize, (cy + halfH) * worldSize), nativeZoom),
      CRS.Simple.pointToLatLng(L.point((cx + halfW) * worldSize, (cy - halfH) * worldSize), nativeZoom)
    );
    // The land itself — what the view is sized and centered on, so the island
    // fills the window instead of the square's surrounding void.
    const bounds = islandFitBounds(worldSize, nativeZoom);

    function applyFit() {
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
      map.fitBounds(bounds, {
        animate: false,
        paddingTopLeft: [insetLeft + FIT_PADDING, FIT_PADDING],
        paddingBottomRight: [FIT_PADDING, FIT_PADDING],
      });
      map.setMaxBounds(panBounds);
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
    const firstFit = requestAnimationFrame(applyFit);
    map.on("resize", applyFit);

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
      applyFit();
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(firstFit);
      map.off("resize", applyFit);
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

export interface IslandMapProps {
  findings: Finding[];
  /** Sprite ids whose Radar toggle is on. Only their findings get pins — an empty set means an empty map. */
  visibleSpriteIds: Set<string>;
  isAddMode: boolean;
  pois: Poi[];
  onMapClick: (xFrac: number, yFrac: number) => void;
  /** Horizontal space the overlaying sidebar occupies; the island is fitted and centered to the right of it. */
  insetLeft?: number;
}

export default function IslandMap({
  findings,
  visibleSpriteIds,
  isAddMode,
  pois,
  onMapClick,
  insetLeft = 0,
}: IslandMapProps) {
  const provider = ACTIVE_MAP_PROVIDER;
  const worldSize = useMemo(() => worldSizePx(provider), [provider]);
  const { getSprite } = useSpriteCatalog();
  // Held so the map controls below can live outside MapContainer as ordinary
  // React buttons — Leaflet's own zoom control renders "+"/"−" as text, which
  // can't be swapped for real Lucide icons.
  const [map, setMap] = useState<L.Map | null>(null);
  // Tracked so pins can re-lay-out on zoom: they only step aside for POI labels
  // once you're actually zoomed in on a location (see POI_LABEL_ZOOM).
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (!map) return;
    const update = () => setZoom(map.getZoom());
    update();
    map.on("zoomend", update);
    return () => {
      map.off("zoomend", update);
    };
  }, [map]);

  const visibleFindings = findings.filter((f) => visibleSpriteIds.has(f.spriteId));
  const fences = useMemo(() => buildFences(pois), [pois]);
  // CRS.Simple: one unit of normalized map fraction is this many screen px at
  // the current zoom. Converting the fence here is what makes the scatter widen
  // as you zoom into a location instead of staying a fixed pixel blob.
  const pxPerFraction = worldSize * 2 ** ((zoom ?? provider.minZoom) - provider.nativeZoom);

  /**
   * Flies to a pin and zooms in on its surroundings. The target is shifted left
   * by half the sidebar's width so the pin lands centered in the *visible* map,
   * not behind the panel that overlays it.
   */
  function focusOn(latlng: L.LatLng) {
    if (!map) return;
    const zoom = Math.min(provider.maxZoom, POI_ZOOM);
    const shifted = map.project(latlng, zoom).subtract(L.point(insetLeft / 2, 0));
    map.flyTo(map.unproject(shifted, zoom), zoom, { duration: 0.6 });
  }

  function resetView() {
    if (!map) return;
    // Same padding as the initial fit, so "reset" lands on identical framing.
    map.fitBounds(islandFitBounds(worldSize, provider.nativeZoom), {
      paddingTopLeft: [insetLeft + FIT_PADDING, FIT_PADDING],
      paddingBottomRight: [FIT_PADDING, FIT_PADDING],
    });
  }

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
        style={{ backgroundColor: MAP_BACKGROUND_COLOR, "--map-background": MAP_BACKGROUND_COLOR } as CSSProperties}
      >
      <TileWorldSetup
        worldSize={worldSize}
        nativeZoom={provider.nativeZoom}
        minZoom={provider.minZoom}
        insetLeft={insetLeft}
      />
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
      <PoiLabels pois={pois} worldSize={worldSize} nativeZoom={provider.nativeZoom} />
      {clusterFindings(visibleFindings).map(({ finding: f, index, count, atPoi }) => {
        const sprite = getSprite(f.spriteId);
        if (!sprite) return null;
        const latlng = L.CRS.Simple.pointToLatLng(
          L.point(f.x * worldSize, f.y * worldSize),
          provider.nativeZoom
        );
        const accent = rarityAccent(sprite.rarity);
        const size = markerSize(count);
        const fencePx = f.poiId ? (fences.get(f.poiId) ?? 0) * pxPerFraction : 0;
        return (
          <Marker
            key={f.id}
            position={latlng}
            icon={makeIcon(
              accent,
              sprite.icon,
              f.id.startsWith("f-"),
              size,
              markerOffset(
                index,
                count,
                size,
                fencePx,
                seedFrom(f.id),
                atPoi && zoom !== null && zoom >= POI_LABEL_ZOOM
              )
            )}
            // No popup: clicking a pin flies the map to it instead.
            eventHandlers={{ click: () => focusOn(latlng) }}
          />
        );
      })}
      </MapContainer>

      <div className="absolute right-2 bottom-2 z-[500] flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset view"
          className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-lg transition-colors outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <RotateCcw className="size-4" strokeWidth={1.5} />
        </button>
        <div className="flex flex-col overflow-hidden rounded-full border border-border bg-card shadow-lg">
          <button
            type="button"
            onClick={() => map?.zoomIn()}
            aria-label="Zoom in"
            className="flex size-9 items-center justify-center text-muted-foreground transition-colors outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            <Plus className="size-4" strokeWidth={1.5} />
          </button>
          <div className="h-px w-full bg-border" />
          <button
            type="button"
            onClick={() => map?.zoomOut()}
            aria-label="Zoom out"
            className="flex size-9 items-center justify-center text-muted-foreground transition-colors outline-none select-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
          >
            <Minus className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
