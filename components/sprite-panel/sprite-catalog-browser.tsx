"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Info, Search, Ban, Crown, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { useCollectionStatus } from "@/hooks/use-collection-status";
import type { NormalizedSprite } from "@/lib/sprite-catalog/types";
import { rarityAccent } from "@/lib/rarity";
import { displayName } from "@/lib/sprite-name";
import { VARIANT_SLOTS, variantGradient, variantKey, variantLabel, variantLabelColor } from "@/lib/variant-colors";
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
          className="text-muted-foreground"
        >
          <PanelLeftOpen className="size-5" strokeWidth={1.5} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Pinned header, lifted one step off the panel (--muted, the same fill the
          sprite tiles use) so it reads as its own section. Full-bleed — the
          sidebar's own overflow-hidden clips it to the rounded corners. */}
      <div className="shrink-0 bg-muted">
        {/* px-3 matches the search and sprite cards, so everything in the
            sidebar shares one left edge. */}
        <div className="flex items-center gap-2 px-3 pt-4 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Pulled 2px left of the 12px everything else sits on, so the mark
              looks level rather than measuring level. Two reasons it read as
              inset: the lockup carries 3px of its own transparent padding
              (1.4px at this size), and its mark is a circle — a round shape
              touches the alignment line at a single point while its mass sits
              back from it, so it needs to overhang a flat edge slightly to
              appear flush. The crown, search field and tiles below are all
              flat-edged and stay at 12. */}
          <img
            src="/brand/logo-lockup.svg"
            alt="SpriteRadar"
            className="-ml-[2px] h-[18px] w-auto object-contain"
          />
          {/* ml-auto pins it to the row's right edge, opposite the logo. */}
          <Button
            variant="ghost"
            size="icon-sm"
            data-slot="sidebar-toggle"
            onClick={onToggleCollapsed}
            aria-label="Collapse sidebar"
            aria-expanded={true}
            // -mr-1.5 pulls the button's own padding back so the GLYPH still
            // lands on the 12px gutter, rather than the button box landing on
            // it and the icon sitting inset from the edge.
            //
            // Hidden on a phone: collapsing the catalog there would reveal
            // nothing behind it, because the catalog is the whole screen.
            className="-mr-1.5 ml-auto text-muted-foreground max-md:hidden"
          >
            <PanelLeftClose className="size-5" strokeWidth={1.5} />
          </Button>
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
            // bg-card: the same fill as the mastery bar's track in the header
            // above — the darkest of the panel's blues, where the default
            // --input is white at 15% alpha and composites lighter than
            // anything else in the sidebar.
            //
            // The border is not optional with this fill. Input defaults to
            // `border-transparent` and only colours it on focus, which works
            // when the field is lighter than its surroundings; bg-card is
            // exactly the sidebar's own background, so with no border the
            // field would have no edge at all at rest.
            className="border-border bg-card pl-9 [&::-webkit-search-cancel-button]:appearance-none"
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
          <Button variant="outline" size="sm" data-slot="retry" onClick={reload} className="self-start">
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && (
        <motion.div variants={container} initial="hidden" animate="show">
          {filtered.map((group, index) => {
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
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-heading text-lg font-medium leading-[1.15] text-foreground">
                            {group.family}
                          </span>
                          {/* Sized down from the Radar's 20px and moved off the
                              right edge to sit with the name it describes —
                              it opens that Sprite's detail panel, so it reads
                              as part of the title rather than as a second map
                              control beside the Radar. */}
                          {/* icon-xs, not a bare icon: at 14px the glyph alone
                              was a 14px target, under the 24px minimum for a
                              control. The box is 24px and the glyph stays
                              14px, so it looks the same and can be hit. */}
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            data-slot="sprite-details"
                            onClick={() => onSelect(baseVariant.id)}
                            aria-label={`${group.family} details`}
                            className="text-muted-foreground"
                          >
                            <Info className="size-3.5" strokeWidth={1.5} />
                          </Button>
                        </span>
                        <span className="flex items-center gap-3">
                        {/* The Badge component at its own size and shape — the
                            h-auto / rounded-[4px] / px-1 / text-2xs overrides
                            this used to carry had left almost nothing of it.
                            Only the fill is ours: Atlassian lozenge colours
                            (see rarityAccent), inline because they come from
                            their token set rather than Tailwind's palette. */}
                        <Badge
                          data-slot="rarity-badge"
                          className="text-white"
                          style={{
                            // Solid bright fill with white text. The border takes the
                            // fill color so no outline shows; badgeVariants reserves a
                            // 1px border either way, so the badge's size is unchanged.
                            backgroundColor: rarityAccent(group.rarity).solid,
                            borderColor: rarityAccent(group.rarity).solid,
                          }}
                        >
                          {group.rarity ? group.rarity.charAt(0).toUpperCase() + group.rarity.slice(1) : "Unknown"}
                        </Badge>
                        {/* One dot per variant SLOT, in VARIANT_SLOTS order, so a
                            dot's position tells you which variant it stands for:
                            the second dot is always gold, the fifth always bounty
                            hunter. That is why all five are always drawn, even for
                            a family that doesn't have all five — dropping the
                            missing ones would shift every dot after them onto the
                            wrong variant. Slots the family has no variant for are
                            dimmed instead, the same thing the dashed tile and its
                            Ban icon say further down the card.
                            h-4 caps the box at the badge's 16px (10px text + 2px
                            padding + 1px border, each side) so the row stays one
                            badge tall. */}
                        <span
                          className="flex h-4 items-center gap-1"
                          role="img"
                          aria-label={`${masteredInSet} of ${group.variants.length} mastered`}
                        >
                          {VARIANT_SLOTS.map((slot) => {
                            const v = group.variants.find((x) => variantKey(x.variant) === slot);
                            const mastered = v ? getStatus(v.id) === "mastered" : false;
                            return (
                              <span
                                key={slot}
                                data-slot="mastery-dot"
                                data-state={!v ? "absent" : mastered ? "mastered" : "unmastered"}
                                className={cn(
                                  "size-2 rounded-full",
                                  mastered
                                    ? "bg-sprite-gold"
                                    : v
                                      ? "bg-muted-foreground/40"
                                      : "bg-muted-foreground/15"
                                )}
                              />
                            );
                          })}
                        </span>
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {/* Same reasoning as Info above: a 20px glyph was a 20px
                          target. -mr-1.5 keeps the glyph on the 12px gutter
                          now that the button carries padding of its own. */}
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
                        className={cn("-mr-1.5", isShown ? "text-sprite-radar-active" : "text-muted-foreground")}
                      >
                        <Radar className="size-5" strokeWidth={1.5} />
                      </Button>
                    </span>
                  </div>

                  <div className="h-[0.5px] w-full bg-border" />

                  {/* Horizontally scrollable: tiles keep a fixed size rather than
                      shrinking to fit, so families with four variants overflow and
                      scroll instead of squeezing down at narrow sidebar widths. */}
                  <div className="no-scrollbar -mx-3 flex items-center gap-2 overflow-x-auto px-3 py-2">
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
                            className="flex w-[72px] shrink-0 flex-col items-center gap-1"
                          >
                            {/* Colour-coded like a real tile's caption, so the
                                five columns stay identifiable straight down
                                the sidebar. Not dimmed: every variant colour
                                falls below the 4.5:1 small-text floor once
                                faded (indigo reaches 2.7:1 at 70%), and the
                                dashed border and Ban icon below already say
                                the variant doesn't exist. */}
                            <span
                              className="text-2xs font-medium leading-5"
                              style={{ color: variantLabelColor(slot === "normal" ? null : slot) ?? undefined }}
                            >
                              {variantLabel(slot)}
                            </span>
                            <span
                              className="relative flex aspect-square w-full items-center justify-center rounded-sm border-[0.5px] border-dashed border-border bg-muted/40"
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
                      const accent = variantGradient(v.variant);
                      const isColored = status !== "default";
                      return (
                        <button
                          key={v.id}
                          type="button"
                          data-slot="variant-tile"
                          data-status={status}
                          onClick={() => cycleStatus(v.id)}
                          aria-label={`${displayName(v.name)}: ${status}, click to change`}
                          className="group flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-sm outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/30"
                        >
                          {/* Caption carries its variant's colour whether or
                              not the sprite is collected, so the row reads as
                              a legend of the five variants rather than only
                              labelling what you happen to own. Placeholder
                              slots above stay dimmed — a family with no such
                              variant has no fill to match. */}
                          <span
                            className="text-2xs font-medium leading-5"
                            style={{ color: variantLabelColor(v.variant) ?? undefined }}
                          >
                            {label}
                          </span>
                          <span
                            className={cn(
                              // outline, not border: outlines paint outside the box and
                              // take no layout space, so thickening one on hover can't
                              // nudge the tile's contents (the crown especially).
                              "relative aspect-square w-full overflow-clip rounded-sm outline -outline-offset-1 transition-all duration-150",
                              // No outline change on hover — hover is conveyed by the
                              // image coming to full color and scaling up. The gold
                              // outline is reserved for mastered, so it reads as the
                              // top of the ladder rather than just "collected".
                              status === "mastered"
                                ? "outline-2 outline-sprite-gold"
                                : "outline-[0.5px] outline-border",
                              // Collected tiles cast a shadow so they sit above
                              // the panel rather than flush in it — the fill
                              // alone reads as a swatch painted on the surface.
                              // Two layers: a tight one for the contact edge
                              // and a wider, softer one for the cast. Both are
                              // black rather than a tinted shadow, because the
                              // panel is already dark and a coloured shadow
                              // muddies into it instead of darkening it.
                              isColored &&
                                "shadow-[0_1px_2px_rgba(0,0,0,0.55),0_6px_14px_-4px_rgba(0,0,0,0.65)]",
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
                                alt={displayName(v.name)}
                                className={cn(
                                  "absolute inset-0 size-full object-cover transition-all duration-150 group-hover:scale-110",
                                  // Uncollected sprites read as black-and-white, and come
                                  // up to full color on hover.
                                  !isColored && "sprite-unowned group-hover:[filter:none]"
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
