import { NextRequest, NextResponse } from "next/server";
import { exchangeDiscordCode, fetchDiscordProfile } from "@/lib/discord-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { signSession, COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/session-jwt";

const STATE_COOKIE = "discord_oauth_state";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;

  // Both checks matter: no code means Discord sent an error instead of a
  // code (the user declined, or something went wrong on Discord's side); a
  // state mismatch means this request didn't originate from the login
  // redirect we issued, which is exactly what the state check exists to
  // catch.
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth_error=discord", request.url));
  }

  try {
    const token = await exchangeDiscordCode(code);
    const profile = await fetchDiscordProfile(token.access_token);

    // Upsert on discord_account_id: a returning player gets their existing
    // profile id back (so their history and any Epic link stay theirs)
    // rather than a new row every login. Display name and avatar are
    // refreshed each login since players do change those on Discord's side.
    const { data: row, error } = await getSupabaseAdmin()
      .from("profiles")
      .upsert(
        {
          discord_account_id: profile.userId,
          discord_display_name: profile.username,
          discord_avatar_url: profile.avatarUrl,
        },
        { onConflict: "discord_account_id" }
      )
      .select("id")
      .single();

    if (error || !row) {
      throw new Error(`Could not upsert profile: ${error?.message}`);
    }

    const session = await signSession({
      profileId: row.id,
      discordAccountId: profile.userId,
      discordDisplayName: profile.username,
      discordAvatarUrl: profile.avatarUrl ?? undefined,
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
    console.error("Discord sign-in failed:", err);
    return NextResponse.redirect(new URL("/?auth_error=discord", request.url));
  }
}
