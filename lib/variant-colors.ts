/**
 * Fixed per-variant tile colors, taken from the variants' own artwork.
 *
 * Each hue is measured, not chosen: for every variant slot, all 20 of this
 * season's icons were sampled in-browser (same-origin canvas read on
 * fortnite.gg, so the pixels are readable), averaging the colored pixels —
 * alpha > 200 and saturation > 0.30, which skips the shared white/grey body
 * and keeps the part that actually distinguishes a variant. Measured hues:
 * gold 86°, cheat master 140° (green), loot hacker 277° (indigo), bounty
 * hunter 318° (purple).
 *
 * Each hue then takes the MOST SATURATED form sRGB can give it, at the
 * highest lightness that still reaches gold's vibrancy (HSV saturation
 * >= 0.95, capped at gold's own OKLCH L 0.727). An earlier pass put all four
 * on one lightness rung instead, which looked even in the abstract but left
 * green, indigo and purple visibly pastel beside gold — equal OKLCH chroma
 * is not equal vibrancy, because sRGB holds far less chroma for those hues
 * than it does for yellow.
 *
 * The cost is that lightness now varies: indigo bottoms out at L 0.485
 * because hue 277° simply cannot be vivid any lighter — at gold's 0.727 its
 * ceiling is HSV 0.43, which is the pastel we were trying to escape. So the
 * indigo tile is noticeably darker than the other three. That is a real
 * tradeoff, chosen deliberately: vibrancy matched, lightness sacrificed.
 */
const VARIANT_COLOR: Record<string, string> = {
  gold: "#D09E00", // artwork 86°,  L 0.727 — unchanged in practice
  cheatmaster: "#3EC700", // artwork 140°, L 0.727
  hacker: "#4B0CFF", // artwork 277°, L 0.485 — darker so it can be vivid
  reaper: "#D203FF", // artwork 318°, L 0.637
};

/**
 * Per-variant tile gradients: the same colour, shaded top-dark to bottom-light.
 *
 * Expressed in OKLCH so the intent is legible — every stop keeps its variant's
 * measured artwork hue and only lightness moves, by -0.09 at the top and +0.09
 * at the bottom of the solid value in VARIANT_COLOR above. The solid therefore
 * remains the gradient's midpoint, so a tile still reads as the same colour it
 * was.
 *
 * Chroma is not constant across the two stops: it is capped at whatever sRGB
 * holds at each lightness, which is why the lighter stop of indigo (0.236 from
 * 0.295) and purple (0.223 from 0.308) is less saturated than its solid. Those
 * hues run out of gamut as they lighten — the alternative would be letting the
 * browser gamut-map them for us, with less control over where.
 *
 * VARIANT_COLOR stays the single solid value, since the detail panel paints it
 * on borders and text where a gradient is not a valid value.
 */
const VARIANT_GRADIENT: Record<string, string> = {
  gold: "linear-gradient(to top, oklch(0.636 0.130 86), oklch(0.816 0.149 86))",
  cheatmaster: "linear-gradient(to top, oklch(0.637 0.205 140), oklch(0.817 0.234 140))",
  hacker: "linear-gradient(to top, oklch(0.395 0.245 276.9), oklch(0.575 0.236 276.9))",
  reaper: "linear-gradient(to top, oklch(0.546 0.265 318), oklch(0.726 0.223 318))",
};

/**
 * The base tile's gradient. Its stops live beside the solid in globals.css
 * rather than here, so the three cannot drift apart — that value is chosen by
 * measurement against the artwork (see the comment there) and is the one most
 * likely to be retuned.
 */
const BASE_VARIANT_GRADIENT =
  "linear-gradient(to top, var(--sprite-base-collected-top), var(--sprite-base-collected-bottom))";

/** The tile fill for a variant: its colour shaded dark-to-light, top to bottom. */
export function variantGradient(variant: string | null): string | null {
  if (!variant) return BASE_VARIANT_GRADIENT;
  return VARIANT_GRADIENT[variantKey(variant)] ?? null;
}

