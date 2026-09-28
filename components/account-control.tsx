"use client";

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
          {/* The same sticker card as the dropdown lists: ink outline, hard
              ink drop, 10px corners, yellow on the highlighted row. */}
          <Menu.Popup className="min-w-44 origin-(--transform-origin) rounded-[10px] border-[3px] border-pop-ink bg-popover p-1.5 text-popover-foreground shadow-[0_4px_0_var(--pop-ink)] outline-none transition-[opacity,scale] duration-100 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0">
            <div className="px-3 pt-1.5 pb-2 text-xs text-muted-foreground">
              Signed in with Discord
            </div>
            <Menu.Item
              onClick={signOut}
              className="display-caps flex w-full cursor-default items-center rounded-md px-3 py-2 text-base text-foreground outline-none select-none data-highlighted:bg-pop-yellow data-highlighted:text-pop-ink"
            >
              Sign out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
