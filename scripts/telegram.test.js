// Offline tests for Telegram message parsing (no network).

const test = require('node:test');
const assert = require('node:assert');
const { parseTelegramMessage, isJobPost } = require('./ingest-jobs');

test('isJobPost accepts real jobs, rejects ads/promos', () => {
  // Real jobs
  assert.equal(isJobPost('Company name: Google\nRole: SDE Intern', 'SDE Intern', 'Google'), true);
  assert.equal(isJobPost('Microsoft Off Campus Hiring for freshers, batch 2026', undefined, 'Microsoft'), true);
  assert.equal(isJobPost('We are hiring a Backend Developer, 0-2 years', undefined, undefined), true);
  // Ads / promos with an apply link but no real role
  assert.equal(isJobPost('Lifetime Free Scapia Credit Card – Travel Lovers ke liye must have! Apply now', undefined, undefined), false);
  assert.equal(isJobPost('Join our free masterclass and enroll today! Referral code inside', undefined, undefined), false);
  assert.equal(isJobPost('Open a demat account and get cashback, sign up and earn', undefined, undefined), false);
});

test('isJobPost: promo words in a real job (insurance/loan company) are not rejected', () => {
  // A genuine role at a fintech mentioning "insurance" keeps its job signal.
  assert.equal(isJobPost('Role: Data Analyst at an insurance firm', 'Data Analyst', 'Acme'), true);
});

test('parses a well-formed multi-line job post', () => {
  const text = [
    'Company name: Salesforce',
    'Role: Software Engineer - AMTS',
    'Batch Eligible: 2026 graduates',
    'Location: Hyderabad/Bangalore, India',
    'Apply Link: https://careers.salesforce.com/job/123',
  ].join('\n');
  const j = parseTelegramMessage(text, ['https://careers.salesforce.com/job/123'], 'ch');
  assert.equal(j.companyName, 'Salesforce');
  assert.equal(j.title, 'Software Engineer - AMTS');
  assert.equal(j.location, 'Hyderabad/Bangalore, India');
  assert.equal(j.applyUrl, 'https://careers.salesforce.com/job/123');
});

test('does not over-capture on single-line (pinned) reposts', () => {
  const text =
    'Company name: micro1 Role: Frontend Developer Batch Eligible: All Location: Remote Apply Link: https://jobs.micro1.ai/post/x';
  const j = parseTelegramMessage(text, ['https://jobs.micro1.ai/post/x'], 'ch');
  assert.equal(j.companyName, 'micro1'); // not "micro1 Role: Frontend..."
  assert.equal(j.title, 'Frontend Developer');
});

test('rejects non-job messages (no apply link)', () => {
  assert.equal(parseTelegramMessage('Fam react krdia kro, boost milta hai ❤️', [], 'ch'), null);
});

test('rejects a link-only message with no job signal', () => {
  assert.equal(parseTelegramMessage('Check this out', ['https://example.com/blog'], 'ch'), null);
});

test('ignores social/DM links as the apply destination', () => {
  // Only a WhatsApp link → no valid external apply URL → not a job.
  assert.equal(
    parseTelegramMessage('Hiring freshers! Apply', ['https://wa.me/919999999999'], 'ch'),
    null
  );
});

test('defaults India-focused channels to India when location is unstated', () => {
  const j = parseTelegramMessage(
    'Company name: Acme\nRole: SDE Intern\nApply Link: https://acme.com/apply',
    ['https://acme.com/apply'],
    'ch'
  );
  assert.equal(j.location, 'India');
});
