"use client";

import { useCallback, useEffect, useState } from "react";
import { Finding, SEED_FINDINGS } from "@/lib/findings";

// Bumped to v4 when the imported findings log landed, so a browser holding
// an older stored array picks up the seeds instead of shadowing them.
const STORAGE_KEY = "sprite-finder:findings:v4";

function load(): Finding[] {
  if (typeof window === "undefined") return SEED_FINDINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_FINDINGS;
    const parsed = JSON.parse(raw) as Finding[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_FINDINGS;
  } catch {
    return SEED_FINDINGS;
  }
}

export function useFindings() {
  const [findings, setFindings] = useState<Finding[]>(SEED_FINDINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setFindings(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(findings));
  }, [findings, hydrated]);

  const addFinding = useCallback((spriteId: string, x: number, y: number, poiId?: string) => {
    const finding: Finding = {
      id: `f-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
      spriteId,
      poiId,
      x,
      y,
      timestamp: Date.now(),
      source: "user-submitted",
    };
    setFindings((prev) => [...prev, finding]);
    return finding;
  }, []);

  const removeFinding = useCallback((id: string) => {
    setFindings((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return { findings, addFinding, removeFinding };
}
