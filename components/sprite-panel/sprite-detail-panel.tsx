"use client";

import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { Finding } from "@/lib/findings";
import { rarityAccent } from "@/lib/rarity";
import { displayName } from "@/lib/sprite-name";
import { titleCase } from "@/lib/title-case";
import { SPRITE_ABILITIES } from "@/lib/sprite-abilities";
import { VARIANT_SLOTS, variantColor, variantKey, variantLabel } from "@/lib/variant-colors";
import { cn } from "@/lib/utils";
import { spriteIconScale } from "@/lib/sprite-icon-metrics";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * The Sprite detail panel.
 *
 * ONE type scale, shared with the catalog sidebar opposite so the two panels
 * read as one product rather than two screens:
 *
 *   name     font-heading 22px medium   — one step up from a catalog card's 18px
 *   value    13px medium                — anything the reader is here to find out
 *   body     13px regular, relaxed      — sentences
 *   label    10px semibold uppercase    — section headings and variant captions
 *   meta     11px                       — asides and empty states
 *
 * Nothing else. The previous version used seven sizes, three weights and two
 * different muted greys, and rendered the same role — a section's one value —
 * at 18px semibold in one place, 14px muted in another and 11px chips in a
 * third, which is what made it read as unfinished.
 *
 * Spacing is just as deliberate: a 12px gutter, matching the catalog sidebar's
 * px-3 exactly so content in both panels starts on the same line, and every
 * section built by the same Section component below rather than by hand. The
 * old file set six different top margins (mt-1, 1.5, 2, 2.5, 3) between a
 * heading and its content; here there is one, because there is one component.
 */

export interface SpriteDetailPanelProps {
  spriteId: string;
  findings: Finding[];
  onBack: () => void;
}

const AVAILABILITY_LABEL: Record<string, string> = {
  live: "Live this season",
  coming_soon: "Coming soon",
  vaulted: "Vaulted / rotated out",
  unreleased: "Not yet released",
  unknown: "Availability unknown",
};

/** The one section heading treatment. Same size and weight as the catalog's variant captions. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{children}</h3>
  );
}

/**
 * A section: heading, then content, separated from its neighbour by a rule.
 *
 * Every section on the panel goes through here, so none of them can drift
 * apart in padding or heading style — the drift was the actual defect.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border/60 px-3 py-4 first:border-t-0">
      <SectionLabel>{title}</SectionLabel>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * A label/value line. Label left, value hard right on tabular figures so
 * numbers down a column line up.
 *
 * Loot sources and summon costs were previously two unrelated shapes — pills
 * with right-aligned text, and wrapping outlined chips. They are the same kind
 * of information, so they are now the same row.
 */
