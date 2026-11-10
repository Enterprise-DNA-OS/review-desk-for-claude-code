---
description: Record a response manually posted by the operator
---

Read CLAUDE.md, then run:

```bash
npm run reviews -- record-posting --reply=<id> --url=<posting-url> --posted-at=<ISO-time-with-zone> --evidence="<posting record>" --actor="<operator>"
```

This command sends nothing. Use it only after the operator has manually posted the approved wording and provides the URL, time and evidence. Do not fabricate a platform receipt. It refuses a superseded reply, missing approval or a posting time before approval.

Writes require the operator’s supplied --actor. Keep evidence, exports and drafts private. Send nothing.
