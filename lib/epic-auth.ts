/**
 * "Sign in with Epic Games" — the OAuth 2.0 authorization-code flow against
 * Epic's own developer-facing endpoints, registered as an app at
 * https://dev.epicgames.com/portal (a "Product" with an OAuth client).
 *
 * NOT the endpoints used by unofficial Fortnite-stats tools
 * (account-public-service-prod*.ol.epicgames.com, or www.epicgames.com/id/api/*).
 * Those reverse-engineer the Fortnite launcher's own private login using its
 * hardcoded client credentials — a different, unsanctioned thing, not a
 * third-party sign-in flow. This file only talks to Epic's public developer
 * OAuth surface, with our own registered client id/secret.
 *
 * Endpoints confirmed against Epic's docs and third-party OAuth client
 * implementations (dev.epicgames.com/docs/web-api-ref/authentication;
 * v2.arcticjs.dev/providers/epicgames). CONFIRM the exact userInfo path
 * (v1 vs v2 — sources disagree) and response field names in the Epic
 * Developer Portal when you register the app; don't trust this comment over
 * what Epic's own docs show you then.
 */

const EPIC_AUTHORIZE_URL = "https://www.epicgames.com/id/authorize";
const EPIC_TOKEN_URL = "https://api.epicgames.dev/epic/oauth/v2/token";
const EPIC_USERINFO_URL = "https://api.epicgames.dev/epic/oauth/v2/userInfo";

/** basic_profile is enough for account id + display name. Broader scopes need Epic's approval before going live. */
const EPIC_SCOPE = "basic_profile";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/** Where we send the user to log in and approve this app. `state` should be a random value you also stash (e.g. in a short-lived cookie) and check on callback, to block CSRF. */
export function buildEpicAuthorizeUrl(state: string): string {
  const url = new URL(EPIC_AUTHORIZE_URL);
  url.searchParams.set("client_id", requireEnv("EPIC_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requireEnv("EPIC_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", EPIC_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

interface EpicTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  account_id?: string;
  // Epic's token response for the exchange_code grant type has carried the
  // account id and display name directly in some documented cases; treat
  // fields beyond access_token as a bonus and fall back to userInfo (below)
  // for anything missing rather than assuming this shape.
  displayName?: string;
}

/** Exchanges the authorization code Epic sent back to our redirect URI for an access token. Server-side only — needs our client secret. */
export async function exchangeEpicCode(code: string): Promise<EpicTokenResponse> {
  const clientId = requireEnv("EPIC_CLIENT_ID");
  const clientSecret = requireEnv("EPIC_CLIENT_SECRET");
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(EPIC_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: requireEnv("EPIC_REDIRECT_URI"),
    }),
  });

  if (!res.ok) {
    throw new Error(`Epic token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export interface EpicProfile {
  accountId: string;
  displayName: string;
}

/**
 * Fetches the account id + display name for the access token just obtained.
 * Separate call rather than trusting the token response, since Epic's own
 * examples disagree on whether those fields ride along with the token.
 */
export async function fetchEpicProfile(accessToken: string): Promise<EpicProfile> {
  const res = await fetch(EPIC_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Epic userInfo fetch failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  // Field names per Epic's OIDC-flavored userInfo response ("sub" is the
  // standard OIDC subject claim; Epic's own doc examples also show
  // account_id directly). CONFIRM against a real response — Epic's docs
  // examples aren't fully consistent — and adjust this mapping if needed.
  const accountId: string | undefined = data.sub ?? data.account_id;
  const displayName: string | undefined = data.preferred_username ?? data.displayName;
  if (!accountId || !displayName) {
    throw new Error(`Unexpected Epic userInfo response shape: ${JSON.stringify(data)}`);
  }
  return { accountId, displayName };
}
