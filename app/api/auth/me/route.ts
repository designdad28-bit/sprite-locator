import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";

/**
 * The client-side entry point into the server-only session (getCurrentUser
 * reads an httpOnly cookie via next/headers, which a "use client" component
 * can't call directly). Returns the session claims, or null when signed out.
 */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
