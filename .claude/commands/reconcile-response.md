---
description: Reconcile a reply already present in the source export
---

Read CLAUDE.md, then run:

```bash
npm run reviews -- reconcile-response --review=<id> --evidence="<source check>" --actor="<operator>"
```

Use --json when comparing records. Codes match without regard to case. For a partial ID or name, stop on an ambiguous match and show the candidates. Report the source time and distinguish imported facts from operator assertions.

Writes require the operator’s supplied --actor. Keep evidence, exports and drafts private. Send nothing.
