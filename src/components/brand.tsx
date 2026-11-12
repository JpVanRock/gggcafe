import Image from "next/image";
import taglineArt from "../../public/brand/elevate-together-yellow.png";
import taglineNavyArt from "../../public/brand/elevate-together-navy.png";
import Link from "next/link";
import { COPYRIGHT, FOOTER_DISCLAIMER } from "@/lib/legal";

/** The GGG.Cafe logo (round badge). */
export function Logo({ size, priority = false, className = "" }: { size: number; priority?: boolean; className?: string }) {
  return (
    <Image
      src="/brand/ggg-cafe-logo.webp"
      alt="GGG Cafe"
      width={size}
      height={size}
      priority={priority}
      className={`rounded-full ${className}`}
    />
  );
}

/** The "GGG.CAFE" type logo (transparent background, 913×189 source). */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/brand/ggg-cafe-wordmark.png"
      alt="GGG.Cafe"
      width={913}
      height={189}
      className={`h-auto ${className}`}
    />
  );
}

/**
 * Site-wide footer on every page: the type logo at the right, and under it the short legal disclaimer
 * and links across the full page width (user, 2026-11-12: one even band, small and quiet but
 * full-contrast text).
 */
export function SiteFooter() {
  const legalLink = "underline underline-offset-2 hover:text-ink";
  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-10 pb-6">
      {/* keep-night: in Day Game the wordmark sits on a navy chip (brand kit: artwork over navy) */}
      <Link href="/" aria-label="GGG.Cafe home" className="keep-night shrink-0 self-end rounded-xl bg-navy-950 px-3 py-2 opacity-90 transition hover:opacity-100">
        <Wordmark className="w-36 sm:w-44" />
      </Link>
      <div className="border-t border-navy-700 pt-4 text-xs leading-relaxed text-muted">
        <p>{FOOTER_DISCLAIMER}</p>
        <nav aria-label="Legal" className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/terms" className={legalLink}>
            Terms of Service
          </Link>
          <Link href="/privacy" className={legalLink}>
            Privacy &amp; Security
          </Link>
          <span>{COPYRIGHT}</span>
        </nav>
      </div>
    </footer>
  );
}

/**
 * The "Elevate Together" tagline: the brand kit's supplied artwork (custom lighter
 * Permanent Marker). Night Game shows the supplied yellow file unchanged; Day Game
 * shows the same artwork in brand navy (identical shapes, ink recolored to #000A2D,
 * which the kit allows: no recoloring *outside* brand colors). Kit rules: never
 * retype it in the font, never lock it up with a logo, don't stretch, outline or
 * add effects. No backing panel: it isn't a button.
 */
export function Tagline({ width, eager = false, className = "" }: { width: number; /** near the top of the page: load right away */ eager?: boolean; className?: string }) {
  const height = Math.round((width * taglineArt.height) / taglineArt.width);
  const loading = eager ? "eager" : undefined;
  return (
    <span className={`inline-block ${className}`}>
      <Image src={taglineArt} alt="Elevate Together" width={width} height={height} loading={loading} className="day:hidden" />
      <Image src={taglineNavyArt} alt="Elevate Together" width={width} height={height} loading={loading} className="hidden day:block" />
    </span>
  );
}
