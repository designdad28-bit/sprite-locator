import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "Privacy Policy — Sprite Radar",
  description: "What Sprite Radar collects, why, and how to reach us about it.",
};

// A plain page, deliberately outside the app shell (no sidebar, no map) —
// this needs to work as a normal, linkable, indexable document, including
// for Epic's own reviewers, not as a screen inside the SPA.
//
// Its own scroll container: globals.css pins html and body to the viewport
// with overflow hidden (the app is one full-window shell), which left the
// bottom of this page unreachable on any screen shorter than the policy.
export default function PrivacyPolicyPage() {
  return (
    <div className="h-dvh overflow-y-auto">
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      {/* The app's own lockup, and the way back to it: this page is reached
          from outside the app, and had no route home but the browser's. */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/" aria-label="Sprite Radar home" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-pop-yellow/60">
          <Logo className="text-lg" />
        </Link>
        <Link
          href="/"
          className="material display-caps flex h-9 items-center rounded-full px-4 text-base text-pop-ink hover:text-pop-ink"
        >
          Back to the map
        </Link>
      </div>
      <h1 className="display-caps mt-10 text-4xl leading-none">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: September 28, 2026</p>

      <p className="mt-8 leading-relaxed">
        Sprite Radar is a fan-made companion site for tracking where Sprites (an in-game item) appear on the
        current Fortnite island map. It is not made by, affiliated with, or endorsed by Epic Games. This page
        explains what information the site collects and what happens to it.
      </p>

      <h2 className="display-caps mt-10 text-xl text-pop-yellow">What we collect</h2>

      <h3 className="mt-6 text-base font-semibold">Findings you log</h3>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        When you use &ldquo;Add Sprite Location&rdquo; to record where a Sprite dropped, we store the location, the
        Sprite, its variant, and how it was obtained. These entries are not tied to your identity unless you
        sign in (see below) — they exist to build a shared, crowdsourced map of drop locations.
      </p>

      <h3 className="mt-6 text-base font-semibold">Your account, if you sign in</h3>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Signing in with Discord shares three things with us: your Discord user ID, your display name, and the
        address of your profile picture. (Where signing in with Epic Games is offered, it shares your Epic
        account ID and display name.) We use this only to recognize you as the same person across visits — for
        example, to show who you&rsquo;re signed in as, or to attribute findings to your account. We do not
        receive your email, password, payment information, messages, servers, or friends list, and we never see
        your credentials — sign-in happens entirely on Discord&rsquo;s (or Epic&rsquo;s) own site.
      </p>

      <h3 className="mt-6 text-base font-semibold">Cookies and your browser</h3>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Signing in sets one cookie, which keeps you signed in for up to 30 days; signing out removes it. Your
        collection progress (which Sprites you&rsquo;ve collected or mastered) and a few display preferences are
        saved in your own browser&rsquo;s storage and never sent to us. There are no advertising or tracking
        cookies.
      </p>

      <h2 className="display-caps mt-10 text-xl text-pop-yellow">What we don&rsquo;t do</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">
        <li>We don&rsquo;t sell or share your data with advertisers or other third parties.</li>
        <li>We don&rsquo;t run analytics or tracking scripts on this site.</li>
        <li>We don&rsquo;t use your data for anything beyond making the map and your findings work.</li>
      </ul>

      <h2 className="display-caps mt-10 text-xl text-pop-yellow">Where data lives</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Findings and account records are stored with Supabase, a hosted database provider. The map imagery
        and Sprite catalog data come from public sources and are not personal data.
      </p>

      <h2 className="display-caps mt-10 text-xl text-pop-yellow">Your choices</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        You can use Sprite Radar without signing in — logging and viewing findings doesn&rsquo;t require an
        account. If you&rsquo;ve signed in and want your account data removed, contact us at the address below
        and we&rsquo;ll delete it.
      </p>

      <h2 className="display-caps mt-10 text-xl text-pop-yellow">Contact</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Questions about this policy or your data: <a className="text-foreground underline underline-offset-3 hover:text-pop-yellow" href="mailto:designdad28@gmail.com">designdad28@gmail.com</a>.
      </p>

      <h2 className="display-caps mt-10 text-xl text-pop-yellow">Changes</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        If what we collect or how we use it changes, this page will be updated and the date at the top
        revised accordingly.
      </p>
    </main>
    </div>
  );
}
