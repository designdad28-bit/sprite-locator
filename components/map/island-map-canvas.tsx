"use client";

import dynamic from "next/dynamic";
import { Finding } from "@/lib/findings";
import { Poi } from "@/lib/map/pois";
import type { MapFocusRequest } from "./island-map";

const IslandMap = dynamic(() => import("./island-map"), {
  ssr: false,
  // The island's own ground while Leaflet loads, with the label in the
  // display face like every other heading (it was a hand-tracked font-heading
  // span that no other text used).
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-map-field" role="status">
      <span className="display-caps text-lg text-muted-foreground motion-safe:animate-pulse">Loading island…</span>
    </div>
  ),
});

export interface IslandMapCanvasProps {
  findings: Finding[];
  visibleSpriteIds: Set<string>;
  isAddMode: boolean;
  pois: Poi[];
  onMapClick: (x: number, y: number) => void;
  insetLeft?: number;
  onSelectSprite?: (spriteId: string) => void;
  focusRequest?: MapFocusRequest | null;
}

export default function IslandMapCanvas(props: IslandMapCanvasProps) {
  return <IslandMap {...props} />;
}
