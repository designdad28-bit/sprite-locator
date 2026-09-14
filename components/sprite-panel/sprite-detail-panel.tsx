"use client";

import { motion } from "framer-motion";
import { X, MapPin, Sparkles, PackageSearch } from "lucide-react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { Finding } from "@/lib/findings";
import { rarityColor } from "@/lib/rarity";

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
  const { getSprite } = useSpriteCatalog();
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

  const color = rarityColor(sprite.rarity);
  const sightingCount = findings.filter((f) => f.spriteId === spriteId).length;
  const dropRateEntries = sprite.dropRates ? Object.entries(sprite.dropRates) : [];

  return (
    <motion.div
      key={spriteId}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="no-scrollbar flex h-full flex-col overflow-y-auto"
    >
      <div className="flex items-center justify-between px-4 pt-5">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sprite Details</span>
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 px-6 pb-5 pt-4 text-center">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color }}>
          {sprite.rarity ?? "Unknown Rarity"}
        </span>
        <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-foreground">{sprite.name}</h2>
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {sprite.variant ? `${sprite.variant} Variant` : "Base Variant"}
        </span>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="relative mt-2 flex h-32 w-32 items-center justify-center rounded-2xl border"
          style={{
            borderColor: `${color}55`,
            background: `radial-gradient(circle at 50% 30%, ${color}22, transparent 70%)`,
            boxShadow: `0 0 32px -8px ${color}66`,
          }}
        >
          {sprite.icon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sprite.icon} alt={sprite.name} className="h-24 w-24 object-contain" />
          ) : (
            <span className="text-4xl">?</span>
          )}
          {!sprite.currentlyLive && (
            <span className="absolute -bottom-2 rounded-full bg-card px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground ring-1 ring-input">
              {AVAILABILITY_LABEL[sprite.availability] ?? "Unavailable"}
            </span>
          )}
        </motion.div>

        <p className="mt-3 max-w-xs text-sm italic leading-relaxed text-muted-foreground">
          &ldquo;Find {sprite.name} across the island.&rdquo;
        </p>
      </div>

      <div className="space-y-5 border-t border-border px-5 py-5">
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

        {(sprite.ability || sprite.description) && (
          <section>
            <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Ability</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground">{sprite.ability ?? sprite.description}</p>
          </section>
        )}

        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Summon Cost</h3>
          <p className="mt-1.5 text-sm text-foreground">
            {sprite.summonCostSpriteDust != null
              ? `${sprite.summonCostSpriteDust.toLocaleString()} Sprite Dust`
              : "Not yet published"}
          </p>
        </section>

        <p className="text-[11px] text-muted-foreground/70">
          {typeof sprite.season === "number" ? `Season ${sprite.season}` : sprite.season ? `Added ${sprite.season}` : "Season unknown"}
          {sprite.seasonDate ? ` — ${sprite.seasonDate}` : ""}
          {" · "}
          {sprite.source}
        </p>
      </div>
    </motion.div>
  );
}
