/**
 * ALL PORTFOLIO CONTENT LIVES HERE. Nothing else needs editing to change copy.
 *
 * Written from the CV (Mohammad Dzaki Yaumal Atsal, 2026). The Indonesian
 * source has been carried into English because the rest of the site is English;
 * the facts, employers, dates and scope are unchanged.
 *
 * Images are the one thing left open. Every project points at
 * `/images/projects/placeholder.svg` until a real screenshot replaces it —
 * search `placeholder.svg` to find each slot. Drop a file into
 * `public/images/projects/` and change the path; nothing else needs touching.
 *
 * Remaining gaps are marked `TODO(you)`.
 */

export const profile = {
  name: "Mohammad Dzaki Yaumal Atsal",
  /** Used where the full name is too long — the nav wordmark and the loader. */
  shortName: "Dzaki Yaumal",
  /**
   * The hero name, broken on purpose. Left to wrap, four words at 9rem stack
   * into four lines and swallow the screen; these two lines keep the display
   * type large without it becoming the whole composition.
   */
  nameLines: ["Mohammad Dzaki", "Yaumal Atsal"],
  role: "Web Systems & Network Engineer",
  tagline: "Mapping digital terrain, from interface to infrastructure.",
  email: "mdzakiyaumal18@gmail.com",
  phone: "+62 812 4960 2770",
  location: "Malang, Indonesia",
  availability: "Open to full-time roles and freelance commissions",
  bio: "I build web systems for organisations that need them to work on the first day and keep working after — hospitals, an industrial smelter, a government health agency. I came to software through computer networking, so I tend to design for the whole path: the interface people use, the database behind it, and the network and servers underneath.",
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

const PLACEHOLDER = "/images/projects/placeholder.svg";

export const projects: ProjectData[] = [
  {
    number: "01",
    slug: "performance-data-centre",
    title: "Institutional Performance Data Centre",
    category: "Government Systems / Laravel",
    chapter: "Field Record 01 / The Central Register",
    description:
      "A web-based data centre consolidating performance information across every working area of the Surabaya Health Quarantine Centre.",
    outcome: "Laravel / centralised reporting / government deployment",
    images: [PLACEHOLDER],
    accent: "ember",
    client: "Balai Besar Kekarantinaan Kesehatan Surabaya",
    year: "2025",
    role: "Web developer & network support",
    overview:
      "Performance figures for the agency's working areas lived in separate places and had to be gathered by hand before they could be evaluated. The system replaces that with one register: each area records against the same structure, and the centre reads the result without chasing it.",
    challenge:
      "Reporting was distributed across working areas with no shared shape, so evaluating performance meant reconciling formats before any comparison could begin.",
    solution:
      "A Laravel application with a single data model for performance records, so every area submits against the same fields and evaluation becomes a query rather than an exercise in collation.",
    architecture: [
      "Laravel application with role-based access per working area",
      "Normalised performance schema shared across all areas",
      "Centralised evaluation and reporting views",
      "Deployed alongside new on-site network infrastructure",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "JavaScript", "Bootstrap"],
    metrics: [
      { label: "Scope", value: "Agency-wide" },
      { label: "Year", value: "2025" },
      { label: "Working areas covered", value: "TODO(you)" },
    ],
    observation:
      "Performance data existed, but not in one place and not in one shape.",
    response: "Give every area the same structure to report against.",
    result: "Evaluation became a reading rather than a reconstruction.",
  },
  {
    number: "02",
    slug: "hotwork-permit",
    title: "Hotwork Permit System",
    category: "Industrial Safety / Laravel",
    chapter: "Field Record 02 / The Safety Ledger",
    description:
      "A web permit system for hot work in a smelting plant, replacing paper authorisation for one of the highest-risk activities on site.",
    outcome: "Laravel / safety compliance / live in an industrial plant",
    images: [PLACEHOLDER],
    accent: "copper",
    client: "PT Smelting Gresik",
    year: "2024",
    role: "Web developer (internship)",
    overview:
      "Hot work — welding, cutting, grinding near flammable material — requires a permit before it starts. Handling that on paper makes the current state of authorisation hard to see. The system moves the permit flow onto the web so a request, its approvals and its validity are legible while the work is happening, not afterwards.",
    challenge:
      "Paper permits are slow to route for approval and give no live picture of what is authorised at any moment — which is exactly what a safety control needs to provide.",
    solution:
      "A Laravel permit workflow: request, review, approval, and an active-permit view, so the authorisation state of the plant is something you can look at rather than reconstruct.",
    architecture: [
      "Laravel request-and-approval workflow with defined roles",
      "Permit lifecycle states from request through to expiry",
      "Active-permit view for supervisors",
      "Record retained for post-work safety audit",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "JavaScript"],
    metrics: [
      { label: "Environment", value: "Smelting plant" },
      { label: "Engagement", value: "Internship" },
      { label: "Permits handled", value: "TODO(you)" },
    ],
    observation:
      "A safety control that lives on paper cannot be checked while it matters.",
    response: "Put the permit lifecycle where it can be read in real time.",
    result:
      "Hot work authorisation became visible to the people responsible for it.",
  },
  {
    number: "03",
    slug: "equipment-room-monitoring",
    title: "Equipment & Room Readiness Monitor",
    category: "Healthcare Systems / Laravel",
    chapter: "Field Record 03 / The Ward Index",
    description:
      "A barcode-driven system tracking medical equipment availability and room readiness across a hospital, in real time.",
    outcome: "Laravel / barcode scanning / real-time availability",
    images: [PLACEHOLDER],
    accent: "moss",
    client: "RS Petrokimia (freelance)",
    year: "TODO(you)",
    role: "Freelance developer",
    overview:
      "A hospital needs to know what equipment is free and which rooms are ready before it can place a patient. The system attaches a barcode to each item and room so state changes are recorded by scanning rather than by remembering to update a list.",
    challenge:
      "Availability was only as current as the last manual update, which in practice meant staff verified by walking.",
    solution:
      "Barcode scanning as the input method: the act of using or releasing equipment records itself, so the register stays close to the truth without anyone maintaining it.",
    architecture: [
      "Laravel application with barcode identity per item and room",
      "Scan-driven state changes rather than manual entry",
      "Real-time availability and readiness views",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "Barcode scanning"],
    metrics: [
      { label: "Domain", value: "Hospital operations" },
      { label: "Input method", value: "Barcode" },
      { label: "Items tracked", value: "TODO(you)" },
    ],
    observation:
      "A register only helps if keeping it accurate costs nobody any effort.",
    response: "Make the everyday action — the scan — the thing that updates it.",
    result: "Availability readable without a walk to check.",
  },
  {
    number: "04",
    slug: "field-console",
    title: "Field Console",
    category: "Observability / Platform Engineering",
    chapter: "Field Record 04 / The Signal Observatory",
    description:
      "A monitoring console that polls every application I run in production and keeps the history — uptime, response-time percentiles, and an incident record that survives redeploys.",
    outcome: "Zero runtime dependencies / 90-day history / adapter architecture",
    images: ["/images/projects/field-console.png"],
    accent: "ivory",
    client: "Personal infrastructure",
    year: "2026",
    role: "Design and engineering",
    overview:
      "The operations half of this site. It polls each application on its own cadence, normalises whatever JSON that application returns, and records a sample every thirty seconds — deriving real uptime, latency percentiles and an incident log, kept in SQLite so a redeploy does not reset the record.",
    challenge:
      "Every application reports its health differently. Writing a bespoke integration per service is how monitoring dashboards rot: the tenth app never gets added because it is too much work.",
    solution:
      "An adapter contract between the poller and the UI. The default adapter infers health, services and metrics from the shape of any JSON payload, so a new service is useful the moment its URL is added, with no code written.",
    architecture: [
      "Per-probe cadences so a slow metrics endpoint cannot throttle health checks",
      "Adapter layer normalising arbitrary JSON into one rendering contract",
      "SQLite time-series on Node's built-in node:sqlite — no npm dependency",
      "Incidents derived as samples arrive, so the feed never needs a backfill",
      "Server-rendered: the first paint is already the real data",
    ],
    techStack: ["TypeScript", "Next.js", "React", "SQLite", "Docker", "GitHub Actions"],
    metrics: [
      { label: "Client JavaScript", value: "179 KB gzipped" },
      { label: "Runtime npm dependencies", value: "0" },
      { label: "History retained", value: "90 days" },
    ],
    observation:
      "A monitoring tool that is tedious to extend stops being extended, and then stops being true.",
    response:
      "Make adding an application a line of configuration, and infer the rest.",
    result: "A console that renders an app it has never seen before, correctly.",
  },
  {
    number: "05",
    slug: "online-attendance",
    title: "Online Work Attendance",
    category: "Workforce Systems / Laravel",
    chapter: "Field Record 05 / The Daily Record",
    description:
      "A digital attendance system using barcode identification to record and monitor employee presence.",
    outcome: "Laravel / barcode identity / digital attendance record",
    images: [PLACEHOLDER],
    accent: "ember",
    client: "PT. Panca Pilar Hutama (freelance)",
    year: "TODO(you)",
    role: "Freelance developer",
    overview:
      "Attendance recorded on paper is slow to total and easy to dispute. The system gives each employee a barcode identity, so arrival and departure are captured as scans and the monthly picture is a query rather than a transcription job.",
    challenge:
      "Manual attendance is laborious to compile and hard to audit after the fact.",
    solution:
      "Barcode-based check-in writing straight to the database, with monitoring views over the resulting record.",
    architecture: [
      "Laravel application with per-employee barcode identity",
      "Scan-driven check-in and check-out",
      "Attendance monitoring and reporting views",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "Barcode scanning"],
    metrics: [
      { label: "Input method", value: "Barcode" },
      { label: "Engagement", value: "Freelance" },
      { label: "Employees covered", value: "TODO(you)" },
    ],
    observation: "Paper attendance is only cheap until someone has to total it.",
    response: "Capture it at the door, in a form that can be queried.",
    result: "A record that compiles itself.",
  },
  {
    number: "06",
    slug: "business-incubation-elearning",
    title: "Business Incubation E-Learning",
    category: "Education Technology / Laravel",
    chapter: "Field Record 06 / The Greenhouse",
    description:
      "An e-learning platform built to grow student business ideas through a structured digital incubation process.",
    outcome: "Laravel / incubation pathway / vocational education",
    images: [PLACEHOLDER],
    accent: "moss",
    client: "Academic project",
    year: "TODO(you)",
    role: "Developer",
    overview:
      "Built around incubation rather than around lessons: students bring an idea and the platform carries it through stages, so the structure of the course matches the structure of starting something.",
    challenge:
      "General e-learning platforms organise content, not ventures — they have no notion of an idea maturing through stages.",
    solution:
      "A Laravel platform modelled on the incubation pathway, with the stages themselves as first-class structure.",
    architecture: [
      "Laravel application modelling the incubation stages",
      "Per-student idea progression through the pathway",
      "Learning material bound to the stage it serves",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "JavaScript"],
    metrics: [
      { label: "Domain", value: "Vocational education" },
      { label: "Model", value: "Digital incubation" },
      { label: "Students", value: "TODO(you)" },
    ],
    observation: "A business idea does not progress the way a syllabus does.",
    response: "Model the incubation stages, not the lesson list.",
    result: "A platform shaped like the thing it teaches.",
  },
  {
    number: "07",
    slug: "fiber-optic-game",
    title: "Fiber Optic Educational Game",
    category: "Game Development / Roblox",
    chapter: "Field Record 07 / The Light Path",
    description:
      "A Lua-based Roblox game introducing fiber optic technology through play rather than through a diagram.",
    outcome: "Roblox / Lua / gamified technical education",
    images: [PLACEHOLDER],
    accent: "copper",
    client: "Freelance",
    year: "TODO(you)",
    role: "Game developer",
    overview:
      "Fiber optics is usually taught with cross-sections and refraction diagrams. Building it in Roblox puts the learner inside the medium instead — the concepts are things you do, on a platform its audience already uses daily.",
    challenge:
      "The physical principles behind fiber optics are abstract on a whiteboard and easy to disengage from.",
    solution:
      "An interactive Roblox environment in Lua where the behaviour of light in a fiber is something the player acts on directly.",
    architecture: [
      "Roblox environment scripted in Lua",
      "Interactive demonstrations of fiber optic principles",
      "Gamified progression through the concepts",
    ],
    techStack: ["Roblox Studio", "Lua", "Game design"],
    metrics: [
      { label: "Platform", value: "Roblox" },
      { label: "Language", value: "Lua" },
      { label: "Players reached", value: "TODO(you)" },
    ],
    observation: "A refraction diagram loses the room.",
    response: "Put the learner inside the fiber.",
    result: "A technical concept taught where its audience already spends time.",
  },
];

export const capabilities = [
  {
    number: "I",
    title: "Build",
    description:
      "Web systems end to end — interface, data model, and the workflow the organisation actually runs on.",
    skills: ["Laravel", "PHP", "JavaScript", "HTML / CSS", "MySQL"],
  },
  {
    number: "II",
    title: "Connect",
    description:
      "Network installation, configuration and troubleshooting — the layer I started in and still design around.",
    skills: ["Network Installation", "Troubleshooting", "Configuration", "Network Security"],
  },
  {
    number: "III",
    title: "Operate",
    description:
      "Ship and keep things running: containers, pipelines, monitoring, and the server underneath.",
    skills: ["Docker", "Linux", "CI/CD", "Monitoring", "VPS Administration"],
  },
  {
    number: "IV",
    title: "Communicate",
    description:
      "Teaching, presenting and writing — from workshop sessions to an international conference paper.",
    skills: ["Public Speaking", "Technical Writing", "Collaboration", "English (TOEIC 820)"],
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

export const experiences: ExperienceEntry[] = [
  {
    number: "I",
    title: "Balai Besar Kekarantinaan Kesehatan Surabaya",
    role: "Web Developer & Network Support",
    type: "work",
    year: "2025",
    description:
      "Built a web-based data centre consolidating performance information across the agency's working areas, and supported the installation of new network infrastructure on site.",
  },
  {
    number: "II",
    title: "PT. Smelting Gresik",
    role: "IT & Web Development",
    type: "work",
    year: "2024",
    description:
      "Developed the Hotwork Permit system for work authorisation, maintained IT equipment and installed new hardware, and helped keep the plant's network stable and secure.",
  },
  {
    number: "III",
    title: "CLEAN Research Group — State University of Malang",
    role: "Member",
    type: "community",
    year: "2024 — 2026",
    description:
      "Co-authored three papers in educational technology, covering a Virtual Entrepreneurship Laboratory and objective-based learning websites, plus a Scrum case study on the SISINTA final-project management system.",
  },
  {
    number: "IV",
    title: "Workshop Elektro UM (WSE)",
    role: "Secretary, Products & Services Division",
    type: "organization",
    year: "2022 — 2024",
    description:
      "Ran administration, documentation and coordination for the division. Delivered the IoT Smart Garden session at Workshop at School 2023 and organised the Line Tracer Design Contest and the PESC UM scientific writing competition.",
  },
  {
    number: "V",
    title: "PT. Weiss Tech Sidoarjo",
    role: "IT Support",
    type: "work",
    year: "2018",
    description:
      "Supported the IT team with computer hardware maintenance and the company's network infrastructure.",
  },
];

export type EducationEntry = {
  years: string;
  institution: string;
  field: string;
};

export const education: EducationEntry[] = [
  {
    years: "2021 — 2025",
    institution: "State University of Malang",
    field: "Informatics Engineering Education (Pendidikan Teknik Informatika)",
  },
  {
    years: "2018 — 2021",
    institution: "SMKN 3 Buduran",
    field: "Computer & Network Engineering (Teknik Komputer dan Jaringan)",
  },
];

export type Credential = {
  label: string;
  detail: string;
  year: string;
};

export const credentials: Credential[] = [
  {
    label: "8th ICEEIE 2024",
    detail:
      "Presenter, International Conference on Electrical, Electronics and Information Engineering",
    year: "2024",
  },
  {
    label: "International Trade Competition",
    detail: "Runner-up — Junior Achievement & FedEx",
    year: "2021",
  },
  {
    label: "TOEFL 577",
    detail: "English proficiency · TOEIC 820 (2020)",
    year: "2026",
  },
  {
    label: "Computer & Network Engineering",
    detail: "Competency certification — langit.net",
    year: "—",
  },
];

export const socialLinks = [
  { label: "GitHub", href: "https://github.com/yaumalatsal" },
  // TODO(you): add LinkedIn, or delete this comment if you would rather not.
] as const;
