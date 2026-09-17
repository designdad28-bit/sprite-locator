import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SERVER-ONLY. Uses the Supabase service-role key, which bypasses row-level
 * security entirely — it must never reach the browser bundle (no
 * NEXT_PUBLIC_ prefix) and must never be imported from a "use client"
 * component. Used only by server routes that need to write a profile before
 * the user has a session yet (see app/api/auth/epic/callback).
 *
 * Everything else in the app keeps using lib/supabase.ts (the public anon
 * client), which is what RLS is actually there to constrain.
 *
 * Built lazily, on first use, rather than at module load: `next build`
 * evaluates every route's module graph to collect its metadata, even routes
 * nothing calls, and supabase-js throws immediately if you construct a
 * client with an empty key. Building this project before
 * SUPABASE_SERVICE_ROLE_KEY is set (e.g. right after adding the Epic sign-in
 * routes, before running their setup) would otherwise fail the whole build
 * over a route nothing is exercising yet.
 */
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  client = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return client;
}
