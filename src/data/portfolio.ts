/**
 * ALL PORTFOLIO CONTENT. Change the copy here. Do not change it elsewhere.
 *
 * ── WRITING RULE: ASD-STE100 (Simplified Technical English) ────────────────
 *
 * Keep to these rules when you change any text in this file:
 *
 *   1. Use the simple tenses only. Write "I build", not "I have been
 *      building". Do not use the perfect or the continuous tense.
 *   2. Use the active voice. Write "I built the system", not "the system was
 *      built".
 *   3. Write short sentences. Use a maximum of 20 words in one sentence.
 *   4. Write short paragraphs. Use a maximum of 6 sentences in one paragraph.
 *   5. Use one word for one meaning. Do not change the word for the same idea.
 *   6. Keep the articles. Write "the system", not "system".
 *   7. Do not use a verb with "-ing" as a noun or an adjective.
 *   8. Do not use more than three nouns together.
 *   9. Use simple words. Write "use", not "utilise". Write "help", not
 *      "facilitate". Write "about", not "approximately".
 *  10. Do not use metaphors, idioms or jargon.
 *
 * ── SOURCES ───────────────────────────────────────────────────────────────
 *
 * The facts come from the CV (2026) and from an examination of the code in
 * these repositories: afu-studio, HRMS, IT-inventory, hotwork-permit and
 * mikrotik-automation.
 *
 * Images are open. Each project shows `/images/projects/placeholder.svg`.
 * Put a file in `public/images/projects/`. Then change the path here.
 *
 * `TODO(you)` marks a fact that no source gives.
 */

export const profile = {
  name: "Mohammad Dzaki Yaumal Atsal",
  /** For the small spaces: the navigation bar and the loader. */
  shortName: "Dzaki Yaumal",
  /** Two lines on purpose. Four words on one line are too wide for the column. */
  nameLines: ["Mohammad Dzaki", "Yaumal Atsal"],
  role: "Web Systems and Network Engineer",
  tagline: "I build web systems. I also operate the networks below them.",
  email: "mdzakiyaumal18@gmail.com",
  phone: "+62 812 4960 2770",
  location: "Malang, Indonesia",
  availability: "I am open to a full-time role and to freelance work",
  heroSummary:
    "I design the full path: the interface, the data, the deployment, the server, and the network that connects them.",
  bio: "I build web systems for organisations that depend on them. My clients include an industrial smelter, a government health agency and a logistics enterprise. I started in computer networks, so I design the full path. I write the interface, the database behind it, and I run the server below both.",
  practiceLead:
    "I work across three linked layers. I design the experience, the software rules, and the infrastructure that keeps both available.",
  practiceSummary:
    "I start with the real workflow and its constraints. I then build the smallest system that can run reliably.",
} as const;

export const practiceSteps = [
  {
    number: "01",
    name: "Map",
    detail: "Users, rules, data, and constraints.",
  },
  {
    number: "02",
    name: "Build",
    detail: "The interface, application, and integrations.",
  },
  {
    number: "03",
    name: "Operate",
    detail: "The deployment, server, and network.",
  },
] as const;

/**
 * How a visitor can reach the live system, and what the console can measure.
 *
 * Most of these systems belong to a client. They run inside the network of
 * that client. I cannot open them to the public, so the console cannot probe
 * them. The dashboard states this instead of showing an empty chart.
 */
export type ProjectAccess =
  /** The internet reaches it. The console probes it. */
  | "public"
  /** It runs inside the network of the client. No public probe is possible. */
  | "client-network"
  /** I built it, but no live instance runs at this time. */
  | "not-deployed"
  /** It is not a web service, so there is nothing to probe. */
  | "no-endpoint";

