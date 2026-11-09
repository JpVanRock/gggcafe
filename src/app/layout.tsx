import type { Metadata, Viewport } from "next";
import { DM_Sans, Jost, Space_Mono } from "next/font/google";
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

// Typewriter accent for menu item names on the player dashboard (cafe-menu look).
const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GGG.Cafe",
  description: "Softball player development and game strategy",
};

export const viewport: Viewport = {
  themeColor: "#000a2d",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the boot script may set data-theme="day" before React loads
    <html lang="en" className={`${dmSans.variable} ${jost.variable} ${spaceMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
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
