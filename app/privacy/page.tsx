import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Sprite Radar",
  description: "What Sprite Radar collects, why, and how to reach us about it.",
};

// A plain page, deliberately outside the app shell (no sidebar, no map) —
// this needs to work as a normal, linkable, indexable document, including
// for Epic's own reviewers, not as a screen inside the SPA.
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-foreground">
      <h1 className="font-heading text-3xl font-semibold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: September 17, 2026</p>

      <p className="mt-8 leading-relaxed">
        Sprite Radar is a fan-made companion site for tracking where Sprites (an in-game item) appear on the
        current Fortnite island map. It is not made by, affiliated with, or endorsed by Epic Games. This page
        explains what information the site collects and what happens to it.
      </p>

      <h2 className="mt-10 font-heading text-xl font-semibold">What we collect</h2>

      <h3 className="mt-6 text-base font-semibold">Findings you log</h3>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        When you use &ldquo;Add Sprite Location&rdquo; to record where a Sprite dropped, we store the location, the
        Sprite, its variant, and how it was obtained. These entries are not tied to your identity unless you
        sign in (see below) — they exist to build a shared, crowdsourced map of drop locations.
      </p>

      <h3 className="mt-6 text-base font-semibold">Your Epic account, if you sign in</h3>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Signing in with Epic Games shares two things with us: your Epic account ID and your current display
        name. We use this only to recognize you as the same person across visits — for example, to attribute
        findings to your account or build a personal collection checklist. We do not receive your email,
        password, payment information, or friends list, and we never see your Epic credentials — the sign-in
        happens entirely on Epic&rsquo;s own site.
      </p>

      <h2 className="mt-10 font-heading text-xl font-semibold">What we don&rsquo;t do</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-muted-foreground">
        <li>We don&rsquo;t sell or share your data with advertisers or other third parties.</li>
        <li>We don&rsquo;t run analytics or tracking scripts on this site.</li>
        <li>We don&rsquo;t use your data for anything beyond making the map and your findings work.</li>
      </ul>

      <h2 className="mt-10 font-heading text-xl font-semibold">Where data lives</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Findings and account records are stored with Supabase, a hosted database provider. The map imagery
        and Sprite catalog data come from public sources and are not personal data.
      </p>

      <h2 className="mt-10 font-heading text-xl font-semibold">Your choices</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        You can use Sprite Radar without signing in — logging and viewing findings doesn&rsquo;t require an
        account. If you&rsquo;ve signed in and want your account data removed, contact us at the address below
        and we&rsquo;ll delete it.
      </p>

      <h2 className="mt-10 font-heading text-xl font-semibold">Contact</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        Questions about this policy or your data: <a className="underline" href="mailto:designdad28@gmail.com">designdad28@gmail.com</a>.
      </p>

      <h2 className="mt-10 font-heading text-xl font-semibold">Changes</h2>
      <p className="mt-2 leading-relaxed text-muted-foreground">
        If what we collect or how we use it changes, this page will be updated and the date at the top
        revised accordingly.
      </p>
    </main>
  );
}
