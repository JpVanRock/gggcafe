import type { Metadata, Viewport } from "next";
import { Jost, Space_Mono } from "next/font/google";
import "./globals.css";
import { SiteFooter } from "@/components/brand";

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
    <html lang="en" className={`${jost.variable} ${spaceMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