/**
 * A themed backdrop per variant, layered over its gradient, for a collected
 * tile. Each follows the effect Epic paints INSIDE that variant's Sprite art:
 *   base         light greyish-blue sheen, the gold treatment in #beccff
 *   gold         crinkled gold foil (see GOLD_FOIL)
 *   cheat master Matrix code: streams of falling green glyphs down every
 *                column, top to bottom, each with a bright head and a fading
 *                tail, over a darkened green
 *   loot hacker  panel patchwork: random-sized purple panels with light
 *                seams (see HACKER_PANELS), lit from the top
 *   bounty       pink swirl: spiral arms turning round a glow behind the
 *                Sprite
 * The code rain and swirl need real shapes, so they're small generated
 * SVGs (deterministic, built once at load) rather than gradients.
 */
const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Seeded so every render draws the same rain and swirl. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const MATRIX_RAIN = (() => {
  const rand = seeded(42);
  // No < > or &: they would break the SVG markup.
  const glyphs = "01ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789Z:=+";
  const size = 7.5;
  let text = "";
  for (let x = 2; x < 100; x += 7) {
    // Streams fall down the whole column, top to bottom: each a bright head
    // with a tail of 4-9 glyphs fading out above it, then a short gap, then
    // the next, so the rain fills the tile rather than a band of it.
    let head = -rand() * 30;
    while (head - 10 * size < 104) {
      const tail = 4 + Math.floor(rand() * 6);
      const faint = rand() < 0.35 ? 0.55 : 1;
      for (let i = 0; i <= tail; i++) {
        const y = head - i * size;
        if (y < -2 || y > 104) continue;
        const ch = glyphs[Math.floor(rand() * glyphs.length)];
        const fill = i === 0 ? "#eaffea" : "#7dff8a";
        const opacity = (i === 0 ? 0.95 : 0.75 * (1 - i / (tail + 1))) * faint;
        text += `<text x="${x}" y="${y.toFixed(1)}" fill="${fill}" fill-opacity="${opacity.toFixed(2)}">${ch}</text>`;
      }
      head += (tail + 2 + Math.floor(rand() * 4)) * size;
    }
  }
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" font-family="Menlo,Consolas,monospace" font-size="${size}" font-weight="700">${text}</svg>`
  );
})();

/**
 * Crinkled gold foil, after the Fortnite gold card: fine hammered texture over
 * the whole surface, big soft dark swaths running diagonally, and bright
 * yellow-gold between them.
 *   - Swaths: low-frequency noise stretched along one axis, then rotated 25deg
 *     so it streaks diagonally; its dark end becomes deep brown, its bright end
 *     pale gold, both as alpha over the base.
 *   - Crinkle: fine, softened turbulence used as a shallow height map (kept
 *     low so the foil reads smooth and flat, not lumpy), lit from the top left
 *     (feDiffuseLighting), then split into a pale highlight layer and a brown
 *     shadow layer, so the texture catches light without greying the gold.
 * SVG filters render once per image and are cached, so this costs nothing per
 * frame.
 */
const GOLD_FOIL = svgUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">` +
    `<defs>` +
    `<filter id="s" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.008 0.024" numOctaves="2" seed="11"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.075  0 0 0 0 0.01  -5 0 0 0 3.05"/>` +
    `</filter>` +
    `<filter id="h" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.011 0.028" numOctaves="2" seed="4"/>` +
    `<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 0.94  0 0 0 0 0.6  3.2 0 0 0 -1.8"/>` +
    `</filter>` +
    `<filter id="c" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7"/><feGaussianBlur stdDeviation="0.35" result="n"/>` +
    `<feDiffuseLighting in="n" surfaceScale="0.45" diffuseConstant="1" lighting-color="#fff" result="l">` +
    `<feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting>` +
    `<feColorMatrix in="l" type="matrix" result="hi" values="0 0 0 0 1  0 0 0 0 0.96  0 0 0 0 0.78  1.1 0 0 0 -0.8"/>` +
    `<feColorMatrix in="l" type="matrix" result="lo" values="0 0 0 0 0.2  0 0 0 0 0.12  0 0 0 0 0.02  -1 0 0 0 0.72"/>` +
    `<feMerge><feMergeNode in="lo"/><feMergeNode in="hi"/></feMerge>` +
    `</filter>` +
    `</defs>` +
    `<g transform="rotate(25 50 50)">` +
    `<rect x="-60" y="-60" width="220" height="220" filter="url(#s)"/>` +
    `<rect x="-60" y="-60" width="220" height="220" filter="url(#h)"/>` +
    `</g>` +
    `<rect width="100" height="100" filter="url(#c)"/>` +
    `</svg>`
);

