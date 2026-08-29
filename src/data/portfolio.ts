export const profile = {
  name: "Aether",
  role: "Creative Developer & IT Architect",
  tagline: "Mapping digital terrain, from interface to infrastructure.",
  email: "hello@aether.dev",
  bio: "I work across the visible and invisible layers of digital products: the interface people use, and the infrastructure that keeps it reliable. Every engagement begins by making the terrain legible.",
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
    slug: "nexus-control",
    title: "Nexus Control",
    category: "Network Operations / Product Design",
    chapter: "Field Record 01 / The Signal Observatory",
    description:
      "A network operations console that turns topology, device health, and predictive alerts into one calm view for multi-site teams.",
    outcome: "100+ endpoints / live topology / predictive alerts",
    images: ["/images/projects/nexus-control.png", "/images/projects/nexus-control-field-guide.png"],
    accent: "ember",
    client: "Enterprise Infrastructure Corp",
    year: "2025",
    role: "Lead Systems & UI Architect",
    overview:
      "Nexus Control is a unified network operations console engineered for high-availability enterprise environments. It merges low-latency SNMP telemetry with a visual topology map, turning chaotic network alerts into actionable operational insights.",
    challenge:
      "Legacy NOC monitoring solutions suffered from high latency, overwhelming alert fatigue, and rigid tabular interfaces that obscured network spatial relationships.",
    solution:
      "We built a real-time event-driven dashboard powered by Node.js web sockets, canvas-based topology visualization, and predictive threshold models that prioritize critical incidents.",
    architecture: [
      "SNMP v3 Polling Engine with automated device discovery",
      "WebSocket event bus pushing state updates in <50ms",
      "Canvas-rendered interactive node map with auto-layout force graph",
      "Time-series database storing metrics with 90-day retention",
    ],
    techStack: ["React", "TypeScript", "Node.js", "MikroTik RouterOS API", "PostgreSQL", "Tailwind CSS"],
    metrics: [
      { label: "Active Monitored Endpoints", value: "120+" },
      { label: "Alert Noise Reduction", value: "64%" },
      { label: "Mean Time to Detect (MTTD)", value: "< 2s" },
    ],
    observation: "Device health, topology, and urgent alerts were fragmented across separate operational views.",
    response: "One spatial model groups signals by location and service impact, then exposes detail only when it matters.",
    result: "A quieter operating picture designed around more than one hundred monitored endpoints.",
  },
  {
    number: "02",
    slug: "chronoscape",
    title: "Chronoscape",
    category: "Immersive Web / Cultural Storytelling",
    chapter: "Field Record 02 / The Garden of Hours",
    description:
      "A WebGL timeline that lets visitors move through an institution's history as a layered landscape of archival moments.",
    outcome: "React Three Fiber / GSAP / procedural motion",
    images: ["/images/projects/chronoscape.png", "/images/projects/chronoscape-field-guide.png"],
    accent: "moss",
    client: "Heritage & Art Foundation",
    year: "2024",
    role: "Creative Developer & 3D Specialist",
    overview:
      "Chronoscape is a web-based interactive museum experience that transforms static historical archives into an exploratory 3D spatial timeline.",
    challenge:
      "Navigating dense historical archives usually feels flat and academic. The objective was to create an emotional, cinematic journey without sacrificing historical fidelity or mobile accessibility.",
    solution:
      "Using React Three Fiber, GSAP ScrollTrigger, and custom GLSL particle shaders, we built a continuous scroll narrative where historical eras transition like scenes in a film.",
    architecture: [
      "Procedural particle universe with milestone camera pathing",
      "Dynamic asset chunking and progressive LOD mesh loading",
      "Synced Lenis smooth scrolling for inertia timeline scrubbing",
    ],
    techStack: ["Next.js", "React Three Fiber", "Three.js", "GSAP", "GLSL Shaders", "Lenis"],
    metrics: [
      { label: "Average Session Duration", value: "4m 12s" },
      { label: "Target Framerate", value: "60 FPS" },
      { label: "Lighthouse Performance", value: "96/100" },
    ],
    observation: "A conventional timeline flattened a rich institutional history into an exhausting sequence of dates.",
    response: "Archival moments become places in a navigable landscape, with motion used to reveal relationships rather than decorate them.",
    result: "A responsive storytelling prototype that keeps chronology clear while rewarding exploration.",
  },
  {
    number: "03",
    slug: "ironclad",
    title: "Ironclad",
    category: "Service Operations / Full-Stack",
    chapter: "Field Record 03 / The Service Ledger",
    description:
      "A role-aware ticketing and change platform that gives support teams a shared record of ownership, response time, and resolution.",
    outcome: "Laravel / React / PostgreSQL / SLA automation",
    images: ["/images/projects/ironclad.png", "/images/projects/ironclad-field-guide.png"],
    accent: "copper",
    client: "Global Logistics Group",
    year: "2024",
    role: "Full-Stack Engineer",
    overview:
      "Ironclad is an audit-compliant change management platform built for ITIL compliance, strict permission boundaries, and automated approval workflows.",
    challenge:
      "Cross-departmental change requests were bogged down in unformatted email threads and missing compliance documentation.",
    solution:
      "A structured ticket engine featuring strict SLA countdown timers, dynamic role permissions, automated PDF audit generation, and real-time activity streams.",
    architecture: [
      "Role-Based Access Control (RBAC) with dynamic permission matrices",
      "Automated SLA tracking background jobs with Redis queue workers",
      "Full audit trail logging for compliance verification",
    ],
    techStack: ["Laravel", "React", "PostgreSQL", "Redis", "Tailwind CSS", "Docker"],
    metrics: [
      { label: "Change Approval Cycle Time", value: "-45%" },
      { label: "Compliance Audit Pass Rate", value: "100%" },
      { label: "Monthly Processed Requests", value: "3,500+" },
    ],
    observation: "Requests changed hands without a clear shared record of ownership, priority, or service-level risk.",
    response: "Role-aware workflows, visible timers, and an event history turn every request into an accountable operational record.",
    result: "A full-stack service model designed to reduce ambiguity from intake through resolution.",
  },
  {
    number: "04",
    slug: "embervault",
    title: "Embervault",
    category: "Design Systems / Developer Experience",
    chapter: "Field Record 04 / The Pattern Archive",
    description:
      "A token-led design system that documents reusable interface patterns and keeps teams aligned from design through production.",
    outcome: "Design tokens / documentation / visual regression",
    images: ["/images/projects/embervault.png", "/images/projects/embervault-field-guide.png"],
    accent: "ivory",
    client: "Aether Open Source Community",
    year: "2025",
    role: "Design System Architect",
    overview:
      "Embervault bridges design and engineering through unified JSON token pipelines, accessible UI primitives, and automated visual regression testing.",
    challenge:
      "Inconsistent UI components across multi-repo codebases caused visual drift, duplicated CSS, and extended QA cycles.",
    solution:
      "We engineered a single-source-of-truth token architecture exporting automatically to Tailwind CSS, CSS Custom Properties, and React component packages.",
    architecture: [
      "Style Dictionary token compilation workflow",
      "Headless accessible component primitives with WAI-ARIA compliance",
      "Automated Storybook visual regression testing in CI/CD pipeline",
    ],
    techStack: ["TypeScript", "Tailwind CSS", "Storybook", "Playwright", "Style Dictionary"],
    metrics: [
      { label: "UI Component Reusability", value: "92%" },
      { label: "Design Token Compilation Speed", value: "< 400ms" },
      { label: "Accessibility Coverage", value: "100% WCAG AA" },
    ],
    observation: "Repeated interface decisions drifted between design files, product code, and documentation.",
    response: "A shared token architecture connects visual foundations, accessible components, usage guidance, and release checks.",
    result: "A maintainable pattern library designed to make quality repeatable across teams.",
  },
];

