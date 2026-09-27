"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Radar } from "lucide-react"; // the original radar glyph, kept off the Hugeicons set on purpose
import { Logo } from "@/components/logo";
import { Info, Ban, CrownSolid, PanelLeftOpen, TapIcon } from "@/components/icons";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { useCollectionStatus } from "@/hooks/use-collection-status";
import type { NormalizedSprite } from "@/lib/sprite-catalog/types";
import { rarityAccent } from "@/lib/rarity";
import { displayName } from "@/lib/sprite-name";
import { VARIANT_SLOTS, variantBackdrop, variantKey, variantLabel, variantLabelColor } from "@/lib/variant-colors";
import { spriteIconTransform } from "@/lib/sprite-icon-metrics";
import { Button } from "@/components/ui/button";
import { MasterySummary } from "./mastery-summary";
import { cn } from "@/lib/utils";

const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "special"];

/**
 * Counts how many times `value` has changed since mount (0 until the first
 * change). Derived during render, React's own pattern for state that tracks
 * a prop, so no effect is needed.
 */
function useChangeCount<T>(value: T) {
  const [seen, setSeen] = useState({ value, count: 0 });
  if (seen.value !== value) setSeen({ value, count: seen.count + 1 });
  return seen.value === value ? seen.count : seen.count + 1;
}

/**
 * A variant tile's box. Re-keyed whenever its status changes, so a tap lands
 * with a springy pop (and a new crown bounces in when it becomes mastered):
 * the reward for the one thing the catalog asks you to do. Nothing plays on
 * the first render, so the page loads still. Reduced motion skips it (see
 * MotionConfig in app/page.tsx).
 */
function TileBox({
  status,
  className,
  style,
  children,
}: {
  status: string;
  className: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const changes = useChangeCount(status);
  const pop = changes > 0;
  return (
    <motion.span
      key={changes}
      initial={pop ? { scale: 0.82 } : false}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 520, damping: 14 }}
      className={className}
      style={style}
    >
      {children}
      {status === "mastered" && (
        // A gold disc in the tile's bottom-right, holding a crown in the
        // sidebar's own colour.
        <motion.span
          aria-hidden
          initial={pop ? { scale: 0, rotate: -40 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 480, damping: 11, delay: pop ? 0.08 : 0 }}
          className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-full border-2 border-pop-ink bg-sprite-gold shadow-[0_2px_0_var(--pop-ink)]"
        >
          <CrownSolid className="size-4 text-card" fill="currentColor" />
        </motion.span>
      )}
    </motion.span>
  );
}

/** DOM id of a rarity's section, for the header scrubber to scroll to. */
function sectionId(rarity: string | null) {
  return `rarity-${rarity ?? "unknown"}`;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as const } },
};

interface SpriteFamilyGroup {
  family: string;
  rarity: string | null;
  icon: string | null;
  variants: NormalizedSprite[];
}


function groupByFamily(sprites: NormalizedSprite[]): SpriteFamilyGroup[] {
  const order: string[] = [];
  const groups = new Map<string, SpriteFamilyGroup>();

  for (const sprite of sprites) {
    if (!groups.has(sprite.family)) {
      order.push(sprite.family);
      groups.set(sprite.family, { family: sprite.family, rarity: null, icon: null, variants: [] });
    }
    const group = groups.get(sprite.family)!;
    group.variants.push(sprite);
    if (sprite.variant === null) {
      group.rarity = sprite.rarity;
      group.icon = sprite.icon;
    }
  }

  for (const group of groups.values()) {
    if (!group.icon) group.icon = group.variants[0]?.icon ?? null;
    if (!group.rarity) group.rarity = group.variants[0]?.rarity ?? null;
  }

  return order.map((id) => groups.get(id)!);
}

