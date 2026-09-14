"use client";

import { useEffect, useState } from "react";
import { loadPois, type Poi } from "@/lib/map/pois";

export function usePois() {
  const [pois, setPois] = useState<Poi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadPois()
      .then((catalog) => {
        if (!cancelled) setPois(catalog.pois);
      })
      .catch(() => {
        if (!cancelled) setPois([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { pois, loading };
}