export type ProjectMonitor = {
  access: ProjectAccess;
  /**
   * The id of the application in sites.json. Set this to give the dashboard
   * the uptime, the response time and the fault record.
   */
  siteId?: string;
  /**
   * The `data-site` value that the /t.js tracker sends. Set this to give the
   * dashboard the page views and the visitors.
   */
  trafficId?: string;
  /**
   * The address of the dashboard the project itself provides, when that
   * dashboard is public. A relative path stays on this site.
   */
  dashboardUrl?: string;
  /**
   * A read-only account on the public instance.
   *
   * Two of these systems put a login in front of the dashboard. Nobody
   * evaluating the work will write and ask for a password -- they close the
   * tab. Publishing a viewer account is what turns "I built this" into
   * something a reader can check.
   *
   * Never a real account, and never one that can write. The seeders create
   * these specifically to be published.
   */
  demo?: {
    /** Where to sign in, if it is not the application root. */
    url?: string;
    /** What the field is called -- "Email", "Nomor Induk". */
    label: string;
    username: string;
    password: string;
  };
  /** One line that tells the visitor why the access state is what it is. */
  note: string;
};

/**
 * The badge on a project dashboard, and the sentence under it.
 *
 * It lives here because it is copy. It also keeps the case study page free of
 * the monitor modules, which reach SQLite and the file system.
 */
export const ACCESS: Record<
  ProjectAccess,
  { label: string; tone: "good" | "warn" | "muted"; meaning: string }
> = {
  public: {
    label: "Public",
    tone: "good",
    meaning: "The internet reaches this system. The console measures it below.",
  },
  "client-network": {
    label: "Client network",
    tone: "muted",
    meaning:
      "The client runs this system on a private network. I cannot probe it from here.",
  },
  "not-deployed": {
    label: "No live instance",
    tone: "muted",
    meaning: "I built this system. No instance runs at a public address now.",
  },
  "no-endpoint": {
    label: "Not a web service",
    tone: "muted",
    meaning: "This project has no HTTP endpoint, so there is nothing to probe.",
  },
};

/**
 * `TODO(you)` marks a fact that no source gives. The marker stays in the data
 * above so it is visible to the person who must supply it. A visitor sees
 * neither the marker nor a stand-in for it.
 *
 * An earlier version rendered "Not recorded", which reads as an unfinished
 * page rather than a considered one. A fact that is not known is left out:
 * the row goes, the field goes, the whole card goes if nothing in it is known.
 */
export function isStated(value: string | undefined | null): value is string {
  return typeof value === "string" && value.length > 0 && !value.startsWith("TODO(");
}

/** The value, or null when no source gives it. Callers must render nothing. */
export function stated(value: string | undefined | null): string | null {
  return isStated(value) ? value : null;
}

/** Only the metrics that have a value. An empty result means: show no list. */
export function statedMetrics<T extends { value: string }>(metrics: readonly T[]): T[] {
  return metrics.filter((m) => isStated(m.value));
}

/**
 * How much of the homepage a project gets.
 *
 * Seven projects at equal weight made the Projects section more than half the
 * height of the page, and gave a reader no way to tell which work matters.
 * Four carry a full chapter. The rest are listed, and their case studies are
 * unchanged — they are one click away, not hidden.
 */
export type ProjectTier = "flagship" | "archive";

export type ProjectData = {
  tier: ProjectTier;
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
  /** What the console can and cannot measure about this project. */
  monitor: ProjectMonitor;
};

