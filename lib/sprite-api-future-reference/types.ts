/**
 * Raw response shapes from the Fortnite Sprite API (https://api-fortnite.com/docs,
 * live schema at https://prod.api-fortnite.com/swagger). These mirror the
 * documented DTOs field-for-field — do not add/rename fields here; put any
 * app-specific shaping in `adapter.ts`.
 */

export interface SpriteImagesDto {
  icon: string | null;
  iconLarge: string | null;
}

export interface SpriteBoonRefDto {
  id: string | null;
  chance: number | null;
}

export interface SpriteVariantDto {
  id: string | null;
  variant: string | null;
  name: string | null;
  rarity: string | null;
  enabled: boolean;
  images: SpriteImagesDto | null;
  baseWeight: number | null;
  weight: number | null;
  dropChancePercent: number | null;
  boons: SpriteBoonRefDto[] | null;
}

export interface SpriteFamilyDto {
  id: string | null;
  name: string | null;
  description: string | null;
  dexNumber: number | null;
  rarity: string | null;
  acquisitionHint: string | null;
  extractRewardLootTier: string | null;
  images: SpriteImagesDto | null;
  tags: string[] | null;
  boons: SpriteBoonRefDto[] | null;
  spawnWeight: number | null;
  spawnChancePercent: number | null;
  variants: SpriteVariantDto[] | null;
}

export interface SpriteLevelDto {
  level: number;
  xp: number;
}

export interface SpriteEventDto {
  name: string | null;
  weights: Record<string, number> | null;
}

export interface SpriteSpawnEntryDto {
  [key: string]: unknown;
}

export interface SpriteSpawnRarityDto {
  [key: string]: unknown;
}

export interface SpriteSpawnListDto {
  id: string | null;
  table: string | null;
  totalWeight: number;
  entries: SpriteSpawnEntryDto[] | null;
  byRarity: SpriteSpawnRarityDto[] | null;
}

export interface SpritesResponseDto {
  gameVersion: string | null;
  generated: string | null;
  hotfixApplied: boolean;
  isCurrent: boolean;
  sprites: SpriteFamilyDto[] | null;
  levelUpCurve: SpriteLevelDto[] | null;
  events: SpriteEventDto[] | null;
  spawnLists: SpriteSpawnListDto[] | null;
}

export interface SpriteBoonDto {
  id: string | null;
  name: string | null;
  description: string | null;
}

export interface SpriteVersionDto {
  version: string;
  generated: string | null;
  isCurrent: boolean;
  familyCount: number;
}
