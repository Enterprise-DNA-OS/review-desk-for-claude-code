---
description: Bring Grade.us review records across
---

Read CLAUDE.md, then run:

```bash
npm run reviews -- import grade-us --file=<export.csv> --map=<mapping.json> --location=<code> --source=<account-profile> --exported-at=<ISO-time-with-zone> --actor="<operator>" --dry-run
```

Read docs/replace-grade-us.md first. Check the actual CSV headers and create the mapping explicitly. The fixture is synthetic, not a captured vendor export. Preview, compare counts and dates with the source, then repeat without --dry-run within the authorised import. Never infer publication or consent from a status label. Preserve one source name per account and profile.

Writes require the operator’s supplied --actor. Keep evidence, exports and drafts private. Send nothing.