export const projects: ProjectData[] = [
  {
    number: "01",
    tier: "flagship",
    slug: "performance-data-centre",
    title: "Institutional Performance Data System",
    category: "Government Systems / Laravel",
    chapter: "Project 01",
    description:
      "A web system that holds the performance data of every work area of the Surabaya Health Quarantine Centre.",
    outcome: "I designed, built and deployed the system alone.",
    images: [
      "/images/projects/simaksi-live.png",
      "/images/projects/simaksi-card.png",
    ],
    accent: "ember",
    client: "Balai Besar Kekarantinaan Kesehatan Surabaya",
    year: "2025",
    role: "Developer and network support",
    overview:
      "Each work area of the agency kept its performance data in a different place. Staff collected the data by hand before they could compare it. This system gives all the areas one structure. Each area sends its data to the same fields. The agency then reads the result directly.",
    challenge:
      "The areas reported in different formats. Staff had to make the formats agree before they could compare any two areas.",
    solution:
      "I built one data model for all the performance records. Each area now uses the same fields. A comparison is a database query.",
    architecture: [
      "Laravel application with access control for each work area",
      "One record structure for all the areas",
      "Central pages for evaluation and reports",
      "Installed with the new network hardware on site",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "JavaScript", "Bootstrap"],
    metrics: [
      { label: "Scope", value: "All work areas" },
      { label: "Year", value: "2025" },
      { label: "Work areas", value: "TODO(you)" },
    ],
    observation: "The data existed. It was not in one place or in one shape.",
    response: "Give each area the same structure.",
    result: "Every area reports into the same fields, so comparing two of them is a query.",
    monitor: {
      access: "public",
      siteId: "simaksi",
      dashboardUrl: "https://simaksi.yaumalatsal.com",
      note:
        "I run a public instance of this system. The figures below come from it, not from the agency.",
    },
  },
  {
    number: "02",
    tier: "flagship",
    slug: "hotwork-permit",
    title: "Hot Work Permit System",
    category: "Industrial Safety / Laravel",
    chapter: "Project 02",
    description:
      "A web permit system for hot work in a smelting plant. It replaces the paper permit for a high-risk task.",
    outcome: "Role-based approval, PDF permits and QR codes for each permit.",
    images: ["/images/projects/hotwork-permit-live.png", "/images/projects/hotwork-permit-login.png"],
    accent: "copper",
    client: "PT Smelting Gresik",
    year: "2024",
    role: "Developer (internship)",
    overview:
      "Hot work covers weld, cut and grind operations near flammable material. The plant must approve this work before it starts. A paper permit does not show the current state of the approvals. This system puts the permit on the web. A supervisor sees each request, each approval and each valid permit while the work continues.",
    challenge:
      "A paper permit moves slowly between approvers. It also gives no live view of the work that the plant permits at this moment.",
    solution:
      "I built the permit steps in Laravel: request, review, approval and expiry. The system prints a PDF permit and a QR code. A supervisor scans the code at the work site to confirm that the permit is valid.",
    architecture: [
      "Laravel workflow with roles from spatie/laravel-permission",
      "Permit states from the request to the expiry",
      "PDF permits with dompdf and QR codes for checks on site",
      "Excel export for the safety audit",
      "Docker Compose for the local environment and the server",
    ],
    techStack: [
      "Laravel 12",
      "PHP 8.2",
      "Alpine.js",
      "Tailwind CSS",
      "Vite",
      "MySQL",
      "Docker",
    ],
    metrics: [
      { label: "Environment", value: "Smelting plant" },
      { label: "Engagement", value: "Internship" },
      { label: "Permits", value: "TODO(you)" },
    ],
    observation: "Nobody can check a paper permit at the moment it matters.",
    response: "Put each permit step where a supervisor can read it.",
    result: "Each permit carries its approval chain, a PDF and a QR code.",
    monitor: {
      access: "public",
      siteId: "hotwork",
      note:
        "I run a public instance of this system. The figures below come from it, not from the plant.",
    },
  },
  {
    number: "03",
    tier: "flagship",
    slug: "warehouse-management-system",
    title: "Warehouse Management System",
    category: "Enterprise Logistics / Next.js",
    chapter: "Project 03",
    description:
      "A multi-warehouse system with real-time stock counts, bin rack allocations and inbound movement records.",
    outcome: "Multi-facility routing, live rack occupancy and order audits.",
    images: [
      "/images/projects/wms-qom-live.png",
      "/images/projects/wms-qom-card.png",
    ],
    accent: "moss",
    client: "Qom Logistics",
    year: "2026",
    role: "Full-stack engineer",
    overview:
      "Logistics teams must track inventory across different warehouses. This system connects multiple facilities into one web dashboard. Staff switch between locations, audit stock deliveries and check physical bin rack occupancy.",
    challenge:
      "Inventory sat in separate buildings with no single view of it. Staff could not see free rack slots or pending shipments in one place.",
    solution:
      "I built a multi-warehouse dashboard in Next.js. The system tracks item movement, calculates rack capacity, and logs order dispatches.",
    architecture: [
      "Next.js application with multi-facility workspace routing",
      "Dynamic bin rack location occupancy calculation",
      "Inbound receiving and outbound order dispatch workflows",
      "Time-series charts for movement volume and category breakdown",
    ],
    techStack: [
      "Next.js",
      "React",
      "TypeScript",
      "Tailwind CSS",
      "PostgreSQL",
      "Docker",
    ],
    metrics: [
      { label: "Facilities", value: "Multiple warehouses" },
      { label: "Audit", value: "Real-time rack count" },
      { label: "Engine", value: "Next.js Enterprise" },
    ],
    observation: "Separate warehouses create slow counts and lost items.",
    response: "Unify facility routing and rack audits in one dashboard.",
    result: "Stock counts and rack occupancy change as movements are recorded.",
    monitor: {
      access: "public",
      dashboardUrl: "https://wms-qom.my.id",
      demo: {
        url: "https://wms-qom.my.id/login",
        label: "Username",
        username: "admin",
        password: "admin123",
      },
      note:
        "I run a live instance of this enterprise platform. You can log in with the test account to inspect the warehouse operations.",
    },
  },
  {
    number: "04",
    tier: "flagship",
    slug: "pinglab",
    title: "Adaptive Learning Platform",
    category: "Adaptive Systems / Laravel & AI",
    chapter: "Project 04",
    description:
      "An adaptive learning platform with AI scaffolding. The platform reduces guidance as the student learns each concept.",
    outcome: "Five levels of scaffolding that fade when the student proves competence.",
    images: [
      "/images/projects/pinglab-live.png",
      "/images/projects/pinglab-card.png",
    ],
    accent: "ivory",
    client: "Research and academic platform",
    year: "2025",
    role: "Full-stack developer",
    overview:
      "Students learn at different speeds. This platform gives support to the student through five steps. It shows full examples at the start. It gives hints as the student works. The platform removes the help when the student works well alone.",
    challenge:
      "A standard course shows the same text to each student. It cannot adjust the help to the current ability of the learner.",
    solution:
      "I built an adaptive engine in Laravel. The engine tests each answer. It then changes the level of help for the next task.",
    architecture: [
      "Laravel application with five scaffolding levels",
      "Progression from full examples to independent work",
      "Interactive code exercises with immediate feedback",
      "Teacher view to inspect student progress and results",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "Tailwind CSS", "JavaScript"],
    metrics: [
      { label: "Levels", value: "5 support tiers" },
      { label: "Method", value: "Adaptive fading" },
      { label: "Status", value: "Live production" },
    ],
    observation: "A fixed lesson gives the same help to a student who needs none.",
    response: "Remove the help as the student learns.",
    result: "Guidance drops one level each time a student answers without it.",
    monitor: {
      access: "public",
      siteId: "pinglab",
      dashboardUrl: "https://pinglab.yaumalatsal.com",
      note:
        "I run a live instance of this platform. You can test the learning paths directly.",
    },
  },
  {
    number: "05",
    tier: "archive",
    slug: "online-attendance",
    title: "Staff Attendance System",
    category: "Workforce Systems / Laravel",
    chapter: "Project 05",
    description:
      "A digital attendance system. Each employee has a barcode. The system records the arrival and the departure.",
    outcome: "The monthly report is a query, not a manual count.",
    images: [
      "/images/projects/online-attendance-live.png",
      "/images/projects/online-attendance-login.png",
    ],
    accent: "ember",
    client: "PT. Panca Pilar Hutama (freelance)",
    year: "TODO(you)",
    role: "Freelance developer",
    overview:
      "A paper attendance sheet is slow to count. It is also hard to check later. This system gives a barcode to each employee. The scan writes the time to the database. A query then gives the monthly total.",
    challenge:
      "Staff counted the paper sheets by hand each month. Nobody could audit a past month quickly.",
    solution:
      "I built a barcode check-in that writes to the database. The system shows the attendance in a report page.",
    architecture: [
      "Laravel application with one barcode for each employee",
      "Check-in and check-out from a scan",
      "Attendance report pages",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "Barcode scanner"],
    metrics: [
      { label: "Input", value: "Barcode" },
      { label: "Engagement", value: "Freelance" },
      { label: "Employees", value: "TODO(you)" },
    ],
    observation: "A paper sheet is cheap until a person must add it up.",
    response: "Record the time at the door, in a form you can query.",
    result: "The monthly report is a query over the recorded times.",
    monitor: {
      access: "client-network",
      note:
        "The company runs this system on its own network. The attendance records belong to it.",
    },
  },
  {
    number: "06",
    tier: "archive",
    slug: "business-incubation-elearning",
    title: "Business Incubation Learning Platform",
    category: "Education Technology / Laravel",
    chapter: "Project 06",
    description:
      "A learning platform for student business ideas. It follows the steps of a business incubator.",
    outcome: "The platform follows the incubation steps, not a lesson list.",
    images: ["/images/projects/bisa-lms-dashboard.png", "/images/projects/bisa-lms-login.png"],
    accent: "moss",
    client: "Academic project",
    year: "TODO(you)",
    role: "Developer",
    overview:
      "A student brings a business idea to the platform. The platform moves the idea through the incubation steps. The course structure and the business structure agree.",
    challenge:
      "A usual learning platform holds lessons. It has no model for an idea that grows through steps.",
    solution:
      "I built the incubation steps as the main structure of the Laravel application. Each learning page belongs to the step that needs it.",
    architecture: [
      "Laravel application with the incubation steps as the structure",
      "One idea for each student, which moves through the steps",
      "Learning material attached to each step",
    ],
    techStack: ["Laravel", "PHP", "MySQL", "JavaScript"],
    metrics: [
      { label: "Domain", value: "Vocational education" },
      { label: "Model", value: "Digital incubation" },
      { label: "Students", value: "TODO(you)" },
    ],
    observation: "A business idea does not grow like a syllabus.",
    response: "Build the incubation steps, not the lesson list.",
    result: "The stages in the platform are the stages of the incubator, not chapters.",
    monitor: {
      access: "public",
      siteId: "bisa-lms",
      demo: {
        label: "Nomor Induk",
        username: "22601001",
        password: "demo1234",
      },
      note:
        "I run a public instance of this platform. The figures below come from it.",
    },
  },
  {
    number: "07",
    tier: "archive",
    slug: "fiber-optic-game",
    title: "Fiber Optic Training Game",
    category: "Simulation / Roblox",
    chapter: "Project 07",
    description:
      "A game in Roblox that teaches fiber optic technology. The player does the work instead of reading a diagram.",
    outcome: "The game models fiber splice work and OTDR tests.",
    images: ["/images/projects/roblox-fiber-optic.png", "/images/projects/roblox-fiber-splice.png"],
    accent: "copper",
    client: "Freelance",
    year: "TODO(you)",
    role: "Game developer",
    overview:
      "A textbook teaches fiber optics with cross-sections and refraction diagrams. This game puts the learner inside the work. The player joins fibers and reads an OTDR trace. Roblox is a platform the audience already uses.",
    challenge:
      "The principles of fiber optics are abstract on a whiteboard, and the work they describe is physical.",
    solution:
      "I wrote an interactive environment in Luau. The player acts on the equipment. The game holds the state of each task and shows the result.",
    architecture: [
      "Roblox environment with Luau scripts",
      "Models of the fiber splice task and the OTDR test",
      "State for each task, and steps that the player must complete",
    ],
    techStack: ["Roblox Studio", "Luau", "Simulation design"],
    metrics: [
      { label: "Platform", value: "Roblox" },
      { label: "Language", value: "Luau" },
      { label: "Players", value: "TODO(you)" },
    ],
    observation: "A diagram of refraction does not show the task it describes.",
    response: "Model the splice and the test as things the player does.",
    result: "The player performs a splice and reads an OTDR trace.",
    monitor: {
      access: "no-endpoint",
      note:
        "The game runs in Roblox. It has no web service for the console to read.",
    },
  },
];

