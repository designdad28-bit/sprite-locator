import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SpriteCatalogProvider } from "@/components/sprite-catalog/sprite-catalog-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

// The display face: tall, condensed, heavy caps, for headings and button
// labels — the chunky poster type of the Sprite Scout reference.
const anton = Anton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Sprite Radar",
  description: "Track every Fortnite Sprite and variant, and log where they drop on the island.",
};

// The browser's own chrome (mobile address bar, PWA title bar) in the
// sidebar's indigo, so the app doesn't sit under a white strip.
export const viewport: Viewport = {
  themeColor: "#232a7a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        "dark",
        anton.variable,
        "font-sans",
        inter.variable
      )}
    >
      {/* No flex/min-height here: globals.css pins html+body to the viewport,
          and the app shell owns its own layout. A column flex body would make
          the shell a flex item that can be sized by its container rather than
          by the window. */}
      <body className="text-foreground">
        {/* The duotone that tints uncollected Sprite art into the indigo ramp
            (see .sprite-unowned in globals.css). It lives here because a CSS
            filter can only reference an SVG filter that is actually in the
            document — a data: URI is not reliably resolved for filter refs —
            and it is defined once at the root so every Sprite list can point
            at the same one.
            feColorMatrix flattens the art to luminance; feComponentTransfer
            then maps 0 to #333D9C and 1 to #AAB2F0: the sidebar's own indigo
            family, the dark end a step above the unselected tile (#232A7A) so
            a dark Sprite still separates from it, the light end held below
            the muted text's lavender so uncollected art stays recessive
            beside a collected tile. sRGB
            interpolation is explicit: the default, linearRGB, washes the
            midtones out. */}
        <svg aria-hidden="true" focusable="false" className="pointer-events-none absolute size-0">
          <filter id="reef-duotone" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0.2126 0.7152 0.0722 0 0
                      0.2126 0.7152 0.0722 0 0
                      0.2126 0.7152 0.0722 0 0
                      0 0 0 1 0"
            />
            <feComponentTransfer>
              <feFuncR type="table" tableValues="0.2 0.667" />
              <feFuncG type="table" tableValues="0.239 0.698" />
              <feFuncB type="table" tableValues="0.612 0.941" />
            </feComponentTransfer>
          </filter>
        </svg>
        <SpriteCatalogProvider>{children}</SpriteCatalogProvider>
      </body>
    </html>
  );
}
