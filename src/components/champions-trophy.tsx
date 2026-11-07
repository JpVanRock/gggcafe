// The GGG Champions Trophy: earned by answering every Extra Credit Library
// question in one run with 80%+. The art is the user's render, cut out of its
// white background; the blurred reflection streak on the base was repainted and
// the bottom gold plinth redrawn crisp, and the band's "WORLD SERIES" re-lettered
// "CHAMPIONS" (public/awards/champions-trophy.webp).
// Works in server and client components.
import Image from "next/image";
import art from "../../public/awards/champions-trophy.webp";

export function ChampionsTrophy({
  earned = true,
  size = 200,
  className = "",
}: {
  earned?: boolean;
  /** width in pixels */
  size?: number;
  className?: string;
}) {
  const label = `GGG Champions Trophy${earned ? "" : ", not earned yet"}`;
  return (
    <Image
      src={art}
      alt={label}
      title={label}
      width={size}
      height={Math.round((size * art.height) / art.width)}
      className={`shrink-0 ${earned ? "drop-shadow-[0_0_18px_rgba(254,31,124,0.28)]" : "opacity-25 grayscale"} ${className}`}
    />
  );
}
