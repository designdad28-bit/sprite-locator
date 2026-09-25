#!/usr/bin/env node
/**
 * Generates lib/map/water-rings.ts: the water around the island, drawn to
 * match Fortnite's own in-game map as vector shapes.
 *
 * What Fortnite draws (measured from an in-game map screenshot, beach
 * outward, at ~962px per unit of map width): TWO water colours plus a rim.
 *   rim    #26beef  ~2px, a bright line right on the sand
 *   light  #1395d8  out to ~30px from the beach
 *   dark   #0f5eb3  out to ~60px
 * Beyond that is the game's own background, not water. Both bands are offset
 * curves of the coastline: they follow every peninsula and bay, with convex
 * corners rounded and bays narrower than the offset filled in. The light band
 * hugs the coast closely; the dark band echoes it in broader scallops. Flat
 * colours, crisp edges, no randomness.
 *
 * How it's reproduced: the exact Euclidean distance from the land, blurred a
 * little (more for the dark band, so it's smoother), and each band is the
 * region within its distance, traced with marching squares into vector loops.
 * Traced here, once, rather than rendered as live SVG filters, because
 * browsers rasterise big blurs at low resolution and the edges stair-step
 * when zoomed. A noise term is still supported per layer (`noise`, `detail`)
 * but set to zero: Fortnite's bands don't wander.
 *
 * Deterministic (seeded noise), so re-running gives the same shapes. Re-run
 * whenever lib/map/land-outline.ts is re-traced:
 *   node scripts/build-water-rings.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Outermost first; each paints over the one before. `level` is the edge's
 * distance from the coast (fraction of map width) before noise; `smooth` is
 * the sigma the distance field is blurred by (bigger = rounder); `noise` is
 * how far the noise can push the edge in or out; `detail` is how much of that
 * is fine wobble rather than big lobes.
 */
const LAYERS = JSON.parse(process.env.WATER_LAYERS || "null") ?? [
  // dark band: ~60px out in the screenshot; smoother, so it echoes the
  // island's big shapes in broad scallops
  // Recoloured to the light band's #1395d8 by request (Fortnite's own is
  // #0f5eb3); the band itself is kept, so it can take its own colour again.
  { name: "dark", color: "#1395d8", level: 0.062, smooth: 0.009, noise: 0 },
  // light band: ~30px out; follows every peninsula and bay closely
  { name: "light", color: "#1395d8", level: 0.03, smooth: 0.005, noise: 0 },
  // the thin bright rim on the sand
  { name: "surf", color: "#26beef", level: 0.0022, smooth: 0.0015, noise: 0 },
];

/** Feature size of the noise, as a fraction of map width. */
const NOISE_SCALE = Number(process.env.WATER_NOISE_SCALE || 0.09);

const S = 1024; // cells across the [0,1] map
const P = 200; // padding, so the outermost lobes aren't clipped
const G = S + 2 * P;

const src = readFileSync(join(ROOT, "lib/map/land-outline.ts"), "utf8");
const body = src.slice(src.indexOf("= [") + 2, src.lastIndexOf("];") + 1);
const land = JSON.parse(body.replace(/,\s*\]$/, "]"));

// --- land raster (1 = land), even-odd scanline fill at cell centres ---
const isLand = new Uint8Array(G * G);
for (let gy = 0; gy < G; gy++) {
  const y = (gy - P + 0.5) / S;
  const xs = [];
  for (let i = 0, j = land.length - 1; i < land.length; j = i++) {
    const [xi, yi] = land[i];
    const [xj, yj] = land[j];
    if (yi > y !== yj > y) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
  }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const a = Math.max(0, Math.ceil(xs[k] * S + P - 0.5));
    const b = Math.min(G - 1, Math.floor(xs[k + 1] * S + P - 0.5));
    for (let gx = a; gx <= b; gx++) isLand[gy * G + gx] = 1;
  }
}

// --- exact Euclidean distance to land (Felzenszwalb & Huttenlocher) ---
const INF = 1e20;
function dt1d(f, n) {
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  let k = 0;
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
  return d;
}
const dist = new Float32Array(G * G);
{
  const tmp = new Float64Array(G * G);
  const col = new Float64Array(G);
  for (let x = 0; x < G; x++) {
    for (let y = 0; y < G; y++) col[y] = isLand[y * G + x] ? 0 : INF;
    const d = dt1d(col, G);
    for (let y = 0; y < G; y++) tmp[y * G + x] = d[y];
  }
  const row = new Float64Array(G);
  for (let y = 0; y < G; y++) {
    for (let x = 0; x < G; x++) row[x] = tmp[y * G + x];
    const d = dt1d(row, G);
    for (let x = 0; x < G; x++) dist[y * G + x] = Math.sqrt(d[x]) / S;
  }
}

function blur(field, sigmaCells) {
  if (sigmaCells <= 0) return field;
  const r = Math.ceil(sigmaCells * 3);
  const k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp((-i * i) / (2 * sigmaCells * sigmaCells));
    k.push(v);
    sum += v;
  }
  for (let i = 0; i < k.length; i++) k[i] /= sum;
  const tmp = new Float32Array(G * G);
  const out = new Float32Array(G * G);
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) {
        const xx = Math.min(G - 1, Math.max(0, x + i));
        a += field[y * G + xx] * k[i + r];
      }
      tmp[y * G + x] = a;
    }
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) {
        const yy = Math.min(G - 1, Math.max(0, y + i));
        a += tmp[yy * G + x] * k[i + r];
      }
      out[y * G + x] = a;
    }
  return out;
}

