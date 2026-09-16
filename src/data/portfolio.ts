/**
 * ALL PORTFOLIO CONTENT LIVES HERE. Nothing else needs editing to change copy.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * READ THIS FIRST
 *
 * This file was drafted from what could be evidenced during the build: your
 * GitHub handle, the LMS answering at yourday.duckdns.org, the monitoring
 * console and this site, and the MikroTik/VPS work visible in the repo. Every
 * line that is an inference rather than a fact carries a `TODO(you)` marker.
 *
 * The `experiences` array is the important one: its previous contents (GDG,
 * JSConf Asia, Hacktoberfest, AIESEC, WordCamp, Code for Indonesia) were
 * template fiction. Invented history on a page aimed at employers is the one
 * kind of wrong that costs you an interview, so it has been emptied rather than
 * re-imagined. Fill it in or the section hides itself.
 *
 * Search `TODO(you)` to find everything that still needs you.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const profile = {
  // TODO(you): Derived from your GitHub handle `yaumalatsal`. Set the form you
  // actually want on a CV — full name, or a studio name if you prefer one.
  name: "Yauma Latsal",

  // Leads with both halves deliberately: building the product and running the
  // infrastructure is an unusual pair, and it is the thing worth hiring for.
  role: "Full-Stack Developer & Infrastructure Engineer",
  tagline: "Mapping digital terrain, from interface to infrastructure.",

  // TODO(you): Intentionally left blank. Your personal address was not written
  // here for you — decide whether to publish it or use a forwarding alias.
  // The contact section falls back to the GitHub link while this is empty.
  email: "",

  // TODO(you): Confirm. Adjust if you are open to relocation or remote-only,
  // recruiters filter on this.
  location: "Indonesia",

  bio: "I work across the two layers most teams keep separate: the interface people use, and the infrastructure that keeps it answering. I build web applications end to end, then run them myself on hardware I maintain — which means the systems I ship are designed to be operated, not just demoed.",
} as const;

export type ProjectData = {
  number: string;
  slug: string;
  title: string;
  category: string;
  chapter: string;
  description: string;
  outcome: string;
  images: string[];
  accent: "ember" | "moss" | "copper" | "ivory";
  client: string;
  year: string;
  role: string;
  overview: string;
  challenge: string;
  solution: string;
  architecture: string[];
  techStack: string[];
  metrics: { label: string; value: string }[];
  observation: string;
  response: string;
  result: string;
};

export const projects: ProjectData[] = [
  {
    number: "01",
    slug: "yourday-lms",
    title: "YourDay LMS",
    category: "Learning Platform / Full-Stack",
    chapter: "Field Record 01 / The Teaching Machine",
    description:
      "A self-hosted learning management system running in production on infrastructure I build and operate myself.",
    // TODO(you): Replace with real numbers — active users, courses, uptime.
    // Concrete figures are what a recruiter actually reads.
    outcome: "Self-hosted / Dockerised / monitored in production",
    // TODO(you): Swap for a real screenshot of the LMS. The second image is
    // decorative field-guide artwork and can stay.
    images: [
      "/images/projects/ironclad.png",
      "/images/projects/ironclad-field-guide.png",
    ],
    accent: "ember",
    client: "TODO(you): personal project, client work, or employer?",
    year: "TODO(you)",
    role: "Sole developer and operator",
    overview:
      "YourDay is a learning management system serving courses, lessons and submissions. It runs continuously on a VPS I administer, behind Docker and a reverse proxy, and exposes its own health and metrics endpoints so its condition can be read from outside without opening a shell.",
    challenge:
      "TODO(you): What made this hard? The honest constraint — limited hardware, a specific institution's workflow, doing it alone — is more persuasive than a generic statement.",
    solution:
      "The application exposes /api/health, /api/monitor/services and /api/monitor/metrics, so its database, cache and queue state are observable as structured data rather than log-diving. That instrumentation is what made the console in Field Record 02 possible.",
    architecture: [
      "Dockerised application and services, orchestrated with docker compose",
      "Health, service and metrics endpoints designed for external monitoring",
      "Token-authenticated monitoring API, secrets held outside the config files",
      "Self-hosted on a VPS with reverse proxy and TLS termination",
    ],
    // TODO(you): Correct this list — it is inferred from the monitoring shape,
    // not from reading the LMS source.
    techStack: ["Docker", "Node.js", "PostgreSQL", "nginx", "Linux"],
    metrics: [
      { label: "Deployment", value: "Self-hosted" },
      { label: "Monitoring", value: "Health + metrics API" },
      { label: "Users", value: "TODO(you)" },
    ],
    observation:
      "An application you cannot see into is an application you cannot run with confidence.",
    response:
      "Instrument it from the inside, and expose that state over an authenticated API.",
    result:
      "A production system whose health is a question with an answer, not a guess.",
  },
  {
    number: "02",
    slug: "field-console",
    title: "Field Console",
    category: "Observability / Platform Engineering",
    chapter: "Field Record 02 / The Signal Observatory",
    description:
      "A monitoring console that polls every application I run in production and keeps the history — uptime, response-time percentiles and an incident record that survives redeploys.",
    outcome: "Zero runtime dependencies / 90-day history / adapter architecture",
    images: [
      "/images/projects/field-console.png",
      "/images/projects/nexus-control-field-guide.png",
    ],
    accent: "copper",
    client: "Personal infrastructure",
    year: "2026",
    role: "Design and engineering",
    overview:
      "The console is the operations half of this site. It polls each application on its own cadence, normalises whatever JSON that application happens to return, and records a sample every thirty seconds. From those samples it derives real uptime percentages, nearest-rank latency percentiles and an incident log — all of it kept in SQLite so a redeploy does not reset the record.",
    challenge:
      "Every application reports its health differently. Writing a bespoke integration per service is how monitoring dashboards rot: the tenth app never gets added because it is too much work.",
    solution:
      "An adapter contract sits between the poller and the UI. The default adapter infers health, services and metrics from the shape of any JSON payload — naming conventions decide whether a number renders as milliseconds, bytes or a percentage — so a new service is useful the moment its URL is added, with no code written.",
    architecture: [
      "Per-probe polling cadences so a slow metrics endpoint cannot throttle health checks",
      "Adapter layer normalising arbitrary JSON into one rendering contract",
      "SQLite time-series via Node's built-in node:sqlite — no npm dependency",
      "Incidents derived as samples arrive, so the feed never needs a backfill",
      "Server-rendered pages: the first paint is already the real data",
    ],
    techStack: [
      "TypeScript",
      "Next.js",
      "React Server Components",
      "SQLite",
      "Docker",
      "GitHub Actions",
    ],
    metrics: [
      { label: "Client JavaScript", value: "178 KB gzipped" },
      { label: "Runtime npm dependencies", value: "0" },
      { label: "History retained", value: "90 days" },
    ],
    observation:
      "A monitoring tool that is tedious to extend stops being extended, and then stops being true.",
    response:
      "Make adding an application a line of configuration, and infer the rest from the payload.",
    result:
      "A console that renders an app it has never seen before, correctly, on first poll.",
  },
  {
    number: "03",
    slug: "astrolabe-field-office",
    title: "Astrolabe Field Office",
    category: "Interactive Web / WebGL",
    chapter: "Field Record 03 / The Instrument",
    description:
      "This site. A working brass astrolabe rendered in WebGL, where each chapter of the practice sits on the star map as a coordinate you can steer to.",
    outcome: "React Three Fiber / GSAP / no WebGL cost off the homepage",
    images: [
      "/images/projects/astrolabe.png",
      "/images/projects/chronoscape-field-guide.png",
    ],
    accent: "moss",
    client: "Self-directed",
    year: "2026",
    role: "Design and engineering",
    overview:
      "A portfolio built around a single object: a gilt orrery you can drag, spin and zoom, with the constellation Aries as its index. It is deliberately one idea carried all the way through — the typography, the coordinate readouts and the navigation are all the same instrument.",
    challenge:
      "An expressive 3D interface usually means a heavy site. The whole WebGL stack was originally loading on every route, including pages that never render it.",
    solution:
      "The instrument is dynamically imported and the page is split into route groups, so the operations console shares the design language while loading none of three.js, GSAP or the smooth-scroll runtime. The starfield pauses when the tab is hidden and paints once under reduced motion instead of running a 60fps loop forever.",
    architecture: [
      "Route groups isolating the WebGL stack from the rest of the application",
      "Dynamically imported 3D scene, absent from the shared chunk",
      "Canvas starfield scaled to screen area, paused on visibilitychange",
      "Reduced-motion path that stops the animation loop rather than muting it",
    ],
    techStack: [
      "Next.js",
      "React",
      "TypeScript",
      "three.js",
      "React Three Fiber",
      "GSAP",
    ],
    metrics: [
      { label: "WebGL chunks off the homepage", value: "0" },
      { label: "Console page weight", value: "178 KB gz" },
      { label: "Reduced-motion frame cost", value: "single paint" },
    ],
    observation:
      "Interfaces with a point of view are usually paid for in load time.",
    response:
      "Scope the expensive parts to the one screen that needs them.",
    result:
      "An interactive instrument on the front page and a fast, quiet console behind it.",
  },
  {
    number: "04",
    slug: "network-operations",
    title: "Network Operations",
    category: "Network Engineering / Infrastructure",
    chapter: "Field Record 04 / The Wire",
    // TODO(you): This entry is the thinnest. It is evidenced only by MikroTik
    // RouterOS configuration work visible in your notes. Write it properly or
    // delete the entry — a vague fourth project is worse than three solid ones.
    description:
      "TODO(you): Network design and operations on MikroTik RouterOS — routing, firewalling and throughput tuning for live sites.",
    outcome: "TODO(you): scale — how many sites, endpoints, or users?",
    images: [
      "/images/projects/nexus-control.png",
      "/images/projects/nexus-control-field-guide.png",
    ],
    accent: "ivory",
    client: "TODO(you)",
    year: "TODO(you)",
    role: "TODO(you): Network engineer?",
    overview:
      "TODO(you): What networks do you run, and for whom? Even one concrete deployment — a site, a depot, a campus — is worth more than an abstract description.",
    challenge: "TODO(you)",
    solution: "TODO(you)",
    architecture: [
      "TODO(you): e.g. RouterOS firewall and NAT policy",
      "TODO(you): e.g. VPN between sites",
      "TODO(you): e.g. FastTrack / queue tuning for throughput",
    ],
    techStack: ["MikroTik RouterOS", "Networking", "VPN", "Firewall", "Linux"],
    metrics: [
      { label: "Sites", value: "TODO(you)" },
      { label: "Endpoints", value: "TODO(you)" },
      { label: "Uptime", value: "TODO(you)" },
    ],
    observation: "TODO(you)",
    response: "TODO(you)",
    result: "TODO(you)",
  },
];

export const capabilities = [
  {
    number: "I",
    title: "Build",
    description:
      "Web applications end to end — interface, data layer, and the API surface between them.",
    skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL"],
  },
  {
    number: "II",
    title: "Direct",
    description:
      "Interface, motion and 3D work where the product needs a point of view rather than a template.",
    skills: ["UI/UX", "Three.js", "WebGL", "GSAP", "Art Direction"],
  },
  {
    number: "III",
    title: "Operate",
    description:
      "Ship and run production systems: containers, pipelines, monitoring, and the machine underneath.",
    skills: ["Docker", "Linux", "CI/CD", "nginx", "Monitoring", "SQLite"],
  },
  {
    number: "IV",
    title: "Connect",
    description:
      "Network architecture for sites that have to stay reachable — routing, filtering, and throughput.",
    skills: ["MikroTik RouterOS", "Firewall", "VPN", "VPS Administration"],
  },
] as const;

export type ExperienceEntry = {
  number: string;
  title: string;
  role: string;
  type: "organization" | "event" | "conference" | "community" | "work";
  year: string;
  description: string;
};

/**
 * TODO(you): EMPTY ON PURPOSE — this is the section recruiters read closest.
 *
 * What was here before was template fiction. Rather than invent a plausible
 * history for you, it has been cleared: the Experience section removes itself
 * while this array is empty, which is honest and looks deliberate. A page with
 * no experience block reads as a developer who leads with work; a page with
 * fabricated conference talks reads as a liability the moment anyone checks.
 *
 * Add real entries — jobs, freelance engagements, education, communities:
 *
 *   { number: "I", title: "Company or organisation", role: "Your title",
 *     type: "work", year: "2024 — Present",
 *     description: "What you were responsible for and what changed because of you." }
 */
export const experiences: ExperienceEntry[] = [];

export const socialLinks = [
  // Verified — this is your account.
  { label: "GitHub", href: "https://github.com/yaumalatsal" },
  // TODO(you): Add your real profiles, or delete the entries you do not use.
  // Placeholder links to a site's homepage read worse than no link at all.
  // { label: "LinkedIn", href: "https://linkedin.com/in/…" },
  // { label: "Email", href: "mailto:…" },
] as const;
