# Wiring in the real Fortnite map tiles

The map is now a real XYZ tile layer (`Leaflet.TileLayer` + `CRS.Simple`), not
an illustration. Panning/zooming loads discrete `{z}/{x}/{y}` tile images —
the exact same architecture fortnite.gg and the community
[Fngg-Map-Studio](https://github.com/wavedropmaps/Fngg-Map-Studio) project
use (native zoom-7 tile pyramid).

**I did not fetch or embed fortnite.gg's own tiles.** That project documents
*how* to pull them, but neither it nor fortnite.gg publishes a license that
covers redistributing that imagery inside another app — so pulling them
automatically isn't something to do without you explicitly sourcing/clearing
that yourself. Right now `ACTIVE_MAP_PROVIDER` in
[`components/map/map-provider.ts`](components/map/map-provider.ts) points at
a locally-generated placeholder (`app/api/tile/[z]/[x]/[y]/route.ts`) — a
plain numbered grid, clearly not map art — just to prove the tiling/pan/zoom
pipeline end-to-end.

## What I need from you to swap in the real map

Give me **one** of these, and I'll point the provider at it — no other code
changes needed:

1. **A tile directory/URL you already have rights to**, structured as
   `{z}/{x}/{y}.png` (or `.jpg`/`.webp`), e.g.:
   - Local files under `public/tiles/{z}/{x}/{y}.png`, or
   - A URL template like `https://your-host/tiles/{z}/{x}/{y}.png`
2. **The tile pyramid's parameters**, if they differ from the fortnite.gg
   defaults I've assumed:
   - Tile size in pixels (assumed **256×256**)
   - Native/max zoom level the pyramid tops out at (assumed **7**, per
     Fngg-Map-Studio's docs)
   - Minimum zoom level available (assumed **0**)
   - Whether `(0,0)` is the top-left or bottom-left tile origin (assumed
     top-left / standard XYZ, not TMS)

Once I have that, the change is a one-line edit to `ACTIVE_MAP_PROVIDER` in
`components/map/map-provider.ts`:

```ts
export const ACTIVE_MAP_PROVIDER: MapTileProviderConfig = {
  id: "fortnite-current-season",
  label: "The Island",
  urlTemplate: "/tiles/{z}/{x}/{y}.png", // or your remote host
  tileSize: 256,
  nativeZoom: 7,
  minZoom: 0,
  maxZoom: 9, // allows a bit of overzoom past native res
};
```

Everything else — markers, findings, click-to-place, the sprite filter — is
written in normalized (0..1, 0..1) map-fraction coordinates and is fully
provider-agnostic, so it keeps working unchanged against real tiles.
