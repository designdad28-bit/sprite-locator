#!/usr/bin/env node
/**
 * Generates lib/map/water-rings.ts: the Fortnite-style water bands drawn
 * around the island, as smooth vector outlines.
 *
 * Why precomputed vectors: the bands used to be SVG filters (blur, then a
 * threshold) applied live in the browser. Browsers rasterise large blur
 * filters at reduced resolution, so the band edges came out stair-stepped
 * when zoomed in. Doing the same blur-and-threshold here, once, and tracing
 * the result into paths gives edges that stay razor-sharp at every zoom.
 *
 * How each band is made: rasterise LAND_OUTLINE onto a padded grid, blur it
 * with a Gaussian of sigma, and keep everything whose blurred value is at
 * least t. Outside a straight coast the blurred value is Phi(-d/sigma), so the
 * band's edge sits d = -sigma * Phi^-1(t) out from the beach, and any corner
 * or inlet narrower than about sigma is rounded away: smooth, evenly spaced
 * contours rather than copies of the coastline. The edge is then traced,
 * simplified, and softened with Chaikin corner-cutting.
 *
 * Re-run whenever lib/map/land-outline.ts is re-traced:
 *   node scripts/build-water-rings.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Outermost first. sigma and d are fractions of the map's width.
 *
 * Each band is the UNION of two contours. "smooth" uses a large sigma, so it
 * only follows the island's big shapes and sweeps over small bays in long
 * curves, the way Fortnite's own bands do. But a large sigma also shrinks
 * away from thin peninsulas, so "margin" (a small sigma) guarantees the band
 * still clears every tip of land by at least its distance.
 */
const BANDS = JSON.parse(process.env.RING_BANDS || "null") ?? [
  // deep blue, the widest: smooth edge ~0.089 out, never closer than ~0.051
  { smooth: { sigma: 0.06, threshold: 0.07 }, margin: { sigma: 0.025, threshold: 0.02 } },
  // mid blue: ~0.038 out, never closer than ~0.017
  { smooth: { sigma: 0.045, threshold: 0.2 }, margin: { sigma: 0.012, threshold: 0.08 } },
  // light shallows, the thinnest: ~0.009 out, never closer than ~0.004
  { smooth: { sigma: 0.03, threshold: 0.38 }, margin: { sigma: 0.006, threshold: 0.25 } },
];

const S = 1024; // cells across the [0,1] map
const P = 128; // padding cells, so the outer band isn't clipped at the edges
const G = S + 2 * P;

const src = readFileSync(join(ROOT, "lib/map/land-outline.ts"), "utf8");
const body = src.slice(src.indexOf("= [") + 2, src.lastIndexOf("];") + 1);
const land = JSON.parse(body.replace(/,\s*\]$/, "]"));

// Rasterise the polygon (even-odd scanline fill, sampled at cell centres).
const base = new Float32Array(G * G);
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
    for (let gx = a; gx <= b; gx++) base[gy * G + gx] = 1;
  }
}

function blur(field, sigma) {
  const r = Math.ceil(sigma * 3);
  const k = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp((-i * i) / (2 * sigma * sigma));
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
        const xx = x + i;
        if (xx >= 0 && xx < G) a += field[y * G + xx] * k[i + r];
      }
      tmp[y * G + x] = a;
    }
  for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) {
        const yy = y + i;
        if (yy >= 0 && yy < G) a += tmp[yy * G + x] * k[i + r];
      }
      out[y * G + x] = a;
    }
  return out;
}

const N4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Union of thresholded fields, keep the largest region, crack-trace its edge. */
function trace(parts) {
  const m = new Uint8Array(G * G);
  for (const [field, t] of parts) for (let i = 0; i < G * G; i++) if (field[i] >= t) m[i] = 1;

  const lab = new Int32Array(G * G);
  let best = 0;
  let bestN = 0;
  let id = 0;
  for (let i = 0; i < G * G; i++) {
    if (!m[i] || lab[i]) continue;
    id++;
    let n = 0;
    const st = [i];
    lab[i] = id;
    while (st.length) {
      const c = st.pop();
      n++;
      const x = c % G;
      const y = (c / G) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= G || ny >= G) continue;
        const nc = ny * G + nx;
        if (m[nc] && !lab[nc]) {
          lab[nc] = id;
          st.push(nc);
        }
      }
    }
    if (n > bestN) {
      bestN = n;
      best = id;
    }
  }
  for (let i = 0; i < G * G; i++) m[i] = lab[i] === best ? 1 : 0;

  const at = (x, y) => x >= 0 && y >= 0 && x < G && y < G && m[y * G + x] === 1;
  let sx = -1;
  let sy = -1;
  outer: for (let y = 0; y < G; y++)
    for (let x = 0; x < G; x++)
      if (at(x, y)) {
        sx = x;
        sy = y;
        break outer;
      }

  const V = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const right = (x, y, d) => (d === 0 ? [x, y] : d === 1 ? [x - 1, y] : d === 2 ? [x - 1, y - 1] : [x, y - 1]);
  const left = (x, y, d) => (d === 0 ? [x, y - 1] : d === 1 ? [x, y] : d === 2 ? [x - 1, y] : [x - 1, y - 1]);
  const pts = [];
  let x = sx;
  let y = sy;
  let dir = 0;
  let steps = 0;
  do {
    pts.push([x, y]);
    for (const turn of [3, 0, 1, 2]) {
      const nd = (dir + turn) % 4;
      const [rx, ry] = right(x, y, nd);
      const [lx, ly] = left(x, y, nd);
      if (at(rx, ry) && !at(lx, ly)) {
        dir = nd;
        break;
      }
    }
    x += V[dir][0];
    y += V[dir][1];
    steps++;
  } while ((x !== sx || y !== sy) && steps < 2_000_000);
  return pts;
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

function chaikin(p, iterations) {
  for (let it = 0; it < iterations; it++) {
    const q = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}

const toFraction = (p) => p.map(([x, y]) => [+((x - P) / S).toFixed(4), +((y - P) / S).toFixed(4)]);

const bands = BANDS.map(({ smooth, margin }) => {
  const edge = trace([
    [blur(base, smooth.sigma * S), smooth.threshold],
    [blur(base, margin.sigma * S), margin.threshold],
  ]);
  return toFraction(simplify(chaikin(simplify(edge, 1.2), 3), 0.25));
});

const fmt = (poly) => "  [\n" + poly.map(([x, y]) => `    [${x}, ${y}],`).join("\n") + "\n  ],";
const out = `// GENERATED by scripts/build-water-rings.mjs from lib/map/land-outline.ts.
// Do not edit by hand; re-run the script instead.
//
// The Fortnite-style water bands around the island, outermost first, as
// closed polygons in the same [0,1] fraction space as LAND_OUTLINE. See the
// script for how they're made (blur the land, threshold, trace, smooth).
export const WATER_RING_OUTLINES: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
${bands.map(fmt).join("\n")}
];
`;
writeFileSync(join(ROOT, "lib/map/water-rings.ts"), out);
console.log(
  "water rings:",
  bands.map((b) => `${b.length} pts`).join(", "),
  "| reach past the island's left edge:",
  bands.map((b) => Math.min(...b.map((p) => p[0])).toFixed(4)).join(", ")
);
