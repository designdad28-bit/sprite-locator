"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radar, Info, Search, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { useCollectionStatus } from "@/hooks/use-collection-status";
import type { NormalizedSprite } from "@/lib/sprite-catalog/types";
import { rarityAccent } from "@/lib/rarity";
import { displayName } from "@/lib/sprite-name";
import { VARIANT_SLOTS, variantKey, variantLabel, variantLabelColor } from "@/lib/variant-colors";
import { Button } from "@/components/ui/button";
import { RarityGem } from "@/components/rarity-gem";
import { Input } from "@/components/ui/input";
import { BorderBeam } from "border-beam";
import { SpriteTileArt } from "@/components/sprite-catalog/sprite-tile";
import { MasterySummary } from "./mastery-summary";
import { cn } from "@/lib/utils";

const RARITY_PILLS = ["Rare", "Epic", "Legendary", "Mythic"];

/** Flip to true to bring the rarity filter row back. */
const SHOW_RARITY_TABS = false;
const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "mythic", "special"];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A light that runs around a tile's edge while it's hovered. The full
 * spectrum rather than each variant's own hue: a green beam on the green
 * cheat tile (or gold on gold) vanished into the fill it was meant to trace. Driven by `active` rather than always-on and
 * hidden, so only the tile under the pointer animates — 101 beams running at
 * once would cost real frames. Off entirely under reduced motion, where the
 * tile's outline hover state still marks it.
 */
