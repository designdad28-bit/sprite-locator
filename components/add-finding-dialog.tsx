"use client";

import { useMemo, useState } from "react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import type { Poi } from "@/lib/map/pois";
import { displayName } from "@/lib/sprite-name";
import { titleCase } from "@/lib/title-case";
import { spriteIconScale } from "@/lib/sprite-icon-metrics";
import { LOOT_SOURCES, lootSourceById } from "@/lib/loot-sources";
import { VARIANT_NAME, VARIANT_SLOTS, variantKey } from "@/lib/variant-colors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A sprite's art at list size, beside its name. Scaled per sprite like the
 * catalog headings: each icon's art fills a different share of its canvas, so
 * equal boxes alone would render visibly unequal sprites.
 */
function SpriteThumb({ id, icon }: { id: string; icon: string | null }) {
  if (!icon) return <span className="size-6 shrink-0" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={icon}
      alt=""
      className="size-6 shrink-0 object-contain"
      style={{ transform: `scale(${spriteIconScale(id)})` }}
    />
  );
}

/**
 * A loot source's icon at list size. Sources with no real image get an empty
 * box of the same size, so every label in the list starts on the same edge.
 */
function LootThumb({ icon }: { icon: string | null }) {
  if (!icon) return <span className="size-6 shrink-0" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={icon} alt="" className="size-6 shrink-0 object-contain" />;
}

export interface AddFindingValues {
  poiId: string;
  /** The family's base Sprite — what a finding is logged against. */
  spriteId: string;
  /** Which of that family's four variants was found, as a slot key ("gold"). */
  variant: string;
  lootSource: string;
}

export interface AddFindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pois: Poi[];
  /** Pre-picked in the Sprite field: the sprite whose detail panel is open, if any. */
  defaultSpriteId: string | null;
  onConfirm: (values: AddFindingValues) => void;
}

/**
 * The Add finding modal: where, which sprite, and what it dropped from.
 *
 * Mount it with a `key` that changes on each open (see app/page.tsx) so every
 * open starts from a blank form without resetting state in an effect.
 */
export function AddFindingDialog({ open, onOpenChange, pois, defaultSpriteId, onConfirm }: AddFindingDialogProps) {
  const { sprites } = useSpriteCatalog();
  const [poiId, setPoiId] = useState<string | null>(null);
  const [spriteId, setSpriteId] = useState<string | null>(defaultSpriteId);
  const [variant, setVariant] = useState<string | null>(null);
  const [lootSource, setLootSource] = useState<string | null>(null);

  const sortedPois = useMemo(() => [...pois].sort((a, b) => a.name.localeCompare(b.name)), [pois]);

  // Findings are logged against a family's base sprite (the Radar toggle and
  // the map pins key on it), so only base sprites are offered, A–Z by the
  // name shown in the UI.
  const sortedSprites = useMemo(
    () =>
      sprites
        .filter((s) => s.currentlyLive && s.variant === null)
        .sort((a, b) => displayName(a.name).localeCompare(displayName(b.name))),
    [sprites]
  );

  // The chosen Sprite's own four variants, in the catalog's display order.
  // A family can be missing some (Mega Man has only a base), so this lists
  // what actually exists rather than four fixed rows.
  const variants = useMemo(() => {
    const chosen = spriteId ? sprites.find((s) => s.id === spriteId) : null;
    if (!chosen) return [];
    const family = sprites.filter((s) => s.family === chosen.family && s.currentlyLive);
    return VARIANT_SLOTS.map((slot) => {
      const match = family.find((s) => variantKey(s.variant) === slot);
      return match ? { slot, icon: match.icon, label: VARIANT_NAME[slot] ?? slot } : null;
    }).filter((v) => v !== null);
  }, [spriteId, sprites]);

  // Loot sources are a fixed list (lib/loot-sources.ts), the same for every
  // sprite, so this field no longer depends on which sprite is chosen.
  const source = lootSource;

  const poiName = (id: string) => titleCase(pois.find((p) => p.id === id)?.name ?? "");
  const canConfirm = poiId !== null && spriteId !== null && variant !== null && source !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add finding</DialogTitle>
          <DialogDescription>Log where you found a sprite and what it dropped from.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="finding-location">Location</Label>
            <Select value={poiId} onValueChange={(value) => setPoiId(value as string | null)}>
              <SelectTrigger id="finding-location" className="w-full">
                <SelectValue>{(value: string | null) => (value ? poiName(value) : "Choose a location")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {/* SelectGroup carries this style's inset padding (p-1.5); items
                    placed straight in SelectContent run flush to the popup edge. */}
                <SelectGroup>
                  {sortedPois.map((poi) => (
                    <SelectItem key={poi.id} value={poi.id}>
                      {titleCase(poi.name)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="finding-sprite">Sprite</Label>
            <Select
              value={spriteId}
              onValueChange={(value) => {
                setSpriteId(value as string | null);
                // A variant belongs to one family, so it cannot survive a
                // change of Sprite.
                setVariant(null);
              }}
            >
              <SelectTrigger id="finding-sprite" className="w-full">
                <SelectValue>
                  {(value: string | null) => {
                    const chosen = value ? sprites.find((s) => s.id === value) : null;
                    return chosen ? (
                      <span className="flex items-center gap-2">
                        <SpriteThumb id={chosen.id} icon={chosen.icon} />
                        {displayName(chosen.name)}
                      </span>
                    ) : (
                      "Choose a sprite"
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {sortedSprites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <SpriteThumb id={s.id} icon={s.icon} />
                        {displayName(s.name)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="finding-variant">Variant</Label>
            {/* Disabled until a Sprite is chosen: which four variants exist,
                and what they look like, depends entirely on that choice. */}
            <Select value={variant} onValueChange={(value) => setVariant(value as string | null)} disabled={!spriteId}>
              <SelectTrigger id="finding-variant" className="w-full">
                <SelectValue>
                  {(value: string | null) => {
                    const chosen = value ? variants.find((v) => v.slot === value) : null;
                    return chosen ? (
                      <span className="flex items-center gap-2">
                        <SpriteThumb id={spriteId ?? ""} icon={chosen.icon} />
                        {chosen.label}
                      </span>
                    ) : spriteId ? (
                      "Choose a variant"
                    ) : (
                      "Choose a sprite first"
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {variants.map((v) => (
                    <SelectItem key={v.slot} value={v.slot}>
                      <span className="flex items-center gap-2">
                        <SpriteThumb id={spriteId ?? ""} icon={v.icon} />
                        {v.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="finding-loot-source">Loot source</Label>
            <Select value={source} onValueChange={(value) => setLootSource(value as string | null)}>
              <SelectTrigger id="finding-loot-source" className="w-full">
                <SelectValue>
                  {(value: string | null) => {
                    const chosen = lootSourceById(value);
                    return chosen ? (
                      <span className="flex items-center gap-2">
                        <LootThumb icon={chosen.icon} />
                        {chosen.label}
                      </span>
                    ) : (
                      "Choose a loot source"
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {LOOT_SOURCES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <LootThumb icon={s.icon} />
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Full-bleed divider above a full-width confirm, as in the reference. */}
        <DialogFooter className="-mx-6 -mb-6 border-t border-border px-6 py-5">
          <Button
            className="w-full"
            disabled={!canConfirm}
            onClick={() => {
              if (poiId && spriteId && variant && source) {
                onConfirm({ poiId, spriteId, variant, lootSource: source });
              }
            }}
          >
            Add finding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
