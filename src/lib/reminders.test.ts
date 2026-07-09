import { test } from "node:test";
import assert from "node:assert/strict";
import { reminderStatus, REMINDER_SOON_DAYS } from "./reminders";

const now = new Date("2026-07-09T12:00:00Z");

test("reminderStatus classifies by calendar day", () => {
  assert.equal(reminderStatus(null, now), "none");
  assert.equal(reminderStatus("", now), "none");
  assert.equal(reminderStatus("not-a-date", now), "none");
  assert.equal(reminderStatus("2026-07-08", now), "overdue");
  assert.equal(reminderStatus("2026-07-09", now), "soon"); // today
  assert.equal(reminderStatus("2026-07-12", now), "soon"); // +3, boundary
  assert.equal(reminderStatus("2026-07-13", now), "upcoming"); // +4
});

test("soon window is REMINDER_SOON_DAYS", () => {
  assert.equal(REMINDER_SOON_DAYS, 3);
});
