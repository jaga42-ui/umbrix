// Offline tests for India location detection. No network/DB.

const test = require('node:test');
const assert = require('node:assert');
const { isIndiaLocation } = require('./ingest-jobs');

test('detects India and major Indian cities', () => {
  for (const loc of [
    'Bengaluru, India',
    'Bangalore',
    'Mumbai, Maharashtra',
    'Remote - India',
    'Gurugram (Gurgaon)',
    'Hyderabad, Telangana',
    'Pune',
    'New Delhi',
    'Noida, Uttar Pradesh',
  ]) {
    assert.equal(isIndiaLocation(loc), true, loc);
  }
});

test('does not false-positive on lookalikes or non-India locations', () => {
  for (const loc of [
    'Indiana, USA',
    'Indianapolis, IN',
    'San Francisco, CA',
    'Remote - US/Canada',
    'London, UK',
    'Berlin, Germany',
    '',
    undefined,
  ]) {
    assert.equal(isIndiaLocation(loc), false, String(loc));
  }
});
