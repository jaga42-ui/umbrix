/**
 * Static skill → course mapping for the "one skill to add" affiliate nudge.
 *
 * TODO(owner): replace the placeholder URLs below with your REAL affiliate links
 * (Coursera / upGrad / Scaler …), and add the ~20-30 highest-frequency skill
 * gaps once the gap_nudge_click analytics show which gaps get clicked most.
 * Keys are the skill's lowercase name (matches the gap nudge's skill text).
 *
 * The current URLs are course-search links so the nudge is clickable and
 * trackable today — swap each one for an affiliate URL as you sign up programs.
 */
export interface SkillCourse {
  url: string;
  provider: string;
}

function coursera(query: string): string {
  return `https://www.coursera.org/search?query=${encodeURIComponent(query)}`;
}

export const SKILL_COURSES: Record<string, SkillCourse> = {
  react: { url: coursera("React"), provider: "Coursera" },
  javascript: { url: coursera("JavaScript"), provider: "Coursera" },
  typescript: { url: coursera("TypeScript"), provider: "Coursera" },
  "node.js": { url: coursera("Node.js"), provider: "Coursera" },
  "next.js": { url: coursera("Next.js React"), provider: "Coursera" },
  python: { url: coursera("Python"), provider: "Coursera" },
  java: { url: coursera("Java programming"), provider: "Coursera" },
  sql: { url: coursera("SQL"), provider: "Coursera" },
  postgresql: { url: coursera("PostgreSQL databases"), provider: "Coursera" },
  mongodb: { url: coursera("MongoDB"), provider: "Coursera" },
  aws: { url: coursera("AWS cloud"), provider: "Coursera" },
  docker: { url: coursera("Docker containers"), provider: "Coursera" },
  kubernetes: { url: coursera("Kubernetes"), provider: "Coursera" },
  "machine learning": { url: coursera("Machine Learning"), provider: "Coursera" },
  figma: { url: coursera("Figma UI UX"), provider: "Coursera" },
  "ui/ux": { url: coursera("UI UX design"), provider: "Coursera" },
  go: { url: coursera("Go programming golang"), provider: "Coursera" },
  cpp: { url: coursera("C++ programming"), provider: "Coursera" },
  csharp: { url: coursera("C# programming"), provider: "Coursera" },
  graphql: { url: coursera("GraphQL"), provider: "Coursera" },
};

/** The mapped course for a skill (case-insensitive), or null if unmapped. */
export function courseForSkill(skill: string): SkillCourse | null {
  if (!skill) return null;
  return SKILL_COURSES[skill.trim().toLowerCase()] ?? null;
}