function HoverBeam({
  children,
  whileFocused = false,
  className = "w-full",
  overflowVisible = false,
}: {
  children: React.ReactNode;
  /** Also light while something inside has focus — for fields you type in. */
  whileFocused?: boolean;
  className?: string;
  /** Let a focus ring show outside the beam's box (the library clips it). */
  overflowVisible?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const on = !prefersReducedMotion() && (hovered || (whileFocused && focused));
  return (
    <BorderBeam
      size="md"
      colorVariant="colorful"
      theme="dark"
      strength={1}
      // The beam is a 1px ring plus glow tuned for card-sized surfaces; on an
      // 80px tile at default settings it read as a faint corner smudge. More
      // light and a wider halo make the travelling highlight legible here.
      brightness={2.2}
      glowSize={1.6}
      // The library multiplies its fixed layer opacities (stroke 0.26, inner
      // 0.42, bloom 0.24) by these hooks; tripling them makes the travelling
      // edge clearly visible against the saturated tile fills.
      style={
        {
          "--beam-stroke-opacity": 3,
          "--beam-inner-opacity": 1.8,
          "--beam-bloom-opacity": 3,
          ...(overflowVisible && { overflow: "visible" }),
        } as CSSProperties
      }
      active={on}
      className={className}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      // React's focus events bubble, so these catch the field inside.
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {children}
    </BorderBeam>
  );
}

/**
 * One Sprite family in the sidebar grid, drawn with its base art.
 *
 * The tile itself is the map toggle: click to pin the sightings of every
 * variant in the family, again to clear them. Shown tiles carry a Radar-blue ring and badge — the
 * same colour the Radar used, so "on the map" means one thing everywhere.
 * On a phone there is no map, so the tile opens the profile instead.
 *
 * The profile (with the variant row where collected / mastered is set) opens
 * from the Info button in the corner: revealed on hover or keyboard focus on
 * desktop, always visible on touch screens, which have no hover.
 */
function GridTile({
  sprite,
  status,
  variantStatuses,
  shown,
  onToggleShown,
  onOpen,
}: {
  sprite: NormalizedSprite;
  status: string;
  /** Per variant slot, in slot order; null where the family has no such variant. */
  variantStatuses: (string | null)[];
  shown: boolean;
  onToggleShown: () => void;
  onOpen: () => void;
}) {
  const name = sprite.family;
  return (
    <div className="group/tile relative flex min-w-0 flex-col gap-1.5">
      <button
        type="button"
        data-slot="grid-tile"
        aria-pressed={shown}
        aria-label={`${name}: ${shown ? "hide from" : "show on"} the map`}
        onClick={() => (window.matchMedia("(max-width: 767px)").matches ? onOpen() : onToggleShown())}
        className="group flex flex-col gap-1.5 rounded-sm text-left outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.96] transition-transform motion-reduce:transition-none"
      >
        <span
          className={cn(
            "block rounded-[6px] transition-shadow duration-200",
            shown && "ring-2 ring-sprite-radar-active ring-offset-2 ring-offset-card"
          )}
        >
          <HoverBeam>
            <SpriteTileArt sprite={sprite} status={status} />
          </HoverBeam>
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          {/* Your record across the family at a glance, one dot per variant
              in slot order: gold mastered, light collected, dim not yet. Set
              in the profile, not here. */}
          <span className="flex items-center gap-1" aria-hidden>
            {variantStatuses.map((st, i) =>
              st === null ? null : (
                <span
                  key={i}
                  className={cn(
                    "size-1.5 rounded-full",
                    st === "mastered" ? "bg-sprite-gold" : st === "default" ? "bg-input" : "bg-foreground/70"
                  )}
                />
              )
            )}
          </span>
        </span>
      </button>

      {shown && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-1.5 left-1.5 z-10 flex size-6 items-center justify-center rounded-full bg-sprite-radar-active text-white shadow-md"
        >
          <Radar className="size-3.5" strokeWidth={2.14} />
        </span>
      )}

      <button
        type="button"
        data-slot="sprite-details"
        aria-label={`${name} profile`}
        onClick={onOpen}
        className="absolute top-1 right-1 z-10 flex size-7 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur-sm transition-opacity duration-150 outline-none group-hover/tile:opacity-100 hover:bg-black/65 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/40 [@media(hover:none)]:opacity-100 after:absolute after:-inset-2 after:content-['']"
      >
        <Info className="size-3.5" strokeWidth={2.14} />
      </button>
    </div>
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
  const { getStatus } = useCollectionStatus();

  // Only Sprites the current season's live config actually makes obtainable
  // — vaulted/rotated-out/unreleased entries never show up in the browsable
  // catalog at all (they're still in sprites.json for reference, just not here).
  const liveSprites = useMemo(() => sprites.filter((s) => s.currentlyLive), [sprites]);
  const shownCount = liveSprites.filter((s) => visibleSpriteIds.has(s.id)).length;
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
        {/* px-4 matches the search and sprite cards, so everything in the
            sidebar shares one left edge. */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 max-md:pt-5 max-md:pb-4">
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
            // Scaled up on a phone with the rest of the layout. The optical
            // pullback scales with it: -2px at 18px tall, -3px at 24px.
            className="-ml-[2px] h-[18px] w-auto object-contain max-md:-ml-[3px] max-md:h-6"
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

        <div className="px-4 pb-4">
          <MasterySummary />
        </div>
      </div>

      {/* Separates the pinned header from everything that scrolls. Full-bleed,
          unlike the in-card dividers, because it divides two regions of the
          sidebar rather than sections of one card. */}
      <div className="h-[0.5px] w-full shrink-0 bg-border" />

      {/* Only the logo and the mastery count stay pinned; the search scrolls
          away with the list below it. */}
      <div className="no-scrollbar flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* pb-1.5, not pb-3: each sprite card carries 6px of its own leading padding
            (py-0.5 here plus py-1 on its header), so 6px here lands the first
            sprite 12px below the field — matching the 12px above it. */}
        <div className="relative pb-1.5">
          {/* Same beam as the tiles, and also lit while the field has focus.
              overflowVisible: the beam's layers clip themselves to the pill,
              and the field's focus ring has to show outside it. */}
          <HoverBeam whileFocused overflowVisible className="w-full rounded-3xl">
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
            className="border-border bg-card pl-11 [&::-webkit-search-cancel-button]:appearance-none"
          />
          </HoverBeam>
          {/* After the beam in the DOM so it paints above the beam's glow. */}
          <Search
            className="pointer-events-none absolute top-5 left-4 z-10 size-4 max-md:top-[22px] -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.875}
          />
        </div>

        {/* Only once you've picked: how many are on the map, and the way back
            to all of them. Hidden on a phone, where there is no map. */}
        {liveSprites.length > 0 && shownCount < liveSprites.length && (
          <div className="mt-2 flex items-center justify-between gap-3 rounded-full bg-sprite-radar-active/12 py-1 pr-1 pl-4 max-md:hidden">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <Radar className="size-4 text-sprite-radar-active" strokeWidth={1.875} />
              {shownCount === 0 ? "Nothing on the map" : `${shownCount} on the map`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSetVisibility(liveSprites.map((o) => o.id), true)}
              className="rounded-full text-sprite-radar-active hover:text-foreground"
            >
              Show all
            </Button>
          </div>
        )}
        {/* Also scrolls: the four hugging pills total ~293px, which no longer
            fits the 252px of content width at a 280px sidebar. */}
        {/* -mx-4 px-4: full-bleed to the panel edge so the row clips there rather
            than 12px short of it, while the first item still lines up with the
            sidebar gutter. */}
        {SHOW_RARITY_TABS && (
        <div className="no-scrollbar -mx-4 flex items-center gap-1 overflow-x-auto px-4 pb-1">
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
        // The real layout, drawn before the data arrives: a section header,
        // then cards in the catalog's exact proportions, so nothing jumps
        // when it lands. The status text stays for screen readers.
        <div className="flex-1 overflow-hidden px-4 pt-4" aria-busy="true">
          <span className="sr-only" role="status">Loading Sprite catalog…</span>
          <div className="skeleton -mx-4 mt-4 mb-2 h-11" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="py-2">
              <div className="flex items-center gap-3 py-1">
                <div className="skeleton size-14 rounded-2xl md:size-16" />
                <div className="flex flex-col gap-2">
                  <div className="skeleton h-5 w-28 rounded-md" />
                  <div className="skeleton h-2 w-16 rounded-full" />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {[0, 1, 2, 3, 4].map((j) => (
                  <div key={j} className="skeleton aspect-square w-20 shrink-0 rounded-sm max-md:w-auto max-md:flex-1" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="flex flex-1 flex-col gap-3 px-4 pt-4 text-base">
          <p className="font-heading text-xl font-medium text-foreground">Sprite catalog unavailable</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" data-slot="retry" onClick={reload} className="self-start">
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && (
        <motion.div variants={container} initial="hidden" animate="show">
          {(() => {
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

            // The map starts with every Sprite on it. While that's so, no tile
            // is marked as "shown" (101 rings would say nothing) and the first
            // click picks rather than removes.
            const allShown = shownCount === liveSprites.length;

            return sections.map((section) => {
              const accent = rarityAccent(section.rarity);
              const label = section.rarity
                ? section.rarity.charAt(0).toUpperCase() + section.rarity.slice(1)
                : "Unknown";
              return (
                <section key={section.rarity ?? "unknown"} id={sectionId(section.rarity)} aria-label={`${label} Sprites`}>
                  {/* An iOS-style sticky section header — flat, solid --card,
                      one hairline border along the bottom. No blur, no
                      gradient wash: xAI's surfaces carry elevation with a
                      hairline, never a glow (see DESIGN.md's Don'ts).

                      -mx-4 px-4 runs it edge to edge while the label keeps
                      the list's 16px line. top-[-16px] cancels the pane's
                      own pt-4 so it pins flush to the pane's top edge.

                      The label stays foreground; the rarity's colour lives
                      only on the scrubber's gems now — colour marks identity
                      there, type carries the name here. */}
                  <div
                    data-slot="rarity-header"
                    // Flat and solid, no frosted glass and no colour wash: xAI's
                    // surfaces carry elevation with a hairline border, never a
                    // blur or a gradient glow (see DESIGN.md). The rarity's
                    // colour still marks the section, just on the gem alone.
                    className="sticky top-[-16px] z-10 -mx-4 mt-4 mb-2 flex h-11 items-center gap-2.5 border-b border-border bg-card px-4"
                  >
                    <span className="text-sm font-semibold tracking-[0.02em] text-foreground">{label}</span>
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      {section.groups.length}
                    </span>

                    {/* The scrubber. Every section's header carries a stop
                        for every rarity, with its own lit — and since only
                        the header of the section on screen is pinned, the
                        lit gem always marks where you are. Tapping another
                        glides the list to that section. One row: where you
                        are, where else there is, and the way there. */}
                    <nav aria-label="Jump to rarity" className="-mr-2 ml-auto flex items-center">
                      {sections.map((other) => {
                        const otherLabel = other.rarity
                          ? other.rarity.charAt(0).toUpperCase() + other.rarity.slice(1)
                          : "Unknown";
                        const here = other.rarity === section.rarity;
                        return (
                          <button
                            key={other.rarity ?? "unknown"}
                            type="button"
                            aria-label={`Jump to ${otherLabel}`}
                            aria-current={here ? "location" : undefined}
                            onClick={() =>
                              document
                                .getElementById(sectionId(other.rarity))
                                ?.scrollIntoView({
                                  behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                                    ? "auto"
                                    : "smooth",
                                  block: "start",
                                })
                            }
                            className="group/gem flex size-8 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30 max-md:size-11"
                          >
                            <span className="flex transition-transform duration-200 group-hover/gem:scale-125">
                              <RarityGem color={rarityAccent(other.rarity).solid} dim={!here} />
                            </span>
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                  {/* One tile per Sprite, its base art. The tile is the map
                      activator for the whole family — all five variants'
                      sightings together; the variants themselves live in the
                      profile. auto-fill at 84px: three columns at the default
                      sidebar width, four on a phone and as it's dragged wider. */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(84px,1fr))] gap-x-2 gap-y-3 pb-2">
                    {section.groups.map((group) => {
                      const base = group.variants.find((v) => v.variant === null) ?? group.variants[0];
                      const ids = group.variants.map((v) => v.id);
                      const shown = !allShown && ids.some((id) => visibleSpriteIds.has(id));
                      return (
                        <GridTile
                          key={group.family}
                          sprite={base}
                          status={getStatus(base.id)}
                          variantStatuses={VARIANT_SLOTS.map((slot) => {
                            const v = group.variants.find((o) => variantKey(o.variant) === slot);
                            return v ? getStatus(v.id) : null;
                          })}
                          shown={shown}
                          onToggleShown={() =>
                            allShown
                              ? // Everything is on the map by default, so the
                                // first pick solos: clear every other family.
                                onSetVisibility(
                                  liveSprites.filter((o) => !ids.includes(o.id)).map((o) => o.id),
                                  false
                                )
                              : onSetVisibility(ids, !shown)
                          }
                          onOpen={() => onSelect(base.id)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            });
          })()}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
              <Search className="size-8 text-muted-foreground/60" strokeWidth={1} />
              <p className="font-heading text-xl font-medium text-foreground">No Sprites match</p>
              <p className="text-sm text-muted-foreground">Try a family name, like &ldquo;Jonesy&rdquo;.</p>
            </div>
          )}
        </motion.div>
      )}
      </div>
    </div>
  );
}
