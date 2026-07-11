// Offline tests for Telegram message parsing (no network).

const test = require('node:test');
const assert = require('node:assert');
const { parseTelegramMessage } = require('./ingest-jobs');

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
