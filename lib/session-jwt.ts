import { SignJWT, jwtVerify } from "jose";

/**
 * Our own Supabase-compatible session tokens.
 *
 * Supabase Auth never issues a session for our users, because neither Epic
 * nor Discord is a provider it knows about — see lib/epic-auth.ts and
 * lib/discord-auth.ts. Instead we sign JWTs ourselves with the project's JWT
 * secret (Project Settings > API > JWT Settings in the Supabase dashboard).
 * PostgREST and RLS accept any JWT signed with that secret carrying the
 * claims below; this is Supabase's own documented pattern for a custom auth
 * provider, not a workaround.
 *
 * `sub` becomes `auth.uid()` in RLS policies — set it to the profile's id,
 * never a provider's own account id, so a policy like
 * `using (user_id = auth.uid())` on sprite_locations works unchanged
 * regardless of which provider the player signed in with.
 */
const COOKIE_NAME = "sprite_radar_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("Missing required env var: SUPABASE_JWT_SECRET");
  return new TextEncoder().encode(secret);
}

/**
 * A signed-in player's identity. A profile always has at least one provider
 * linked (enforced by the DB, see supabase/add-discord.sql), but a session
 * only ever carries the provider it was actually issued for — a Discord
 * login doesn't retroactively know a profile's Epic id. The catalog UI
 * should show whichever display name is present, preferring the one that
 * was just used to sign in.
 */
export interface SessionClaims {
  profileId: string;
  epicAccountId?: string;
  epicDisplayName?: string;
  discordAccountId?: string;
  discordDisplayName?: string;
  discordAvatarUrl?: string;
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    role: "authenticated",
    epic_account_id: claims.epicAccountId,
    epic_display_name: claims.epicDisplayName,
    discord_account_id: claims.discordAccountId,
    discord_display_name: claims.discordDisplayName,
    discord_avatar_url: claims.discordAvatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.profileId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    return {
      profileId: payload.sub,
      epicAccountId: str(payload.epic_account_id),
      epicDisplayName: str(payload.epic_display_name),
      discordAccountId: str(payload.discord_account_id),
      discordDisplayName: str(payload.discord_display_name),
      discordAvatarUrl: str(payload.discord_avatar_url),
    };
  } catch {
    return null;
  }
}

export { COOKIE_NAME, SESSION_TTL_SECONDS };
