/**
 * Education and certifications.
 *
 * A server component with no client JavaScript: it is static text, and nothing
 * here needs to animate on the main thread. For a recent graduate this is the
 * block a recruiter checks, so it is given its own place rather than being
 * folded into the experience list where it would read as an afterthought.
 */

import SectionLabel from "@/components/ui/SectionLabel";
import { credentials, education, profile } from "@/data/portfolio";

export default function CredentialsSection() {
  if (education.length === 0 && credentials.length === 0) return null;

  return (
    <div
      id="credentials"
      className="credentials-section"
      tabIndex={-1}
      aria-labelledby="credentials-title"
    >
      <div className="section-shell">
        <SectionLabel number="06" label="Education" />

        <div className="credentials-intro">
          <h2 id="credentials-title">
            I study networks.
            <br />
            <em>I also teach them.</em>
          </h2>
          <p>
            I started with a vocational course in computer networks. Then I took a
            degree in informatics engineering education. For this reason I write
            documentation for each system, and I can teach it.
          </p>
        </div>

        <div className="credentials-grid">
          <section aria-labelledby="education-heading">
            <h3 id="education-heading" className="credentials-heading">
              Education
            </h3>
            <ul className="credentials-list">
              {education.map((entry) => (
                <li key={entry.institution} className="credential">
                  <span className="credential__years">{entry.years}</span>
                  <span className="credential__body">
                    <strong>{entry.institution}</strong>
                    <em>{entry.field}</em>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="credentials-heading-2">
            <h3 id="credentials-heading-2" className="credentials-heading">
              Certificates and awards
            </h3>
            <ul className="credentials-list">
              {credentials.map((entry) => (
                <li key={entry.label} className="credential">
                  <span className="credential__years">{entry.year}</span>
                  <span className="credential__body">
                    <strong>{entry.label}</strong>
                    <em>{entry.detail}</em>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <p className="credentials-note">
          <span aria-hidden="true" />
          {profile.availability} · {profile.location}
        </p>
      </div>
    </div>
  );
}
