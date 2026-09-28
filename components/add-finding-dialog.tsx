"use client";

import { useMemo, useState } from "react";
import { useSpriteCatalog } from "@/components/sprite-catalog/sprite-catalog-context";
import type { Poi } from "@/lib/map/pois";
import { displayName } from "@/lib/sprite-name";
import { titleCase } from "@/lib/title-case";
import { SpriteThumb } from "@/components/sprite-catalog/sprite-thumb";
import { LOOT_SOURCES } from "@/lib/loot-sources";
import { ADD_FINDING_STYLE } from "@/lib/cta";
import { cn } from "@/lib/utils";
import { VARIANT_NAME, VARIANT_SLOTS, variantBackdrop, variantKey, variantLabel, variantLabelColor } from "@/lib/variant-colors";
import { spriteIconTransform } from "@/lib/sprite-icon-metrics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
/**
 * A loot source's icon at list size. Sources with no real image get an empty
 * box of the same size, so every label in the list starts on the same edge.
 */
function LootThumb({ icon }: { icon: string | null }) {
  if (!icon) return <span className="size-6 shrink-0" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={icon} alt="" className="size-6 shrink-0 object-contain" />;
}

/**
 * Arrow keys move between the options of a one-tap choice (a radiogroup),
 * picking as they go — the keyboard half of a row of buttons that act as one
 * control.
 */
function onChoiceKeys(event: React.KeyboardEvent<HTMLDivElement>) {
  const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
  if (!keys.includes(event.key)) return;
  const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
  const at = options.indexOf(document.activeElement as HTMLButtonElement);
  if (at === -1) return;
  event.preventDefault();
  const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
  const next = options[(at + step + options.length) % options.length];
  next.focus();
  next.click();
}

export interface AddFindingValues {
  poiId: string;
  /**
   * The Sprite a finding is logged against: the id of the VARIANT that was
   * found (gold-jonesy-sprite), not the family's base one. The two pickers
   * below ask for family and variant separately because that is the easier
   * question to answer, but the answer resolves to a single catalog sprite.
   */
  spriteId: string;
  /** Which variant was found, as a slot key ("gold"). Kept for the stored row's own label. */
  variant: string;
  lootSource: string;
}

export interface AddFindingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pois: Poi[];
  /** Pre-picked in the Sprite field: the sprite whose detail panel is open, if any. */
  defaultSpriteId: string | null;
  /**
   * A whole earlier answer to start from — a save that failed and is being
   * retried — so nothing has to be picked twice. Its spriteId is the
   * variant's own id; the form is re-derived from it.
   */
  initialValues?: AddFindingValues | null;
  onConfirm: (values: AddFindingValues) => void;
}

/**
 * The Add finding modal: where, which sprite, and what it dropped from.
 *
 * Mount it with a `key` that changes on each open (see app/page.tsx) so every
 * open starts from a blank form without resetting state in an effect.
 */
/** Field labels: Anton caps in the CTA yellow, the profile panel's heading style. */
const LABEL_STYLE = "display-caps text-base leading-none text-pop-yellow max-md:text-base";

/** The dialog's pickers: the white sticker style of every secondary control, but
 *  with 10px corners, since fields are boxes and only buttons are pills;
 *  yellow on hover (see the material utility). !bg-white beats the trigger's
 *  own bg-input/50, which sits later in the stylesheet. */
const PICKER_STYLE =
  "material !bg-white w-full rounded-[10px] font-semibold text-pop-ink data-placeholder:text-pop-ink/60 [&_svg]:text-pop-ink";

