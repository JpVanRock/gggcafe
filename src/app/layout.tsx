import type { Metadata, Viewport } from "next";
import { Jost, Space_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/brand";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

// Pairs with the logo's Montecatini Pro: a 1920s-style geometric sans with tabular figures.
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
    <html lang="en" className={`${jost.variable} ${spaceMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
