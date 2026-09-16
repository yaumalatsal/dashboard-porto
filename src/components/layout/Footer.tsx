"use client";

import { ArrowUp, Code2, Mail, Network } from "lucide-react";
import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { profile, socialLinks } from "@/data/portfolio";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap } from "@/lib/gsap-config";

export default function Footer() {
  const footerRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useGSAP(
    () => {
      if (!footerRef.current || prefersReducedMotion) {
        return;
      }

      gsap.timeline({
        scrollTrigger: {
          trigger: footerRef.current,
          start: "top bottom",
          end: "bottom bottom",
          scrub: 0.7,
        },
      })
        .fromTo(".site-footer__seal", { yPercent: 38, scale: 0.84 }, { yPercent: 0, scale: 1, ease: "none" }, 0)
        .fromTo(".site-footer__inner", { y: 70, opacity: 0.35 }, { y: 0, opacity: 1, ease: "none" }, 0.12);
    },
    { scope: footerRef, dependencies: [prefersReducedMotion] },
  );

  return (
    <footer ref={footerRef} className="site-footer">
      <div className="site-footer__instrument" data-instrument-trace aria-hidden="true">
        <span /><span /><span /><i />
      </div>
      <div className="site-footer__seal" aria-hidden="true">Field Office</div>
      <div className="site-footer__inner">
        <div>
          <p className="site-footer__brand">{profile.name}</p>
          <p>{profile.role}</p>
        </div>
        {/* Driven by the data rather than fixed positions: `socialLinks[1]`
            threw the moment the placeholder LinkedIn entry was removed. */}
        <div className="site-footer__links" aria-label="Social links">
          {profile.email && (
            <a href={`mailto:${profile.email}`} aria-label="Email" data-cursor="link">
              <Mail size={17} />
            </a>
          )}
          {socialLinks.map((social) => (
            <a
              key={social.label}
              href={social.href}
              target="_blank"
              rel="noreferrer"
              aria-label={social.label}
              data-cursor="link"
            >
              {social.label === "GitHub" ? <Code2 size={17} /> : <Network size={17} />}
            </a>
          ))}
          <a href="#hero" aria-label="Back to top" data-cursor="link"><ArrowUp size={17} /></a>
        </div>
        <p className="site-footer__copyright">
          {new Date().getFullYear()} / Built and operated in {profile.location}
        </p>
      </div>
    </footer>
  );
}
