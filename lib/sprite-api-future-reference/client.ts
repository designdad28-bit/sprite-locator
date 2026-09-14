import "server-only";
import type { SpriteBoonDto, SpritesResponseDto } from "./types";

/**
 * Thin fetch wrapper around the Fortnite Sprite API
 * (https://api-fortnite.com/docs, base https://prod.api-fortnite.com).
 *
 * Server-only: the API requires a personal `x-api-key` header (free account
 * at https://api-fortnite.com/login), which must never reach the browser
 * bundle. Callers go through app/api/sprites (our own route handler), never
 * straight to prod.api-fortnite.com from the client.
 */

const BASE_URL = "https://prod.api-fortnite.com";

export class SpriteApiConfigError extends Error {}
export class SpriteApiRequestError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

function requireApiKey(): string {
  const key = process.env.FORTNITE_API_KEY;
  if (!key) {
    throw new SpriteApiConfigError(
      "FORTNITE_API_KEY is not set. Get a free key at https://api-fortnite.com/login and set it in .env.local."
    );
  }
  return key;
}

async function fortniteApiFetch<T>(path: string, revalidateSeconds: number): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-api-key": requireApiKey() },
    next: { revalidate: revalidateSeconds },
  });

  if (!res.ok) {
    throw new SpriteApiRequestError(
      `Fortnite Sprite API request to ${path} failed: ${res.status} ${res.statusText}`,
      res.status
    );
  }

  return res.json() as Promise<T>;
}

/** GET /api/v2/sprites — live season's full sprite catalog. */
export function fetchSpriteCatalog(): Promise<SpritesResponseDto> {
  return fortniteApiFetch<SpritesResponseDto>("/api/v2/sprites", 3600);
}

/** GET /api/v2/sprites/boons — the boon perk catalog (id -> name/description). */
export function fetchSpriteBoons(): Promise<SpriteBoonDto[]> {
  return fortniteApiFetch<SpriteBoonDto[]>("/api/v2/sprites/boons", 86400);
}
