"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Public boards: what the estate is doing. */
const PUBLIC_LINKS = [
  { href: "/console", label: "Overview" },
  { href: "/console/projects", label: "Projects" },
  { href: "/console/reliability", label: "Reliability" },
  { href: "/console/vps", label: "Server" },
  { href: "/console/analytics", label: "Analytics" },
  { href: "/console/traffic", label: "Traffic" },
  { href: "/console/logs", label: "Log" },
  { href: "/console/incidents", label: "Incidents" },
];

/**
 * Shown only once this browser holds the admin cookie. The page itself 404s
 * regardless — this list decides what is advertised, never what is allowed.
 */
const PRIVATE_LINKS = [{ href: "/console/integrate", label: "Integrate" }];

export default function ConsoleNav({ unlocked = false }: { unlocked?: boolean }) {
  const pathname = usePathname();
  const links = unlocked ? [...PUBLIC_LINKS, ...PRIVATE_LINKS] : PUBLIC_LINKS;

  return (
    <nav className="console__nav" aria-label="Console sections">
      {links.map((link, index) => {
        // Only "/console" needs the exact test; the others are leaf routes.
        const isActive =
          link.href === "/console"
            ? pathname === "/console"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
          >
            <span aria-hidden="true">0{index + 1}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
