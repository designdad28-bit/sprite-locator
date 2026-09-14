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
  title: "SpriteRadar — Fortnite Sprite Intel",
  description: "Interactive island map for finding where Fortnite Sprites spawn.",
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
        <SpriteCatalogProvider>{children}</SpriteCatalogProvider>
      </body>
    </html>
  );
}
