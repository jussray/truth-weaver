import { readFileSync } from "node:fs";

const carrier = readFileSync(new URL("../AGENTS.md", import.meta.url), "utf8");
const compatibilityCarrier = readFileSync(
  new URL("../AGENTS_FOUNDER_INTELLIGENCE.md", import.meta.url),
  "utf8",
);

const required = [
  "ULTRATHINK",
  "Red Team 1 — premise",
  "Lindy mode",
  "L99",
  "Red Team 2 — implementation",
  "OODA",
  "Proof",
  "Rollback / Next Gate",
];

let cursor = -1;
for (const step of required) {
  const next = carrier.indexOf(step, cursor + 1);
  if (next === -1) {
    throw new Error(`Founder Intelligence carrier missing or out of order: ${step}`);
  }
  cursor = next;
}

for (const marker of ["TRUE-FIRST", "EVIDENCE_ONLY", "STALE != FALSE"]) {
  if (!carrier.includes(marker)) {
    throw new Error(`Founder Intelligence carrier missing marker: ${marker}`);
  }
}

for (const marker of [
  "Proof-led Truth Weaver status brief",
  "any newly verified capability",
  "any material readiness change",
  "any newly verified blocker",
  "PLANNED_OR_UNPROVED",
  "current jurisdiction-aware legal navigation",
  "authoritative source coverage",
  "citation, source URL/identifier",
  "uncertainty handling",
  "smallest safe next verification step",
]) {
  if (!carrier.includes(marker)) {
    throw new Error(`Proof-led status brief contract missing marker: ${marker}`);
  }
}

for (const marker of [
  "older Founder Control Room receipts",
  "canonical, executable Founder Intelligence contract",
  "AGENTS.md",
  "provenance only",
]) {
  if (!compatibilityCarrier.includes(marker)) {
    throw new Error(`Founder Intelligence compatibility carrier missing marker: ${marker}`);
  }
}

console.log("Founder Intelligence carrier verified.");