/**
 * The loot hacker art isn't a regular checkerboard: it's a patchwork of
 * rectangular panels of random sizes (big slabs, thin slivers), each a
 * slightly different shade, with fine light seams between them. Built by
 * splitting the tile at random, snapped to a 4-unit grid so it stays blocky
 * and digital, then shading each panel lighter or darker at low alpha.
 */
const HACKER_PANELS = (() => {
  const rand = seeded(9);
  const snap = (v: number) => Math.round(v / 4) * 4;
  let rects = "";
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    const canW = w >= 8;
    const canH = h >= 8;
    // Nothing longer than a fifth of the tile survives unsplit, so the panels
    // are an even, busy mix everywhere, with no large empty patches; below that, stop at random for a mix
    // of sizes down to 4-unit slivers.
    const mustSplit = Math.max(w, h) > 20;
    const stop = (!canW && !canH) || depth >= 10 || (!mustSplit && rand() < 0.45);
    if (stop) {
      // Every panel carries a visible tint, so none reads as an empty gap.
      const light = rand() < 0.5;
      const a = light ? 0.12 + rand() * 0.16 : 0.14 + rand() * 0.18;
      const fill = light ? `rgb(235 215 255 / ${a.toFixed(2)})` : `rgb(35 0 85 / ${a.toFixed(2)})`;
      rects += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
      return;
    }
    const vertical = canW && (!canH || (w > h ? rand() < 0.75 : rand() < 0.25));
    if (vertical) {
      const at = Math.min(Math.max(snap(w * (0.2 + rand() * 0.6)), 4), w - 4);
      split(x, y, at, h, depth + 1);
      split(x + at, y, w - at, h, depth + 1);
    } else {
      const at = Math.min(Math.max(snap(h * (0.2 + rand() * 0.6)), 4), h - 4);
      split(x, y, w, at, depth + 1);
      split(x, y + at, w, h - at, depth + 1);
    }
  };
  split(0, 0, 100, 100, 0);
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">` +
      `<g stroke="rgb(240 205 255)" stroke-opacity="0.45" stroke-width="0.6">${rects}</g></svg>`
  );
})();

const PINK_SWIRL = (() => {
  const cx = 50;
  const cy = 56;
  const arm = (start: number) => {
    const pts: string[] = [];
    for (let t = 0; t <= 9; t += 0.12) {
      const r = 3 * Math.exp(0.36 * t);
      if (r > 95) break;
      const a = start + t;
      pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(" ");
  };
  let paths = "";
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    paths += `<polyline points="${arm(a)}" stroke="#ffd2fb" stroke-opacity="0.34" stroke-width="7"/>`;
    paths += `<polyline points="${arm(a + Math.PI / 5)}" stroke="#5a0056" stroke-opacity="0.2" stroke-width="5"/>`;
  }
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" fill="none" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
  );
})();

