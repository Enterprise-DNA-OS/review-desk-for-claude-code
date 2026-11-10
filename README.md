# Review Desk for Claude Code

Know which location needs a reply, who owns it and what evidence supports the wording. Keep the original review, each changed version, the approved response and the record of a manual posting in one database.

## Three ways to use it

- **Do it yourself:** free MIT source. Run the demo, map your Grade.us review export and operate your own response desk.
- **We customise it:** Enterprise DNA brings your records across and builds your fields, approval rules, connections and shared screens. Setup fee, then a retainer.
- **We run it for you:** installed, connected and operated through **Omni by Enterprise DNA**, for a setup fee then a retainer. [Talk to Sam](https://enterprisedna.co/omni/book?offer=replace-software&utm_campaign=grade-us&utm_medium=readme).

## Quick start

Node 20 or newer on Windows or Linux. The default PGlite database needs no database service. Set DATABASE_URL for PostgreSQL. Claude Code, Codex, OpenCode and Cursor share the same instructions.

```bash
npm install
npm run demo
npm run reviews -- response-queue
npm run reviews -- location-health
npm run reviews -- weekly-review
npm run view
npm run docs
npm test
```

Demo people, centres, reviews, URLs and evidence are synthetic. Run demo in an empty local database. The fixture demonstrates explicit mapping; it is not a vendor-export specimen. Read [operations](docs/operations.md) before real records.

## The daily and weekly work

/response-queue shows the next response action. /location-health compares coverage. /owner-load balances overdue work. /source-freshness identifies missing or stale exports. /compliance shows evidence that needs review. /weekly-review combines the response queue, location health, integrity checks and service actions.

Every CLI command supports --json. Writes require --actor. Exact codes and names match without regard to case; partial IDs and names must identify one record. Ambiguity lists candidates and exits 1. The same source review ID can appear at different locations, so use the local ID from reviews when needed.

## Import your history

```bash
npm run reviews -- import grade-us --file=fixtures/grade-us.csv --map=fixtures/grade-us-map.json --location=HARBOUR --source=synthetic-demo --exported-at=2026-11-01T00:00:00Z --actor=Demo --dry-run
```

Replace the file, mapping, location, source and time with your actual export. Repeat without --dry-run after reconciliation. Source identity is location plus source name plus exported review ID. The importer preserves original CSV, every original column and all prior changed versions. Identical imports are harmless; changed exports require a later timestamp. Missing rows never delete history.

Grade.us documents CSV review exports but does not publish a stable column contract. Inspect your headers and set the mapping once. If there is no stable ID, use a stable review URL as external_id. A ratings-only summary cannot become individual review history. [Exact import instructions](docs/replace-grade-us.md).

## A reply is an evidence trail

Read detail first. Record assess with the evidence you checked. Write the proposed response in a private file and use draft-reply. A different named person inspects and approves the exact reply with approve-reply. After the operator manually posts it, record-posting stores their URL, timestamp and evidence. No command sends a message or posts a review.

New source content reopens the response queue. Earlier versions, drafts and approvals remain in history but cannot approve a new version. A newer draft also makes an older approval unusable. An imported source reply needs reconcile-response; its presence never silently closes the local work. Actor names are supplied assertions, not authenticated signatures.

## Ten questions your own review desk answers

1. Which location has low-rated reviews still awaiting a response? location-health
2. Which response is overdue, and who owns it? response-queue
3. Which approved reply still needs manual posting? response-queue
4. Which imported response has not been checked against the original? response-queue
5. Which source review changed after our last decision? history
6. Which review version did the approver actually inspect? detail and history
7. Which locations have no recent export? source-freshness
8. Which integrity concerns or disclosures need evidence? compliance
9. Which service fixes remain open after a review was answered? actions
10. Which owner has the greatest response backlog? owner-load

These are supported questions, not a claim that Grade.us cannot answer similar ones. Your own evidence, response rules and service fixes can be analysed together and changed to fit your business.

## Commands

| Job | CLI |
|---|---|
| Show the location register | locations |
| Read all imported reviews | reviews |
| Plan the daily response round | response-queue |
| Compare response coverage across locations | location-health |
| Balance the response workload | owner-load |
| Find overdue responses and quiet work | attention |
| Review source integrity, disclosures and privacy evidence | compliance |
| Review service fixes arising from reviews | actions |
| Reconcile import batches and source times | imports |
| Find locations whose exports need refreshing | source-freshness |
| Read the operator decision history | audit |
| Prepare the Monday review pack | weekly-review |
| Read a review and its current response evidence | detail |
| Inspect prior source versions and decisions | history |
| Register a location | add-location |
| Record a location policy and access review | policy |
| Assign response ownership and due date | assign |
| Record a source and disclosure assessment | assess |
| Record an evidenced decision not to reply | no-response |
| Reopen a response with a reason | reopen |
| Reconcile a reply already present in the source export | reconcile-response |
| Write a private response for review | draft-reply |
| Record review of the exact reply version | approve-reply |
| Record a response manually posted by the operator | record-posting |
| Assign the service fix behind a review | add-action |
| Close a service fix with evidence | close-action |
| Record a private investigation note | log |
| Bring Grade.us review records across | import |
| Export all records and original source evidence | export |

Run npm run reviews -- help for options. /docs and /view render HTML. /new-view adds a report; /customise adds fields or rules through a tested migration.

## Documents in your name

Set your name, logo and colours in brand.json. npm run docs produces a location review report and a response evidence record for each review. npm run view produces the weekly response desk and integrity checks. Reports include every imported rating, including reviews marked no-response. Counts and averages cover imported records only; they are never represented as the live platform rating.

## Your first hour: ten things to ask for

1. Put our name on the location report.
2. Show the overdue response round.
3. Show which locations need a fresh export.
4. Explain the source reply that needs reconciliation.
5. Show the service action behind the cancellation review.
6. Preview an actual export without writing records.
7. Compare the source review with its changed version.
8. Draft a response using only the evidence supplied.
9. Show the policy and retention checks still missing.
10. Add a regional manager field with /customise.

## Scope and proof

This is an operator-run review records and response desk. It does not collect live platform reviews, send invitations, host public review forms, offer a phone app or authenticate reviewers. Grade.us offers collection, connections, widgets and hosted access beyond this base. Enterprise DNA scopes those connections and surfaces with the owner. Platform access and permissions remain subject to the platform. [Why no front end](docs/why-no-front-end.md).

[Compliance rules and sources](docs/compliance.md), [research](docs/research.md), [verification](docs/verification.md). npm test uses disposable data and covers every CLI command, imports, source revisions, reply approvals, rollback, exports and escaped HTML.

MIT. Not affiliated with Grade.us, GatherUp or Anthropic. Hosting, agent use and ongoing operation remain your costs.
