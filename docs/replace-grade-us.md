# Replace Grade.us review records

## Export before cancelling

Grade.us [documents CSV exports with performance reports](https://blog.grade.us/heres-weve-working-grade-us-feature-update/) and the inclusion of status flags and notes in directly collected review exports. Its [current pricing FAQ](https://www.grade.us/home/plans/) confirms that first-party reviews can be exported before cancellation. Check your account’s Reports and directly collected review export controls, set the complete date range and download individual review records as CSV. The historical feature article is from 2017 and is not proof of the current button layout. If your current account cannot expose the individual records, obtain the export through Grade.us support before switching.

Third-party reviews remain on the original platform. Downloading a CSV does not transfer platform ownership, permissions, API approvals or a live collection connection. A summary containing only counts and averages cannot populate this importer.

## One import command after mapping

Create the location with add-location. Choose a fixed source name for the original account/profile and keep it unchanged on subsequent imports. Inspect the actual headers, then copy fixtures/grade-us-map.json to a private mapping file and set each value to the matching source column. The fixture is synthetic: the vendor has not published a stable CSV header contract. No column names are claimed to be exact vendor headers.

Required fields: external_id, platform, rating, reviewed_on, body. Optional: reviewer, review_url, source_reply, source_status, source_notes. A stable review URL may be mapped to external_id when the export has no ID; leave review_url unmapped in that case to avoid using one column twice. Platform must come from an explicit source column; if your export is single-platform, add that known value to a working copy and retain the untouched original separately. Do not infer it. Dates must be YYYY-MM-DD and ratings integers 1 through 5. Normalise a working copy when needed and retain the original.

```bash
npm run reviews -- import grade-us --file=imports/reviews.csv --map=imports/mapping.json --location=YOUR-CODE --source=your-account-profile --exported-at=2026-11-01T00:00:00Z --actor="Your name" --dry-run
```

Use the actual export timestamp. Check row counts, rating range, date range and a sample of multiline reviews. Repeat the same command without --dry-run. This is one import per source location. Split a portfolio export by its actual location identifier before loading; do not load mixed locations as one.

## What maps

Original CSV and the explicit mapping are retained with their hash. Every original column survives in raw_record, including columns not mapped. Mapped values populate the review desk. The source status and response remain source evidence; they are not local approval or completion. Use reconcile-response after comparing a source reply with the original.

Repeated identical files and mapping do nothing. Newer exports update changed review versions and reopen work. They never erase older evidence or silently remove reviews omitted by a filter. An export with duplicate IDs, invalid dates, out-of-range ratings or a missing mapped column is rejected before any data is committed.

## What needs separate work

Campaigns, recipient consents, messages, site credentials, attachments, widgets, public forms, live monitoring and permissions are outside the CSV migration. Agree their migration and platform connections separately. This base does not replace the review platforms themselves. Have Enterprise DNA bring the history across and test the connections as part of the custom version.

## Reconcile before switching

Compare imports, reviews and detail against the source. Compare the imported counts per location and platform. Check status notes and original columns in export. Do not cancel the source until the owner has checked history and the required ongoing collection method. Export all local records with npm run reviews -- export --out=exports/review-desk.json. This JSON includes original CSV and is a data export, not a PostgreSQL or PGlite backup; follow operations for backup and restore.

Sources checked 10 November 2026.