const VARIANT_PATTERN: Record<string, string> = {
  // The mastery tracker's "/ 101" colour (--muted-foreground, #beccff),
  // swept with the same soft sheen as gold. Opaque, so it replaces the base
  // blue on the tile only; pins and captions keep --sprite-base-collected.
  base:
    "radial-gradient(ellipse 45% 30% at 28% 22%, rgb(255 255 255 / 0.4), transparent 70%), " +
    "linear-gradient(125deg, oklch(0.74 0.07 277) 0%, oklch(0.87 0.06 277) 20%, oklch(0.78 0.07 277) 36%, " +
    "oklch(0.91 0.05 277) 50%, oklch(0.77 0.07 277) 64%, oklch(0.85 0.06 277) 80%, oklch(0.72 0.07 277) 100%)",
  gold:
    `${GOLD_FOIL} center / cover no-repeat, ` +
    "radial-gradient(ellipse 40% 30% at 82% 45%, oklch(0.7 0.15 60 / 0.45), transparent 70%), " +
    "linear-gradient(160deg, oklch(0.84 0.13 96) 0%, oklch(0.72 0.13 86) 50%, oklch(0.66 0.12 80) 100%)",
  cheatmaster: `${MATRIX_RAIN} center / cover no-repeat, linear-gradient(rgb(0 35 5 / 0.55), rgb(0 35 5 / 0.3))`,
  // Over the loot hacker label's own colour (oklch 0.65 0.204 276.9), shaded
  // a step either side, rather than the deeper tile gradient.
  hacker:
    "linear-gradient(to bottom, rgb(255 255 255 / 0.14), transparent 65%), " +
    `${HACKER_PANELS} center / cover no-repeat, ` +
    "linear-gradient(to top, oklch(0.56 0.21 276.9), oklch(0.7 0.19 276.9))",
  reaper: `radial-gradient(circle at 50% 56%, rgb(255 215 255 / 0.55), transparent 30%), ${PINK_SWIRL} center / cover no-repeat`,
};

/**
 * The soft sheen gold and base are built from, as a light-only overlay for
 * the patterned variants: the same diagonal bands and corner glint, but
 * white at low alpha, laid on top so the code rain, checkerboard and swirl
 * all still show through.
 */
const SHEEN =
  "radial-gradient(ellipse 45% 30% at 28% 22%, rgb(255 255 255 / 0.22), transparent 70%), " +
  "linear-gradient(125deg, transparent 4%, rgb(255 255 255 / 0.1) 20%, transparent 34%, " +
  "rgb(255 255 255 / 0.14) 50%, transparent 64%, rgb(255 255 255 / 0.08) 80%, transparent 96%)";

const INK_VEIL = "linear-gradient(rgb(13 30 74 / 0.1), rgb(13 30 74 / 0.1))";

/**
 * Each variant's own mid-tone, laid over its pattern at 22% so the patterns
 * sit back on an 80px tile: a fully collected row is five patterns side by
 * side, and at full strength they competed with the Sprites on them. A veil
 * of the tile's own colour, not grey, so it calms the texture without
 * dulling the hue.
 */
const QUIET: Record<string, string> = {
  base: "oklch(0.8 0.06 277 / 0.22)",
  gold: "oklch(0.74 0.12 84 / 0.22)",
  cheatmaster: "oklch(0.4 0.11 140 / 0.24)",
  hacker: "oklch(0.63 0.2 277 / 0.22)",
  reaper: "oklch(0.64 0.24 318 / 0.22)",
};

/** Gold and base are a sheen already; the rest get SHEEN on top. */
const HAS_OWN_SHEEN = new Set(["base", "gold"]);

/** A collected tile's full background: ink veil, sheen, then the variant's pattern, over its gradient. */
export function variantBackdrop(variant: string | null): string | null {
  const gradient = variantGradient(variant);
  if (!gradient) return null;
  const key = variant ? variantKey(variant) : "base";
  const pattern = VARIANT_PATTERN[key];
  if (!pattern) return gradient;
  const layers = HAS_OWN_SHEEN.has(key) ? `${pattern}, ${gradient}` : `${SHEEN}, ${pattern}, ${gradient}`;
  // The quieting veil, then a 10% ink veil over the whole backdrop, so the
  // Sprite on top has a little more contrast against the brightest patterns.
  const quiet = QUIET[key] ? `linear-gradient(${QUIET[key]}, ${QUIET[key]}), ` : "";
  return `${INK_VEIL}, ${quiet}${layers}`;
}

