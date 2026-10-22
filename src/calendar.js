const { google } = require('googleapis');

const {
  GOOGLE_CLIENT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_CALENDAR_ID,
  GOOGLE_CALENDAR_TIMEZONE = 'Europe/London'
} = process.env;

function isConfigured() {
  return Boolean(GOOGLE_CLIENT_EMAIL && GOOGLE_PRIVATE_KEY && GOOGLE_CALENDAR_ID);
}

function getAuth() {
  if (!isConfigured()) return null;
  // Private keys in env vars often have literal \n sequences
  const privateKey = GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');
  return new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/calendar']
  });
}

/**
 * Parse user-supplied start/end strings into ISO-ish local datetimes.
 * Accepts: 2026-10-25T19:00, 2026-10-25 19:00, 2026-10-25T19:00:00
 */
function parseLocalDateTime(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.trim().replace(' ', 'T');
  // Require at least YYYY-MM-DDTHH:MM
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(cleaned)) return null;
  // Append seconds if missing so Date can parse more reliably in some engines
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(cleaned)
    ? `${cleaned}:00`
    : cleaned;
  return withSeconds;
}

function addHours(localDateTime, hours) {
  // localDateTime is "YYYY-MM-DDTHH:MM:SS" without timezone — treat as wall clock
  const d = new Date(localDateTime);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(d.getHours() + hours);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Create a Google Calendar event.
 * Returns { id, htmlLink } or null if Calendar is not configured / start missing.
 */
async function createCalendarEvent({ title, description, start, end, timezone }) {
  if (!isConfigured()) {
    return { skipped: true, reason: 'Google Calendar is not configured.' };
  }
  const startLocal = parseLocalDateTime(start);
  if (!startLocal) {
    return { skipped: true, reason: 'No valid start time provided (use e.g. 2026-10-25T19:00).' };
  }
  const tz = timezone || GOOGLE_CALENDAR_TIMEZONE;
  let endLocal = parseLocalDateTime(end);
  if (!endLocal) {
    endLocal = addHours(startLocal, 2);
  }

  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const resource = {
    summary: title,
    description: description || '',
    start: { dateTime: startLocal, timeZone: tz },
    end: { dateTime: endLocal, timeZone: tz }
  };

  const res = await calendar.events.insert({
    calendarId: GOOGLE_CALENDAR_ID,
    requestBody: resource
  });

  return {
    id: res.data.id,
    htmlLink: res.data.htmlLink,
    start: startLocal,
    end: endLocal,
    timeZone: tz
  };
}

/**
 * Update event description (e.g. with live RSVP counts).
 */
async function updateCalendarEventDescription(googleEventId, description) {
  if (!isConfigured() || !googleEventId) return false;
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });
  await calendar.events.patch({
    calendarId: GOOGLE_CALENDAR_ID,
    eventId: googleEventId,
    requestBody: { description }
  });
  return true;
}

module.exports = {
  isConfigured,
  createCalendarEvent,
  updateCalendarEventDescription,
  parseLocalDateTime
};
