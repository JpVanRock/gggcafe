import type { Metadata, Viewport } from "next";
import { DM_Sans, Jost } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/brand";
import { SkipLink } from "@/components/ui";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

// Body and interface (brand kit): clear at small sizes; the opsz axis tunes letter shapes per size.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
});

// Titles, tables and stat numbers: pairs with the logo's Montecatini Pro, and has tabular
// figures (DM Sans doesn't), so numbers line up in columns.
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GGG.Cafe",
  description: "Softball player development and team management",
  // Installed on an iPhone home screen (the rest is in manifest.ts): the name under the icon, and
  // a dark status bar with white text, readable over Night Game and Day Game alike. The name under the
  // icon is "GGG Cafe" (user, 2026-11-13); page titles keep "GGG.Cafe".
  appleWebApp: { capable: true, title: "GGG Cafe", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#000a2d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the boot script may set data-theme="day" before React loads
    <html lang="en" className={`${dmSans.variable} ${jost.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* The site has its own dark look (Night Game), so browsers' "night mode" recoloring stays off:
            Firefox for iPhone's night mode and the Dark Reader extensions skip pages with this tag. Their
            recoloring had made Day Game unreadable (pale text on white, black fields; user, 2026-11-21).
            Chrome's forced dark is turned off in globals.css (color-scheme: only light). */}
        <meta name="darkreader-lock" />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SkipLink />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
