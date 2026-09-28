"use client";

import { Menu } from "@base-ui/react/menu";
import { DiscordIcon, LogOut } from "@/components/icons";
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
    <Menu.Root>
      <Menu.Trigger
        aria-label={`Signed in as ${name}. Account menu`}
        className={cn(
          "material display-caps ml-auto flex shrink-0 items-center rounded-full text-pop-ink outline-none hover:text-pop-ink focus-visible:ring-3 focus-visible:ring-pop-yellow/60",
          lg ? "h-9 max-w-64 gap-2 py-0 pr-4 pl-0.5 text-base" : "h-8 max-w-40 gap-1.5 py-0 pr-3 pl-0.5 text-base",
          className
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
      <Menu.Portal>
        {/* Above the map's panes and the sidebar (z 500-700). */}
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-[1200]">
          {/* A dropdown panel, not another button: the ink blue every
              sticker's shadow is drawn in, 10px corners, matched to the
              pill's width. The row lightens on hover or keyboard focus (not
              the menu's own "highlighted" state, which it sets on open) and
              the label stays CTA yellow throughout. */}
          <Menu.Popup className="w-(--anchor-width) origin-(--transform-origin) rounded-[10px] bg-pop-ink p-1 shadow-[0_10px_24px_rgb(0_0_0/0.35)] outline-none transition-[opacity,scale,translate] duration-150 data-ending-style:-translate-y-1 data-ending-style:opacity-0 data-starting-style:-translate-y-1 data-starting-style:opacity-0">
            <Menu.Item
              onClick={signOut}
              className="display-caps flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-3 text-base text-pop-yellow outline-none transition-colors duration-150 select-none hover:bg-white/10 focus-visible:bg-white/10"
            >
              <LogOut className="size-4" />
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
