"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A personal "have I got this?" checklist per Sprite variant — entirely
 * separate from map findings/sightings. Clicking a variant's image in the
 * catalog cycles it through this, independent of the map and independent
 * per variant: default -> owned -> mastered -> default. Persisted locally
 * per browser, same pattern as findings (see hooks/use-findings.ts) but a
 * distinct concept/storage key.
 *
 * Backed by a module-level store rather than per-hook `useState`: more than
 * one component reads this now (the catalog tiles and the mastery summary),
 * and separate `useState` copies would drift apart — each would only see its
 * own writes, leaving the other showing whatever localStorage held at mount.
 */
export type CollectionStatus = "default" | "owned" | "mastered";

const STORAGE_KEY = "sprite-finder:collection:v1";

type StatusMap = Record<string, CollectionStatus>;

/** Stable reference: useSyncExternalStore loops forever if this is a fresh object each call. */
const EMPTY: StatusMap = {};

let state: StatusMap | null = null;
const listeners = new Set<() => void>();

function read(): StatusMap {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StatusMap) : {};
  } catch {
    return {};
  }
}

function getSnapshot(): StatusMap {
  if (state === null) state = read();
  return state;
}

function getServerSnapshot(): StatusMap {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(next: StatusMap) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode, quota) — keep the in-memory state
  }
  for (const listener of listeners) listener();
}

export function useCollectionStatus() {
  const statusById = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const getStatus = useCallback(
    (id: string): CollectionStatus => statusById[id] ?? "default",
    [statusById]
  );

  const cycleStatus = useCallback((id: string) => {
    const current = getSnapshot();
    const now = current[id] ?? "default";
    const next: CollectionStatus = now === "default" ? "owned" : now === "owned" ? "mastered" : "default";
    const updated = { ...current };
    if (next === "default") delete updated[id];
    else updated[id] = next;
    setState(updated);
  }, []);

  return { getStatus, cycleStatus };
}