export const capabilities = [
  {
    number: "I",
    title: "Build",
    description:
      "I build web applications from the interface to the database. I use Laravel for the server and React for the interface.",
    skills: [
      "Laravel",
      "PHP",
      "React",
      "Inertia.js",
      "TypeScript",
      "Tailwind CSS",
      "MySQL",
    ],
  },
  {
    number: "II",
    title: "Deploy",
    description:
      "I deploy and operate my own systems. I write the container files, the web server rules and the DNS records.",
    skills: [
      "Docker",
      "Docker Compose",
      "Nginx",
      "Cloudflare",
      "Linux",
      "CI/CD",
    ],
  },
  {
    number: "III",
    title: "Connect",
    description:
      "I install and configure networks. I started in this work and I still design for the layer below the application.",
    skills: [
      "MikroTik RouterOS",
      "VLAN",
      "Routing",
      "Firewall",
      "Network troubleshooting",
    ],
  },
  {
    number: "IV",
    title: "Explain",
    description:
      "I teach, present and write. My degree is in informatics education, so I document the systems that I build.",
    skills: [
      "Technical writing",
      "Public speaking",
      "Scrum",
      "English (TOEIC 820)",
    ],
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
    title: "PT Ragam Tangguh Fortindo",
    role: "IT Staff",
    type: "work",
    year: "2026 — Present",
    description:
      "I maintain the hardware and the network of the company. I also built the IT ticketing system that the staff use to report a fault and follow its repair.",
  },
  {
    number: "II",
    title: "Balai Besar Kekarantinaan Kesehatan Surabaya",
    role: "Developer and Network Support",
    type: "work",
    year: "2025",
    description:
      "I designed and built the web system that holds the performance data of all the work areas. I also installed the new network hardware at the site.",
  },
  {
    number: "III",
    title: "PT. Smelting Gresik",
    role: "IT and Web Development",
    type: "work",
    year: "2024",
    description:
      "I developed the Hot Work Permit system for the plant. I also maintained the IT equipment, installed new hardware, and kept the plant network stable and secure.",
  },
  {
    number: "IV",
    title: "CLEARN Lab, State University of Malang",
    role: "Member",
    type: "community",
    year: "2024 — 2026",
    description:
      "I wrote three papers about education technology with the group. The papers cover a virtual entrepreneurship laboratory and learning websites. I also made a Scrum case study of the SISINTA project management system.",
  },
  {
    number: "V",
    title: "Workshop Elektro UM (WSE)",
    role: "Secretary, Products and Services Division",
    type: "organization",
    year: "2022 — 2024",
    description:
      "I managed the administration, the documents and the coordination for the division. I taught the Internet of Things session at Workshop at School 2023. I also organised the Line Tracer Design Contest and the PESC UM writing competition.",
  },
  {
    number: "VI",
    title: "PT. Weiss Tech Sidoarjo",
    role: "IT Support",
    type: "work",
    year: "2018",
    description:
      "I helped the IT team. I maintained the computer hardware and the company network.",
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
    field: "Informatics Engineering Education",
  },
  {
    years: "2018 — 2021",
    institution: "SMKN 3 Buduran",
    field: "Computer and Network Engineering",
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
      "Presenter at the International Conference on Electrical, Electronics and Information Engineering",
    year: "2024",
  },
  {
    label: "International Trade Competition",
    detail: "Second place. Junior Achievement and FedEx",
    year: "2021",
  },
  {
    label: "TOEFL 577",
    detail: "English test. TOEIC 820 in 2020",
    year: "2026",
  },
  {
    label: "Computer and Network Engineering",
    detail: "Competency certificate from langit.net",
    year: "2020",
  },
];

export const socialLinks = [
  { label: "GitHub", href: "https://github.com/yaumalatsal" },
  // TODO(you): Add your LinkedIn address here.
] as const;
