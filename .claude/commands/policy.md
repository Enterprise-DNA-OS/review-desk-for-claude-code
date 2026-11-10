---
description: Record a location policy and access review
---

Read CLAUDE.md, then run:

```bash
npm run reviews -- policy --location=<code> --policy-url=<url> --security-evidence="<evidence>" --policy-review-on=<date> --retention-review-on=<date> --purpose="<purpose>" --actor="<operator>"
```

Use --json when comparing records. Codes match without regard to case. For a partial ID or name, stop on an ambiguous match and show the candidates. Report the source time and distinguish imported facts from operator assertions.

Writes require the operator’s supplied --actor. Keep evidence, exports and drafts private. Send nothing.
