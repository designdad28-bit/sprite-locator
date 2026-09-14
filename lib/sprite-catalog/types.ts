/** App-facing Sprite model — same shape regardless of where the catalog data comes from. */
export interface SpriteBoon {
  id: string;
  description: string;
}

export type SpriteAvailability = "live" | "coming_soon" | "vaulted" | "unreleased" | "unknown";

export interface NormalizedSprite {
  id: string;
  name: string;
  family: string;
  /** e.g. "gold", "cheatmaster", "hacker" — null for the base form. Variant taxonomy can change season to season. */
  variant: string | null;
  rarity: string | null;
  icon: string | null;
  /** Longer-form flavor/ability text — wiki tends to have the richest version. */
  description: string | null;
  /** Short in-game ability blurb, as fortnite.gg shows it. */
  ability: string | null;
  boons: SpriteBoon[];
  /** Where/how to get it — fortnite.gg's spawn-location hint, or the wiki's longer "how to obtain" text. */
  acquisitionHint: string | null;
  /** Sprite Dust cost to summon this variant. Null if unknown/not yet published (never a fabricated 0). */
  summonCostSpriteDust: number | null;
  /** Drop chance by source, e.g. {"Sprite Chest": 6.48}. Null value per-source (or null map) means unpublished — never a fabricated 0%. */
  dropRates: Record<string, number | null> | null;
  /** Numeric season this record was read from (e.g. 42), or a wiki version string when only the wiki has it. */
  season: number | string | null;
  seasonDate: string | null;
  /** True if this Sprite/variant is confirmed to exist in the game's data (either source has seen it). */
  existsInGameData: boolean;
  /** True only if the CURRENT live season's config makes it obtainable right now. */
  currentlyLive: boolean;
  availability: SpriteAvailability;
  /** Where this record's authoritative fields came from. */
  source: "fortnite.gg" | "fortnite.gg+wiki" | "wiki";
  /** ISO timestamp of the scrape run that produced this record. */
  lastVerified: string;
}

export interface SpriteCatalog {
  source: string;
  generated: string;
  currentSeason: number | null;
  familyCount: number;
  variantCount: number;
  sprites: NormalizedSprite[];
}
