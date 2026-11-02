import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { cleanTickets } from './clean.js';
import { classify, DEFAULT_MODEL } from './classify.js';
import { classifyByRules } from './rules.js';
import { outputSchema, URGENCY_RANK } from './schema.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(ROOT, '.env'), quiet: true });
const INPUT = 'tickets_raw.csv';
const OUTPUT = 'output_kaustav.json';
const TOP_N = 3;

function groupIssues(tickets) {
  const groups = new Map();
  for (const t of tickets) {
    if (!groups.has(t.issue_key)) groups.set(t.issue_key, []);
    groups.get(t.issue_key).push(t);
  }

  const issues = [...groups.values()].map((members) => {
    const lead = members.reduce((a, b) => (URGENCY_RANK[b.urgency] > URGENCY_RANK[a.urgency] ? b : a));
    const customers = new Set(members.map((t) => t.customer_email ?? t.ticket_id));
    const times = members.map((t) => t.received_at).filter(Boolean).sort();
    return {
      issue: lead.subject,
      category: lead.category,
      urgency: lead.urgency,
      customer_count: customers.size,
      ticket_ids: members.map((t) => t.ticket_id),
      reason: lead.urgency_reason,
      customer_marked_urgent: members.some((t) => t.customer_marked_urgent),
      earliest: times[0] ?? '9999',
    };
  });

  issues.sort(
    (a, b) =>
      URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency] ||
      b.customer_count - a.customer_count ||
      Number(b.customer_marked_urgent) - Number(a.customer_marked_urgent) ||
      a.earliest.localeCompare(b.earliest)
  );

  return issues.slice(0, TOP_N).map(({ earliest, ...issue }, i) => ({ rank: i + 1, ...issue }));
}

function groupDropped(dropped) {
  const byReason = new Map();
  for (const d of dropped) {
    if (!byReason.has(d.reason)) byReason.set(d.reason, []);
    byReason.get(d.reason).push(d.ticket_id);
  }
  return [...byReason].map(([reason, ids]) => ({ reason, count: ids.length, ticket_ids: ids }));
}

function printSummary(out) {
  const s = out.summary;
  const droppedTotal = s.dropped.reduce((n, d) => n + d.count, 0);
  console.log(`Read ${s.rows_read} rows, processed ${s.processed} tickets, dropped ${droppedTotal}, merged ${s.merged_follow_ups} follow-ups.`);
  for (const d of s.dropped) console.log(`  dropped ${d.count} ${d.reason}: ${d.ticket_ids.join(', ')}`);
  console.log(`\nLook at these first:`);
  for (const t of out.top_issues) {
    const who = `${t.customer_count} customer${t.customer_count === 1 ? '' : 's'}`;
    console.log(`  ${t.rank}. [${t.urgency}/${t.category}] ${t.issue} (${who}: ${t.ticket_ids.join(', ')})`);
    console.log(`     ${t.reason}`);
  }
  console.log(`\nClassified by ${out.classifier} (${out.model}). Wrote ${OUTPUT}`);
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  let model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const csvText = fs.readFileSync(path.join(ROOT, INPUT), 'utf8');
  const { rowsRead, tickets, dropped, mergedFollowUps } = cleanTickets(csvText);

  let classifier = 'gemini';
  let classified;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set, using the rule-based classifier.');
    classifier = 'rules';
  } else {
    try {
      classified = await classify(tickets, { apiKey, model });
    } catch (err) {
      console.warn(`${err.message}\nFalling back to the rule-based classifier.`);
      classifier = 'rules';
    }
  }
  if (classifier === 'rules') {
    classified = classifyByRules(tickets);
    model = 'rules-v1';
  }
  const kept = [];
  for (const t of tickets) {
    const c = classified.get(t.ticket_id);
    if (c.category === 'not_support') {
      dropped.push({ ticket_id: t.ticket_id, reason: 'not_a_support_ticket' });
      continue;
    }
    kept.push({
      ...t,
      category: c.category,
      urgency: c.urgency,
      urgency_reason: c.urgency_reason,
    });
  }

  const output = outputSchema.parse({
    generated_at: new Date().toISOString(),
    source_file: INPUT,
    classifier,
    model,
    summary: {
      rows_read: rowsRead,
      processed: kept.length,
      merged_follow_ups: mergedFollowUps,
      dropped: groupDropped(dropped),
    },
    top_issues: groupIssues(kept),
    tickets: kept,
    dropped,
  });

  fs.writeFileSync(path.join(ROOT, OUTPUT), JSON.stringify(output, null, 2) + '\n');
  printSummary(output);
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
