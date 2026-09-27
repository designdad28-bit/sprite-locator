#!/usr/bin/env python3
"""
Traces the water around the island from a screenshot of Fortnite's own
in-game map, and writes lib/map/water-rings.ts.

Why trace instead of generate: the look being matched is Epic's hand-shaped
water, two bands whose edges swing in and out on their own, with deep rounded
bays, tongues, thin necks and loose oval puddles of the neighbouring colour.
Offset curves and noise (scripts/build-water-rings.mjs, which this replaced)
only ever produced even, blobby bands. The screenshot shows this exact island,
so its bands can be lifted directly and laid onto our map.

How:
  1. Classify the screenshot's pixels. Water is dark and bluish (r < 45,
     b > g); within it, the light band (b >= 195, g >= 122), the mid band
     (b >= 150) and the dark background (the rest). The island is the
     largest non-water shape; any other non-water pixel (a boat, an icon)
     takes the class of the nearest water.
  2. Register it to our map. LAND_OUTLINE is rasterised into the screenshot
     and a uniform scale + offset is searched for the best overlap with the
     screenshot's land (largest component, holes filled). This screenshot
     fits at 971 px per map unit, IoU 0.95, the rest being the surf halo
     the screenshot counts as land.
  3. Sample both bands onto a 1024-per-unit grid in map space, softened by a
     1.5px blur so the contours come out smooth rather than pixel-stepped.
  4. Fill what the screenshot doesn't show. The map is clipped at the top
     and a few panels sit over the water (OCCLUDERS below); there the band is
     filled with an offset of the coast at the band's typical reach, blended
     into the traced shape over a short distance so there's no seam.
  5. Keep the light band covering our own coast (so it always meets the
     beach), the mid band covering the light band, drop specks, and trace
     every edge (outer edges, holes, puddles) with marching squares.

Needs numpy, scipy, scikit-image and Pillow. Dev-only.

Usage: python3 scripts/trace-water-rings.py path/to/fortnite-map-screenshot.png
"""
import pathlib
import re
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
from skimage import measure

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "lib" / "map" / "water-rings.ts"

# Screen regions (x0, y0, x1, y1) of the 1920x1080 screenshot where UI covers
# the water: the top of the map is clipped under the header, then the legend
# panel, the control hints, the Reset button, the match panel and the
# compass. Nothing there is trusted.
MAP_TOP = 115
OCCLUDERS = [
    (1436, 296, 1782, 458),
    (1470, 720, 1790, 918),
    (880, 964, 1054, 1020),
    (140, 210, 556, 690),
    (320, 990, 405, 1080),
]

COLORS = {"dark": "#1868DB", "light": "#26beef", "surf": "#26beef"}

S = 1024  # grid cells per map unit
P = 240  # padding cells either side, so the outermost water isn't clipped


def load_outline():
    src = (ROOT / "lib" / "map" / "land-outline.ts").read_text()
    src = src[src.index("export const LAND_OUTLINE") :]
    return np.array([[float(a), float(b)] for a, b in re.findall(r"\[(-?[\d.]+),\s*(-?[\d.]+)\]", src)])


def classify(path):
    im = np.asarray(Image.open(path).convert("RGB")).astype(int)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    water = (r < 45) & (b > g)
    light = water & (b >= 195) & (g >= 122)
    mid = water & ~light & (b >= 150)
    unknown = np.zeros(r.shape, bool)
    unknown[:MAP_TOP, :] = True
    for x0, y0, x1, y1 in OCCLUDERS:
        unknown[y0:y1, x0:x1] = True
    land = ~water & ~unknown
    lab, n = ndi.label(land)
    land = lab == (1 + np.argmax(ndi.sum(land, lab, range(1, n + 1))))
    land = ndi.binary_fill_holes(land)
    # Whatever is neither water nor the island (boats, icons, the blurred
    # scene past the map) takes the class of the nearest water pixel.
    stray = ~water & ~land
    _, (iy, ix) = ndi.distance_transform_edt(stray, return_indices=True)
    light = np.where(stray, light[iy, ix], light)
    mid = np.where(stray, mid[iy, ix], mid)
    return light, mid, unknown, land


