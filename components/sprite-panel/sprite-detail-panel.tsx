"use client";

import { motion } from "framer-motion";
import { X } from "@/components/icons";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { Finding } from "@/lib/findings";
import { rarityAccent } from "@/lib/rarity";
import { displayName } from "@/lib/sprite-name";
import { titleCase } from "@/lib/title-case";
import { SPRITE_ABILITIES } from "@/lib/sprite-abilities";
import { VARIANT_SLOTS, variantKey, variantLabel, variantLabelColor } from "@/lib/variant-colors";
import { cn } from "@/lib/utils";
import { spriteIconTransform } from "@/lib/sprite-icon-metrics";
import { Button } from "@/components/ui/button";

/**
 * The Sprite detail panel, built from the same parts as the catalog opposite:
 * lifted card panels (--muted, rounded, a half-strength ink drop) instead of
 * hairline dividers, Anton caps for every heading and label, Inter for
 * sentences and values, and the rarity as the same sticker as the rarity bands.
 *
 *   name       Anton 30px caps
 *   headings   Anton 16px caps, CTA yellow
 *   labels     Inter 14px medium, or Anton caps in a variant's colour
 *   values     Inter 14px, tabular
 *   body       Inter 16px, relaxed
 *
 * Same 16px gutter as the catalog, so both panels' content starts on one line.
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

/** The one section heading treatment: Anton caps in the CTA yellow. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="display-caps text-base text-pop-yellow">{children}</h3>;
}

/** The lifted card panel every block sits on, the same as a catalog card. */
const PANEL = "rounded-2xl bg-muted shadow-[0_3px_0_rgb(13_30_74/0.5)]";

/**
 * A section: a card panel holding a heading and its content. Every section
 * goes through here, so none can drift apart in padding or heading style.
 */
