import { test } from "node:test";
import assert from "node:assert/strict";
import { selectDigestJobs, DIGEST_THRESHOLD, type DigestCandidate } from "./digest";
import type { MatchProfile } from "./matchScore";

const profile: MatchProfile = {
  skills: ["React", "TypeScript", "Node.js"],
  title: "Frontend Engineer",
};

function candidate(id: string, tags: string[], extra: Partial<DigestCandidate> = {}): DigestCandidate {
  return {
    id,
    title: extra.title ?? "Frontend Engineer",
    tags,
    companySlug: extra.companySlug ?? "acme",
    location: extra.location ?? "Bengaluru, India",
    applyUrl: extra.applyUrl ?? `https://acme.com/${id}`,
    minExperience: extra.minExperience ?? 0,
    ...extra,
  };
}

test("keeps only matches at/above the threshold", () => {
  const strong = candidate("a", ["React", "TypeScript", "Node.js"]); // full overlap → high
  const weak = candidate("b", ["Rust", "Kubernetes", "Go", "AWS"]); // no overlap → low
  const jobs = selectDigestJobs(profile, [strong, weak]);
  const ids = jobs.map((j) => j.id);
  assert.ok(ids.includes("a"), "strong match should be included");
  assert.ok(!ids.includes("b"), "weak match should be excluded");
  assert.ok(jobs.every((j) => j.score >= DIGEST_THRESHOLD));
});

test("sorts by score descending and caps at max", () => {
  const cands = [
    candidate("full", ["React", "TypeScript", "Node.js"]),
    candidate("partial", ["React", "TypeScript", "Rust", "Go"]),
    candidate("also-full", ["React", "Node.js"]),
  ];
  const jobs = selectDigestJobs(profile, cands, { max: 2 });
  assert.equal(jobs.length, 2, "respects the max cap");
  assert.ok(jobs[0].score >= jobs[1].score, "sorted by score desc");
});

test("returns empty when nothing qualifies (caller then skips the send)", () => {
  const cands = [
    candidate("x", ["Rust", "Go"]),
    candidate("y", ["Kubernetes", "AWS", "C++"]),
  ];
  assert.deepEqual(selectDigestJobs(profile, cands), []);
});

test("maps company from name, falling back to slug", () => {
  const withName = candidate("n", ["React", "TypeScript", "Node.js"], { companyName: "Acme Corp" });
  const [job] = selectDigestJobs(profile, [withName]);
  assert.equal(job.company, "Acme Corp");

  const noName = candidate("s", ["React", "TypeScript", "Node.js"], { companySlug: "widgets" });
  const [job2] = selectDigestJobs(profile, [noName]);
  assert.equal(job2.company, "widgets");
});

test("empty candidate list yields empty result", () => {
  assert.deepEqual(selectDigestJobs(profile, []), []);
});
