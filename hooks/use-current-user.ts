"use client";

import { useEffect, useState } from "react";
import type { SessionClaims } from "@/lib/session-jwt";

/**
 * The signed-in player, read from the httpOnly session cookie via
 * /api/auth/me (a "use client" component can't read that cookie's contents
 * directly — see lib/current-user.ts). null while loading AND once loaded
 * with nobody signed in; `loading` distinguishes the two so the sidebar can
 * show nothing rather than flash a "Sign in" button for a returning player.
 */
export function useCurrentUser() {
  const [user, setUser] = useState<SessionClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user: SessionClaims | null }) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    // A full reload, not just state: findings/collection hooks and any
    // Supabase-authenticated fetch in flight were made under the old
    // session's cookie, and this is the simplest way to guarantee nothing
    // downstream is left holding onto it.
    window.location.reload();
  }

  return { user, loading, signOut };
}