export function AddFindingDialog({
  open,
  onOpenChange,
  pois,
  defaultSpriteId,
  initialValues,
  onConfirm,
}: AddFindingDialogProps) {
  const { sprites } = useSpriteCatalog();
  // A retried answer names the variant that was found; the Sprite field wants
  // that family's base sprite, so it's mapped back here.
  const initialBaseId = (() => {
    if (!initialValues) return defaultSpriteId;
    const found = sprites.find((s) => s.id === initialValues.spriteId);
    if (!found) return defaultSpriteId;
    return sprites.find((s) => s.family === found.family && s.variant === null)?.id ?? found.id;
  })();
  const [poiId, setPoiId] = useState<string | null>(initialValues?.poiId ?? null);
  const [spriteId, setSpriteId] = useState<string | null>(initialBaseId);
  const [variant, setVariant] = useState<string | null>(initialValues?.variant ?? null);
  const [lootSource, setLootSource] = useState<string | null>(initialValues?.lootSource ?? null);

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
      // `id` is the variant's OWN catalog sprite id (gold-jonesy-sprite), which
      // is what the finding is logged against — see the confirm handler below.
      return match ? { slot, id: match.id, icon: match.icon, label: VARIANT_NAME[slot] ?? slot } : null;
    }).filter((v) => v !== null);
  }, [spriteId, sprites]);

  // Loot sources are a fixed list (lib/loot-sources.ts), the same for every
  // sprite, so this field no longer depends on which sprite is chosen.
  const source = lootSource;

  const poiName = (id: string) => titleCase(pois.find((p) => p.id === id)?.name ?? "");
  // The picked family + variant, resolved back to the one catalog sprite they
  // name. Null only while the variant picker is still empty.
  const variantSpriteId = variants.find((v) => v.slot === variant)?.id ?? null;

  const canConfirm = poiId !== null && spriteId !== null && variant !== null && source !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent showCloseButton={false}>
        {/* No visible header: the sheet opens directly on the form, and the
            grabber (phone) plus the backdrop/Escape (desktop) are the
            dismissal affordances now that the X is gone. The title stays
            for screen readers only — DialogPrimitive.Popup still needs an
            accessible name — so removing it visually doesn't remove it from
            the accessibility tree. */}
        <DialogTitle className="sr-only">Add Sprite Location</DialogTitle>

        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label htmlFor="finding-sprite" className={LABEL_STYLE}>Sprite</Label>
            <Select
              value={spriteId}
              onValueChange={(value) => {
                setSpriteId(value as string | null);
                // A variant belongs to one family, so it cannot survive a
                // change of Sprite.
                setVariant(null);
              }}
            >
              <SelectTrigger id="finding-sprite" className={PICKER_STYLE}>
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

          {/* Absent until a Sprite is chosen: which variants exist depends
              entirely on that choice. One tap, not a dropdown — the variants
              are few, and seeing them all at once as the catalog's own tiles
              (their art, their caption colours) is faster to answer mid-match
              than reading a list. */}
          {spriteId && (
          <div className="grid gap-2">
            <span id="finding-variant-label" className={LABEL_STYLE}>Variant</span>
            <div
              role="radiogroup"
              aria-labelledby="finding-variant-label"
              onKeyDown={onChoiceKeys}
              className="flex gap-2"
            >
              {variants.map((v) => {
                const checked = variant === v.slot;
                const variantValue = v.slot === "normal" ? null : v.slot;
                return (
                  <button
                    key={v.slot}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-label={v.label}
                    // Roving focus: only the picked option (or the first, before
                    // anything is picked) is in the tab order.
                    tabIndex={checked || (variant === null && v === variants[0]) ? 0 : -1}
                    onClick={() => setVariant(v.slot)}
                    className="group flex min-w-0 flex-1 flex-col items-center gap-1 outline-none"
                  >
                    <span
                      className="display-caps text-sm leading-5"
                      style={{ color: variantLabelColor(variantValue) ?? undefined }}
                    >
                      {variantLabel(variantValue)}
                    </span>
                    {/* The catalog tile's sticker: ink outline and drop, the
                        variant's own backdrop once picked (with the white
                        selected ring the open card wears), the sidebar's fill
                        and duotone art until then. */}
                    <span
                      className={cn(
                        "relative block aspect-square w-full overflow-clip rounded-md border-[3px] border-pop-ink shadow-[0_3px_0_var(--pop-ink)] transition-[scale,box-shadow] duration-150 ease-out group-hover:scale-[1.05] group-active:scale-[0.97] group-focus-visible:ring-3 group-focus-visible:ring-pop-yellow motion-reduce:transition-none",
                        checked ? "ring-3 ring-white" : "bg-card"
                      )}
                      style={checked ? { background: variantBackdrop(variantValue) ?? undefined } : undefined}
                    >
                      {v.icon && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={v.icon}
                          alt=""
                          className={cn(
                            "absolute inset-0 size-full object-cover [filter:drop-shadow(0_2px_0_var(--pop-ink))]",
                            !checked &&
                              "[filter:url(#reef-duotone)_drop-shadow(0_2px_0_var(--pop-ink))] group-hover:[filter:drop-shadow(0_2px_0_var(--pop-ink))]"
                          )}
                          style={{ transform: spriteIconTransform(v.id) }}
                        />
                      )}
                    </span>
                  </button>
                );
              })}
              {/* Keeps each tile a fifth of the row when a Sprite has fewer
                  than five variants (Mega Man has one). */}
              {Array.from({ length: Math.max(0, VARIANT_SLOTS.length - variants.length) }, (_, i) => (
                <span key={`pad-${i}`} aria-hidden className="min-w-0 flex-1" />
              ))}
            </div>
          </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="finding-location" className={LABEL_STYLE}>Location</Label>
            <Select value={poiId} onValueChange={(value) => setPoiId(value as string | null)}>
              <SelectTrigger id="finding-location" className={PICKER_STYLE}>
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

          {/* Six fixed options, shown as one-tap chips rather than a list
              behind a dropdown: dark until picked, CTA yellow once picked. */}
          <div className="grid gap-2">
            <span id="finding-loot-source-label" className={LABEL_STYLE}>Loot source</span>
            <div
              role="radiogroup"
              aria-labelledby="finding-loot-source-label"
              onKeyDown={onChoiceKeys}
              className="grid grid-cols-2 gap-2"
            >
              {LOOT_SOURCES.map((s) => {
                const checked = source === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    tabIndex={checked || (source === null && s === LOOT_SOURCES[0]) ? 0 : -1}
                    onClick={() => setLootSource(s.id)}
                    className={cn(
                      "flex min-h-11 min-w-0 items-center gap-2 rounded-[10px] border-[3px] border-pop-ink px-2.5 py-1 text-left text-sm leading-tight font-semibold shadow-[0_3px_0_var(--pop-ink)] outline-none transition-[background-color,color,translate,box-shadow] duration-150 active:translate-y-[2px] active:shadow-[0_1px_0_var(--pop-ink)] focus-visible:ring-3 focus-visible:ring-pop-yellow/60 motion-reduce:transition-none",
                      checked
                        ? "bg-pop-yellow text-pop-ink"
                        : "bg-card text-foreground hover:bg-[color-mix(in_oklch,var(--card),white_8%)]"
                    )}
                  >
                    {/* Only real art takes space: an empty slot beside
                        "Legendary Cheat Code" was what cut its name short. */}
                    {s.icon && <LootThumb icon={s.icon} />}
                    <span className="line-clamp-2 min-w-0">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            // h-12 / text-base at every size: the same as the primary
            // action over the map and on the phone's bottom bar, so the
            // one action the product asks for has one size everywhere.
            className={cn("h-12 w-full text-base", ADD_FINDING_STYLE)}
            disabled={!canConfirm}
            onClick={() => {
              if (poiId && spriteId && variant && source) {
                onConfirm({ poiId, spriteId: variantSpriteId ?? spriteId, variant, lootSource: source });
              }
            }}
          >
            Save Location
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