// --- smooth, seeded value noise in [-1, 1] ---
function makeNoise(seed) {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
  const cell = NOISE_SCALE * S;
  const N = Math.ceil((G * 2.2) / cell) + 3;
  const lattice = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) lattice[i] = rand();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const fx = x / cell;
    const fy = y / cell;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fade(fx - x0);
    const ty = fade(fy - y0);
    const at = (i, j) => lattice[(j % N) * N + (i % N)];
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
    return a + (b - a) * ty;
  };
}
// Two octaves: big lobes plus finer wobble. `detail` is the fine octave's
// share. Fortnite's outermost edge is big smooth lobes (low detail), while its
// inner layers wobble more and break off into puddles (higher detail).
function noiseField(seed, detail) {
  const n1 = makeNoise(seed);
  const n2 = makeNoise(seed + 7919);
  const out = new Float32Array(G * G);
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) out[y * G + x] = n1(x, y) * (1 - detail) + n2(x * 2.6, y * 2.6) * detail;
  return out;
}

// --- marching squares: every loop of { g <= level } ---
function contours(field, level) {
  const inside = (i) => field[i] <= level;
  const segs = new Map();
  const pt = (x0, y0, x1, y1) => {
    const a = field[y0 * G + x0] - level;
    const b = field[y1 * G + x1] - level;
    const t = a / (a - b);
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  };
  const key = (p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
  const add = (p, q) => segs.set(key(p), [key(q), p]);
  for (let y = 0; y < G - 1; y++)
    for (let x = 0; x < G - 1; x++) {
      const tl = inside(y * G + x);
      const tr = inside(y * G + x + 1);
      const br = inside((y + 1) * G + x + 1);
      const bl = inside((y + 1) * G + x);
      const c = (tl ? 8 : 0) | (tr ? 4 : 0) | (br ? 2 : 0) | (bl ? 1 : 0);
      if (c === 0 || c === 15) continue;
      const T = () => pt(x, y, x + 1, y);
      const R = () => pt(x + 1, y, x + 1, y + 1);
      const B = () => pt(x, y + 1, x + 1, y + 1);
      const L = () => pt(x, y, x, y + 1);
      switch (c) {
        case 1: add(L(), B()); break;
        case 2: add(B(), R()); break;
        case 3: add(L(), R()); break;
        case 4: add(R(), T()); break;
        case 5: add(L(), T()); add(R(), B()); break;
        case 6: add(B(), T()); break;
        case 7: add(L(), T()); break;
        case 8: add(T(), L()); break;
        case 9: add(T(), B()); break;
        case 10: add(T(), R()); add(B(), L()); break;
        case 11: add(T(), R()); break;
        case 12: add(R(), L()); break;
        case 13: add(R(), B()); break;
        case 14: add(B(), L()); break;
      }
    }
  const loops = [];
  while (segs.size) {
    const [startKey, first] = segs.entries().next().value;
    segs.delete(startKey);
    const loop = [first[1]];
    let nextKey = first[0];
    let guard = 0;
    while (nextKey !== startKey && guard++ < 5_000_000) {
      const seg = segs.get(nextKey);
      if (!seg) break;
      segs.delete(nextKey);
      loop.push(seg[1]);
      nextKey = seg[0];
    }
    if (loop.length >= 8) loops.push(loop);
  }
  return loops;
}

function simplify(p, eps) {
  if (p.length < 3) return p;
  const a = p[0];
  const b = p[p.length - 1];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  let max = 0;
  let idx = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const d = Math.abs(dy * p[i][0] - dx * p[i][1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  return max > eps ? [...simplify(p.slice(0, idx + 1), eps).slice(0, -1), ...simplify(p.slice(idx), eps)] : [a, b];
}

const toFraction = (p) => p.map(([x, y]) => [+((x - P) / S).toFixed(4), +((y - P) / S).toFixed(4)]);

const layers = LAYERS.map((layer, i) => {
  let g = blur(dist, (layer.smooth || 0) * S);
  if (layer.noise) {
    const n = noiseField(1234 + i * 101, layer.detail ?? 0.3);
    g = Float32Array.from(g, (v, j) => v + n[j] * layer.noise);
  }
  const loops = contours(g, layer.level)
    .map((l) => toFraction(simplify(l, 0.35)))
    .filter((l) => l.length >= 4);
  return { name: layer.name, color: layer.color, loops };
});

const fmtLoop = (l) => "      [" + l.map(([x, y]) => `[${x},${y}]`).join(",") + "],";
const out = `// GENERATED by scripts/build-water-rings.mjs from lib/map/land-outline.ts.
// Do not edit by hand; re-run the script instead.
//
// The water around the island, matched to Fortnite's in-game map: layers
// painted outermost first, each a set of closed loops (outer edges, holes and
// puddles) in the same [0,1] fraction space as LAND_OUTLINE, to be filled
// with the even-odd rule. See the script for how they're made.
export interface WaterLayer {
  name: string;
  color: string;
  loops: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
}

export const WATER_LAYERS: ReadonlyArray<WaterLayer> = [
${layers
  .map((l) => `  {\n    name: "${l.name}",\n    color: "${l.color}",\n    loops: [\n${l.loops.map(fmtLoop).join("\n")}\n    ],\n  },`)
  .join("\n")}
];

/** How far the outermost layer reaches past the coast, for fitting the view. */
export const WATER_REACH = ${(LAYERS[0].level + LAYERS[0].noise).toFixed(3)};
`;
writeFileSync(join(ROOT, "lib/map/water-rings.ts"), out);
console.log(layers.map((l) => `${l.name}: ${l.loops.length} loops, ${l.loops.reduce((a, b) => a + b.length, 0)} pts`).join(" | "));
