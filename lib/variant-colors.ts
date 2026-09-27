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
 *   base         clouds: soft white puffs in the base's sky blue
 *   gold         reflective gold: gentle bands of light and shadow sweeping
 *                across polished metal, with a soft specular
 *   cheat master Matrix code: streams of falling green glyphs down every
 *                column, top to bottom, each with a bright head and a fading
 *                tail, over a darkened green
 *   loot hacker  purple checkerboard, lit from the top
 *   bounty       pink swirl: spiral arms turning round a glow behind the
 *                Sprite
 * The code rain, clouds and swirl need real shapes, so they're small generated
 * SVGs (deterministic, built once at load) rather than gradients.
 */
const CHECKER = (color: string, size: number, offset = 0) =>
  `conic-gradient(${color} 25%, transparent 0 50%, ${color} 0 75%, transparent 0) ${offset}px ${offset}px / ${size}px ${size}px`;

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

const CLOUDS = (() => {
  // Puffs of overlapping circles, each cloud drawn solid then faded as a
  // group so the overlaps don't double up.
  const cloud = (cx: number, cy: number, k: number, opacity: number) => {
    const puffs = [
      [0, 0, 11], [-12, 4, 8], [12, 4, 9], [-5, -7, 9], [6, -6, 8], [-20, 8, 5], [21, 8, 6],
    ];
    const circles = puffs
      .map(([x, y, r]) => `<circle cx="${(cx + x * k).toFixed(1)}" cy="${(cy + y * k).toFixed(1)}" r="${(r * k).toFixed(1)}"/>`)
      .join("");
    const base = `<rect x="${(cx - 22 * k).toFixed(1)}" y="${cy.toFixed(1)}" width="${(44 * k).toFixed(1)}" height="${(10 * k).toFixed(1)}" rx="${(5 * k).toFixed(1)}"/>`;
    return `<g opacity="${opacity}">${circles}${base}</g>`;
  };
  return svgUrl(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" fill="#ffffff">` +
      cloud(24, 84, 1.25, 0.55) +
      cloud(84, 72, 0.9, 0.4) +
      cloud(74, 18, 0.7, 0.35) +
      cloud(14, 28, 0.55, 0.28) +
      `</svg>`
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
  base: `radial-gradient(circle at 50% 30%, rgb(255 255 255 / 0.3), transparent 55%), ${CLOUDS} center / cover no-repeat`,
  gold:
    "radial-gradient(ellipse 45% 30% at 28% 22%, rgb(255 255 245 / 0.45), transparent 70%), " +
    "linear-gradient(125deg, oklch(0.66 0.13 80) 0%, oklch(0.82 0.13 90) 20%, oklch(0.7 0.13 82) 36%, " +
    "oklch(0.86 0.11 94) 50%, oklch(0.69 0.13 81) 64%, oklch(0.8 0.13 89) 80%, oklch(0.64 0.12 78) 100%)",
  cheatmaster: `${MATRIX_RAIN} center / cover no-repeat, linear-gradient(rgb(0 35 5 / 0.55), rgb(0 35 5 / 0.3))`,
  hacker:
    "linear-gradient(to bottom, rgb(255 255 255 / 0.2), transparent 65%), " +
    CHECKER("rgb(205 150 255 / 0.32)", 16),
  reaper: `radial-gradient(circle at 50% 56%, rgb(255 215 255 / 0.55), transparent 30%), ${PINK_SWIRL} center / cover no-repeat`,
};

/** A collected tile's full background: the variant's pattern over its gradient. */
export function variantBackdrop(variant: string | null): string | null {
  const gradient = variantGradient(variant);
  if (!gradient) return null;
  const pattern = VARIANT_PATTERN[variant ? variantKey(variant) : "base"];
  return pattern ? `${pattern}, ${gradient}` : gradient;
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
