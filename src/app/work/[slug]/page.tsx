import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Cpu, ShieldCheck } from "lucide-react";
import SectionLabel from "@/components/ui/SectionLabel";
import { projects } from "@/data/portfolio";

export async function generateStaticParams() {
  return projects.map((project) => ({
    slug: project.slug,
  }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);
  if (!project) return { title: "Project Not Found" };

  return {
    title: `${project.title} - Field Record | Aether`,
    description: project.description,
  };
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = projects.find((p) => p.slug === slug);

  if (!project) {
    notFound();
  }

  const currentIndex = projects.findIndex((p) => p.slug === slug);
  const nextProject = projects[(currentIndex + 1) % projects.length];

  return (
    <article className="case-study-page" aria-labelledby="case-study-title">
      {/* Hero Header */}
      <header className="case-study-hero">
        <div className="case-study-astrolabe" data-instrument-trace aria-hidden="true">
          <span /><span /><span /><i /><b>{project.number}</b>
        </div>
        <div className="section-shell">
          <Link href="/#work" className="case-study-back-link" data-cursor="link">
            <ArrowLeft size={16} /> Back to field records
          </Link>

          <SectionLabel number={project.number} label={`Folio / ${project.category}`} />

          <h1 id="case-study-title" className="case-study-title">
            {project.title}
          </h1>
          <p className="case-study-subtitle">{project.chapter}</p>

          <div className="case-study-meta-grid">
            <div>
              <span className="case-study-meta-label">Client</span>
              <span className="case-study-meta-value">{project.client}</span>
            </div>
            <div>
              <span className="case-study-meta-label">Year</span>
              <span className="case-study-meta-value">{project.year}</span>
            </div>
            <div>
              <span className="case-study-meta-label">Role</span>
              <span className="case-study-meta-value">{project.role}</span>
            </div>
            <div>
              <span className="case-study-meta-label">Category</span>
              <span className="case-study-meta-value">{project.category}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Featured Banner */}
      <div className="case-study-banner">
        <div className="section-shell">
          <div className="case-study-image-container" data-instrument-tilt>
            <Image
              src={project.images[0]}
              alt={`Case study hero for ${project.title}`}
              fill
              priority
              sizes="90vw"
            />
            <span className="case-study-image-reticle" data-instrument-trace aria-hidden="true"><i /><i /><i /></span>
          </div>
        </div>
      </div>

      {/* Overview & Metrics Section */}
      <section className="case-study-body">
        <div className="section-shell">
          <div className="case-study-content-grid">
            <div className="case-study-main">
              <h2>Brief</h2>
              <p className="lead-text">{project.overview}</p>

              <h2>Observation</h2>
              <p>{project.challenge}</p>

              <h2>Response</h2>
              <p>{project.solution}</p>

              <h2>System Notes</h2>
              <ul className="architecture-list">
                {project.architecture.map((item, idx) => (
                  <li key={idx}>
                    <CheckCircle2 size={18} className="text-amber" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="case-study-sidebar">
              <div className="sidebar-card">
                <h3><Cpu size={18} /> Outcome Markers</h3>
                <div className="metrics-list">
                  {project.metrics.map((m) => (
                    <div key={m.label} className="metric-item" data-instrument-trace>
                      <span className="metric-value">{m.value}</span>
                      <span className="metric-label">{m.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="sidebar-card">
                <h3><ShieldCheck size={18} /> Tech Stack</h3>
                <div className="tags-flex">
                  {project.techStack.map((tech) => (
                    <span key={tech} className="tech-tag">{tech}</span>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Next Project Footer Link */}
      <footer className="case-study-next-footer">
        <div className="case-study-next-instrument" data-instrument-trace aria-hidden="true"><span /><span /><i /></div>
        <div className="section-shell">
          <div className="next-project-card">
            <div>
              <span className="next-label">Next Field Record</span>
              <h3 className="next-title">{nextProject.title}</h3>
              <p className="next-desc">{nextProject.description}</p>
            </div>
            <Link
              href={`/work/${nextProject.slug}`}
              className="next-button"
              data-cursor="link"
              data-cursor-label="Next"
            >
              <span>Open Folio {nextProject.number}</span>
              <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
      </footer>
    </article>
  );
}