export interface SpriteCatalogBrowserProps {
  selectedSpriteId?: string | null;
  /** Opens the detail panel. The Info icon only — Radar never triggers this. */
  onSelect: (id: string) => void;
  visibleSpriteIds: Set<string>;
  /**
   * Shows/hides this Sprite's findings on the map. The Radar icon only.
   *
   * Takes a list because a finding is stored against the variant that was
   * found, so one Sprite is several ids — the Radar flips all of them together
   * in a single state update.
   */
  onSetVisibility: (ids: string[], visible: boolean) => void;
  /** When true the sidebar shrinks to just its open button in the top-left corner. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function SpriteCatalogBrowser({
  onSelect,
  visibleSpriteIds,
  onSetVisibility,
  collapsed,
  onToggleCollapsed,
}: SpriteCatalogBrowserProps) {
  const { sprites, loading, error, reload } = useSpriteCatalog();
  const { getStatus, cycleStatus, hasAny } = useCollectionStatus();

  // Only Sprites the current season's live config actually makes obtainable
  // — vaulted/rotated-out/unreleased entries never show up in the browsable
  // catalog at all (they're still in sprites.json for reference, just not here).
  const liveSprites = useMemo(() => sprites.filter((s) => s.currentlyLive), [sprites]);
  const groups = useMemo(() => {
    const byFamily = groupByFamily(liveSprites);
    return byFamily.sort((a, b) => {
      const ai = RARITY_ORDER.indexOf(a.rarity?.toLowerCase() ?? "");
      const bi = RARITY_ORDER.indexOf(b.rarity?.toLowerCase() ?? "");
      return (ai === -1 ? RARITY_ORDER.length : ai) - (bi === -1 ? RARITY_ORDER.length : bi);
    });
  }, [liveSprites]);

  const filtered = groups;

  // Collapsed: nothing but the open button, so the sidebar hugs it as a small
  // floating control in the top-left corner (page.tsx drops the panel's fixed
  // width and full height). Returns only after every hook above has run —
  // hooks must be called on every render, collapsed or not.
  if (collapsed) {
    return (
      // bg-muted: the same grey as the open panel's header strip, so the
      // collapsed control reads as that header folded down to its button.
      // p-4 puts the icon 16px from the top, the same as in the open header
      // (pt-4), so collapsing only moves it sideways, never up.
      <div className="bg-muted p-4">
        <Button
          variant="ghost"
          size="icon-sm"
          data-slot="sidebar-toggle"
          onClick={onToggleCollapsed}
          aria-label="Open sidebar"
          aria-expanded={false}
          className="text-muted-foreground hover:!bg-transparent hover:!text-pop-yellow"
        >
          <PanelLeftOpen className="size-5" strokeWidth={1.5} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Pinned header: the logo and the mastery count. px-4 matches the
          cards below, so everything in the sidebar shares one left edge. */}
      <div className="shrink-0">
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 max-md:pt-5 max-md:pb-4">
          <Logo className="text-lg max-md:text-xl" />
        </div>

        <div className="px-4 pb-[3px]">
          {/* pb-[3px]: room for the bar's 3px hard shadow, which the rarity
              container below would otherwise cover. */}
          <MasterySummary />
          {/* First run only: until anything is marked, say how the tiles
              work. Gone for good after the first tap. */}
          {!hasAny && (
            <p className="mt-4 flex items-center gap-2 text-sm leading-snug text-muted-foreground">
              <span
                aria-hidden
                className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-pop-ink bg-pop-yellow text-pop-ink shadow-[0_2px_0_var(--pop-ink)]"
              >
                <TapIcon className="size-3.5" />
              </span>
              <span>
                Tap a sprite <span className="font-semibold text-foreground">once</span> when you collect it,{" "}
                <span className="font-semibold text-foreground">twice</span> when you master it.
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Everything below the header scrolls. */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pb-4">
      {loading && (
        // The real layout, drawn before the data arrives: a rarity band, then
        // card panels in the catalog's exact proportions, so nothing jumps
        // when it lands. The status text stays for screen readers.
        <div className="overflow-hidden" aria-busy="true">
          <span className="sr-only" role="status">Loading Sprite catalog…</span>
          <div className="skeleton mt-4 mb-4 h-9 rounded-full" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="mb-3 rounded-2xl bg-muted px-3 py-3 shadow-[0_3px_0_rgb(20_28_74/0.5)]">
              <div className="flex items-center gap-3">
                <div className="skeleton-dark size-12 rounded-xl" />
                <div className="flex flex-col gap-2">
                  <div className="skeleton-dark h-5 w-28 rounded-md" />
                  <div className="skeleton-dark h-2 w-16 rounded-full" />
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className="skeleton-dark aspect-square w-20 shrink-0 rounded-md max-md:w-auto max-md:flex-1" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-1 flex-col gap-3 pt-4 text-base">
          <p className="display-caps text-xl text-foreground">Sprite catalog unavailable</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{error}</p>
          <Button variant="ghost" size="sm" data-slot="retry" onClick={reload} className="material self-start rounded-full px-4 text-pop-ink hover:text-pop-ink">
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && (
        <motion.div variants={container} initial="hidden" animate="show">
          {(() => {
            const renderCard = (group: SpriteFamilyGroup) => {
            const baseVariant = group.variants.find((v) => v.variant === null) ?? group.variants[0];
            // One Radar per Sprite, covering every variant it has: findings are
            // stored against the variant that was actually found, so "show
            // Jonesy" means all of Jonesy's ids. Narrowing to a single variant
            // is the map's own filter (see app/page.tsx), not a per-tile
            // control — it is one choice about the map rather than 101 of them.
            const isShown = group.variants.some((v) => visibleSpriteIds.has(v.id));
            // Out of the variants this family actually has, not a flat four —
            // Mega Man ships only its base one, so it reads (0/1).
            const masteredInSet = group.variants.filter((v) => getStatus(v.id) === "mastered").length;

            return (
              <motion.div key={group.family} variants={item}>
                {/* Each Sprite is its own lifted panel: one step lighter than
                    the sidebar (--muted), rounded, and a soft ink drop under it
                    at half strength, so the cards separate by surface and
                    depth rather than by outlines. overflow-hidden clips the
                    scrolling tile row to the panel's rounded corners. */}
                <div className="mb-3 overflow-hidden rounded-2xl bg-muted px-3 py-2 shadow-[0_3px_0_rgb(20_28_74/0.5)]">
                  {/* Header: purely informational — not clickable/hoverable, per design. Only the Radar/Info icons act. */}
                  <div className="flex items-center justify-between py-1">
                    <span className="flex min-w-0 items-center">
                      {group.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={group.icon}
                          alt=""
                          className="size-14 md:size-16 shrink-0 object-contain"
                          // Every icon is a 512x512 square, but the artwork inside fills
                          // 71%-92% of it depending on the Sprite — so equal boxes alone
                          // still render visibly unequal sprites. See scripts/measure-sprite-icons.py.
                          style={{ transform: spriteIconTransform(baseVariant.id) }}
                        />
                      ) : (
                        <span className="size-14 md:size-16 shrink-0 rounded-md bg-input/30" />
                      )}
                      <span className="flex min-w-0 flex-col items-start justify-center gap-0.5">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="display-caps truncate text-xl leading-[1.15] text-foreground">
                            {group.family}
                          </span>
                          {/* Opens this Sprite's profile. The visible box matches the
                              name's line height; ::after widens the hit area to
                              43px. */}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            data-slot="sprite-details"
                            onClick={() => onSelect(baseVariant.id)}
                            aria-label={`${group.family} details`}
                            // The visible box stays at the name's line-height, but
                            // the ::after extends the hit area 10px each way to
                            // 43px — clearing the accessibility minimum the
                            // visible box alone could not.
                            className="relative size-[23px] text-muted-foreground hover:!bg-transparent hover:!text-pop-yellow after:absolute after:-inset-2.5 after:content-['']"
                          >
                            <Info className="size-4" strokeWidth={2.5} />
                          </Button>
                        </span>
                        {/* One dot per variant the family has, in slot order:
                            gold once mastered, else the unselected tile fill. */}
                        <span
                          className="flex h-4 items-center gap-1"
                          role="img"
                          aria-label={`${masteredInSet} of ${group.variants.length} mastered`}
                        >
                          {VARIANT_SLOTS.map((slot) => {
                            const v = group.variants.find((x) => variantKey(x.variant) === slot);
                            // Only variants that exist get a dot: Mega Man shows one.
                            if (!v) return null;
                            const mastered = getStatus(v.id) === "mastered";
                            return (
                              <span
                                key={slot}
                                data-slot="mastery-dot"
                                data-state={mastered ? "mastered" : "unmastered"}
                                className={cn(
                                  "size-2 rounded-full",
                                  // Unmastered: exactly the unselected tile's fill (bg-card).
                                  mastered ? "bg-sprite-gold" : "bg-card"
                                )}
                              />
                            );
                          })}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {/* The Radar toggle. Off: a bare lavender glyph that turns
                          yellow on hover. On: a yellow sticker disc with an ink
                          glyph, so "showing on the map" reads as a switched-on
                          state at a glance, not just a colour shift. */}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        data-slot="toggle-findings"
                        onClick={() => onSetVisibility(group.variants.map((v) => v.id), !isShown)}
                        aria-pressed={isShown}
                        aria-label={
                          isShown
                            ? `Hide ${group.family} findings on the map`
                            : `Show ${group.family} findings on the map`
                        }
                        className={cn(
                          "-mr-1 size-10 rounded-full border-2 transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:translate-y-[2px] motion-reduce:transition-none max-md:size-11",
                          isShown
                            ? "border-pop-ink !bg-pop-yellow text-pop-ink shadow-[0_2px_0_var(--pop-ink)] hover:!text-pop-ink active:shadow-none"
                            : "border-transparent text-muted-foreground hover:!bg-transparent hover:!text-pop-yellow"
                        )}
                      >
                        <Radar className="size-6" strokeWidth={2} />
                      </Button>
                    </span>
                  </div>

                  {/* Beside the map the tiles keep a fixed 80px and the row
                      scrolls, clipped at the card's edge; on a phone they flex
                      to fill the card's width instead. */}
                  <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 py-2 max-md:overflow-x-visible">
                    {VARIANT_SLOTS.map((slot) => {
                      const v = group.variants.find((x) => variantKey(x.variant) === slot);
                      // Not every family ships all five variants (Mega Man has only
                      // the base one). Render a placeholder so the columns line up
                      // and every tile is the same size.
                      if (!v) {
                        return (
                          <div
                            key={slot}
                            data-slot="variant-slot-empty"
                            className="flex w-20 shrink-0 flex-col items-center gap-1 max-md:w-auto max-md:flex-1 max-md:shrink"
                          >
                            {/* Colour-coded like a real tile's caption, so the
                                five columns stay identifiable straight down
                                the sidebar. Not dimmed: every variant colour
                                falls below the 4.5:1 small-text floor once
                                faded (indigo reaches 2.7:1 at 70%), and the
                                dashed border and Ban icon below already say
                                the variant doesn't exist. */}
                            <span
                              className="display-caps text-sm leading-5"
                              style={{ color: variantLabelColor(slot === "normal" ? null : slot) ?? undefined }}
                            >
                              {variantLabel(slot)}
                            </span>
                            <span
                              className="relative flex aspect-square w-full items-center justify-center rounded-md border-[3px] border-dashed border-pop-ink/40 bg-card"
                              aria-label={`${group.family} has no ${variantLabel(slot).toLowerCase()} variant`}
                            >
                              {/* Opaque, not muted-foreground/50. The Ban glyph
                                  is one path whose slash crosses its own
                                  circle, and at partial opacity that overlap
                                  blends against itself — the crossing showed
                                  as a brighter seam, so the line appeared to
                                  continue through the ring.
                                  color-mix resolves what 50% WOULD have looked
                                  like over this tile, but as one opaque colour
                                  and out of the theme's own tokens. It was a
                                  hard-coded #506988 before, which no longer
                                  tracked the palette. */}
                              <Ban
                                className="size-5"
                                strokeWidth={1.5}
                                style={{
                                  color: "color-mix(in oklch, var(--muted-foreground), var(--card) 50%)",
                                }}
                              />
                            </span>
                          </div>
                        );
                      }
                      const status = getStatus(v.id);
                      const label = variantLabel(v.variant);
                      const accent = variantBackdrop(v.variant);
                      const isColored = status !== "default";
                      return (
                        <button
                          key={v.id}
                          type="button"
                          data-slot="variant-tile"
                          data-status={status}
                          onClick={() => cycleStatus(v.id)}
                          aria-label={`${displayName(v.name)}: ${status}, click to change`}
                          className="group flex w-20 shrink-0 flex-col items-center gap-1 outline-none select-none max-md:w-auto max-md:flex-1 max-md:shrink"
                        >
                          {/* The caption is always in its variant's colour, so the
                              row reads as a legend of the five. */}
                          <span
                            className="display-caps text-sm leading-5"
                            style={{ color: variantLabelColor(v.variant) ?? undefined }}
                          >
                            {label}
                          </span>
                          <TileBox
                            status={status}
                            className={cn(
                              // A sticker like every other control: ink outline and
                              // hard ink drop. Hover zooms the whole tile (art and
                              // all, as one piece), press squeezes it, keyboard
                              // focus rings it in yellow.
                              "relative block aspect-square w-full overflow-clip rounded-md border-[3px] border-pop-ink shadow-[0_3px_0_var(--pop-ink)] transition-[scale] duration-150 ease-out",
                              "group-hover:scale-[1.06] group-active:scale-[0.97]",
                              "group-focus-visible:ring-3 group-focus-visible:ring-pop-yellow motion-reduce:transition-none motion-reduce:group-hover:scale-100",
                              // Gold outline only for mastered: the top of the ladder.
                              status === "mastered" && "border-sprite-gold",
                              // Uncollected: the sidebar's own fill, a step below the card.
                              !isColored && "bg-card"
                            )}
                            style={isColored ? { background: accent ?? undefined } : undefined}
                          >
                            {v.icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.icon}
                                alt={displayName(v.name)}
                                className={cn(
                                  // Every Sprite pops off its tile by default: the hard
                                  // ink drop under the art, then a soft dark lift.
                                  "absolute inset-0 size-full object-cover transition-[filter] duration-150 [filter:drop-shadow(0_3px_0_var(--pop-ink))_drop-shadow(0_6px_8px_rgb(0_0_0/0.35))]",
                                  // Uncollected Sprites wear the indigo duotone (keeping
                                  // the drop) and come up to full colour on hover.
                                  !isColored &&
                                    "[filter:url(#reef-duotone)_drop-shadow(0_3px_0_var(--pop-ink))_drop-shadow(0_6px_8px_rgb(0_0_0/0.35))] group-hover:[filter:drop-shadow(0_3px_0_var(--pop-ink))_drop-shadow(0_6px_8px_rgb(0_0_0/0.35))]"
                                )}
                                // Sized and centred per Sprite (lib/sprite-icon-metrics.ts).
                                style={{ transform: spriteIconTransform(v.id) }}
                              />
                            ) : (
                              <span className="absolute inset-0 bg-input/30" />
                            )}
                          </TileBox>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
            };

            // One section per rarity run. `filtered` is already rarity-sorted
            // and filtering never reorders it, so adjacent runs are the
            // sections. Each is its own element so its header can be sticky
            // for exactly as long as that rarity is on screen — a sticky
            // element only sticks within its parent.
            const sections: { rarity: string | null; groups: SpriteFamilyGroup[] }[] = [];
            filtered.forEach((group) => {
              const last = sections[sections.length - 1];
              if (last && last.rarity === group.rarity) last.groups.push(group);
              else sections.push({ rarity: group.rarity, groups: [group] });
            });

            return sections.map((section) => {
              const accent = rarityAccent(section.rarity);
              const label = section.rarity
                ? section.rarity.charAt(0).toUpperCase() + section.rarity.slice(1)
                : "Unknown";
              return (
                <section key={section.rarity ?? "unknown"} id={sectionId(section.rarity)} aria-label={`${label} Sprites`}>
                  {/* Sticky rarity header: a solid --card strip with 16px above
                      and below the band, so cards scroll cleanly under it. */}
                  <div
                    data-slot="rarity-header"
                    className="sticky top-0 z-10 -mx-4 mt-3 [section:first-of-type_&]:mt-0 flex h-[68px] items-center px-4 py-4 bg-card"
                  >
                    {/* The section divider: a rarity-coloured sticker band,
                        ink outline and hard drop shadow like every button. */}
                    <div
                      className="flex h-9 w-full items-center gap-2.5 rounded-full border-[3px] border-pop-ink pr-1 pl-[9px] shadow-[0_3px_0_var(--pop-ink)]"
                      style={{ background: accent.solid }}
                    >
                      <span className="display-caps ink-label text-xl leading-none">{label}</span>
                      <span className="display-caps ml-auto rounded-full border-[3px] border-pop-ink bg-pop-ink px-2 text-sm leading-4 tabular-nums text-white">
                        {section.groups.length}
                      </span>
                    </div>
                  </div>
                  {section.groups.map((group) => renderCard(group))}
                </section>
              );
            });
          })()}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <p className="display-caps text-xl text-foreground">No Sprites this season yet</p>
              <p className="text-sm text-muted-foreground">The catalog refreshes as the season goes live.</p>
            </div>
          )}
        </motion.div>
      )}
      </div>
    </div>
  );
}