def register(outline, land, unknown):
    h, w = land.shape
    known = ~unknown

    def iou(s, tx, ty):
        im = Image.new("1", (w, h), 0)
        ImageDraw.Draw(im).polygon([(s * x + tx, s * y + ty) for x, y in outline], fill=1)
        m = np.asarray(im)
        return (m & land & known).sum() / ((m | land) & known).sum()

    ys, xs = np.nonzero(land)
    (ox0, oy0), (ox1, oy1) = outline.min(0), outline.max(0)
    s0 = ((xs.max() - xs.min()) / (ox1 - ox0) + (ys.max() - ys.min()) / (oy1 - oy0)) / 2
    best = (0.0, s0, xs.min() - s0 * ox0, ys.min() - s0 * oy0)
    for step, span in ((2.0, 16), (0.5, 2)):
        _, s, tx, ty = best
        for ds in np.arange(-span, span + step / 2, step):
            for dx in np.arange(-span / 2, span / 2 + step / 2, step):
                for dy in np.arange(-span / 2, span / 2 + step / 2, step):
                    v = iou(s + ds, tx + dx, ty + dy)
                    if v > best[0]:
                        best = (v, s + ds, tx + dx, ty + dy)
    return best


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    outline = load_outline()
    light, mid, unknown, land = classify(sys.argv[1])
    score, s, tx, ty = register(outline, land, unknown)
    print(f"registered: {s:.1f} px per map unit, offset ({tx:.1f}, {ty:.1f}), IoU {score:.3f}")

    # Inside-the-edge masks in screenshot space: everything that isn't the
    # band outside. Softened so the sampled field has sub-pixel edges.
    in_light = (land | light).astype(float)
    in_mid = (land | light | mid).astype(float)
    in_light = ndi.gaussian_filter(in_light, 1.5)
    in_mid = ndi.gaussian_filter(in_mid, 1.5)
    unk = unknown.astype(float)

    # Map-space grid, sampled from the screenshot.
    n = S + 2 * P
    frac = (np.arange(n) + 0.5 - P) / S
    fx, fy = np.meshgrid(frac, frac)
    px, py = s * fx + tx - 0.5, s * fy + ty - 0.5
    h, w = land.shape
    outside = (px < 0) | (py < 0) | (px > w - 1) | (py > h - 1)
    coords = [np.clip(py, 0, h - 1), np.clip(px, 0, w - 1)]
    k_light = ndi.map_coordinates(in_light, coords, order=1)
    k_mid = ndi.map_coordinates(in_mid, coords, order=1)
    unk_g = (ndi.map_coordinates(unk, coords, order=1) > 0.01) | outside

    # Our own land and the distance from it, in map units.
    im = Image.new("1", (n, n), 0)
    ImageDraw.Draw(im).polygon([((x * S + P), (y * S + P)) for x, y in outline], fill=1)
    ours = np.asarray(im)
    dist = ndi.distance_transform_edt(~ours) / S

    rng = np.random.default_rng(7)
    coarse = rng.uniform(-1, 1, (n // 110 + 3, n // 110 + 3))
    noise = ndi.zoom(coarse, n / (coarse.shape[0] - 2), order=3)[:n, :n]
    noise /= np.abs(noise).max()

    def fill(k, band_level):
        """Traced where seen; an offset of the coast where not, blended in."""
        known = ~unk_g
        edge = known & (np.abs(k - 0.5) < 0.25)
        edge &= dist > 0.004
        reach = np.median(dist[edge]) if band_level is None else band_level
        # Local reach: the traced edges' own distance from the coast, averaged
        # over the neighbourhood (normalised convolution), so a stand-in edge
        # starts out where the traced edge beside it actually is.
        wsum = ndi.gaussian_filter(edge.astype(float), 0.04 * S)
        local = ndi.gaussian_filter(np.where(edge, dist, 0.0), 0.04 * S)
        reach_f = np.where(wsum > 1e-6, local / np.maximum(wsum, 1e-9), reach)
        # The stand-in edge: the coast offset to the band's typical reach,
        # rounded (blurred) and swung in and out by smooth seeded noise, so
        # it has the same loose waves as the traced parts beside it.
        wave = ndi.gaussian_filter(dist, 0.018 * S) + noise * 0.018
        guess = 1 / (1 + np.exp((wave - reach_f) / 0.004))
        # How far inside the unseen part, and the traced value nearest to it:
        # the traced shape carries on a little way in, then gives way to the
        # offset, so an edge running into a panel bends smoothly to meet it.
        into, (iy, ix) = ndi.distance_transform_edt(unk_g, return_indices=True)
        wgt = np.clip(1 - into / S / 0.02, 0, 1)
        f = wgt * k[iy, ix] + (1 - wgt) * guess
        # Round off the join: blur in and around the unseen part only.
        near = np.clip(1 - ndi.distance_transform_edt(known) / S / 0.012, 0, 1)
        return near * ndi.gaussian_filter(f, 0.008 * S) + (1 - near) * f, reach

    f_light, r_light = fill(k_light, None)
    f_mid, r_mid = fill(k_mid, None)
    print(f"typical reach: light {r_light:.3f}, mid {r_mid:.3f} map units")

    # The light band always meets our beach; the mid band always holds the
    # light band. Then drop specks (UI glyphs, boats) under ~7px across,
    # keeping the real puddles, which are 15-40px.
    m_light = (f_light > 0.5) | (dist < 0.003)
    m_mid = (f_mid > 0.5) | m_light
    min_area = int((0.007 * S) ** 2)
    for m in (m_light, m_mid):
        lab, cnt = ndi.label(m)
        small = np.isin(lab, 1 + np.nonzero(ndi.sum(m, lab, range(1, cnt + 1)) < min_area)[0])
        m[small] = False
        lab, cnt = ndi.label(~m)
        small = np.isin(lab, 1 + np.nonzero(ndi.sum(~m, lab, range(1, cnt + 1)) < min_area)[0])
        m[small] = True
    # River mouths: the game's rivers run out to sea in the mid colour where
    # our coast closes them, which leaves stray mid-blue specks in the light
    # band right against the beach. Fill any hole in the light band that
    # sits on our coast.
    lab, cnt = ndi.label(~m_light)
    for i in range(1, cnt + 1):
        hole = lab == i
        if hole.sum() < (0.03 * S) ** 2 and dist[hole].min() < 0.008:
            m_light[hole] = True
    m_mid |= m_light
    m_surf = dist < 0.0022

    def loops(mask):
        # Smooth the binary mask back into a field so the traced edge is a
        # clean curve, then trace every loop and simplify to ~0.3 cell.
        # Sigma 3 cells (~3px at the screenshot's scale) irons out the
        # screenshot's pixel stair-steps and compression wobble without losing
        # the bays and puddles; two rounds of Chaikin then round the corners
        # the simplifier leaves.
        field = ndi.gaussian_filter(np.pad(mask.astype(float), 8), 3.0)
        out = []
        for c in measure.find_contours(field, 0.5):
            c = measure.approximate_polygon(c, 0.25)[:-1]
            if len(c) < 4:
                continue
            for _ in range(2):
                nxt = np.roll(c, -1, axis=0)
                c = np.stack([0.75 * c + 0.25 * nxt, 0.25 * c + 0.75 * nxt], 1).reshape(-1, 2)
            c = np.vstack([c, c[:1]])
            out.append([[round((x - 8 - P) / S, 4), round((y - 8 - P) / S, 4)] for y, x in c[:-1]])
        return out

    layers = [("dark", loops(m_mid)), ("light", loops(m_light)), ("surf", loops(m_surf))]

    ys, xs = np.nonzero(m_mid)
    ext = [(xs.min() - P) / S, (ys.min() - P) / S, (xs.max() - P) / S, (ys.max() - P) / S]
    (ox0, oy0), (ox1, oy1) = outline.min(0), outline.max(0)
    reach = max(ox0 - ext[0], oy0 - ext[1], ext[2] - ox1, ext[3] - oy1)
    print(f"water extent {[round(v, 3) for v in ext]}, reach past coast {reach:.3f}")

    body = []
    for name, lps in layers:
        body.append(f'  {{\n    name: "{name}",\n    color: "{COLORS[name]}",\n    loops: [')
        for lp in lps:
            body.append("      [" + ",".join(f"[{x},{y}]" for x, y in lp) + "],")
        body.append("    ],\n  },")
    OUT.write_text(
        "// GENERATED by scripts/trace-water-rings.py from a screenshot of\n"
        "// Fortnite's in-game map. Do not edit by hand; re-run the script instead.\n"
        "//\n"
        "// The water around the island, traced from Epic's own map: layers painted\n"
        "// outermost first, each a set of closed loops (outer edges, holes and\n"
        "// puddles) in the same [0,1] fraction space as LAND_OUTLINE, to be filled\n"
        "// with the even-odd rule. See the script for how they're made.\n"
        "export interface WaterLayer {\n  name: string;\n  color: string;\n"
        "  loops: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;\n}\n\n"
        "export const WATER_LAYERS: ReadonlyArray<WaterLayer> = [\n"
        + "\n".join(body)
        + "\n];\n\n"
        "/** How far the water reaches past the coast's bounding box, in map units. */\n"
        f"export const WATER_REACH = {reach:.3f};\n"
    )
    print(f"wrote {OUT.relative_to(ROOT)}: " + " | ".join(f"{nm}: {len(l)} loops" for nm, l in layers))


if __name__ == "__main__":
    main()
