"use client";

import dynamic from "next/dynamic";
import { Finding } from "@/lib/findings";
import { Poi } from "@/lib/map/pois";
import { MAP_BACKGROUND_COLOR } from "./map-provider";

const IslandMap = dynamic(() => import("./island-map"), {
  ssr: false,
  loading: () => (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundColor: MAP_BACKGROUND_COLOR }}
    >
      <span className="font-heading animate-pulse text-lg tracking-[0.2em] text-muted-foreground">
        LOADING ISLAND…
      </span>
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
}

export default function IslandMapCanvas(props: IslandMapCanvasProps) {
  return <IslandMap {...props} />;
}
