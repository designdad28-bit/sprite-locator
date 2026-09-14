"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Info, Search, Ban, Crown, X } from "lucide-react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { useCollectionStatus } from "@/hooks/use-collection-status";
import type { NormalizedSprite } from "@/lib/sprite-catalog/types";
import { rarityAccent } from "@/lib/rarity";
import { variantColor } from "@/lib/variant-colors";
import { spriteIconScale } from "@/lib/sprite-icon-metrics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MasterySummary } from "./mastery-summary";
import { cn } from "@/lib/utils";

const RARITY_PILLS = ["Rare", "Epic", "Legendary", "Mythic"];

/** Flip to true to bring the rarity filter row back. */
const SHOW_RARITY_TABS = false;
const RARITY_ORDER = ["rare", "epic", "legendary", "mythic"];

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

/** Normalizes a catalog variant string to a stable slot key ("gold", "cheatmaster", …). */
function variantKey(variant: string | null): string {
  return variant ? variant.toLowerCase().replace(/[^a-z]/g, "") : "normal";
}

/** Every family renders these four slots, whether or not it has the sprite for each. */
const VARIANT_SLOTS = ["normal", "gold", "cheatmaster", "hacker"];

function variantLabel(variant: string | null): string {
  const key = variantKey(variant);
  if (key === "normal") return "BASE";
  if (key === "cheatmaster") return "CHEAT";
  return key.toUpperCase();
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
  /** Shows/hides this Sprite's findings on the map. The Radar icon only. */
  onToggleVisibility: (id: string) => void;
}

