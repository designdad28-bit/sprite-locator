"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Finding } from "@/lib/findings";
import { usePois } from "@/hooks/use-pois";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import { displayName } from "@/lib/sprite-name";
import { LOOT_SOURCES } from "@/lib/loot-sources";
import { titleCase } from "@/lib/title-case";

/**
 * A row of public.sprite_locations.
 *
 * The table stores display NAMES, not our internal ids, so the table stays
 * readable in the Supabase dashboard. That means every read has to resolve
 * names back to ids against the catalog and the POI list (see below).
 * The cost is that renaming a Sprite or a named location upstream orphans
 * the rows that referenced the old name.
 */
interface SpriteLocationRow {
  id: string;
  location_name: string;
  sprite_name: string;
  loot_source: string;
  created_at: string;
}

const TABLE = "sprite_locations";

/** Names are matched case- and spacing-insensitively, since they round-trip through a human-readable column. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function useFindings() {
  const { pois } = usePois();
  const { sprites } = useSpriteCatalog();
  const [rows, setRows] = useState<SpriteLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reads go straight to Supabase from the browser; writes go through
  // app/api/sprite-locations/route.ts instead, so validation has a server-side
  // home later on.
  const refresh = useCallback(async () => {
    const { data, error: err } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: true });
    if (err) setError(err.message);
    else setRows((data ?? []) as SpriteLocationRow[]);
    return !err;
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Wrapped rather than called straight from the effect body: refresh()
    // sets state, and doing that synchronously here costs an extra render
    // pass (react-hooks/set-state-in-effect).
    void (async () => {
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  // Rows are resolved to Findings here rather than at fetch time, because the
  // catalog and the POI list load independently and may arrive after the rows
  // do. Re-running as they arrive means no ordering assumption.
  const findings = useMemo<Finding[]>(() => {
    if (pois.length === 0 || sprites.length === 0) return [];

    const poiByName = new Map(pois.map((p) => [normalize(p.name), p]));
    const spriteByName = new Map(
      sprites
        .filter((s) => s.variant === null)
        .map((s) => [normalize(displayName(s.name)), s])
    );
    const sourceByLabel = new Map(LOOT_SOURCES.map((s) => [normalize(s.label), s]));

    const resolved: Finding[] = [];
    for (const row of rows) {
      const poi = poiByName.get(normalize(row.location_name));
      const sprite = spriteByName.get(normalize(row.sprite_name));
      // A row naming a location or Sprite we don't have can't be placed on the
      // map, so it is skipped rather than guessed at.
      if (!poi || !sprite) continue;
      resolved.push({
        id: row.id,
        spriteId: sprite.id,
        poiId: poi.id,
        lootSource: sourceByLabel.get(normalize(row.loot_source))?.id,
        // The table has no coordinates: a finding sits at the center of the
        // named location it was logged against, which is the precision the
        // form collects anyway.
        x: poi.x,
        y: poi.y,
        timestamp: Date.parse(row.created_at),
        source: "user-submitted",
      });
    }
    return resolved;
  }, [rows, pois, sprites]);

  /** How many stored rows name a location or Sprite that no longer resolves. */
  const unresolvedCount = rows.length - findings.length;

  const addFinding = useCallback(
    async ({ poiId, spriteId, lootSource }: { poiId: string; spriteId: string; lootSource: string }) => {
      const poi = pois.find((p) => p.id === poiId);
      const sprite = sprites.find((s) => s.id === spriteId);
      const source = LOOT_SOURCES.find((s) => s.id === lootSource);
      if (!poi || !sprite || !source) return false;

      const res = await fetch("/api/sprite-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location_name: titleCase(poi.name),
          sprite_name: displayName(sprite.name),
          loot_source: source.label,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not save that finding.");
        return false;
      }

      // The route replies {success:true} without the stored row, so there is
      // no id or created_at to append locally — re-read instead.
      setError(null);
      return refresh();
    },
    [pois, sprites, refresh]
  );

  return { findings, addFinding, refresh, loading, error, unresolvedCount };
}
