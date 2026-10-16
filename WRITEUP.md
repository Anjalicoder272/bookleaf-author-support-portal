# Write-up: Approach, Trade-offs and Next Steps

**What I prioritised.** I treated this as a real operations tool, not a demo of an API call. Since the
brief weights AI quality and architecture at 25% each, I built the core ticket lifecycle end to end
first (author raises → AI triages → admin reviews a draft → author sees the reply), then spent the
remaining effort on the parts that make AI dependable in production: grounding, cost and failure handling.

**AI that knows BookLeaf, not generic AI.** Drafts are grounded in two things: the knowledge-base
section for the ticket's category, and the author's actual records (royalty paid/pending, last payout,
book status, and a computed next payout date). That's what lets a reply say "your ₹3,570 pending royalty
will be paid by 14 November" instead of "we'll look into it". The tone rules from the brief are in the
system prompt verbatim. Triage uses schema-enforced JSON with a written priority rubric, so labels are
always valid and consistent.

**Cost.** I avoided sending the whole knowledge base and history on every call: one policy section per
draft, no knowledge base for triage, trimmed conversation history, only the relevant book's data, cached
drafts that regenerate only when the conversation changes, and minimal thinking. In testing, triage cost about 370 tokens per ticket and a draft about 1,000. Every call logs its
token usage.

**Failure as a normal case.** A ticket is saved before the AI is involved, so an outage can never lose
an author's query. If triage fails, a keyword classifier keeps the queue usable and marks those labels;
if drafting fails, the admin simply writes the reply. Admin overrides are stored separately from the
AI's suggestion, so a re-run never undoes a human decision.

**Trade-offs I made.**
- *Polling instead of WebSockets.* Support replies don't need sub-second delivery, and polling works
  reliably on free hosting with no extra infrastructure. The API already supports `updated_since`, so
  moving to SSE later is incremental.
- *A background thread instead of a task queue* for triage. It keeps deployment to one service; the
  trade-off is no automatic retries.
- *Django REST Framework* over a lighter framework: auth, permissions, validation and OpenAPI docs come
  built in, which let me spend time on the AI and product decisions instead of plumbing.
- *Attachments are UI-only*, as the brief allowed.

**Evolving this into production.**
1. Move AI work to Celery + Redis with retries, exponential backoff on 429s, and a per-day token budget.
2. Measure quality: use the stored AI-vs-admin labels and "draft sent unedited" rates as metrics, and keep
   a regression set of real tickets to test prompt changes before shipping them.
3. Add SLA timers by priority, email notifications to authors, and canned responses for common issues.
4. Let the AI see more context safely: real royalty breakdowns per platform, production stage history,
   and photos for printing issues, with retrieval over past resolved tickets for consistency.
5. Harden auth (httpOnly cookies, refresh rotation, login rate limiting) and add audit logs for admin
   actions on author data.
