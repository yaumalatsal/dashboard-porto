import type { Metadata } from "next";
import Link from "next/link";
import {
  capabilities,
  credentials,
  education,
  experiences,
  isStated,
  profile,
  projects,
  socialLinks,
} from "@/data/portfolio";
import PrintButton from "@/components/ui/PrintButton";
import "./resume.css";

export const metadata: Metadata = {
  title: `Résumé — ${profile.name}`,
  description: `${profile.role}. ${profile.location}.`,
};

/**
 * The résumé, generated from the same data as the rest of the site.
 *
 * The header links to this rather than to a PDF on purpose. A PDF in the
 * repository is a second copy of these facts that goes stale the moment one of
 * them changes, and there was no such file to link to in any case. This page
 * carries a print stylesheet, so "save as PDF" produces the document without
 * anyone having to maintain one.
 */
export default function ResumePage() {
  // Work history only. The site's experience list also carries study and
  // research entries, which belong under education on a résumé.
  const work = experiences.filter((entry) => entry.type === "work");
  const other = experiences.filter((entry) => entry.type !== "work");

  // Projects a reader can check, newest first, with the unknown years last.
  const shown = [...projects].sort((a, b) => {
    const ay = isStated(a.year) ? Number.parseInt(a.year, 10) || 0 : -1;
    const by = isStated(b.year) ? Number.parseInt(b.year, 10) || 0 : -1;
    return by - ay;
  });

  return (
    <div className="resume">
      <div className="resume__bar">
        <Link href="/" className="resume__back" data-cursor="link">
          ← Portfolio
        </Link>
        <PrintButton />
      </div>

      <article className="resume__sheet">
        <header className="resume__head">
          <h1>{profile.name}</h1>
          <p className="resume__role">{profile.role}</p>
          <ul className="resume__contact">
            <li>{profile.location}</li>
            <li>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
            </li>
            <li>
              <a href={`tel:${profile.phone.replace(/\s/g, "")}`}>{profile.phone}</a>
            </li>
            {socialLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href} rel="noreferrer noopener" target="_blank">
                  {link.href.replace(/^https?:\/\//, "")}
                </a>
              </li>
            ))}
          </ul>
          <p className="resume__summary">{profile.bio}</p>
        </header>

        <section className="resume__section">
          <h2>Experience</h2>
          {work.map((entry) => (
            <div key={entry.number} className="resume__entry">
              <div className="resume__entry-head">
                <h3>{entry.role}</h3>
                <span className="resume__years">{entry.year}</span>
              </div>
              <p className="resume__org">{entry.title}</p>
              <p>{entry.description}</p>
            </div>
          ))}
        </section>

        <section className="resume__section">
          <h2>Selected work</h2>
          {shown.map((project) => (
            <div key={project.slug} className="resume__entry">
              <div className="resume__entry-head">
                <h3>{project.title}</h3>
                {isStated(project.year) && (
                  <span className="resume__years">{project.year}</span>
                )}
              </div>
              <p className="resume__org">
                {project.client} · {project.role}
              </p>
              <p>{project.description}</p>
              <p className="resume__stack">{project.techStack.join(" · ")}</p>
            </div>
          ))}
        </section>

        <section className="resume__section">
          <h2>Capabilities</h2>
          <dl className="resume__caps">
            {capabilities.map((capability) => (
              <div key={capability.title}>
                <dt>{capability.title}</dt>
                <dd>{capability.skills.join(" · ")}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="resume__section">
          <h2>Education</h2>
          {education.map((entry) => (
            <div key={entry.institution} className="resume__entry">
              <div className="resume__entry-head">
                <h3>{entry.field}</h3>
                <span className="resume__years">{entry.years}</span>
              </div>
              <p className="resume__org">{entry.institution}</p>
            </div>
          ))}
          {other.map((entry) => (
            <div key={entry.number} className="resume__entry">
              <div className="resume__entry-head">
                <h3>{entry.role}</h3>
                <span className="resume__years">{entry.year}</span>
              </div>
              <p className="resume__org">{entry.title}</p>
              <p>{entry.description}</p>
            </div>
          ))}
        </section>

        <section className="resume__section">
          <h2>Certificates and awards</h2>
          <ul className="resume__list">
            {credentials.map((credential) => (
              <li key={credential.label}>
                <strong>{credential.label}</strong>
                <span>{credential.detail}</span>
                <span className="resume__years">{credential.year}</span>
              </li>
            ))}
          </ul>
        </section>

        <footer className="resume__foot">
          <p>{profile.availability}.</p>
        </footer>
      </article>
    </div>
  );
}
