import { NextRequest, NextResponse } from "next/server";
import { exchangeEpicCode, fetchEpicProfile } from "@/lib/epic-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { signSession, COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/session-jwt";

const STATE_COOKIE = "epic_oauth_state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  // Both checks matter: no code means Epic sent an error instead of a code
  // (the user declined, or something went wrong on Epic's side); a state
  // mismatch means this request didn't originate from the login redirect we
  // issued, which is exactly what the state check exists to catch.
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth_error=epic", request.url));
  }

  try {
    const token = await exchangeEpicCode(code);
    const profile = await fetchEpicProfile(token.access_token);

    // Upsert on epic_account_id: a returning player gets their existing
    // profile id back (so their history stays theirs) rather than a new row
    // every login. Display name is refreshed each login since players do
    // rename themselves on Epic's side.
    const { data: row, error } = await getSupabaseAdmin()
      .from("profiles")
      .upsert(
        { epic_account_id: profile.accountId, epic_display_name: profile.displayName },
        { onConflict: "epic_account_id" }
      )
      .select("id")
      .single();

    if (error || !row) {
      throw new Error(`Could not upsert profile: ${error?.message}`);
    }

    const session = await signSession({
      profileId: row.id,
      epicAccountId: profile.accountId,
      epicDisplayName: profile.displayName,
    });

    const res = NextResponse.redirect(new URL("/", request.url));
    res.cookies.set(COOKIE_NAME, session, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("Epic sign-in failed:", err);
    return NextResponse.redirect(new URL("/?auth_error=epic", request.url));
  }
}
