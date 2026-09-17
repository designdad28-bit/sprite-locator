import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildEpicAuthorizeUrl } from "@/lib/epic-auth";

const STATE_COOKIE = "epic_oauth_state";

/** Starts the flow: stash a random `state` value, send the user to Epic. */
export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildEpicAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 10, // only needs to survive the round trip to Epic and back
    path: "/",
  });
  return res;
}
