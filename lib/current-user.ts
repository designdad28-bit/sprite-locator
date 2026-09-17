import { cookies } from "next/headers";
import { verifySession, COOKIE_NAME, type SessionClaims } from "@/lib/session-jwt";

/** Reads the caller's session from the request cookie, server-side (route handlers, server components). Returns null when signed out or the cookie is missing/invalid/expired. */
export async function getCurrentUser(): Promise<SessionClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
