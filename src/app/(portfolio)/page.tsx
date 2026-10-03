import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, Asterisk } from "lucide-react";
import { profile, projects, capabilities, experiences, education, credentials, socialLinks, stated } from "@/data/portfolio";
import PortfolioMotion from "@/components/ui/PortfolioMotion";
import Marks from "@/components/ui/Marks";
import AstrolabeScene from "@/components/ui/AstrolabeScene";
import ScrollSectionTracker from "@/components/ui/ScrollSectionTracker";

import { heroReadout } from "@/lib/monitor/hero";


export const revalidate = 60;

function Chapter({number, label}: {number: string; label: string}) {
  return <p className="obs-label"><span>{number}</span><span className="obs-rule"/>{label}</p>;
}

export default function Home() {
  const featured = projects.filter(p => p.tier === "flagship");
  const archive = projects.filter(p => p.tier === "archive");
  const readout = heroReadout();
  return <PortfolioMotion>
    <ScrollSectionTracker />
    <section id="hero" className="obs-hero" aria-labelledby="obs-title">
      <div className="obs-hero-stage">
        <div className="obs-hero-frame" aria-hidden="true" />
        <div className="obs-hero-copy">
          <p className="obs-label">Web development & networks</p>
          <p className="obs-hero-statement">{profile.tagline}</p>
          <p className="obs-hero-location">{profile.location}</p>
          <span className="obs-status">Available for work</span>
        </div>
        <div className="obs-instrument-scroll">
          <div className="obs-instrument-pointer">
            <div className="obs-astrolabe-panel" aria-label="Interactive astrolabe">
              <AstrolabeScene />
            </div>
          </div>
        </div>
        <div className="obs-hero-marker" aria-hidden="true">✳</div>
        <h1 id="obs-title" className="obs-hero-title"><span>Mohammad Dzaki</span><span>Yaumal Atsal<span className="obs-title-dot">.</span></span></h1>
        <div className="obs-hero-bottom">
          <a href="#work">View projects <ArrowDown size={16}/></a>
          <span>Portfolio / {new Date().getFullYear()}</span>
          <Link href="/resume">View résumé <ArrowUpRight size={16}/></Link>
        </div>
      </div>
    </section>

    <section id="work" className="obs-section obs-work" aria-labelledby="obs-work-title"><Marks items={[{glyph:"spark",x:"91%",y:"5%",size:22,hue:"sky",depth:0.35,spin:true},{glyph:"ruler",x:"60%",y:"3.2%",size:20,hue:"lilac",wide:true},{glyph:"tag",x:"60%",y:"4.6%",hue:"lilac",wide:true,label:<>Index <i>01—04</i></>},{glyph:"bracket",x:"52%",y:"30%",size:28,hue:"rose",depth:-0.25,wide:true},{glyph:"grid",x:"95%",y:"48%",size:22,hue:"mint",depth:0.2},{glyph:"cross",x:"47%",y:"71%",size:16,hue:"butter",depth:0.3,wide:true}]}/>
      <Chapter number="01" label="Selected work"/>
      <div className="obs-section-heading"><h2 id="obs-work-title"><em>Projects</em></h2><p>Some projects I built for work, clients, and education. Each page explains the problem and my part in the project.</p></div>
      <div className="obs-projects">{featured.map((p,i) => <Link className="obs-project" href={`/work/${p.slug}`} key={p.slug}>
        {/* A plate in space: tilt takes the scroll, depth takes the pointer, and
            the slabs behind give it an edge. See the 2.5D notes in observatory.css. */}
        <div className="obs-plate"><div className="obs-plate-tilt"><div className="obs-plate-depth">
          <span className="obs-plate-slab obs-plate-slab--far" aria-hidden="true"/>
          <span className="obs-plate-slab" aria-hidden="true"/>
          <div className="obs-project-image"><div className="obs-project-bar"><span>{p.category}</span><span>{stated(p.year)}</span></div><Image src={p.images[0]} alt={`${p.title} interface`} width={1440} height={900} sizes="(max-width: 700px) 90vw, 65vw"/></div>
          <span className="obs-project-open" aria-hidden="true"><ArrowUpRight size={22}/></span>
        </div></div></div>
        <div className="obs-project-title"><span className="obs-label">0{i+1}</span><h3>{p.title}</h3><ArrowUpRight size={20}/></div><p>{p.description}</p><div className="obs-tags">{p.techStack.slice(0,3).map(t => <span key={t}>{t}</span>)}</div>
      </Link>)}</div>
      <div className="obs-archive"><p className="obs-label">Other projects / {archive.length.toString().padStart(2,'0')}</p>{archive.map(p => <Link href={`/work/${p.slug}`} key={p.slug}><span>{p.title}</span><small>{p.category}</small><ArrowUpRight size={18}/>
        {/* Hover preview: the project's screens as plates receding in depth.
            Decorative — the row already names the project — so hidden from
            assistive tech, and display:none on touch so it never downloads. */}
        <span className="obs-stack" aria-hidden="true">
          {p.images.slice(0, 2).map((src, i) => <span className="obs-stack__plate" style={{"--i": i} as CSSProperties} key={src}><Image src={src} alt="" width={520} height={325} sizes="260px" loading="lazy"/></span>)}
          <span className="obs-stack__plate obs-stack__plate--slab" style={{"--i": 2} as CSSProperties}/>
        </span>
      </Link>)}</div>
    </section>

    <section id="about" className="obs-section obs-about" aria-labelledby="obs-about-title"><Marks items={[{glyph:"orbit",x:"84%",y:"8%",size:30,hue:"butter",depth:0.3},{glyph:"spark",x:"41%",y:"16%",size:14,hue:"rose",depth:-0.2,wide:true},{glyph:"cross",x:"46%",y:"62%",size:16,hue:"sky",depth:0.25,wide:true},{glyph:"tag",x:"52%",y:"91%",hue:"mint",wide:true,label:<>Lat <i>−07.97</i> / Lon <i>112.63</i></>}]}/><Chapter number="02" label="About"/><div className="obs-about-grid"><div><h2 id="obs-about-title">About <em>me</em></h2><div className="obs-about-portrait"><div className="obs-plate obs-plate--portrait"><div className="obs-plate-tilt"><div className="obs-plate-depth"><span className="obs-plate-slab obs-plate-slab--far" aria-hidden="true"/><span className="obs-plate-slab" aria-hidden="true"/><span className="obs-portrait-panel" aria-hidden="true"/><Image className="obs-portrait-figure" src="/images/portrait-cutout.png" alt={profile.name} width={517} height={578} sizes="(max-width: 700px) 85vw, 40vw"/></div></div></div><div className="obs-about-caption"><Asterisk size={38} strokeWidth={.7}/><span>{profile.shortName}<br/>{profile.location}</span></div></div></div><div className="obs-about-copy"><p>{profile.bio}</p><p>{profile.practiceSummary}</p><Link className="obs-text-link" href="/resume">Read my résumé <ArrowUpRight size={16}/></Link></div></div></section>

    <section id="skills" className="obs-section obs-skills obs-paneled" aria-labelledby="obs-skills-title"><span className="obs-panel" aria-hidden="true"/><Marks items={[{glyph:"spark",x:"92%",y:"9%",size:20,hue:"butter",depth:0.3,spin:true},{glyph:"grid",x:"60%",y:"7%",size:24,hue:"sky",wide:true},{glyph:"chevrons",x:"86%",y:"84%",size:18,hue:"mint",depth:-0.2,wide:true},{glyph:"bracket",x:"3.2%",y:"46%",size:20,hue:"rose",depth:0.15,wide:true}]}/><Chapter number="03" label="Skills"/><div className="obs-section-heading"><h2 id="obs-skills-title">Skills & <em>tools</em></h2><p>{profile.practiceLead}</p></div><div className="obs-capabilities">{capabilities.map(c => <article key={c.number}><span className="obs-label">{c.number} /</span><h3>{c.title}<span aria-hidden="true">✧</span></h3><p>{c.description}</p><div className="obs-tags">{c.skills.map(s => <span key={s}>{s}</span>)}</div></article>)}</div></section>

    <section id="operations" className="obs-system-band obs-paneled" aria-label="Live systems"><span className="obs-panel" aria-hidden="true"/><Marks items={[{glyph:"cross",x:"48%",y:"22%",size:14,hue:"mint",wide:true},{glyph:"spark",x:"96%",y:"18%",size:12,hue:"sky"}]}/><div><p className="obs-label">System status</p><h2>Sites I <em>maintain</em></h2><p>{readout ? `${readout.online} of ${readout.total} applications online · ${readout.uptime} uptime` : 'You can check the status of my sites here.'}</p></div><Link href="/console" className="obs-button">View site status <ArrowUpRight size={18}/></Link></section>


    <section id="experience" className="obs-section obs-experience" aria-labelledby="obs-experience-title"><Marks items={[{glyph:"ring",x:"90%",y:"6%",size:30,hue:"lilac",depth:0.3,spin:true},{glyph:"ruler",x:"62%",y:"4%",size:20,hue:"mint",wide:true},{glyph:"spark",x:"55%",y:"20%",size:13,hue:"rose",depth:-0.2,wide:true},{glyph:"cross",x:"95%",y:"74%",size:15,hue:"butter",depth:0.25}]}/><Chapter number="04" label="Work and activities"/><div className="obs-section-heading"><h2 id="obs-experience-title"><em>Experience</em></h2><p>My jobs, research, and community activities. Select an entry to read more.</p></div><div className="obs-experience-list">{experiences.map(e => <details key={e.number}><summary><span className="obs-label">{e.year}</span><span><strong>{e.title}</strong><small>{e.role}</small></span><span className="obs-plus" aria-hidden="true">+</span></summary><p>{e.description}</p></details>)}</div></section>

    <section id="credentials" className="obs-section obs-education" aria-labelledby="obs-education-title"><Marks items={[{glyph:"spark",x:"90%",y:"8%",size:18,hue:"rose",depth:0.3},{glyph:"grid",x:"55%",y:"10%",size:22,hue:"lilac",wide:true},{glyph:"orbit",x:"88%",y:"78%",size:24,hue:"sky",depth:-0.2,wide:true}]}/><Chapter number="05" label="Education and certificates"/><div className="obs-education-grid"><div><h2 id="obs-education-title"><em>Education</em></h2>{education.map(e => <article key={e.institution}><p className="obs-label">{e.years}</p><h3>{e.institution}</h3><p>{e.field}</p></article>)}</div><div className="obs-credentials">{credentials.map(c => <article key={c.label}><span className="obs-label">{c.year}</span><h3>{c.label}</h3><p>{c.detail}</p></article>)}</div></div></section>

    <section id="contact" className="obs-section obs-contact obs-paneled" aria-labelledby="obs-contact-title"><span className="obs-panel" aria-hidden="true"/><Marks items={[{glyph:"spark",x:"72%",y:"16%",size:18,hue:"lilac",depth:0.3,spin:true},{glyph:"cross",x:"62%",y:"58%",size:16,hue:"sky",depth:-0.2,wide:true},{glyph:"bracket",x:"90%",y:"70%",size:22,hue:"rose",wide:true}]}/><Chapter number="06" label="Contact"/><span className="obs-contact-star" aria-hidden="true">✳</span><p className="obs-status">{profile.availability}</p><h2 id="obs-contact-title">Get in <em>touch</em></h2><a className="obs-contact-email" href={`mailto:${profile.email}`}>Send me an email <ArrowUpRight/></a><div className="obs-contact-bottom"><a href={`mailto:${profile.email}`}>{profile.email}</a><div>{socialLinks.map(s => <a key={s.label} href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>)}<Link href="/resume">Résumé ↗</Link></div></div></section>
  </PortfolioMotion>;
}
