# Ticket Triage Tool: build task

Time: do not spend more than 2 hours of actual work on this. We mean it. Something smaller and solid beats something bigger and rushed, and we will ask you how long you took. Knowing when to stop is part of the job.

## The problem
Attached is tickets_raw.csv - about 120 customer support messages pulled out of a shared inbox. It's real-world messy: inconsistent casing, some duplicate rows, missing and malformed fields, timestamps in more than one format, and a few entries that aren't support tickets at all.

A support lead currently reads all of these every morning and decides what to deal with first. We want to give them ten minutes of their morning back.

Build a command-line tool in Node.js that reads this file and produces a triage output the lead could actually act on.

## Requirements
- Node.js 18+. Runs from the terminal in one command, documented in the README. No web UI, no React, no Express : if you build one we'll ignore it, and you'll have spent hours we didn't ask for.
- It cleans the data and handles the bad rows. Your call on what "handle" means for each kind of bad row - just be ready to defend it.
- It classifies every valid ticket into a category and gives it an urgency. We haven't given you a category list. Deciding what the categories should be is part of the task.
- It writes one JSON file named `output_<yourfirstname>.json`, all lowercase, no spaces. So if your name is Rahul, that's output_rahul.json.
- The output is validated against a schema using Zod before it's written. If you haven't used Zod before, that's expected - picking it up is part of the assignment.
- It prints a short human-readable summary to the terminal: how many tickets were processed, how many were dropped and why, and the top 3 things the lead should look at first.
- A package.json with your dependencies. Any npm packages you want.

**Field reference** for tickets_raw.csv: `ticket_id, received_at, customer_email, subject, body, channel, priority_flag`.

## What to send back
One GitHub repo link - public, or private with <your-github-handle> invited - containing:

The code and `package.json`.
The generated `output_<yourfirstname>.json`, committed.
`README.md` with exactly these four headings, in this order:
- How to run it
- Decisions I made
- How I used AI
- Time spent
Under ## How I used AI, keep it to half a page. Which tools, for what. And at least one specific instance where the AI gave you something wrong, misleading or over-engineered - how you noticed, and what you did instead. If you honestly never caught it out, say so, and say what you think that means.


## One last thing
If something in this brief is unclear or doesn't add up, just reply to this email and ask. Asking is not a mark against you - it's the opposite. You're equally welcome to make a reasonable assumption and write it down under ## Decisions I made. Either is fine.

Going quiet and guessing is the only wrong move.