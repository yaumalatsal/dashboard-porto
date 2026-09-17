"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/console", label: "Overview" },
  { href: "/console/analytics", label: "Analytics" },
  { href: "/console/traffic", label: "Traffic" },
  { href: "/console/logs", label: "Log" },
  { href: "/console/incidents", label: "Incidents" },
];

export default function ConsoleNav() {
  const pathname = usePathname();

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
