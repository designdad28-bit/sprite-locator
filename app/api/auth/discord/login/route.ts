import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildDiscordAuthorizeUrl } from "@/lib/discord-auth";

const STATE_COOKIE = "discord_oauth_state";

/** Starts the flow: stash a random `state` value, send the user to Discord. */
export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildDiscordAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // only needs to survive the round trip to Discord and back
    path: "/",
  });
  return res;
}
