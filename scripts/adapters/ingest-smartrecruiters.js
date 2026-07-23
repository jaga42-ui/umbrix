// SmartRecruiters ATS adapter. Normalizes postings into the common shape the
// orchestrator (scripts/ingest-jobs.js) consumes.

/**
 * Fetches postings from a SmartRecruiters public job board (used by several
 * India-office employers, e.g. Freshworks / ServiceNow). Paginated via
 * limit/offset. The list endpoint has no description body, so `content` is left
 * empty (SmartRecruiters feeds are clean corporate boards, so the scam filter
 * has nothing to catch anyway) — the apply URL is constructed from the posting
 * id, avoiding an N+1 detail call per posting.
 * @param {string} slug - The company identifier.
 * @returns {Promise<Array<{title:string,location:string,content:string,applyUrl:string,department:?string}>>}
 */
async function fetchSmartRecruitersJobs(slug) {
  const limit = 100;
  const out = [];
  for (let offset = 0; ; offset += limit) {
    const response = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${limit}&offset=${offset}`
    );
    if (!response.ok) {
      throw new Error(`SmartRecruiters ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const content = Array.isArray(data.content) ? data.content : [];
    for (const p of content) {
      const identifier = (p.company && p.company.identifier) || slug;
      const loc = p.location || {};
      const location =
        loc.fullLocation || [loc.city, loc.country].filter(Boolean).join(', ') || 'Remote';
      out.push({
        title: p.name,
        location,
        content: '',
        applyUrl: `https://jobs.smartrecruiters.com/${identifier}/${p.id}`,
        department: (p.department && p.department.label) || null,
      });
    }
    if (content.length === 0 || offset + limit >= (data.totalFound || 0)) break;
  }
  return out;
}

module.exports = { ats: 'smartrecruiters', tier: 3, fetch: fetchSmartRecruitersJobs };
