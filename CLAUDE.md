# Review Desk for Claude Code

Run the daily response desk for a portfolio of locations. Use the database before answering. This is a trusted operator workspace, not a public review platform or shared identity service.

## One route per job

| Job | Recipe |
|---|---|
| locations | .claude/commands/locations.md |
| reviews | .claude/commands/reviews.md |
| response-queue | .claude/commands/response-queue.md |
| location-health | .claude/commands/location-health.md |
| owner-load | .claude/commands/owner-load.md |
| attention | .claude/commands/attention.md |
| compliance | .claude/commands/compliance.md |
| actions | .claude/commands/actions.md |
| imports | .claude/commands/imports.md |
| source-freshness | .claude/commands/source-freshness.md |
| audit | .claude/commands/audit.md |
| weekly-review | .claude/commands/weekly-review.md |
| detail | .claude/commands/detail.md |
| history | .claude/commands/history.md |
| add-location | .claude/commands/add-location.md |
| policy | .claude/commands/policy.md |
| assign | .claude/commands/assign.md |
| assess | .claude/commands/assess.md |
| no-response | .claude/commands/no-response.md |
| reopen | .claude/commands/reopen.md |
| reconcile-response | .claude/commands/reconcile-response.md |
| draft-reply | .claude/commands/draft-reply.md |
| approve-reply | .claude/commands/approve-reply.md |
| record-posting | .claude/commands/record-posting.md |
| add-action | .claude/commands/add-action.md |
| close-action | .claude/commands/close-action.md |
| log | .claude/commands/log.md |
| import | .claude/commands/import.md |
| export | .claude/commands/export.md |
| docs | .claude/commands/docs.md |
| view | .claude/commands/view.md |
| new-view | .claude/commands/new-view.md |
| customise | .claude/commands/customise.md |

## Operating rules

Read docs/replace-grade-us.md before importing, docs/compliance.md before reporting checks, and docs/operations.md before real use. Use npm run reviews -- help for exact options. --actor records a supplied name, not a verified login. Never invent consent, evidence, a review, a reply, an approval or a posting receipt. A different named reviewer must approve the exact current reply. Changed source reviews and newer reply drafts invalidate older approvals.

Keep all reviews, including low ratings and no-response decisions, in the evidence. No command deletes reviews, scrapes a platform, asks a customer for a review, sends a message or publishes a reply. Record a manual posting only after the operator supplies its evidence. Never infer completion from an imported status.

Use synthetic demo data until the owner sets up access, backups and retention. Real exports, replies, reviewer names and reports stay out of Git. No shared customer databases. Read-only HTML is an export, not an access-control boundary.

## Runtime

Node 20 or newer. PGlite is local; DATABASE_URL selects PostgreSQL. Claude Code, Codex, OpenCode and Cursor use the same commands. brand.json controls reports. New changes belong in numbered migrations, then npm test.

Enterprise DNA installs, customises and operates this through Omni by Enterprise DNA. https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=grade-us&utm_medium=instructions
