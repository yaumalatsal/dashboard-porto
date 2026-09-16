"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useLenis } from "lenis/react";
import { useUiStore, type AstrolabeSection } from "@/stores/uiStore";
import { experiences, profile } from "@/data/portfolio";

const allLinks = [
  { section: "about" as AstrolabeSection, href: "#about", label: "Practice" },
  { section: "work" as AstrolabeSection, href: "#work", label: "Field Records" },
  { section: "skills" as AstrolabeSection, href: "#skills", label: "Field Kit" },
  { section: "operations" as AstrolabeSection, href: "#operations", label: "Live Systems" },
  { section: "experience" as AstrolabeSection, href: "#experience", label: "Experience" },
  { section: "contact" as AstrolabeSection, href: "#contact", label: "Contact" },
] as const;

/**
 * The Experience section removes itself while it has no real entries, so the
 * link has to go with it — otherwise the header advertises a destination that
 * does not exist and clicking it does nothing.
 */
const links = allLinks.filter(
  (link) => link.section !== "experience" || experiences.length > 0,
);

export default function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const lenis = useLenis();
  const isMenuOpen = useUiStore((state) => state.isMenuOpen);
  const setMenuOpen = useUiStore((state) => state.setMenuOpen);
  const activeSection = useUiStore((state) => state.activeSection);
  const setActiveSection = useUiStore((state) => state.setActiveSection);
  const setFocusedPoint = useUiStore((state) => state.setFocusedPoint);
  const setHoveredPoint = useUiStore((state) => state.setHoveredPoint);
  const hoveredPoint = useUiStore((state) => state.hoveredPoint);

  useEffect(() => {
    const update = () => setIsScrolled(window.scrollY > 32);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("is-menu-open", isMenuOpen);
    if (isMenuOpen) {
      lenis?.stop();
    } else {
      lenis?.start();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMenuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      root.classList.remove("is-menu-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMenuOpen, lenis, setMenuOpen]);

  /**
   * Scrolls to the section.
   *
   * This used to only swing the instrument and open its overlay, which meant
   * the header did nothing for a reader who just wanted to see the work. Lenis
   * drives the scroll when it is available so the motion matches the rest of
   * the page; `scrollIntoView` is the fallback.
   */
  const navigate = (event: React.MouseEvent<HTMLAnchorElement>, section: AstrolabeSection) => {
    event.preventDefault();
    setMenuOpen(false);
    setHoveredPoint(null);
    setActiveSection(section);
    setFocusedPoint(null);

    if (section === "hero") {
      if (lenis) lenis.scrollTo(0);
      else window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const target = document.getElementById(section);
    if (!target) return;

    if (lenis) lenis.scrollTo(target, { offset: -72 });
    else target.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Each header entry is a star on the instrument. Pointing at one lights its coordinate
  // and swings the sighting rule onto it, so the two navigations read as the same object.
  const preview = (section: AstrolabeSection | null) => () => setHoveredPoint(section);

  return (
    <>
      <nav className={`site-nav${isScrolled ? " site-nav--scrolled" : ""}`} aria-label="Primary navigation">
        <div className="site-nav__inner">
          <a className="site-nav__brand" href="#hero" onClick={(event) => navigate(event, "hero")} data-cursor="link">
            <span className="site-nav__sigil" aria-hidden="true" />
            <span className="site-nav__wordmark">{profile.name} <small>Field Office</small></span>
          </a>

          <div className="site-nav__links">
            {links.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(event) => navigate(event, link.section)}
                onPointerEnter={preview(link.section)}
                onPointerLeave={preview(null)}
                onFocus={preview(link.section)}
                onBlur={preview(null)}
                className={`${activeSection === link.section ? "is-active" : ""}${hoveredPoint === link.section ? " is-previewing" : ""}`.trim()}
                aria-current={activeSection === link.section ? "location" : undefined}
                data-cursor="link"
              >
                <span aria-hidden="true">0{index + 1}</span>{link.label}<i className="site-nav__star" aria-hidden="true" />
              </a>
            ))}
          </div>

          <Link href="/console" className="site-nav__console" data-cursor="link">
            Console <span aria-hidden="true">↗</span>
          </Link>

          <button
            ref={menuButtonRef}
            className="site-nav__menu"
            type="button"
            aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </nav>

      <div id="mobile-navigation" className={`mobile-nav${isMenuOpen ? " is-open" : ""}`} aria-hidden={!isMenuOpen}>
        <div className="mobile-nav__instrument" aria-hidden="true"><span /><span /><i /></div>
        <p className="mobile-nav__eyebrow">Field guide index</p>
        <div className="mobile-nav__links">
          {links.map((link, index) => (
            <a key={link.href} href={link.href} onClick={(event) => navigate(event, link.section)} tabIndex={isMenuOpen ? 0 : -1}>
              <span>0{index + 1}</span>{link.label}
            </a>
          ))}
        </div>
        <Link href="/console" className="mobile-nav__console" tabIndex={isMenuOpen ? 0 : -1}>
          Live Console <span aria-hidden="true">↗</span>
        </Link>
        <p className="mobile-nav__footer">{profile.role} / {profile.location}</p>
      </div>
    </>
  );
}
