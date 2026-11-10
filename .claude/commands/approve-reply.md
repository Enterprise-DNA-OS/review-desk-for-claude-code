---
description: Record review of the exact reply version
---

Read CLAUDE.md, then run:

```bash
npm run reviews -- approve-reply --reply=<id> --evidence="<checks>" --privacy-checked --actor="<different reviewer>"
```

Show the exact stored reply, source review version and evidence to the named reviewer. Record approval only when that person has approved this exact wording. The supplied actor name is an assertion, not authenticated identity. Review the source and disclosure assessment, policy, privacy and retention evidence before approval. Never invent the reviewer.

Writes require the operator’s supplied --actor. Keep evidence, exports and drafts private. Send nothing.
