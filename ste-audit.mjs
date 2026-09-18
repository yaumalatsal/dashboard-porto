/**
 * Checks the portfolio copy against the ASD-STE100 rules that can be tested
 * mechanically: sentence length, the active voice, and "-ing" used as a noun or
 * an adjective. The approved-vocabulary rule needs the official dictionary and
 * is not checked here.
 */
import fs from "node:fs";

const files = [
  "src/data/portfolio.ts",
  "src/app/console/page.tsx",
  "src/app/console/traffic/page.tsx",
  "src/app/console/logs/page.tsx",
  "src/app/console/analytics/page.tsx",
  "src/app/console/incidents/page.tsx",
];

// Words that end in -ing but are part of a technical name or a noun in its own
// right. STE allows these.
const ALLOWED_ING =
  /^(during|thing|something|nothing|engineering|training|smelting|monitoring|learning|building|nothing)$/i;

let total = 0;
const findings = [];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");

  // User-facing strings: quoted text of 25+ characters, minus code-ish values.
  const strings = [...src.matchAll(/"((?:[^"\\]|\\.){25,}?)"/g)]
    .map((m) => m[1])
    .filter(
      (s) =>
        !s.includes("/images/") &&
        !s.startsWith("http") &&
        !s.includes("TODO") &&
        !s.includes("className") &&
        !/^[a-z-]+$/.test(s) &&
        // Prose only: a type declaration or a config object is not copy.
        !/[;{}]|:\s|=>/.test(s) &&
        / /.test(s) &&
        /[a-z]{3}/.test(s),
    );

  for (const text of strings) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      const words = sentence.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) continue;
      total++;

      if (words.length > 20) {
        findings.push(`LONG (${words.length}w) ${file}: ${sentence.slice(0, 62)}`);
      }

      const ing = (sentence.match(/\b(\w{4,}ing)\b/gi) ?? []).filter(
        (w) => !ALLOWED_ING.test(w),
      );
      if (ing.length > 0) {
        findings.push(`ING ${ing.join(", ")} — ${file}: ${sentence.slice(0, 48)}`);
      }

      if (/\b(?:is|are|was|were|been|be)\s+\w+(?:ed|en)\b/i.test(sentence)) {
        findings.push(`PASSIVE ${file}: ${sentence.slice(0, 58)}`);
      }
    }
  }
}

console.log(`  sentences audited: ${total}`);
console.log(`  findings: ${findings.length}`);
for (const f of findings.slice(0, 12)) console.log("   " + f);
if (findings.length === 0) {
  console.log("  CLEAN on sentence length, active voice and -ing usage");
}
