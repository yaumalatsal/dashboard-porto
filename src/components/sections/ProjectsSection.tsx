"use client";

import ProjectCard from "@/components/ui/ProjectCard";
import SectionLabel from "@/components/ui/SectionLabel";
import { projects } from "@/data/portfolio";

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

export default function ProjectsSection() {
  return (
    <div id="work" className="projects-section" tabIndex={-1} aria-labelledby="work-title">
      <div className="section-shell">
        <SectionLabel number="02" label="Field Records" />
        <div className="projects-intro">
          <h2 id="work-title">
            {COUNT_WORDS[projects.length] ?? projects.length} systems,<br />mapped in context.
          </h2>
          <p>Work delivered for hospitals, an industrial smelter, a government health agency and private clients — each shaped around a real operational terrain.</p>
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
