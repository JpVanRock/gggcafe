"use client";

// A top-menu link that knows when it is the page you're on: it is marked aria-current="page"
// (screen readers say "current page") and shown in the highlight color.
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({
  href,
  section = href,
  exact = false,
  className = "",
  children,
  ...rest
}: {
  href: string;
  /** the part of the site this link stands for, when wider than `href` (Coaches Dugout: "/dugout") */
  section?: string;
  /** current only on this exact page, not below it (a home link) */
  exact?: boolean;
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
  title?: string;
}) {
  const path = usePathname() ?? "";
  const current = path === section || (!exact && path.startsWith(`${section}/`));
  return (
    <Link href={href} aria-current={current ? "page" : undefined} className={`${className} ${current ? "text-highlight" : "text-muted hover:text-highlight"}`} {...rest}>
      {children}
    </Link>
  );
}
