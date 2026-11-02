# Ticket Triage Util

Reads `tickets_raw.csv`, cleans it, classifies each ticket with Gemini, and writes output JSON plus a short terminal summary for the support lead.

## How to run it

Requires Node.js 18+ and a Gemini API key (Google AI Studio).

```
npm install
cp .env.example .env   # then put your key in .env
npm start
```

`GEMINI_API_KEY` can also be exported in the shell instead of using `.env`. Optional: `GEMINI_MODEL` overrides the default model. Without a key, or if Gemini still fails after 4 attempts with backoff, the tool uses the rule-based classifier instead and says so in the terminal.

## Decisions I made

**Cleaning**
- The file has no `priority_flag` column. Two rows (TKT-1004, TKT-1065) have an unquoted `, urgent` in the subject, which shifts the columns. The brief's field reference lists `priority_flag`, but the sender confirmed it is not in the file and left the reading of these two rows to me. I read `urgent` as the customer typing it into the message: I rejoin the subject, strip `urgent`, and set `customer_marked_urgent`. A customer asking for priority is not a reason to trust it, so it never changes the assigned urgency, which stays an impact rating. It is kept as a visible `customer_marked_urgent` field and used only as a tie-breaker when ranking issues of equal urgency and customer count. The classifier never sees it.
- Exact repeat ticket IDs (6 rows) are dropped as `duplicate`, keeping the first.
- A row with the same customer and subject as an earlier ticket and a body ending "Following up on this." is merged into the original (`follow_up_ids`) and not counted as dropped. It is the same issue, and the lead should see that the customer chased.
- Spam, a newsletter and an out-of-office reply are caught by Gemini as `not_support` and dropped as `not_a_support_ticket`.
- Invalid emails (`not-an-email`, `priya@`, empty, and so on) are kept with `customer_email: null` and an `invalid_email` flag, because one of them reports an API outage. The check is deliberately lenient, so addresses like `sneha.@acmecorp.com` pass.
- Empty bodies are kept and classified from the subject, with a `missing_body` flag. A row is dropped as `unusable` only when the ticket ID is missing or both subject and body are empty.
- Timestamps come in three formats (ISO, day-first `20/10/2026 7:25 PM`, and `Oct 23, 2026 21:05`). All are written as ISO 8601. The data has no timezone, so I assume UTC.
- Channel is trimmed and lowercased. Subjects are trimmed and keep their casing, but the grouping key is lowercased.

**Classification**
- One batched Gemini call with a JSON response schema and temperature 0. The reply is checked with Zod, and the ticket IDs must match exactly. Up to 4 attempts with exponential backoff (2s, 4s, 8s), since overload errors like 503 are usually brief, then the tool falls back to a keyword classifier (`src/rules.js`), as it does when no key is set. The output records which one ran in `classifier`. The rules are ordered, first match wins, and cover every issue in this file, but they will not generalize to new wording the way Gemini does.
- Categories: `outage`, `account_access`, `security`, `data_integrity`, `bug`, `billing`, `how_to`, `feature_request`, plus `not_support` for filtering. They map to who in the team would act on the ticket.
- Urgency: `critical` (production down, data lost, security, whole team blocked), `high` (one user blocked, or money wrong), `medium` (degraded, workaround exists), `low` (questions, requests).

**Top 3**
- Tickets are grouped by normalized subject, because the same problem arrives from many customers. Issues are ranked by worst urgency, then distinct customers, then earliest report. Every ticket still appears individually in the output.

## How I used AI

TODO: write this yourself, in your own words (half a page max). Include the tools used and at least one concrete case where the AI was wrong, misleading or over-engineered.

## Time spent

TODO: fill in the real time you spent.
