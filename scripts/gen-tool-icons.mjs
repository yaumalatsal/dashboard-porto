import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const si = require("simple-icons");

// Slug -> the skill strings in portfolio.ts that should carry that mark.
const MAP = {
  laravel: ["Laravel"],
  php: ["PHP"],
  react: ["React"],
  inertia: ["Inertia.js"],
  typescript: ["TypeScript"],
  tailwindcss: ["Tailwind CSS"],
  mysql: ["MySQL"],
  docker: ["Docker", "Docker Compose"],
  nginx: ["Nginx"],
  cloudflare: ["Cloudflare"],
  linux: ["Linux"],
  githubactions: ["CI/CD"],
  mikrotik: ["MikroTik RouterOS"],
  git: ["Git"],
};

const entries = [];
for (const [slug, labels] of Object.entries(MAP)) {
  const key = "si" + slug.charAt(0).toUpperCase() + slug.slice(1);
  const icon = si[key];
  if (!icon) throw new Error("missing icon: " + slug);
  entries.push({ slug, title: icon.title, path: icon.path, labels });
}

const lines = [];
lines.push("/**");
lines.push(" * Brand marks for the tools listed in `capabilities`.");
lines.push(" *");
lines.push(" * The paths are copied from Simple Icons (CC0 1.0, public domain) rather");
lines.push(" * than imported, so the site carries no icon dependency at runtime and");
lines.push(" * fetches nothing from a third party. Each is a single 24x24 path.");
lines.push(" *");
lines.push(" * Regenerate with scripts/gen-tool-icons.mjs if a tool is added.");
lines.push(" *");
lines.push(" * Not every skill has a brand. VLAN, routing, firewalling, technical");
lines.push(" * writing and the rest are practices, not products, and deliberately");
lines.push(" * resolve to null here — the UI gives them a monogram instead of");
lines.push(" * inventing a logo.");
lines.push(" */");
lines.push("");
lines.push("export type ToolIcon = {");
lines.push("  /** Simple Icons slug, kept for regeneration. */");
lines.push("  slug: string;");
lines.push("  title: string;");
lines.push("  /** A single path, drawn against a 24x24 viewBox. */");
lines.push("  path: string;");
lines.push("};");
lines.push("");
lines.push("const ICONS: Record<string, ToolIcon> = {");
for (const e of entries) {
  lines.push(`  ${e.slug}: {`);
  lines.push(`    slug: ${JSON.stringify(e.slug)},`);
  lines.push(`    title: ${JSON.stringify(e.title)},`);
  lines.push(`    path: ${JSON.stringify(e.path)},`);
  lines.push("  },");
}
lines.push("};");
lines.push("");
lines.push("/** Skill label, exactly as written in portfolio.ts, to its mark. */");
lines.push("const BY_LABEL: Record<string, string> = {");
for (const e of entries) {
  for (const l of e.labels) {
    lines.push(`  ${JSON.stringify(l)}: ${JSON.stringify(e.slug)},`);
  }
}
lines.push("};");
lines.push("");
lines.push("/** The mark for a skill, or null when the skill is a practice, not a product. */");
lines.push("export function toolIcon(label: string): ToolIcon | null {");
lines.push("  const slug = BY_LABEL[label];");
lines.push("");
lines.push("  return slug ? (ICONS[slug] ?? null) : null;");
lines.push("}");
lines.push("");
lines.push("/** First letters of a skill with no brand, for the monogram fallback. */");
lines.push("export function monogram(label: string): string {");
lines.push("  const words = label.replace(/[^A-Za-z0-9 ]/g, \" \").trim().split(/\\s+/);");
lines.push("");
lines.push("  return words.length > 1");
lines.push("    ? (words[0][0] + words[1][0]).toUpperCase()");
lines.push("    : label.slice(0, 2).toUpperCase();");
lines.push("}");
lines.push("");

fs.writeFileSync("src/data/tool-icons.ts", lines.join("\r\n"));
console.log(`  wrote src/data/tool-icons.ts with ${entries.length} marks`);
