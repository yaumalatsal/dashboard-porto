"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Minus, Plus } from "lucide-react";
import { useId, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { gsap } from "@/lib/gsap-config";
import type { ProjectData } from "@/data/portfolio";

export default function ProjectCard({ project, index }: { project: ProjectData; index: number }) {
  const chapterRef = useRef<HTMLElement>(null);
  const [isRecordOpen, setRecordOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const recordId = useId();

  useGSAP(
    () => {
      if (!chapterRef.current || prefersReducedMotion) {
        return;
      }

      const direction = index % 2 === 0 ? -1 : 1;
      gsap.fromTo(
        "[data-project-copy]",
        { opacity: 0, x: direction * 28 },
        {
          opacity: 1,
          x: 0,
          duration: 0.8,
          stagger: 0.08,
          ease: "power3.out",
          scrollTrigger: { trigger: chapterRef.current, start: "top 78%", once: true },
        },
      );

      gsap.fromTo(
        "[data-project-media]",
        { opacity: 0, x: direction * 50 },
        {
          opacity: 1,
          x: 0,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: chapterRef.current,
            start: "top 85%",
            once: true,
          },
        },
      );

      gsap.fromTo(
        "[data-project-base]",
        { xPercent: direction * -6 },
        {
          xPercent: direction * 6,
          ease: "none",
          scrollTrigger: {
            trigger: chapterRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );

      gsap.fromTo(
        "[data-project-float]",
        { xPercent: direction * -18 },
        {
          xPercent: direction * 18,
          ease: "none",
          scrollTrigger: {
            trigger: chapterRef.current,
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        },
      );
    },
    { scope: chapterRef, dependencies: [index, prefersReducedMotion] },
  );

  return (
    <article
      ref={chapterRef}
      className={`project-chapter project-chapter--${project.accent}${isRecordOpen ? " is-record-open" : ""}`}
      id={`project-${project.slug}`}
    >
      <div className="project-chapter__meta" data-project-copy>
        <p className="project-chapter__folio">Folio {project.number}</p>
        <p className="project-chapter__category">{project.category}</p>
        <span className="project-chapter__rule" aria-hidden="true" />
        <p className="project-chapter__year">{project.year}</p>
        <p className="project-chapter__outcome">{project.outcome}</p>
      </div>

      <div className="project-chapter__body">
        <div className="project-chapter__heading" data-project-copy>
          <p>{project.chapter}</p>
          <h3>{project.title}</h3>
          <p className="project-chapter__description">{project.description}</p>
        </div>

        <div
          className="project-chapter__media"
          data-cursor="project"
          data-cursor-label="Inspect"
          data-project-media
        >
          <span className="project-chapter__depth-frame" aria-hidden="true" />
          
          <div className="project-chapter__gallery">
            <span className="project-chapter__image-base" data-project-base>
              <Image
                src={project.images[0]}
                alt={`Concept artwork for ${project.title}`}
                fill
                sizes="(max-width: 767px) 100vw, 76vw"
              />
            </span>
            
            {project.images[1] && (
              <span className="project-chapter__image-float" data-project-float aria-hidden="true">
                <Image 
                  src={project.images[1]} 
                  alt="" 
                  fill 
                  sizes="(max-width: 767px) 80vw, 40vw" 
                />
              </span>
            )}
          </div>

          <span className="project-chapter__reticle" data-instrument-trace aria-hidden="true">
            <i /><i /><i />
            <b>N</b><b>E</b><b>S</b><b>W</b>
          </span>
          <span className="project-chapter__veil" aria-hidden="true" />
          <span
            className="project-chapter__index"
            data-parallax
            data-parallax-speed={index % 2 === 0 ? "0.12" : "-0.12"}
            aria-hidden="true"
          >
            {project.number}
          </span>
          
          <div className="project-chapter__actions">
            <Link
              href={`/work/${project.slug}`}
              className="project-chapter__cta"
              data-cursor="link"
              data-cursor-label="Read"
            >
              <span>Open Field Record</span> <ArrowUpRight size={16} />
            </Link>
            <button
              type="button"
              className="project-chapter__toggle"
              aria-expanded={isRecordOpen}
              aria-controls={recordId}
              onClick={() => setRecordOpen((isOpen) => !isOpen)}
              data-cursor="link"
              data-cursor-label={isRecordOpen ? "Close" : "Notes"}
            >
              {isRecordOpen ? <Minus aria-hidden="true" size={14} /> : <Plus aria-hidden="true" size={14} />}
              <span>{isRecordOpen ? "Close Notes" : "Field Notes"}</span>
            </button>
          </div>
        </div>

        <div id={recordId} className={`project-record${isRecordOpen ? " is-open" : ""}`} aria-hidden={!isRecordOpen}>
          <div className="project-record__inner">
            <dl>
              {project.metrics.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
            <Link href={`/work/${project.slug}`} className="project-record__contact" data-cursor="link" tabIndex={isRecordOpen ? 0 : -1}>
              Read the Full Field Record <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
