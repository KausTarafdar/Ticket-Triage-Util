import { z } from 'zod';

const CATEGORIES = [
  'outage',
  'account_access',
  'security',
  'data_integrity',
  'bug',
  'billing',
  'how_to',
  'feature_request',
  'not_support',
];

const URGENCIES = ['critical', 'high', 'medium', 'low'];

const URGENCY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };

const category = z.enum(CATEGORIES);
const urgency = z.enum(URGENCIES);
const isoDate = z.iso.datetime();

const classificationSchema = z.object({
  results: z.array(
    z.object({
      ticket_id: z.string(),
      category,
      urgency,
      urgency_reason: z.string().min(1),
    })
  ),
});

const ticketSchema = z.object({
  ticket_id: z.string().min(1),
  received_at: isoDate.nullable(),
  customer_email: z.string().nullable(),
  subject: z.string(),
  body: z.string().nullable(),
  channel: z.string().nullable(),
  category: category.exclude(['not_support']),
  urgency,
  urgency_reason: z.string(),
  customer_marked_urgent: z.boolean(),
  flags: z.array(z.string()),
  follow_up_ids: z.array(z.string()),
  issue_key: z.string(),
});

const outputSchema = z.object({
  generated_at: isoDate,
  source_file: z.string(),
  classifier: z.enum(['gemini', 'rules']),
  model: z.string(),
  summary: z.object({
    rows_read: z.number().int(),
    processed: z.number().int(),
    merged_follow_ups: z.number().int(),
    dropped: z.array(
      z.object({
        reason: z.string(),
        count: z.number().int(),
        ticket_ids: z.array(z.string()),
      })
    ),
  }),
  top_issues: z.array(
    z.object({
      rank: z.number().int(),
      issue: z.string(),
      category: category.exclude(['not_support']),
      urgency,
      customer_count: z.number().int(),
      ticket_ids: z.array(z.string()),
      reason: z.string(),
      customer_marked_urgent: z.boolean(),
    })
  ),
  tickets: z.array(ticketSchema),
  dropped: z.array(z.object({ ticket_id: z.string(), reason: z.string() })),
});

export {
  CATEGORIES,
  URGENCIES,
  URGENCY_RANK,
  classificationSchema,
  outputSchema,
};
