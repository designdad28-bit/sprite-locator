import type { SpriteBoonDto, SpriteFamilyDto, SpriteVariantDto, SpritesResponseDto } from "./types";

/**
 * Normalized Sprite model used everywhere else in the app.
 *
 * Every field here is sourced from the Fortnite Sprite API
 * (https://api-fortnite.com/docs) — nothing is invented locally. One entry
 * is produced per *variant* (a family with no variants becomes a single
 * entry using the family's own data), because that's the granularity a
 * player actually finds/identifies in-game (e.g. "Duck Sprite" vs.
 * "Duck Sprite (Gold)" are visually and mechanically distinct).
 */
export interface NormalizedSpriteBoon {
  id: string;
  name: string | null;
  description: string | null;
  chance: number | null;
}

export interface NormalizedSprite {
  /** Stable catalog id: the variant id, or the family id when there are no variants. */
  id: string;
  familyId: string;
  name: string;
  family: string;
  /** Variant label (e.g. "gold"), or null for a family's base/only form. */
  variant: string | null;
  rarity: string | null;
  icon: string | null;
  iconLarge: string | null;
  description: string | null;
  dexNumber: number | null;
  dropChancePercent: number | null;
  acquisitionHint: string | null;
  extractRewardLootTier: string | null;
  tags: string[];
  boons: NormalizedSpriteBoon[];
  /** Whether this exact variant currently spawns (false = catalog-only/disabled right now). */
  enabled: boolean;
  /** Catalog version this data was read from (e.g. "42.03"), NOT the season the sprite first appeared — the API doesn't expose introduction season directly. */
  gameVersion: string | null;
  isCurrentSeason: boolean;
}

export interface NormalizedSpriteCatalog {
  gameVersion: string | null;
  generated: string | null;
  isCurrentSeason: boolean;
  sprites: NormalizedSprite[];
  boonCatalog: Record<string, SpriteBoonDto>;
}

function resolveBoons(
  refs: { id: string | null; chance: number | null }[] | null | undefined,
  boonCatalog: Record<string, SpriteBoonDto>
): NormalizedSpriteBoon[] {
  if (!refs) return [];
  return refs
    .filter((ref): ref is { id: string; chance: number | null } => !!ref.id)
    .map((ref) => {
      const boon = boonCatalog[ref.id];
      return {
        id: ref.id,
        name: boon?.name ?? null,
        description: boon?.description ?? null,
        chance: ref.chance,
      };
    });
}

function normalizeVariant(
  family: SpriteFamilyDto,
  variant: SpriteVariantDto | null,
  catalog: SpritesResponseDto,
  boonCatalog: Record<string, SpriteBoonDto>
): NormalizedSprite {
  const id = variant?.id ?? family.id ?? "unknown";
  const images = variant?.images ?? family.images ?? null;
  const boons = resolveBoons(variant?.boons ?? family.boons, boonCatalog);

  return {
    id,
    familyId: family.id ?? id,
    name: variant?.name ?? family.name ?? id,
    family: family.name ?? family.id ?? "Unknown",
    variant: variant?.variant ?? null,
    rarity: variant?.rarity ?? family.rarity ?? null,
    icon: images?.icon ?? null,
    iconLarge: images?.iconLarge ?? null,
    description: family.description ?? null,
    dexNumber: family.dexNumber ?? null,
    dropChancePercent: variant?.dropChancePercent ?? family.spawnChancePercent ?? null,
    acquisitionHint: family.acquisitionHint ?? null,
    extractRewardLootTier: family.extractRewardLootTier ?? null,
    tags: family.tags ?? [],
    boons,
    enabled: variant?.enabled ?? true,
    gameVersion: catalog.gameVersion,
    isCurrentSeason: catalog.isCurrent,
  };
}

export function normalizeSpriteCatalog(
  catalog: SpritesResponseDto,
  boons: SpriteBoonDto[]
): NormalizedSpriteCatalog {
  const boonCatalog: Record<string, SpriteBoonDto> = {};
  for (const boon of boons) {
    if (boon.id) boonCatalog[boon.id] = boon;
  }

  const sprites: NormalizedSprite[] = [];
  for (const family of catalog.sprites ?? []) {
    if (family.variants && family.variants.length > 0) {
      for (const variant of family.variants) {
        sprites.push(normalizeVariant(family, variant, catalog, boonCatalog));
      }
    } else {
      sprites.push(normalizeVariant(family, null, catalog, boonCatalog));
    }
  }

  return {
    gameVersion: catalog.gameVersion,
    generated: catalog.generated,
    isCurrentSeason: catalog.isCurrent,
    sprites,
    boonCatalog,
  };
}
