const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, isScam, stripHtml } = require('./scamFilter');

// --- Legitimate jobs must survive (false-positive guards) ------------------
// These are the cases the old substring filter got wrong. Each is a real
// pattern from the fintech/payments companies in our source list.

test('legit fintech JD mentioning wire transfers is NOT flagged', () => {
  const job = {
    title: 'Senior Backend Engineer, Payments',
    content:
      '<p>You will build systems that move money at scale — ACH, wire transfer, ' +
      'and card rails. Experience with payment processing and settlement is a plus.</p>',
    applyUrl: 'https://boards.greenhouse.io/stripe/jobs/12345',
  };
  assert.equal(evaluate(job).isScam, false);
});

test('legit JD describing "processing fees" as a product concept is NOT flagged', () => {
  const job = {
    title: 'Product Manager, Merchant Platform',
    content:
      '<p>Our platform lets merchants configure the processing fee they charge ' +
      'their own customers. You will own the pricing surface.</p>',
    applyUrl: 'https://jobs.lever.co/brex/abc',
  };
  assert.equal(evaluate(job).isScam, false);
});

test('legit fresher / work-from-home role is NOT flagged', () => {
  const job = {
    title: 'Associate Software Engineer (Fresher, Remote)',
    content:
      '<p>Great opportunity for freshers! Work from home. No prior experience ' +
      'required. Competitive salary. Apply on our careers page.</p>',
    applyUrl: 'https://boards.greenhouse.io/groww/jobs/999',
  };
  assert.equal(evaluate(job).isScam, false);
});

test('a company literally building on WhatsApp is NOT flagged', () => {
  const job = {
    title: 'Engineer, Messaging',
    content:
      '<p>Build our WhatsApp and Telegram notification integrations for millions ' +
      'of users.</p>',
    applyUrl: 'https://boards.greenhouse.io/gupshup/jobs/1',
  };
  assert.equal(evaluate(job).isScam, false);
});

// The following four are real false positives caught by a full dry-run against
// 8,378 live postings — pinned here so they can never regress.

test('hardware JD mentioning "material cost" / "training cost" is NOT flagged', () => {
  const job = {
    title: 'Mechanical Engineer II',
    content:
      '<p>Own the bill of materials cost and reduce training cost across the ' +
      'manufacturing line. Manage material cost targets per unit.</p>',
    applyUrl: 'https://boards.greenhouse.io/peloton/jobs/1',
  };
  assert.equal(evaluate(job).isScam, false);
});

test('"Paid Media" role with "we pay a competitive salary" is NOT flagged', () => {
  const job = {
    title: 'Director, Paid Media',
    content:
      '<p>Lead our paid media strategy across channels. We pay a competitive ' +
      'salary and offer paid time off. You will manage budgets to start new campaigns.</p>',
    applyUrl: 'https://boards.greenhouse.io/faire/jobs/2',
  };
  assert.equal(evaluate(job).isScam, false);
});

test('edtech JD describing a "course fee" product is NOT flagged', () => {
  const job = {
    title: 'Curriculum Product Manager',
    content:
      '<p>Learners pay a course fee to enroll in our specializations. You will ' +
      'own pricing and the enrollment funnel.</p>',
    applyUrl: 'https://boards.greenhouse.io/coursera/jobs/3',
  };
  assert.equal(evaluate(job).isScam, false);
});

test('proptech JD handling "security deposit" as product is NOT flagged', () => {
  const job = {
    title: 'Backend Engineer, Rentals',
    content:
      '<p>Build the system that automates security deposit refunds for millions ' +
      'of renters. Integrate with payment rails.</p>',
    applyUrl: 'https://boards.greenhouse.io/flatironhealth/jobs/4',
  };
  assert.equal(evaluate(job).isScam, false);
});

