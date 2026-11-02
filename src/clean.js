import { parse } from 'csv-parse/sync';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FOLLOW_UP_RE = /\s*following up on this\.?\s*$/i;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const squish = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

const issueKey = (subject) =>
  subject.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function toUtcIso(y, mo, d, h, mi, s = 0) {
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const valid =
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === mo - 1 &&
    date.getUTCDate() === d &&
    date.getUTCHours() === h;
  return valid ? date.toISOString() : null;
}

// The source has no timezone, so every format is read as UTC.
function parseTimestamp(raw) {
  const s = squish(raw);
  let m;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})$/))) {
    return toUtcIso(+m[1], +m[2], +m[3], +m[4], +m[5], +m[6]);
  }
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}) (AM|PM)$/i))) {
    const hour = (+m[4] % 12) + (m[6].toUpperCase() === 'PM' ? 12 : 0);
    return toUtcIso(+m[3], +m[2], +m[1], hour, +m[5]);
  }
  if ((m = s.match(/^([A-Za-z]{3}) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2})$/))) {
    const month = MONTHS.indexOf(m[1].toLowerCase()) + 1;
    return month ? toUtcIso(+m[3], month, +m[2], +m[4], +m[5]) : null;
  }
  return null;
}

// Unquoted commas in a subject push extra fields in before the body, so rejoin them.
// A trailing ", urgent" is the only priority signal in the file.
function splitRow(row) {
  if (row.length < 6) return null;
  const subjectParts = row.slice(3, row.length - 2);
  let urgent = false;
  if (subjectParts.length > 1 && squish(subjectParts[subjectParts.length - 1]).toLowerCase() === 'urgent') {
    subjectParts.pop();
    urgent = true;
  }
  return {
    id: row[0],
    receivedAt: row[1],
    email: row[2],
    subject: subjectParts.join(','),
    body: row[row.length - 2],
    channel: row[row.length - 1],
    urgent,
  };
}

function cleanTickets(csvText) {
  const rows = parse(csvText, { relax_column_count: true, skip_empty_lines: true }).slice(1);
  const dropped = [];
  const seen = new Set();
  const candidates = [];

  rows.forEach((row, i) => {
    const rec = splitRow(row);
    const ticketId = squish(row[0]) || `row-${i + 2}`;
    if (!rec) return dropped.push({ ticket_id: ticketId, reason: 'malformed_row' });
    if (!squish(rec.id)) return dropped.push({ ticket_id: ticketId, reason: 'unusable' });

    const subject = squish(rec.subject);
    const body = squish(rec.body);
    if (!subject && !body) return dropped.push({ ticket_id: ticketId, reason: 'unusable' });
    if (seen.has(ticketId)) return dropped.push({ ticket_id: ticketId, reason: 'duplicate' });
    seen.add(ticketId);

    const flags = [];
    const email = squish(rec.email).toLowerCase();
    const validEmail = EMAIL_RE.test(email);
    if (!validEmail) flags.push('invalid_email');

    const receivedAt = parseTimestamp(rec.receivedAt);
    if (!receivedAt) flags.push('invalid_timestamp');

    const channel = squish(rec.channel).toLowerCase() || null;
    if (!channel) flags.push('missing_channel');
    if (!body) flags.push('missing_body');
    if (!subject) flags.push('missing_subject');

    candidates.push({
      ticket_id: ticketId,
      received_at: receivedAt,
      customer_email: validEmail ? email : null,
      subject,
      body: body || null,
      channel,
      customer_marked_urgent: rec.urgent,
      flags,
      follow_up_ids: [],
      issue_key: issueKey(subject),
    });
  });

  const originals = new Map();
  for (const t of candidates) {
    if (t.customer_email && !FOLLOW_UP_RE.test(t.body ?? '')) {
      originals.set(`${t.customer_email}|${t.issue_key}`, t);
    }
  }

  const tickets = [];
  let mergedFollowUps = 0;
  for (const t of candidates) {
    if (t.customer_email && FOLLOW_UP_RE.test(t.body ?? '')) {
      const original = originals.get(`${t.customer_email}|${t.issue_key}`);
      if (original) {
        original.follow_up_ids.push(t.ticket_id);
        mergedFollowUps++;
        continue;
      }
      t.flags.push('follow_up_without_original');
    }
    tickets.push(t);
  }

  return { rowsRead: rows.length, tickets, dropped, mergedFollowUps };
}

export { cleanTickets, parseTimestamp };