function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className={cn(PANEL, "px-4 pt-4 pb-3")}>
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel>{title}</SectionLabel>
        {/* A unit or qualifier for the whole section, set quieter than the title. */}
        {aside && <span className="display-caps text-sm text-muted-foreground">{aside}</span>}
      </div>
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
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span
        className={cn("text-sm font-medium", !labelColor && "text-foreground")}
        style={labelColor ? { color: labelColor } : undefined}
      >
        {label}
      </span>
      <span
        className={cn(
          "shrink-0 text-sm tabular-nums",
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
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function SpriteDetailPanel({ spriteId, findings, onBack }: SpriteDetailPanelProps) {
  const { getSprite, sprites } = useSpriteCatalog();
  const sprite = getSprite(spriteId);

  if (!sprite) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-base text-muted-foreground">Sprite not found in the catalog.</p>
        <Button variant="ghost" size="sm" onClick={onBack} className="material rounded-full px-4 text-pop-ink hover:text-pop-ink">
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
      className="no-scrollbar flex h-full flex-col gap-3 overflow-y-auto p-4"
    >
      {/* The hero: full-bleed across the top of the panel (the -m cancels the
          scroll area's 16px padding), square-cornered, lit by a pool of its
          rarity's colour, brightest where the Sprite stands. Closed along the
          bottom by the same 3px ink line as the phone's bottom CTA bar. */}
      <div data-slot="detail-header" className="relative -mx-4 -mt-4 shrink-0 overflow-hidden border-b-[3px] border-pop-ink bg-muted">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(75% 62% at 50% 56%, color-mix(in oklch, ${accent.solid} 80%, transparent), color-mix(in oklch, ${accent.solid} 20%, transparent) 55%, transparent 78%)`,
          }}
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label="Close"
          className="material absolute top-3 right-3 z-10 rounded-full text-pop-ink hover:text-pop-ink max-md:size-11"
        >
          <X />
        </Button>

        {/* A square that tracks the panel's width (the sidebar is draggable),
            sized and centred per Sprite like every other piece of art. It
            wears the tiles' pop too: a hard ink drop, then a soft lift. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative mx-auto flex aspect-square w-full items-center justify-center p-4"
        >
          {sprite.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              data-slot="detail-image"
              src={sprite.icon}
              alt={displayName(sprite.name)}
              className="size-full object-contain [filter:drop-shadow(0_5px_0_var(--pop-ink))_drop-shadow(0_18px_20px_rgb(0_0_0/0.35))]"
              style={{ transform: spriteIconTransform(sprite.id) }}
            />
          ) : (
            <span className="display-caps text-3xl text-muted-foreground">?</span>
          )}
        </motion.div>
      </div>

      {/* Identity sits on the panel's own ground, not a card: it is the
          subject, not one of its facts. Name and rarity share a row, the
          sticker pinned right and kept on the first line if the name wraps. */}
      <div className="px-1 pt-2 pb-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="display-caps min-w-0 text-3xl leading-[1.1] text-foreground">
            {displayName(sprite.name)}
          </h2>
          {/* The same sticker as the catalog's rarity band, in miniature. */}
          <span
            data-slot="rarity-badge"
            className="display-caps ink-label mt-0.5 flex h-7 shrink-0 items-center rounded-full border-[3px] border-pop-ink px-3 text-sm leading-none shadow-[0_2px_0_var(--pop-ink)] [-webkit-text-stroke-width:3px]"
            style={{ background: accent.solid }}
          >
            {sprite.rarity ?? "Unknown"}
          </span>
        </div>

        {/* Only for a Sprite this season doesn't offer. */}
        {!sprite.currentlyLive && (
          <p className="display-caps mt-2 text-sm text-muted-foreground">
            {AVAILABILITY_LABEL[sprite.availability] ?? "Unavailable"}
          </p>
        )}

        {ability && (
          <p data-slot="detail-ability" className="mt-3 text-base leading-relaxed text-foreground">
            {ability}
          </p>
        )}
      </div>

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
          <p className="mt-2 mb-1 text-sm leading-relaxed text-muted-foreground">{sprite.acquisitionHint}</p>
        )}
      </Section>

      <Section title="Resummon cost" aside="Sprite Dust">
        {/* One chip per variant, in the catalog's slot order: the variant's
            name in its caption colour, the cost in CTA yellow, on the tiles'
            own recessed indigo with the ink outline and hard drop every
            sticker wears. A cost the catalog doesn't have shows as a dash;
            nothing is estimated. */}
        {noCostsPublished ? (
          <Empty>Epic hasn&rsquo;t published costs for this Sprite yet.</Empty>
        ) : (
          <div data-slot="summon-costs" className="flex flex-wrap gap-2 pt-1 pb-1.5">
            {familyVariants.map((v) => {
              const cost = v.summonCostSpriteDust;
              return (
                <span
                  key={v.id}
                  data-slot="summon-cost"
                  className="inline-flex h-9 items-center gap-2.5 rounded-xl border-[3px] border-pop-ink bg-card px-3 shadow-[0_2px_0_var(--pop-ink)]"
                  aria-label={`${variantLabel(v.variant)}: ${cost != null ? `${cost.toLocaleString()} Sprite Dust` : "not published"}`}
                >
                  <span
                    className="display-caps text-base leading-none"
                    style={{ color: variantLabelColor(v.variant) ?? undefined }}
                  >
                    {variantLabel(v.variant)}
                  </span>
                  <span
                    className={cn(
                      "display-caps text-base leading-none tabular-nums",
                      cost != null ? "text-pop-yellow" : "text-muted-foreground/70"
                    )}
                  >
                    {cost != null ? cost.toLocaleString() : "—"}
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </Section>

      {sprite.boons.length > 0 && (
        <Section title="Boons">
          <ul className="space-y-2 pb-1">
            {sprite.boons.map((boon) => (
              <li key={boon.id} className="text-base leading-relaxed text-foreground">
                {boon.description}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </motion.div>
  );
}
