// Greenhouse ATS adapter. Fetches a public job board and normalizes each
// posting into the common shape the orchestrator (scripts/ingest-jobs.js)
// consumes: { title, location, content, applyUrl, department }. The shared
// pipeline owns scam filtering, eligibility extraction, upsert, and stale
// reconciliation, so this file's only job is source-specific fetch + normalize.

/**
 * Fetches raw postings from a Greenhouse board and normalizes each into the
 * common shape.
 * @param {string} slug - The board slug (e.g. "airbnb").
 * @returns {Promise<Array<{title:string,location:string,content:string,applyUrl:string,department:?string}>>}
 */
async function fetchGreenhouseJobs(slug) {
  const response = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  if (!response.ok) {
    throw new Error(`Greenhouse ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const jobs = data.jobs || [];
  return jobs.map((job) => ({
    title: job.title,
    location: job.location?.name || 'Remote',
    content: job.content || '',
    applyUrl: job.absolute_url,
    department: job.departments?.[0]?.name && job.departments[0].name !== 'No Department'
      ? job.departments[0].name
      : null,
  }));
}

module.exports = { ats: 'greenhouse', tier: 3, fetch: fetchGreenhouseJobs };
