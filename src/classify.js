import { GoogleGenAI } from '@google/genai';
import { CATEGORIES, URGENCIES, classificationSchema } from './schema.js';

const DEFAULT_MODEL = 'gemini-flash-latest';
const ATTEMPTS = 4;
const BASE_DELAY_MS = 2000;

const SYSTEM_INSTRUCTION = `You triage customer support tickets for a B2B SaaS product. For every ticket in the input JSON array, return exactly one result with the same ticket_id.

Categories:
- outage: a core feature or integration is down or failing broadly, or production is affected
- account_access: login, lockout, password reset, 2FA, SSO
- security: suspicious activity or a possible compromise
- data_integrity: data lost, duplicated, wrong or missing
- bug: something misbehaves but the product is up
- billing: charges, invoices, refunds, plan or seat changes, pricing questions, trials
- how_to: usage or setup questions, docs, onboarding
- feature_request: asks for something the product does not do
- not_support: spam, newsletters, auto-replies or anything that is not a customer needing help

Urgency:
- critical: production down, data lost, a security issue, or a whole team blocked
- high: one user blocked from the product, or money is wrong
- medium: degraded or buggy, but a workaround exists
- low: questions and feature requests

Use not_support with urgency low for non-tickets. urgency_reason is one short sentence.`;

const RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ticket_id: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          urgency: { type: 'string', enum: URGENCIES },
          urgency_reason: { type: 'string' },
        },
        required: ['ticket_id', 'category', 'urgency', 'urgency_reason'],
      },
    },
  },
  required: ['results'],
};

async function classify(tickets, { apiKey, model = DEFAULT_MODEL }) {
  const ai = new GoogleGenAI({ apiKey });
  const contents = JSON.stringify(
    tickets.map((t) => ({
      ticket_id: t.ticket_id,
      subject: t.subject,
      body: t.body ?? '',
      channel: t.channel,
    }))
  );
  const expected = new Set(tickets.map((t) => t.ticket_id));

  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature: 0,
          responseMimeType: 'application/json',
          responseJsonSchema: RESPONSE_JSON_SCHEMA,
        },
      });
      const { results } = classificationSchema.parse(JSON.parse(res.text));
      const byId = new Map(results.map((r) => [r.ticket_id, r]));
      const missing = [...expected].filter((id) => !byId.has(id));
      const extra = [...byId.keys()].filter((id) => !expected.has(id));
      if (missing.length || extra.length || byId.size !== results.length) {
        throw new Error(`ticket id mismatch (missing: ${missing.join(',') || 'none'}, extra: ${extra.join(',') || 'none'})`);
      }
      return byId;
    } catch (err) {
      lastError = err;
      if (attempt < ATTEMPTS) {
        const delayMs = BASE_DELAY_MS * 2 ** (attempt - 1);
        console.warn(`Gemini attempt ${attempt} failed, retrying in ${delayMs / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw new Error(`Gemini classification failed after ${ATTEMPTS} attempts: ${lastError.message}`);
}

export { classify, DEFAULT_MODEL };
