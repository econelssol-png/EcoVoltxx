/**
 * Society-local dates and times.
 *
 * Bookings store a date ("2026-12-01") and times ("18:30") as residents see
 * them on their phones, in India time (IST, UTC+05:30, no daylight saving).
 * The server clock runs in UTC, so comparisons with "now" go through here.
 */

const UTC_OFFSET = '+05:30';
const OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Today's date in India, as YYYY-MM-DD */
function today(now = new Date()) {
  return new Date(now.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** A YYYY-MM-DD date moved by a number of days */
function addDays(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The moment a slot starts (date and time in India time) */
function slotStart(date, time) {
  return new Date(`${date}T${String(time).slice(0, 5)}:00${UTC_OFFSET}`);
}

/** Whether a slot has already started */
function hasStarted(date, time, now = new Date()) {
  return slotStart(date, time).getTime() <= now.getTime();
}

module.exports = { DATE_RE, TIME_RE, today, addDays, slotStart, hasStarted };