function Row({
  label,
  labelColor,
  value,
  muted,
}: {
  label: string;
  labelColor?: string;
  value: string;
  /** For a value the catalog doesn't have, so "unknown" never looks like data. */
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span
        className={cn("text-xs font-medium", !labelColor && "text-foreground")}
        style={labelColor ? { color: labelColor } : undefined}
      >
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 text-xs tabular-nums",
          muted ? "text-muted-foreground" : "font-medium text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** One empty-state treatment, so "nothing here" reads the same everywhere. */
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

export function SpriteDetailPanel({ spriteId, findings, onBack }: SpriteDetailPanelProps) {
  const { getSprite, sprites } = useSpriteCatalog();
  const sprite = getSprite(spriteId);

  if (!sprite) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-3 text-center">
        <p className="text-sm text-muted-foreground">Sprite not found in the catalog.</p>
        <Button variant="outline" size="sm" onClick={onBack}>
          Close
        </Button>
      </div>
    );
  }

  const accent = rarityAccent(sprite.rarity);
  const sightingCount = findings.filter((f) => f.spriteId === spriteId).length;
  const dropRateEntries = sprite.dropRates ? Object.entries(sprite.dropRates) : [];
  // Authored copy first (see lib/sprite-abilities.ts), then the catalog's.
  const ability = SPRITE_ABILITIES[sprite.family] ?? sprite.ability ?? sprite.description;
  // Every live variant of this family, in the same slot order as the catalog
  // tiles, for the per-variant summon costs.
  const familyVariants = VARIANT_SLOTS.map((slot) =>
    sprites.find((s) => s.currentlyLive && s.family === sprite.family && variantKey(s.variant) === slot)
  ).filter((s): s is NonNullable<typeof s> => !!s);
  const noCostsPublished = familyVariants.every((v) => v.summonCostSpriteDust == null);

  return (
    <motion.div
      key={spriteId}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="no-scrollbar flex h-full flex-col overflow-y-auto"
    >
      {/* The same grey as the catalog sidebar's header strip (logo + mastery),
          so the two panels' headers read as one system. Full-bleed — the
          panel's own overflow-hidden clips it to its corners. */}
      <div data-slot="detail-header" className="relative shrink-0 bg-muted p-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Close"
          className="absolute top-2 right-2 z-10 rounded-full text-muted-foreground hover:bg-card"
        >
          <X strokeWidth={1.5} />
        </Button>

        {/* No frame, fill or glow: the art sits straight on the header grey.
            A square that tracks the panel's width rather than a fixed 240px,
            since the sidebar is draggable — at 418px the old fixed size left a
            band of empty grey either side of it. Scaled per sprite like the
            catalog headings, because each icon's art fills a different share
            of its 512px canvas. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mx-auto flex aspect-square w-full items-center justify-center"
        >
          {sprite.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-slot="detail-image"
              src={sprite.icon}
              alt={displayName(sprite.name)}
              className="size-full object-contain"
              style={{ transform: `scale(${spriteIconScale(sprite.id)})` }}
            />
          ) : (
            <span className="font-heading text-xl text-muted-foreground">?</span>
          )}
        </motion.div>
      </div>

      <div className="h-[0.5px] w-full shrink-0 bg-border" />

      {/* Identity sits outside Section: it is the panel's subject, not one of
          its facts, so it carries the name at hero size and no heading. */}
      <div className="px-3 pt-4 pb-4">
        {/* Name and rarity share one row, the badge pinned to the right edge.
            items-start rather than centred so the badge stays on the FIRST
            line if a long name wraps, instead of drifting to the middle of the
            block. min-w-0 lets the name wrap rather than push the badge past
            the gutter.

            mt-px is an optical correction, measured not guessed. Centring the
            badge in the heading's LINE BOX (23px, so a centre at 11.5) sits it
            low, because the line box includes descender space the capitals
            never use. The name's optical centre is the middle of its cap-height
            band: cap height 12.86px on a baseline 17.5px down, so a centre at
            11.07px. A 20px badge therefore wants its top at 1.07px — 1px, not
            the 2px that line-box centring gives.

            Baseline alignment is not the answer here either: the badge's own
            vertical padding puts its text baseline 14.5px down its 20px box,
            which would drop its top to 3px — further out than where it
            started. */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 font-heading text-xl font-medium leading-[1.15] text-foreground">
            {displayName(sprite.name)}
          </h2>

          {/* Identical to the catalog cards': the Badge at its own size, with
              only the rarity fill overridden. */}
          <Badge
            data-slot="rarity-badge"
            className="mt-px shrink-0 text-white"
            style={{ backgroundColor: accent.solid, borderColor: accent.solid }}
          >
            {sprite.rarity ? sprite.rarity.charAt(0).toUpperCase() + sprite.rarity.slice(1) : "Unknown"}
          </Badge>
        </div>

        {/* Its own line below, not beside the badge: it only appears for a
            Sprite this season doesn't offer, and that is a sentence about
            availability rather than a second label on the name row. */}
        {!sprite.currentlyLive && (
          <p className="mt-2 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {AVAILABILITY_LABEL[sprite.availability] ?? "Unavailable"}
          </p>
        )}

        {ability && (
          <p data-slot="detail-ability" className="mt-3 text-sm leading-relaxed text-foreground">
            {ability}
          </p>
        )}
      </div>

      {/* Sightings and likely areas were two sections asking the same question
          from opposite ends, one of them a heading over the words "Coming
          soon". Folded into one, so a placeholder costs a row rather than a
          whole section. */}
      <Section title="Locations">
        <Row
          label={sightingCount === 1 ? "Sighting logged" : "Sightings logged"}
          value={String(sightingCount)}
          muted={sightingCount === 0}
        />
        <Row label="Most likely areas" value="Coming soon" muted />
      </Section>

      <Section title="Loot sources">
        {dropRateEntries.length > 0 ? (
          dropRateEntries.map(([source, pct]) => (
            <Row
              key={source}
              // The catalog stores these shouting ("SPRITE CHEST"), which is
              // how the source published them, not how they should read in a
              // sentence-cased panel. Same treatment the Add finding form
              // gives location names.
              label={titleCase(source)}
              value={pct != null ? `${pct}%` : "Not published"}
              muted={pct == null}
            />
          ))
        ) : (
          <Empty>Not documented</Empty>
        )}
        {sprite.acquisitionHint && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{sprite.acquisitionHint}</p>
        )}
      </Section>

      <Section title="Summon cost — Sprite Dust">
        {/* One row per variant in the catalog's slot order, its label in that
            variant's own colour so the column matches the tiles opposite. Base
            has no hue of its own, so it takes the default. A cost the catalog
            doesn't have shows as unpublished; nothing is estimated. */}
        <div data-slot="summon-costs">
          {familyVariants.map((v) => (
            <Row
              key={v.id}
              label={variantLabel(v.variant)}
              labelColor={variantKey(v.variant) === "normal" ? undefined : (variantColor(v.variant) ?? undefined)}
              value={
                v.summonCostSpriteDust != null ? v.summonCostSpriteDust.toLocaleString() : "Not published"
              }
              muted={v.summonCostSpriteDust == null}
            />
          ))}
        </div>
        {noCostsPublished && <Empty>Epic hasn&rsquo;t published costs for this Sprite yet.</Empty>}
      </Section>

      {sprite.boons.length > 0 && (
        <Section title="Boons">
          <ul className="space-y-1.5">
            {sprite.boons.map((boon) => (
              <li key={boon.id} className="text-sm leading-relaxed text-foreground">
                {boon.description}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </motion.div>
  );
}
