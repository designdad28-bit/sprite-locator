import type { Metadata } from "next";
import { Geist_Mono, Inter, Rajdhani } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SpriteCatalogProvider } from "@/components/sprite-catalog/sprite-catalog-context";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-heading",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sprite Radar",
  description: "Fortnite Sprite Locator",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        "dark",
        geistMono.variable,
        rajdhani.variable,
        "font-sans",
        inter.variable
      )}
    >
      {/* No flex/min-height here: globals.css pins html+body to the viewport,
          and the app shell owns its own layout. A column flex body would make
          the shell a flex item that can be sized by its container rather than
          by the window. */}
      <body className="text-foreground">
        {/* The duotone that tints uncollected Sprite art into the Reef ramp
            (see .sprite-unowned in globals.css). It lives here because a CSS
            filter can only reference an SVG filter that is actually in the
            document — a data: URI is not reliably resolved for filter refs —
            and it is defined once at the root so every Sprite list can point
            at the same one.
            feColorMatrix flattens the art to luminance; feComponentTransfer
            then maps 0 to #1E2F44 and 1 to #BED3EF, both hue 256. sRGB
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
              <feFuncR type="table" tableValues="0.118 0.745" />
              <feFuncG type="table" tableValues="0.184 0.827" />
              <feFuncB type="table" tableValues="0.267 0.937" />
            </feComponentTransfer>
          </filter>
        </svg>
        <SpriteCatalogProvider>{children}</SpriteCatalogProvider>
      </body>
    </html>
  );
}
