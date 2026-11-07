import Image from "next/image";
import taglineArt from "../../public/brand/elevate-together-yellow.png";
import taglineNavyArt from "../../public/brand/elevate-together-navy.png";
import Link from "next/link";

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

/** Site-wide footer: the type logo in the bottom-right corner of every page. */
export function SiteFooter() {
  return (
    // keep-night: the footer stays navy. At night that's the page color; in Day Game it's a
    // full-width navy strip, so the yellow wordmark still sits on navy (brand kit) without
    // looking like a button.
    <footer className="keep-night mt-10 w-full bg-navy-950">
      <div className="mx-auto flex w-full max-w-5xl justify-end px-4 py-6">
        <Link href="/" aria-label="GGG.Cafe home" className="opacity-90 transition hover:opacity-100">
          <Wordmark className="w-36 sm:w-44" />
        </Link>
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
export function Tagline({ width, className = "" }: { width: number; className?: string }) {
  const height = Math.round((width * taglineArt.height) / taglineArt.width);
  return (
    <span className={`inline-block ${className}`}>
      <Image src={taglineArt} alt="Elevate Together" width={width} height={height} className="day:hidden" />
      <Image src={taglineNavyArt} alt="Elevate Together" width={width} height={height} className="hidden day:block" />
    </span>
  );
}
