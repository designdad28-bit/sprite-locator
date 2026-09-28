"use client";

import { useRef } from "react";
import { Menu } from "@base-ui/react/menu";
import { DiscordIcon } from "@/components/icons";
import { useCurrentUser } from "@/hooks/use-current-user";
import { cn } from "@/lib/utils";

/**
 * Sign in with Discord, or the signed-in player (avatar + name). Clicking
 * the signed-in pill opens a small menu with Sign out, rather than signing
 * out on the spot. Desktop: large, in the site's top-right corner over the map.
 * Phone: small, in the sidebar header beside the logo.
 *
 * Renders nothing while the session loads, so a returning player never sees
 * a flash of "Sign in".
 */
export function AccountControl({ size = "lg", className }: { size?: "sm" | "lg"; className?: string }) {
  const { user, loading, signOut } = useCurrentUser();
  // The menu renders inside this wrapper (not at the page root), so it can
  // sit BEHIND the pill in the same stacking context and hang from it.
  const wrapRef = useRef<HTMLSpanElement>(null);
  if (loading) return null;
  const lg = size === "lg";

  if (!user) {
    return (
      <a
        href="/api/auth/discord/login"
        className={cn(
          "material display-caps ml-auto flex shrink-0 items-center rounded-full text-pop-ink hover:text-pop-ink",
          lg ? "h-9 gap-2 px-4 text-base" : "h-8 gap-1.5 px-3 text-base",
          className
        )}
      >
        <DiscordIcon className="size-4" />
        Sign In
      </a>
    );
  }

  const name = user.discordDisplayName ?? user.epicDisplayName ?? "Player";
  return (
    <span ref={wrapRef} className={cn("relative isolate ml-auto flex shrink-0", className)}>
      <Menu.Root>
        <Menu.Trigger
          aria-label={`Signed in as ${name}. Account menu`}
          className={cn(
            "material display-caps flex shrink-0 items-center rounded-full text-pop-ink outline-none hover:text-pop-ink focus-visible:ring-3 focus-visible:ring-pop-yellow/60",
            lg ? "h-9 max-w-64 gap-2 py-0 pr-4 pl-0.5 text-base" : "h-8 max-w-40 gap-1.5 py-0 pr-3 pl-0.5 text-base"
          )}
        >
          {user.discordAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.discordAvatarUrl} alt="" className="size-7 shrink-0 rounded-full border-2 border-pop-ink" />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-pop-ink bg-pop-yellow">
              <DiscordIcon className="size-3.5" />
            </span>
          )}
          <span className="truncate">{name}</span>
        </Menu.Trigger>
        <Menu.Portal container={wrapRef}>
          {/* A tab that hangs from the pill: it starts halfway up the pill
              (sideOffset is minus half its height) and sits BEHIND it
              (z -1 inside the wrapper's own stacking context), so the pill's
              hard ink drop runs straight into the ink panel and the two read
              as one piece. Matched to the pill's width, square along the
              top, rounded below. */}
          <Menu.Positioner side="bottom" align="end" sideOffset={lg ? -18 : -16} className="-z-10">
            <Menu.Popup className="w-(--anchor-width) origin-top rounded-b-[16px] bg-pop-ink px-1 pt-[22px] pb-1 outline-none transition-[opacity,translate] duration-150 data-ending-style:-translate-y-2 data-ending-style:opacity-0 data-starting-style:-translate-y-2 data-starting-style:opacity-0">
              {/* Just the words, right-aligned under the name's end. The row
                  lightens on real hover or keyboard focus (not the menu's own
                  "highlighted" state, which it sets on open). */}
              <Menu.Item
                onClick={signOut}
                className="display-caps flex h-8 w-full cursor-pointer items-center justify-end rounded-[12px] px-3 text-base text-pop-yellow outline-none transition-colors duration-150 select-none hover:bg-white/10 focus-visible:bg-white/10"
              >
                Sign out
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </span>
  );
}
