/**
 * The rarity's mark: a small lit diamond in the rarity colour. Used by the
 * catalog's section headers and the detail panel, so rarity is one object
 * wherever it appears.
 */
export function RarityGem({ color, dim = false }: { color: string; dim?: boolean }) {
  // Dim: the same diamond unlit — a small outline in the rarity colour with no
  // fill or glow, so the scrubber's other stops read as "somewhere else" while
  // keeping their colour, and the lit one reads as "here" by contrast alone.
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rotate-45 rounded-[2px] transition-[background-color,border-color] duration-300"
      style={
        dim
          ? { border: `1.5px solid ${color}` }
          : {
              // No outer glow: xAI's material system carries elevation with
              // hairline borders, not neon bloom (see DESIGN.md's Don'ts).
              // The white ring plus solid fill is enough to read as "lit".
              backgroundColor: color,
              border: "1.5px solid var(--pop-ink)",
            }
      }
    />
  );
}
