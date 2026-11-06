import Image from "next/image";
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
    <footer className="mx-auto flex w-full max-w-5xl justify-end px-4 pt-10 pb-6">
      <Link href="/" aria-label="GGG.Cafe home" className="opacity-90 transition hover:opacity-100">
        <Wordmark className="w-36 sm:w-44" />
      </Link>
    </footer>
  );
}
