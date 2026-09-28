"use client";

import { DiscordIcon } from "@/components/icons";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

/**
 * Sign in with Discord, or the signed-in player (avatar + name, click to
 * sign out). Desktop: large, in the site's top-right corner over the map.
 * Phone: small, in the sidebar header beside the logo.
 *
 * Renders nothing while the session loads, so a returning player never sees
 * a flash of "Sign in".
 */
export function AccountControl({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  const { user, loading, signOut } = useCurrentUser();
  if (loading) return null;
  const lg = size === "lg";

  if (!user) {
    return (
      <a
        href="/api/auth/discord/login"
        className={cn(
          "material ml-auto flex shrink-0 items-center rounded-full font-semibold text-pop-ink hover:text-pop-ink",
          lg ? "h-11 gap-2 px-5 text-base" : "h-8 gap-1.5 px-3 text-sm",
          className
        )}
      >
        <DiscordIcon className={lg ? "size-5" : "size-4"} />
        {lg ? "Sign in with Discord" : "Sign in"}
      </a>
    );
  }

  const name = user.discordDisplayName ?? user.epicDisplayName ?? "Player";
  return (
    <button
      type="button"
      onClick={signOut}
      aria-label={`Signed in as ${name}. Sign out`}
      title="Sign out"
      className={cn(
        "material ml-auto flex shrink-0 items-center rounded-full font-semibold text-pop-ink hover:text-pop-ink",
        lg ? "h-11 max-w-64 gap-2.5 py-0 pr-5 pl-1 text-base" : "h-8 max-w-40 gap-1.5 py-0 pr-3 pl-0.5 text-sm",
        className
      )}
    >
      {user.discordAvatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.discordAvatarUrl}
          alt=""
          className={cn("shrink-0 rounded-full border-2 border-pop-ink", lg ? "size-8" : "size-7")}
        />
      ) : (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full border-2 border-pop-ink bg-pop-yellow",
            lg ? "size-8" : "size-7"
          )}
        >
          <DiscordIcon className={lg ? "size-4" : "size-3.5"} />
        </span>
      )}
      <span className="truncate">{name}</span>
    </button>
  );
}
