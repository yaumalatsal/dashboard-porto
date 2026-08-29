"use client";

import { ArrowUpRight } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import { profile, socialLinks } from "@/data/portfolio";
import { useMagnetic } from "@/hooks/useMagnetic";

export default function ContactSection() {
  const {
    ref: magneticRef,
    onPointerMove: handlePointerMove,
    onPointerLeave: handlePointerLeave,
  } = useMagnetic<HTMLAnchorElement>(0.08);

  return (
    <div className="contact-section" tabIndex={-1} aria-labelledby="contact-title">
      <div className="contact-instrument" aria-hidden="true">
        <span />
        <span />
        <span />
        <i />
      </div>
      <div className="section-shell">
        <SectionLabel number="05" label="Correspondence" light />
        <div className="contact-grid">
          <div>
            <p className="contact-section__eyebrow">Accepting selected commissions</p>
            <h2 id="contact-title">Bring me the<br /><em>difficult map.</em></h2>
          </div>
          <div className="contact-copy">
            <p>For immersive web experiences, internal platforms, network architecture, or work that spans all three.</p>
            <a
              ref={magneticRef}
              onPointerMove={handlePointerMove}
              onPointerLeave={handlePointerLeave}
              href={`mailto:${profile.email}`}
              className="contact-email"
              data-cursor="link"
              data-cursor-label="Send"
            >
              <span>{profile.email}</span><ArrowUpRight aria-hidden="true" />
            </a>
            <div className="contact-socials">
              {socialLinks.map((social) => (
                <a key={social.label} href={social.href} target="_blank" rel="noreferrer" data-cursor="link">{social.label}</a>
              ))}
            </div>
          </div>
        </div>
        <div className="contact-note"><span />Based in Jakarta / collaborating worldwide</div>
      </div>
    </div>
  );
}