test('a JD with an anti-scam disclaimer is NOT flagged by its own disclaimer', () => {
  // Verbatim-style boilerplate seen on real Peloton / Verkada postings.
  const job = {
    title: 'Android Engineer III',
    content:
      '<p>Build our mobile app.</p><p>Please note: we will never ask you to pay ' +
      'any application, processing, or training fee at any stage of the ' +
      'recruitment process. Report any such request to security@company.com.</p>',
    applyUrl: 'https://boards.greenhouse.io/peloton/jobs/9',
  };
  const r = evaluate(job);
  assert.equal(r.isScam, false, `unexpectedly flagged: ${r.reasons.join('; ')}`);
});

test('a scam that ALSO includes a disclaimer clause is still caught', () => {
  // The disclaimer clause is stripped, but the real demand in a separate
  // sentence must still fire.
  const job = {
    title: 'Data Entry',
    content:
      '<p>We will never ask for a processing fee. However, you must pay a ' +
      'registration fee of Rs 1500 to confirm your seat.</p>',
    applyUrl: '',
  };
  assert.equal(evaluate(job).isScam, true);
});

// --- Actual scams must be caught -------------------------------------------

test('"applicants must submit a resume" / "must pay attention" are NOT flagged', () => {
  assert.equal(
    evaluate({
      title: 'Global Payment Operations Lead',
      content: '<p>To be considered, applicants must submit an updated, professional resume. You must pay attention to detail.</p>',
      applyUrl: 'https://boards.greenhouse.io/cloudflare/jobs/7',
    }).isScam,
    false,
  );
});

test('pay-a-registration-fee scam is flagged', () => {
  const job = {
    title: 'Work From Home Data Entry',
    content:
      '<p>Pay a registration fee of Rs 1999 to secure your seat. Contact us on ' +
      'WhatsApp +91 9876543210 for immediate joining.</p>',
    applyUrl: 'https://wa.me/919876543210',
  };
  const r = evaluate(job);
  assert.equal(r.isScam, true);
  assert.ok(r.reasons.length >= 2, 'should record multiple reasons');
});

test('refundable security deposit scam is flagged', () => {
  const job = {
    title: 'Online Job',
    content: '<p>A refundable security deposit is required before joining.</p>',
    applyUrl: '',
  };
  assert.equal(evaluate(job).isScam, true);
});

test('pay-via-UPI training-fee scam is flagged', () => {
  const job = {
    title: 'Fresher Opening',
    content: '<p>Pay the training fee via UPI to get your offer letter.</p>',
    applyUrl: '',
  };
  assert.equal(evaluate(job).isScam, true);
});

test('guaranteed-placement + suspicious short link is flagged', () => {
  const job = {
    title: 'Guaranteed Placement',
    content: '<p>100% guaranteed job. No interview. Apply now.</p>',
    applyUrl: 'https://bit.ly/apply-now',
  };
  assert.equal(evaluate(job).isScam, true);
});

// --- Robustness / edge cases -----------------------------------------------

test('empty and missing inputs do not crash and are not scams', () => {
  assert.equal(evaluate({}).isScam, false);
  assert.equal(evaluate({ content: null, title: undefined, applyUrl: null }).isScam, false);
  assert.equal(isScam(''), false);
  assert.equal(isScam(undefined), false);
});

test('malformed apply URL contributes suspicion but is not fatal alone', () => {
  const r = evaluate({ title: 'Engineer', content: 'Build things.', applyUrl: 'not a url' });
  assert.equal(r.isScam, false); // score 2 < threshold 3
  assert.ok(r.reasons.includes('application URL is malformed'));
});

test('stripHtml decodes entities and removes tags', () => {
  assert.equal(stripHtml('<p>Hello&nbsp;&amp;&nbsp;welcome</p>'), 'Hello & welcome');
});

test('a single weak signal alone does not flag a job', () => {
  const job = {
    title: 'Engineer',
    content: '<p>Immediate joining available for the right candidate.</p>',
    applyUrl: 'https://boards.greenhouse.io/vercel/jobs/1',
  };
  assert.equal(evaluate(job).isScam, false); // weight 1 < threshold
});
