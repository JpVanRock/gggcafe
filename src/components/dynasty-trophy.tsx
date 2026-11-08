// The GGG Dynasty Trophy: the second hidden award (easter egg), for clean books in
// all ten How to Keep the Book games. Same trophy render as the GGG Champions
// Trophy (the user's choice), with its own name and a pink glow. Nothing on the
// site shows or names it until it's earned. Rename it here (the database key is
// 'all-ten', so a new name needs no migration). Works in server and client components.
import Image from "next/image";
import art from "../../public/awards/champions-trophy.webp";

export const DYNASTY_TROPHY = "GGG Dynasty Trophy";

export function DynastyTrophy({ size = 200, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src={art}
      alt={DYNASTY_TROPHY}
      title={DYNASTY_TROPHY}
      width={size}
      height={Math.round((size * art.height) / art.width)}
      className={`shrink-0 drop-shadow-[0_0_26px_rgba(254,31,124,0.55)] ${className}`}
    />
  );
}
