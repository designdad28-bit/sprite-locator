import { spriteIconScale } from "@/lib/sprite-icon-metrics";

/**
 * A Sprite's icon at list size, for dropdown rows and triggers.
 *
 * Every icon is a 512x512 square, but the artwork inside fills 71%-92% of it
 * depending on the Sprite, so equal boxes alone still render visibly unequal
 * sprites — hence the per-id scale (see scripts/measure-sprite-icons.py).
 * Sprites with no icon get an empty box of the same size, so every label in a
 * list starts on the same edge.
 *
 * `id` is what the scale is looked up by, and `icon` is what's drawn: a
 * variant's row passes the variant's own icon alongside the id whose metrics
 * it was measured under.
 */
export function SpriteThumb({ id, icon }: { id: string; icon: string | null }) {
  if (!icon) return <span className="size-6 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon}
      alt=""
      className="size-6 shrink-0 object-contain"
      style={{ transform: `scale(${spriteIconScale(id)})` }}
    />
  );
}
