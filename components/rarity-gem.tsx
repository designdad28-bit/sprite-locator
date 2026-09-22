/**
 * The rarity's mark: a small lit diamond in the rarity colour. Used by the
 * catalog's section headers and the detail panel, so rarity is one object
 * wherever it appears.
 */
export function RarityGem({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-2.5 shrink-0 rotate-45 rounded-[2px]"
      style={{
        backgroundColor: color,
        boxShadow: `0 0 0 1.5px color-mix(in oklch, white 35%, transparent), 0 0 10px ${color}`,
      }}
    />
  );
}
