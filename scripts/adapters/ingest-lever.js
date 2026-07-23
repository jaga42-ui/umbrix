// Lever ATS adapter. Normalizes postings into the common shape the orchestrator
// (scripts/ingest-jobs.js) consumes, so the shared pipeline doesn't need to
// know which ATS a job came from.

/**
 * Fetches raw postings from a Lever board and normalizes each into the common
 * shape.
 * @param {string} slug - The board slug.
 * @returns {Promise<Array<{title:string,location:string,content:string,applyUrl:string,department:?string}>>}
 */
async function fetchLeverJobs(slug) {
  const response = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  if (!response.ok) {
    throw new Error(`Lever ${response.status} ${response.statusText}`);
  }
  const jobs = await response.json();
  if (!Array.isArray(jobs)) return [];
  return jobs.map((job) => ({
    title: job.text,
    location: job.categories?.location || 'Remote',
    content: job.description || job.descriptionPlain || '',
    applyUrl: job.hostedUrl,
    department: job.categories?.team || null,
  }));
}

module.exports = { ats: 'lever', tier: 3, fetch: fetchLeverJobs };