/**
 * The base/normal variant's accent: grey, because base Sprites — unlike the
 * four variants — share no colour to borrow (their artwork hues span the whole
 * wheel; see --sprite-base-collected in app/globals.css for the measurement).
 * It is pitched at the mean lightness of the four coloured tiles so the
 * neutral column reads as their peer rather than as an empty slot.
 */
const BASE_VARIANT_COLOR = "var(--sprite-base-collected)";

export function variantColor(variant: string | null): string | null {
  if (!variant) return BASE_VARIANT_COLOR;
  const key = variant.toLowerCase().replace(/[^a-z]/g, "");
  return VARIANT_COLOR[key] ?? null;
}

/** Normalizes a catalog variant string to a stable slot key ("gold", "cheatmaster", …). */
export function variantKey(variant: string | null): string {
  return variant ? variant.toLowerCase().replace(/[^a-z]/g, "") : "normal";
}

/**
 * The five variant slots, in display order. Shared by the catalog tiles and the
 * detail panel's summon costs so the two always agree on order.
 *
 * "reaper" is the catalog's own key for the variant shown as "Bounty Hunter"
 * — the game's internal name and its display name simply differ, so the key
 * is left as the data spells it rather than renamed to match the label.
 */
export const VARIANT_SLOTS = ["normal", "gold", "cheatmaster", "hacker", "reaper"];

/**
 * The variant's full name, as the catalog itself spells it ("Gold Jonesy
 * Sprite", "Cheat Master Jonesy Sprite", "Loot Hacker Jonesy Sprite") — for
 * places with room for words rather than the four-letter tile caption below.
 * Keyed by slot, because a family's base name is not always a prefix of its
 * variants' ("Bush" vs "Loot Hacker Bushranger").
 */
export const VARIANT_NAME: Record<string, string> = {
  normal: "Base",
  gold: "Gold",
  cheatmaster: "Cheat Master",
  hacker: "Loot Hacker",
  reaper: "Bounty Hunter",
};

/**
 * The colour of the caption above a collected tile, matching the fill the
 * sprite sits on.
 *
 * Three of the five can use their tile colour verbatim. Two cannot: as 10px
 * text on the panel (--card, #18181B) the indigo solid measures 2.36:1 and
 * the purple 4.38:1, below the 4.5:1 needed for small text — indigo in
 * particular being all but unreadable. Both are lifted in lightness, and only
 * as far as clearing 4.5:1 requires, keeping their hue and chroma so they
 * still read as the same colour as the tile: indigo L 0.485 -> 0.620,
 * purple 0.636 -> 0.645 (the latter barely perceptible). Indigo's chroma is
 * also pulled to 0.207, the most its hue holds at that lightness, so the value
 * is inside sRGB and the browser is not left to gamut-map it somewhere
 * unpredictable.
 *
 * Applied whether or not the sprite is collected, so the row reads as a legend
 * of the five variants rather than only labelling what you own. The dashed
 * placeholder slots are the exception and stay dimmed: a family with no such
 * variant has no fill to match.
 */
const VARIANT_LABEL_COLOR: Record<string, string> = {
  gold: "#D09E00", // the tile colour, 7.23:1
  cheatmaster: "#3EC700", // the tile colour, 7.91:1
  hacker: "oklch(0.65 0.204 276.9)", // lifted from L 0.485 for legibility, 4.61:1
  reaper: "oklch(0.67 0.295 318)", // lifted from L 0.636, 4.62:1
};

/** Matches the caption above a tile to the fill beneath it. Null when there is no variant colour to match. */
export function variantLabelColor(variant: string | null): string | null {
  if (!variant) return "var(--sprite-base-collected)";
  return VARIANT_LABEL_COLOR[variantKey(variant)] ?? null;
}

/** The short label a variant is shown under everywhere in the UI. */
export function variantLabel(variant: string | null): string {
  const key = variantKey(variant);
  if (key === "normal") return "BASE";
  if (key === "cheatmaster") return "CHEAT";
  // "BOUNTY", not "REAPER": the tile caption should match the name players
  // see in game, even though the catalog's key for it is "reaper".
  if (key === "reaper") return "BOUNTY";
  return key.toUpperCase();
}
