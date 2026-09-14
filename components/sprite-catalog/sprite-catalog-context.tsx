"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { NormalizedSprite, SpriteCatalog } from "@/lib/sprite-catalog/types";
import { loadSpriteCatalog } from "@/lib/sprite-catalog/repository";

interface SpriteCatalogState {
  sprites: NormalizedSprite[];
  source: string | null;
  generated: string | null;
  loading: boolean;
  error: string | null;
  getSprite: (id: string) => NormalizedSprite | undefined;
  reload: () => void;
}

const SpriteCatalogContext = createContext<SpriteCatalogState | null>(null);

export function SpriteCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<SpriteCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loadSpriteCatalog()
      .then((data) => {
        if (!cancelled) setCatalog(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const lookup = useMemo(() => {
    const map = new Map<string, NormalizedSprite>();
    for (const sprite of catalog?.sprites ?? []) map.set(sprite.id, sprite);
    return map;
  }, [catalog]);

  const value: SpriteCatalogState = {
    sprites: catalog?.sprites ?? [],
    source: catalog?.source ?? null,
    generated: catalog?.generated ?? null,
    loading,
    error,
    getSprite: (id) => lookup.get(id),
    reload: () => setNonce((n) => n + 1),
  };

  return <SpriteCatalogContext.Provider value={value}>{children}</SpriteCatalogContext.Provider>;
}

export function useSpriteCatalog(): SpriteCatalogState {
  const ctx = useContext(SpriteCatalogContext);
  if (!ctx) throw new Error("useSpriteCatalog must be used within a SpriteCatalogProvider");
  return ctx;
}
