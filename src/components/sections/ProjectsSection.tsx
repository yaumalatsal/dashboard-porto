"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ProjectCard from "@/components/ui/ProjectCard";
import SectionLabel from "@/components/ui/SectionLabel";
import { projects, stated } from "@/data/portfolio";

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/**
 * Four projects get a chapter. The rest get a line.
 *
 * Every project used to get the same full-bleed treatment, which put roughly
 * half the height of the homepage into this one section and told a reader
 * nothing about which work to look at first. The archive entries keep their
 * case studies; they just stop competing with the work that carries the page.
 */
export default function ProjectsSection() {
  const flagship = projects.filter((project) => project.tier === "flagship");
  // Counted, not written. A literal here would be wrong the first time a
  // project changes tier, and a wrong number on a page about honesty is worse
  // than no number.
  const archive = projects.filter((project) => project.tier === "archive");

  return (
    <div id="work" className="projects-section" tabIndex={-1} aria-labelledby="work-title">
      <div className="section-shell">
        <SectionLabel number="02" label="Projects" />
        <div className="projects-intro">
          <h2 id="work-title">
            {COUNT_WORDS[projects.length] ?? projects.length} systems.<br />
            <em>{COUNT_WORDS[flagship.length] ?? flagship.length} with a full record.</em>
          </h2>
          <p>I built these for an industrial smelter, a government health agency, a logistics firm and private clients. Each one addresses a single operational problem. Each card states whether the system is reachable from here, and the console measures the ones that are.</p>
        </div>

        <div className="projects-list">
          {flagship.map((project, index) => (
            <ProjectCard key={project.slug} project={project} index={index} />
          ))}
        </div>

        {archive.length > 0 && (
          <section className="archive" aria-labelledby="archive-title">
            <div className="archive__head">
              <h3 id="archive-title">Also built</h3>
              <p>
                Smaller systems and teaching work. Each one has its own record.
              </p>
            </div>

            <ul className="archive__list">
              {archive.map((project) => (
                <li key={project.slug}>
                  <Link href={`/work/${project.slug}`} className="archive__item" data-cursor="link">
                    <span className="archive__title">{project.title}</span>
                    <span className="archive__meta">
                      {project.category}
                      {stated(project.year) ? ` · ${stated(project.year)}` : ""}
                    </span>
                    <span className="archive__stack">{project.techStack.slice(0, 3).join(" · ")}</span>
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
