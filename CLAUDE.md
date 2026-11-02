# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## State of the repo

Greenfield. There is no source code yet, only [assignment.md](assignment.md) (the build brief), [tickets_raw.csv](tickets_raw.csv) (input), a stub README, and a bare [package.json](package.json) (CommonJS, no dependencies, no real test script). Read the assignment before building anything.

## What is being built

A Node.js 18+ CLI that reads `tickets_raw.csv` (~120 messy support tickets), cleans it, classifies each valid ticket into a category with an urgency, and writes `output_<firstname>.json` (lowercase, no spaces). The user's git identity is KausTarafdar, so the likely filename is `output_kaustav.json`, but confirm the first name with the user.

Hard requirements from the brief:
- One terminal command to run, documented in the README. No web UI, React or Express.
- The output JSON is validated with Zod before it is written.
- Terminal summary: tickets processed, dropped count with reasons, and the top 3 tickets to look at first.
- The category list is not given. Choosing it is part of the task and must be justified in the README.
- The generated output JSON must be committed.
- README.md must have exactly these four headings, in order: `How to run it`, `Decisions I made`, `How I used AI`, `Time spent`. The AI section is capped at half a page and must include a specific instance where the AI was wrong or over-engineered. Write this honestly, do not invent it.
- The brief caps the work at about 2 hours. Prefer small and solid over large.

## Input data quirks (tickets_raw.csv)

Header: `ticket_id, received_at, customer_email, subject, body, channel, priority_flag`. The header has 6 columns without `priority_flag`, yet the brief lists 7, so check how rows actually line up.

Observed problems to handle and document:
- Unquoted commas inside `subject` (e.g. `SSO login broken for our whole team, urgent`) shift columns, so a naive CSV parse misaligns fields. Plan for this explicitly.
- Mixed timestamp formats: `2026-10-21 17:05:00` and `20/10/2026 7:25 PM` (day-first, 12-hour).
- Inconsistent `channel` casing (`email`, `CHAT`).
- Malformed emails (e.g. `sneha.@acmecorp.com`), duplicate rows, missing fields, and entries that are not support tickets.