export const capabilities = [
  {
    number: "I",
    title: "Direct",
    description: "Shape product structure, visual language, interaction, and motion around the job to be done.",
    skills: ["UI/UX", "Art Direction", "Motion Design", "3D Web", "Prototyping"],
  },
  {
    number: "II",
    title: "Build",
    description: "Create fast, accessible interfaces and applications with maintainable foundations.",
    skills: ["Next.js", "React", "TypeScript", "Three.js", "Laravel", "Node.js"],
  },
  {
    number: "III",
    title: "Connect",
    description: "Design network architecture for visibility, resilience, and practical day-to-day operations.",
    skills: ["RouterOS", "SNMP", "Network Architecture", "VPN", "Firewall"],
  },
  {
    number: "IV",
    title: "Operate",
    description: "Ship, monitor, and maintain production systems that remain understandable after launch.",
    skills: ["Docker", "Linux", "CI/CD", "PostgreSQL", "Monitoring", "NAS"],
  },
] as const;

export type ExperienceEntry = {
  number: string;
  title: string;
  role: string;
  type: "organization" | "event" | "conference" | "community";
  year: string;
  description: string;
};

export const experiences: ExperienceEntry[] = [
  {
    number: "I",
    title: "Google Developer Group",
    role: "Core Team Member",
    type: "community",
    year: "2024 — Present",
    description: "Organising workshops, study jams, and developer meetups for the local tech community.",
  },
  {
    number: "II",
    title: "JSConf Asia",
    role: "Speaker & Attendee",
    type: "conference",
    year: "2024",
    description: "Presented on real-time WebGL data visualisation for network operations dashboards.",
  },
  {
    number: "III",
    title: "Hacktoberfest Jakarta",
    role: "Mentor & Organiser",
    type: "event",
    year: "2023 — 2024",
    description: "Guided first-time open-source contributors through their initial pull requests and code reviews.",
  },
  {
    number: "IV",
    title: "AIESEC",
    role: "VP Technology",
    type: "organization",
    year: "2022 — 2023",
    description: "Led the digital transformation of local chapter operations, migrating legacy systems to modern cloud infrastructure.",
  },
  {
    number: "V",
    title: "WordCamp Jakarta",
    role: "Volunteer & Speaker",
    type: "conference",
    year: "2023",
    description: "Spoke on headless WordPress architectures with Next.js and contributed to event logistics.",
  },
  {
    number: "VI",
    title: "Code for Indonesia",
    role: "Civic Tech Contributor",
    type: "community",
    year: "2023 — Present",
    description: "Building open-source tools for public data transparency and civic engagement platforms.",
  },
] as const;

export const socialLinks = [
  { label: "GitHub", href: "https://github.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
  { label: "X", href: "https://x.com" },
] as const;