export function SpriteCatalogBrowser({
  onSelect,
  visibleSpriteIds,
  onToggleVisibility,
}: SpriteCatalogBrowserProps) {
  const [query, setQuery] = useState("");
  const [rarityPill, setRarityPill] = useState<string | null>(null); // null = no filter = show all (the default view)
  const { sprites, loading, error, reload } = useSpriteCatalog();
  const { getStatus, cycleStatus } = useCollectionStatus();

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

  const filtered = groups.filter((g) => {
    if (query && !g.family.toLowerCase().includes(query.toLowerCase())) return false;
    if (rarityPill && g.rarity?.toLowerCase() !== rarityPill.toLowerCase()) return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Pinned header, lifted one step off the panel (--muted, the same fill the
          sprite tiles use) so it reads as its own section. Full-bleed — the
          sidebar's own overflow-hidden clips it to the rounded corners. */}
      <div className="shrink-0 bg-muted">
        {/* px-3 matches the search and sprite cards, so everything in the
            sidebar shares one left edge. */}
        <div className="flex items-center px-3 pt-4 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-lockup.svg" alt="SpriteRadar" className="h-[18px] w-auto object-contain" />
        </div>

        <div className="px-3 pb-3">
          <MasterySummary />
        </div>
      </div>

      {/* Separates the pinned header from everything that scrolls. Full-bleed,
          unlike the in-card dividers, because it divides two regions of the
          sidebar rather than sections of one card. */}
      <div className="h-[0.5px] w-full shrink-0 bg-border" />

      {/* Only the logo and the mastery count stay pinned; the search scrolls
          away with the list below it. */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-3 pt-3 pb-2.5">
        {/* pb-1.5, not pb-3: each sprite card carries 6px of its own leading padding
            (py-0.5 here plus py-1 on its header), so 6px here lands the first
            sprite 12px below the field — matching the 12px above it. */}
        <div className="relative pb-1.5">
          <Search
            className="pointer-events-none absolute top-[18px] left-3 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sprites…"
            disabled={liveSprites.length === 0}
            className="bg-input pl-9 [&::-webkit-search-cancel-button]:appearance-none"
          />
        </div>
        {/* Also scrolls: the four hugging pills total ~293px, which no longer
            fits the 252px of content width at a 280px sidebar. */}
        {/* -mx-3 px-3: full-bleed to the panel edge so the row clips there rather
            than 12px short of it, while the first item still lines up with the
            sidebar gutter. */}
        {SHOW_RARITY_TABS && (
        <div className="no-scrollbar -mx-3 flex items-center gap-1 overflow-x-auto px-3 pb-1">
          {/* Only mounted while a filter is on, so with nothing selected the
              pills sit flush against the sidebar's left edge. */}
          <AnimatePresence initial={false}>
            {rarityPill && (
              <motion.div
                key="clear-rarity"
                // Animating width (not just opacity) is what slides the pills
                // across instead of snapping them.
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 36, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="shrink-0 overflow-hidden"
              >
                <Button
                  data-slot="clear-rarity"
                  variant="outline"
                  size="icon"
                  onClick={() => setRarityPill(null)}
                  aria-label={`Clear the ${rarityPill} filter`}
                  className="rounded-full text-muted-foreground hover:text-foreground"
                >
                  <X className="size-5" strokeWidth={1.5} />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          {RARITY_PILLS.map((label) => {
            const active = rarityPill === label;
            return (
              // Selected reads as the primary CTA (solid --primary fill); the rest
              // stay outline pills. Both come straight from the Button variants, so
              // no per-state color is hand-written here.
              <Button
                key={label}
                data-slot="rarity-filter"
                variant={active ? "default" : "outline"}
                onClick={() => setRarityPill(active ? null : label)}
                aria-pressed={active}
                className={cn("shrink-0", !active && "text-foreground")}
              >
                {label}
              </Button>
            );
          })}
        </div>
        )}

      {loading && (
        <div className="flex flex-1 items-center justify-center px-5">
          <span className="text-xs text-muted-foreground">Loading Sprite catalog…</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-1 flex-col gap-3 px-5 text-sm">
          <p className="text-foreground">Sprite catalog unavailable.</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{error}</p>
          <button
            type="button"
            data-slot="retry"
            onClick={reload}
            className="self-start rounded-full border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors outline-none select-none hover:border-ring hover:bg-input/30 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <motion.div variants={container} initial="hidden" animate="show">
          {filtered.map((group, index) => {
            const baseVariant = group.variants.find((v) => v.variant === null) ?? group.variants[0];
            const isShown = visibleSpriteIds.has(baseVariant.id);
            // Out of the variants this family actually has, not a flat four —
            // Mega Man ships only its base one, so it reads (0/1).
            const masteredInSet = group.variants.filter((v) => getStatus(v.id) === "mastered").length;

            return (
              <motion.div key={group.family} variants={item}>
                {/* The first card drops its own leading padding (its 2px plus the
                    header's 4px) so nothing sits between it and the search field. */}
                <div className={cn("rounded-lg py-0.5", index === 0 && "pt-0")}>
                  {/* Header: purely informational — not clickable/hoverable, per design. Only the Radar/Info icons act. */}
                  <div className={cn("flex items-center justify-between py-1", index === 0 && "pt-0")}>
                    <span className="flex min-w-0 items-center">
                      {group.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={group.icon}
                          alt=""
                          className="size-14 shrink-0 object-contain"
                          // Every icon is a 512x512 square, but the artwork inside fills
                          // 71%-92% of it depending on the Sprite — so equal boxes alone
                          // still render visibly unequal sprites. See scripts/measure-sprite-icons.py.
                          style={{ transform: `scale(${spriteIconScale(baseVariant.id)})` }}
                        />
                      ) : (
                        <span className="size-14 shrink-0 rounded-md bg-input/30" />
                      )}
                      <span className="flex min-w-0 flex-col items-start justify-center gap-0.5">
                        <span className="font-heading text-[18px] font-medium leading-[1.15] text-white">
                          {group.family}{" "}
                          {/* Same split as the mastery card: the count you've earned in
                              gold, the total muted so it reads as the denominator. */}
                          <span className="text-muted-foreground">
                            (<span className="text-sprite-gold">{masteredInSet}</span>/
                            {group.variants.length})
                          </span>
                        </span>
                        {/* Atlassian lozenge colors (see rarityAccent). Inline rather
                            than classes because the values come from their token set,
                            not Tailwind's palette. h-auto + leading-none so the pill
                            hugs the text: badgeVariants fixes h-5, and text-[10px]
                            sets only a font-size, dropping text-xs's line-height. */}
                        <Badge
                          data-slot="rarity-badge"
                          className="h-auto rounded-[4px] px-1 py-0.5 text-[10px] leading-none"
                          style={{
                            backgroundColor: rarityAccent(group.rarity).bg,
                            // The accent's own mid-tone border step, brighter than the
                            // ground and deeper than the text. badgeVariants already
                            // reserves a 1px transparent border, so coloring it changes
                            // nothing about the badge's size.
                            borderColor: rarityAccent(group.rarity).border,
                            color: rarityAccent(group.rarity).fg,
                          }}
                        >
                          {group.rarity ? group.rarity.charAt(0).toUpperCase() + group.rarity.slice(1) : "Unknown"}
                        </Badge>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        data-slot="toggle-findings"
                        onClick={() => onToggleVisibility(baseVariant.id)}
                        aria-pressed={isShown}
                        aria-label={
                          isShown
                            ? `Hide ${group.family} findings on the map`
                            : `Show ${group.family} findings on the map`
                        }
                        className={cn(
                          "rounded-sm transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
                          isShown
                            ? "text-sprite-radar-active"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Radar className="size-5" strokeWidth={1.5} />
                      </button>
                      <button
                        type="button"
                        data-slot="sprite-details"
                        onClick={() => onSelect(baseVariant.id)}
                        aria-label={`${group.family} details`}
                        className="rounded-sm text-muted-foreground transition-colors outline-none select-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                      >
                        <Info className="size-5" strokeWidth={1.5} />
                      </button>
                    </span>
                  </div>

                  <div className="h-[0.5px] w-full bg-border" />

                  {/* Horizontally scrollable: tiles keep a fixed size rather than
                      shrinking to fit, so families with four variants overflow and
                      scroll instead of squeezing down at narrow sidebar widths. */}
                  <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 py-2">
                    {VARIANT_SLOTS.map((slot) => {
                      const v = group.variants.find((x) => variantKey(x.variant) === slot);
                      // Not every family ships all four variants (Mega Man has only
                      // the base one). Render a placeholder so the columns line up
                      // and every tile is the same size.
                      if (!v) {
                        return (
                          <div
                            key={slot}
                            data-slot="variant-slot-empty"
                            className="flex w-[72px] shrink-0 flex-col items-center gap-1"
                          >
                            <span className="text-[10px] font-medium leading-5 text-muted-foreground/50">
                              {variantLabel(slot)}
                            </span>
                            <span
                              className="relative flex aspect-square w-full items-center justify-center rounded-[6px] border-[0.5px] border-dashed border-border bg-muted/40"
                              aria-label={`${group.family} has no ${variantLabel(slot).toLowerCase()} variant`}
                            >
                              <Ban className="size-5 text-muted-foreground/50" strokeWidth={1.5} />
                            </span>
                          </div>
                        );
                      }
                      const status = getStatus(v.id);
                      const label = variantLabel(v.variant);
                      const accent = variantColor(v.variant);
                      const isColored = status !== "default";
                      return (
                        <button
                          key={v.id}
                          type="button"
                          data-slot="variant-tile"
                          data-status={status}
                          onClick={() => cycleStatus(v.id)}
                          aria-label={`${v.name}: ${status}, click to change`}
                          className="group flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-[6px] outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        >
                          <span className="text-[10px] font-medium leading-5 text-muted-foreground">{label}</span>
                          <span
                            className={cn(
                              // outline, not border: outlines paint outside the box and
                              // take no layout space, so thickening one on hover can't
                              // nudge the tile's contents (the crown especially).
                              "relative aspect-square w-full overflow-clip rounded-[6px] outline -outline-offset-1 transition-all duration-150",
                              // No outline change on hover — hover is conveyed by the
                              // image coming to full color and scaling up. The gold
                              // outline is reserved for mastered, so it reads as the
                              // top of the ladder rather than just "collected".
                              status === "mastered"
                                ? "outline-2 outline-sprite-gold"
                                : "outline-[0.5px] outline-border",
                              // Uncollected tiles share the empty-slot fill (see the
                              // variant-slot-empty branch above), so "nothing here yet"
                              // and "not collected yet" read as the same weight.
                              !isColored && "bg-muted/40"
                            )}
                            style={isColored ? { background: accent ?? undefined } : undefined}
                          >
                            {v.icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={v.icon}
                                alt={v.name}
                                className={cn(
                                  "absolute inset-0 size-full object-cover transition-all duration-150 group-hover:scale-110",
                                  // Uncollected sprites read as black-and-white, and come
                                  // up to full color on hover.
                                  !isColored && "grayscale group-hover:grayscale-0"
                                )}
                              />
                            ) : (
                              <span className="absolute inset-0 bg-input/30" />
                            )}
                            {status === "mastered" && (
                              // Sits over the sprite's head rather than in a corner badge.
                              // The drop shadow keeps it legible on the lighter variant
                              // backgrounds (gold especially).
                              <Crown
                                aria-hidden
                                // Lucide's Crown ships two paths: the crown itself and a
                                // separate base bar ("M5 21h14"). Hide the bar rather than
                                // hand-authoring a trimmed copy of the icon.
                                className="absolute top-1 left-1/2 size-5 -translate-x-1/2 text-sprite-gold drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] [&>path:last-child]:hidden"
                                strokeWidth={1.5}
                                fill="currentColor"
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No sprites match.</p>
          )}
        </motion.div>
      )}
      </div>
    </div>
  );
}
