/**
 * "Sign in with Discord" — the OAuth 2.0 authorization-code flow against
 * Discord's own API, registered as an application at
 * https://discord.com/developers/applications.
 *
 * Mirrors lib/epic-auth.ts exactly (same shape: buildXAuthorizeUrl,
 * exchangeXCode, fetchXProfile) so the two providers' login/callback routes
 * are structurally identical — see app/api/auth/discord/*.
 *
 * Docs: https://discord.com/developers/docs/topics/oauth2
 */

const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USERINFO_URL = "https://discord.com/api/users/@me";

/** identify is enough for user id + username + avatar. No email requested. */
const DISCORD_SCOPE = "identify";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/** Where we send the user to log in and approve this app. `state` should be a random value you also stash (e.g. in a short-lived cookie) and check on callback, to block CSRF. */
export function buildDiscordAuthorizeUrl(state: string): string {
  const url = new URL(DISCORD_AUTHORIZE_URL);
  url.searchParams.set("client_id", requireEnv("DISCORD_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requireEnv("DISCORD_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DISCORD_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

/** Exchanges the authorization code Discord sent back to our redirect URI for an access token. Server-side only — needs our client secret. */
export async function exchangeDiscordCode(code: string): Promise<DiscordTokenResponse> {
  const res = await fetch(DISCORD_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv("DISCORD_CLIENT_ID"),
      client_secret: requireEnv("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: requireEnv("DISCORD_REDIRECT_URI"),
    }),
  });

  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface DiscordProfile {
  userId: string;
  username: string;
  /** Full CDN URL, or null if the user has no custom avatar (default avatar). */
  avatarUrl: string | null;
}

/** Fetches the identify-scope profile for the access token just obtained. */
export async function fetchDiscordProfile(accessToken: string): Promise<DiscordProfile> {
  const res = await fetch(DISCORD_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Discord userInfo fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const userId: string | undefined = data.id;
  // Discord's "new" (Pomelo) usernames have no discriminator; legacy
  // accounts still carry one ("name#1234"). global_name is the display name
  // shown in the client, which is what a player recognizes as themselves —
  // prefer it, falling back to username for older accounts without one.
  const username: string | undefined = data.global_name ?? data.username;
  if (!userId || !username) {
    throw new Error(`Unexpected Discord userInfo response shape: ${JSON.stringify(data)}`);
  }
  const avatarUrl = data.avatar
    ? `https://cdn.discordapp.com/avatars/${userId}/${data.avatar}.png?size=64`
    : null;
  return { userId, username, avatarUrl };
}
