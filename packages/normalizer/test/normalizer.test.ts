import test from 'node:test';
import assert from 'node:assert';
import { normalizeCategory, stripHtml, decodeEntities, truncateWords, isIndiaLocation, extractCity, detectWorkMode, normalizeLocation, classifyType, extractTags } from '../src/index';

test('normalizeCategory: narrow rules beat broad ones', () => {
  // "Sales Engineer" contains "engineer", but sales is the more specific claim.
  assert.equal(normalizeCategory(null, 'Sales Engineer'), 'sales');
  assert.equal(normalizeCategory(null, 'Software Engineer'), 'it');
  assert.equal(normalizeCategory(null, 'Mechanical Design Engineer'), 'engineering');
});

test('normalizeCategory: the source category outranks the title', () => {
  // A posting filed under Finance whose title says "analyst" is finance.
  assert.equal(normalizeCategory('Finance', 'Business Analyst'), 'finance');
  // With no usable department, the title decides.
  assert.equal(normalizeCategory('No Department', 'Talent Acquisition Intern'), 'hr');
});

test('normalizeCategory: "design" in an engineering title stays engineering', () => {
  // Bare "design" used to send every design engineer to creative.
  assert.equal(normalizeCategory(null, 'Mechanical Design Engineer'), 'engineering');
  assert.equal(normalizeCategory(null, 'Design Engineer'), 'engineering');
  // …while genuine design roles still resolve to creative.
  assert.equal(normalizeCategory(null, 'Graphic Designer'), 'creative');
  assert.equal(normalizeCategory(null, 'UI/UX Designer'), 'creative');
  assert.equal(normalizeCategory(null, 'Product Designer'), 'creative');
});

test('normalizeCategory: never returns null — unknown maps to general', () => {
  assert.equal(normalizeCategory('Zzzz', 'Qqqq'), 'general');
  assert.equal(normalizeCategory(null, null), 'general');
  assert.equal(normalizeCategory(undefined, ''), 'general');
});

test('normalizeCategory: covers non-tech streams, not just IT', () => {
  assert.equal(normalizeCategory(null, 'Staff Nurse'), 'healthcare');
  assert.equal(normalizeCategory(null, 'Hotel Front Office Executive'), 'hospitality');
  assert.equal(normalizeCategory(null, 'Warehouse Supervisor'), 'logistics');
  assert.equal(normalizeCategory(null, 'Physics Teacher'), 'teaching');
  assert.equal(normalizeCategory(null, 'CNC Machine Operator'), 'manufacturing');
});

test('decodeEntities handles named, decimal and hex escapes', () => {
  assert.equal(decodeEntities('a&nbsp;b'), 'a b');
  assert.equal(decodeEntities('Tom &amp; Jerry'), 'Tom & Jerry');
  assert.equal(decodeEntities('&#65;&#x42;'), 'AB');
  // An unknown entity is left alone rather than silently deleted.
  assert.equal(decodeEntities('&notanentity;'), '&notanentity;');
});

test('stripHtml removes script bodies and cannot resurrect a tag', () => {
  assert.equal(stripHtml('<p>Hello</p><script>alert(1)</script>'), 'Hello');
  // Entities are decoded AFTER tags are stripped, so this stays inert text.
  assert.equal(stripHtml('&lt;script&gt;x&lt;/script&gt;'), '<script>x</script>');
});

test('truncateWords cuts on a word boundary', () => {
  assert.equal(truncateWords('hello world foo', 100), 'hello world foo');
  assert.ok(!truncateWords('hello world foobar', 14).endsWith('foob'));
});

test('isIndiaLocation does not match Indiana', () => {
  assert.equal(isIndiaLocation('Bengaluru, India'), true);
  assert.equal(isIndiaLocation('Indianapolis, Indiana'), false);
  assert.equal(isIndiaLocation('Remote'), false);
});

test('extractCity canonicalises spellings', () => {
  assert.equal(extractCity('Bangalore, KA'), 'Bengaluru');
  assert.equal(extractCity('Bengaluru'), 'Bengaluru');
  assert.equal(extractCity('Gurgaon'), 'Gurugram');
  assert.equal(extractCity('Bombay'), 'Mumbai');
  assert.equal(extractCity('Berlin'), undefined);
});

test('detectWorkMode prefers hybrid over remote', () => {
  assert.equal(detectWorkMode('Hybrid - Remote friendly'), 'hybrid');
  assert.equal(detectWorkMode('Work from home'), 'remote');
  // Silence is not evidence of onsite.
  assert.equal(detectWorkMode('Pune'), undefined);
});

test('normalizeLocation dedupes repeated segments', () => {
  assert.equal(normalizeLocation('Pune, Pune, India'), 'Pune, India');
  assert.equal(normalizeLocation(''), 'India');
  assert.equal(normalizeLocation('  ', 'Remote'), 'Remote');
});

test('classifyType detects internships', () => {
  assert.equal(classifyType('Software Engineering Intern'), 'internship');
  assert.equal(classifyType('Graduate Engineer Trainee'), 'internship');
  assert.equal(classifyType('Backend Engineer'), 'job');
});

test('extractTags requires whole-word skill matches', () => {
  // The original bug: "AI" inside "trainee"/"available" tagged everything as AI.
  const tags = extractTags({ title: 'Graduate Trainee', description: 'Seats available', category: 'general' });
  assert.ok(!tags.includes('AI'), `"AI" should not match inside other words: ${tags.join(',')}`);
  assert.ok(extractTags({ title: 'AI Engineer', description: '' }).includes('AI'));
  // Keywords with punctuation still match.
  assert.ok(extractTags({ title: 'Node.js developer', description: '' }).includes('Node.js'));
});
