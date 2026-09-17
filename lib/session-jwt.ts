import { SignJWT, jwtVerify } from "jose";

/**
 * Our own Supabase-compatible session tokens.
 *
 * Supabase Auth never issues a session for our users, because Epic isn't a
 * provider it knows about — see lib/epic-auth.ts. Instead we sign JWTs
 * ourselves with the project's JWT secret (Project Settings > API > JWT
 * Settings in the Supabase dashboard). PostgREST and RLS accept any JWT
 * signed with that secret carrying the claims below; this is Supabase's own
 * documented pattern for a custom auth provider, not a workaround.
 *
 * `sub` becomes `auth.uid()` in RLS policies — set it to the profile's id,
 * never the Epic account id, so a policy like
 * `using (user_id = auth.uid())` on sprite_locations works unchanged.
 */
const COOKIE_NAME = "sprite_radar_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function secretKey() {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("Missing required env var: SUPABASE_JWT_SECRET");
  return new TextEncoder().encode(secret);
}

export interface SessionClaims {
  profileId: string;
  epicAccountId: string;
  epicDisplayName: string;
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({
    role: "authenticated",
    epic_account_id: claims.epicAccountId,
    epic_display_name: claims.epicDisplayName,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.profileId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string") return null;
    return {
      profileId: payload.sub,
      epicAccountId: String(payload.epic_account_id ?? ""),
      epicDisplayName: String(payload.epic_display_name ?? ""),
    };
  } catch {
    return null;
  }
}

export { COOKIE_NAME, SESSION_TTL_SECONDS };
