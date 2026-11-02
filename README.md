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

### Cleaning

- The file has no `priority_flag` column. Two rows (TKT-1004, TKT-1065) have an unquoted `, urgent` in the subject, which shifts the columns. I read `urgent` as the customer typing it into the message: I rejoin the subject, strip `urgent`, and set `customer_marked_urgent`. A customer asking for priority is not a reason to trust it, and shouldn't change the assigned urgency. It is kept as a visible `customer_marked_urgent` field and used only as a tie-breaker when ranking issues of equal urgency and customer count.
- Exact repeat ticket IDs (6 rows) are dropped as `duplicate`, keeping the first.
- A row with the same customer and subject as an earlier ticket and a body ending "Following up on this." is merged into the original as `follow_up_ids`.
- Spam, a newsletter and an out-of-office reply are caught as `not_support` and dropped as `not_a_support_ticket`.
- Invalid emails (`not-an-email`, `priya@`, empty, and so on) are kept with `customer_email: null` and an `invalid_email` flag, because one of them reports an API outage. The check is deliberately lenient, so addresses like `sneha.@acmecorp.com` pass.
- Empty bodies are kept and classified from the subject, with a `missing_body` flag. A row is dropped as `unusable` only when the ticket ID is missing or both subject and body are empty.
- Timestamps come in three formats (ISO, day-first `20/10/2026 7:25 PM`, and `Oct 23, 2026 21:05`). All are normalized to ISO. The data has no timezone, so I assumed UTC.
- Channel is trimmed and lowercased. Subjects are trimmed and keep their casing, but the grouping key is lowercased.

### Classification
- Assumption: real tickets will not have uniform subjects and bodies, so the primary classifier is an LLM, not keyword rules. A lite model judges meaning better than patterns do. The default is `gemini-flash-lite-latest` for that reason: cheap and fast, but still enough for this task.
- The tool makes one batched Gemini call with a JSON response schema and temperature 0. The reply is checked with Zod, and the ticket IDs must match exactly. Up to 4 attempts with exponential backoff (2s, 4s, 8s), since overload errors like 503 are usually brief.
- If the API fails, the tool falls back to a keyword classifier (`src/rules.js`), as it does when no key is set. The output records which one ran in `classifier`. The rules are ordered, first match wins, and cover every issue in this file, but they will not generalize to new wording the way Gemini does.
- The rules classifier joins the subject and body, lowercases them, and checks a list of `[regex, category, urgency, reason]` rules in order. The first match wins, so severe and specific patterns (spam, security, data loss, outages) come before broad ones (billing, feature requests, bugs). A ticket that matches nothing becomes `bug` / `medium` with the reason "No rule matched, needs a manual look".

Categories map to who in the team would act on the ticket:

| Category | What it covers |
| --- | --- |
| `outage` | A core feature or integration is down or failing broadly, or production is affected |
| `account_access` | Login, lockout, password reset, 2FA, SSO |
| `security` | Suspicious activity or a possible compromise |
| `data_integrity` | Data lost, duplicated, wrong or missing |
| `bug` | Something misbehaves but the product is up |
| `billing` | Charges, invoices, refunds, plan or seat changes, pricing, trials |
| `how_to` | Usage or setup questions, docs, onboarding |
| `feature_request` | Asks for something the product does not do |
| `not_support` | Spam, newsletters, auto-replies. Used only for filtering and dropped from the output |

Urgency is about impact, not tone:

| Urgency | Meaning | Typical examples |
| --- | --- | --- |
| `critical` | Production down, data lost, a security issue, or a whole team blocked | API returning 500s, SSO broken for a team, suspicious login |
| `high` | One user blocked from the product, or money is wrong | Locked out, charged twice |
| `medium` | Degraded or buggy, but a workaround exists | Crashes, timezone bugs, wrong totals |
| `low` | Questions and requests | How-to, invoice copy, feature ideas |

### Top 3
- Tickets are grouped by normalized subject (lowercased), because the same problem arrives from many customers and would otherwise fill all three slots. Each group is represented by its most urgent ticket. Every ticket still appears individually in the output.
- Issues are sorted by these rules, each applying only when the one above is tied:
  - Worst urgency, critical first.
  - Most distinct customers. A ticket with no valid email counts as a unique customer.
  - Marked urgent by a customer. This is a tie-breaker only, since asking for priority is not evidence.
  - Earliest report, so the issue that has waited longest wins.
- The top 3 groups are printed in the terminal and saved as `top_issues` in the output, each with a `rank` and all its ticket IDs.

## How I used AI

I used Claude Code (my usual agent) and Gemini 3.8 Flash to design and build this project. The reasoning for using an LLM as the classifier is in the Classification section.

Claude Code produced the initial design and first version, and I revised it where I saw a need:

- **Failure handling:** the first version relied entirely on Gemini, with no handling for 429 quota errors and no fallback. I added both, plus a regex classifier to use when Gemini is unavailable.
- **Model choice:** this is a simple classification task, so I switched to a smaller, cheaper Flash-Lite model, which does the job well enough.
- **Where the AI was over-engineered:** Claude added a separate `dropped` list to the output JSON and its Zod schema, alongside the dropped list already in the summary. This was redundant, since the summary already has the dropped ticket IDs and reasons, and dropped tickets are mostly unimportant or need manual review. I removed it.

## Time spent

- **Initial build (45 minutes):** a simple three-phase script covering cleaning, classification and output.
- **Refinement (about 30 mins):** simplifying the script's usage and output, and testing it.
- **Documentation (about 1 hour):** choice to take more time writing this README so it reflects my decisions, intent and design choices accurately.
