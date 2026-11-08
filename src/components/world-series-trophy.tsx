// The GGG World Series Trophy: a hidden award (easter egg) for keeping a clean
// book in the How to Keep the Book game. The art is the user's original trophy
// render with its WORLD SERIES band (the GGG Champions Trophy is the same render,
// re-lettered). Nothing on the site shows or names it until it's earned.
// Works in server and client components.
import Image from "next/image";
import art from "../../public/awards/world-series-trophy.webp";

export function WorldSeriesTrophy({ size = 200, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src={art}
      alt="GGG World Series Trophy"
      title="GGG World Series Trophy"
      width={size}
      height={Math.round((size * art.height) / art.width)}
      className={`shrink-0 drop-shadow-[0_0_22px_rgba(231,251,6,0.3)] ${className}`}
    />
  );
}
