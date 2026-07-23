// Ashby ATS adapter. Normalizes postings into the common shape the orchestrator
// (scripts/ingest-jobs.js) consumes.

/**
 * Fetches raw postings from an Ashby job board and normalizes each into the
 * common shape. Ashby's board names are case-sensitive, so the slug in
 * companies.json must match exactly (e.g. "ElevenLabs", not "elevenlabs").
 * Unlisted postings (isListed === false) are internal/hidden and dropped.
 * @param {string} slug - The board name (case-sensitive).
 * @returns {Promise<Array<{title:string,location:string,content:string,applyUrl:string,department:?string}>>}
 */
async function fetchAshbyJobs(slug) {
  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`);
  if (!response.ok) {
    throw new Error(`Ashby ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];
  return jobs
    .filter((job) => job.isListed !== false)
    .map((job) => ({
      title: job.title,
      location: job.location || (job.isRemote ? 'Remote' : 'Remote'),
      content: job.descriptionHtml || job.descriptionPlain || '',
      applyUrl: job.applyUrl || job.jobUrl,
      department: job.department || job.team || null,
    }));
}

module.exports = { ats: 'ashby', tier: 3, fetch: fetchAshbyJobs };
