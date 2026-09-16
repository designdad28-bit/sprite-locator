"use client";

import { motion } from "framer-motion";
import { X, MapPin, Sparkles, PackageSearch } from "lucide-react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { Finding } from "@/lib/findings";
import { rarityAccent } from "@/lib/rarity";
import { displayName } from "@/lib/sprite-name";
import { SPRITE_ABILITIES } from "@/lib/sprite-abilities";
import { VARIANT_SLOTS, variantColor, variantKey, variantLabel } from "@/lib/variant-colors";
import { cn } from "@/lib/utils";
import { spriteIconScale } from "@/lib/sprite-icon-metrics";
import { Badge } from "@/components/ui/badge";

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

export function SpriteDetailPanel({ spriteId, findings, onBack }: SpriteDetailPanelProps) {
  const { getSprite, sprites } = useSpriteCatalog();
  const sprite = getSprite(spriteId);

  if (!sprite) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">Sprite not found in the catalog.</p>
        <button
          onClick={onBack}
          className="rounded-full border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:border-ring hover:bg-input/30"
        >
          Close
        </button>
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
      {/* Top section: the same grey as the left sidebar's header strip (logo +
          mastery), so the two panels' headers read as one system. Full-bleed —
          the panel's own overflow-hidden clips it to its corners. */}
      <div data-slot="detail-header" className="relative shrink-0 bg-muted px-5 pt-5 pb-5">
        <button
          onClick={onBack}
          className="absolute top-3 right-3 flex items-center rounded-full p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>

        {/* The top section holds only the art. */}
        <div className="flex justify-center">
          {/* No frame, fill or glow: the art sits straight on the header grey.
              Scaled per sprite like the catalog headings, because each icon's
              art fills a different share of its 512px canvas. */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            // size-60 = 240px, the full content width (280px panel minus the
            // header's 20px side padding), so the art is as large as it can be
            // without touching the panel's edges.
            className="flex size-60 items-center justify-center"
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
              <span className="text-5xl text-muted-foreground">?</span>
            )}
          </motion.div>
        </div>
      </div>

      {/* The dividing line: everything above sits on the header grey. */}
      <div className="h-[0.5px] w-full shrink-0 bg-border" />

      <div className="space-y-5 px-5 py-5">
        {/* Identity first: name, rarity, then what the sprite does. Left-aligned
            to the same edge as the section headings below. */}
        <div className="flex flex-col items-start text-left">
          <h2 className="font-heading text-2xl font-medium leading-tight text-foreground">{displayName(sprite.name)}</h2>

          {/* Same badge as the catalog cards: solid rarity fill, white text. */}
          <Badge
            data-slot="rarity-badge"
            className="mt-1.5 h-auto rounded-[4px] px-1 py-0.5 text-[10px] leading-none"
            style={{ backgroundColor: accent.solid, borderColor: accent.solid, color: "#fff" }}
          >
            {sprite.rarity ? sprite.rarity.charAt(0).toUpperCase() + sprite.rarity.slice(1) : "Unknown"}
          </Badge>

          {!sprite.currentlyLive && (
            <span className="mt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {AVAILABILITY_LABEL[sprite.availability] ?? "Unavailable"}
            </span>
          )}

          {ability && (
            <p data-slot="detail-ability" className="mt-3 text-sm leading-relaxed text-foreground">
              {ability}
            </p>
          )}
        </div>

        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Found Locations
          </h3>
          <p className="mt-1.5 font-heading text-lg font-semibold text-foreground">
            {sightingCount} {sightingCount === 1 ? "sighting" : "sightings"}
          </p>
        </section>

        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Most Likely Areas
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground/70">Coming soon</p>
        </section>

        <section>
          <h3 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            <PackageSearch className="h-3.5 w-3.5" />
            Loot Sources
          </h3>
          {dropRateEntries.length > 0 ? (
            <div className="mt-2 space-y-1">
              {dropRateEntries.map(([source, pct]) => (
                <div key={source} className="flex items-center justify-between text-[11px]">
                  <span className="rounded-full border border-border bg-input/30 px-2.5 py-1 font-medium text-foreground">
                    {source}
                  </span>
                  <span className="text-muted-foreground">{pct != null ? `${pct}%` : "rate not yet published"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1.5 text-sm text-muted-foreground/70">Not documented</p>
          )}
          {sprite.acquisitionHint && (
            <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{sprite.acquisitionHint}</p>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
            Summon Cost (Sprite Dust)
          </h3>
          {/* One chip per variant, outlined and labelled in that variant's color
              (the same colors as the catalog tiles). Base has no hue of its own
              (its tile color is a see-through white), so it uses the neutral
              border and muted label. A cost the catalog doesn't have shows "—";
              nothing is estimated or filled in. */}
          <div data-slot="summon-costs" className="mt-2 flex flex-wrap gap-1.5">
            {familyVariants.map((v) => {
              const accent = variantKey(v.variant) === "normal" ? null : variantColor(v.variant);
              return (
                <span
                  key={v.id}
                  data-slot="summon-cost"
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-[4px] border px-2 py-1 text-[11px] leading-none",
                    !accent && "border-border"
                  )}
                  style={accent ? { borderColor: accent } : undefined}
                >
                  <span
                    className={cn("font-bold uppercase tracking-wide", !accent && "text-muted-foreground")}
                    style={accent ? { color: accent } : undefined}
                  >
                    {variantLabel(v.variant)}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {v.summonCostSpriteDust != null ? v.summonCostSpriteDust.toLocaleString() : "—"}
                  </span>
                </span>
              );
            })}
          </div>
          {noCostsPublished && <p className="mt-2 text-xs text-muted-foreground/70">Not yet published</p>}
        </section>

        {sprite.boons.length > 0 && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Boons</h3>
            <ul className="mt-1.5 space-y-1">
              {sprite.boons.map((boon) => (
                <li key={boon.id} className="text-sm text-foreground">
                  {boon.description}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </motion.div>
  );
}
