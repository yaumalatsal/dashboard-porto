"use client";

import ProjectCard from "@/components/ui/ProjectCard";
import SectionLabel from "@/components/ui/SectionLabel";
import { projects } from "@/data/portfolio";

export default function ProjectsSection() {
  return (
    <div id="work" className="projects-section" tabIndex={-1} aria-labelledby="work-title">
      <div className="section-shell">
        <SectionLabel number="02" label="Field Records" />
        <div className="projects-intro">
          <h2 id="work-title">Four systems,<br />mapped in context.</h2>
          <p>Selected work across interfaces, applications, and infrastructure, each shaped around a real operational terrain.</p>
        </div>
        <div className="projects-list">
          {projects.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
