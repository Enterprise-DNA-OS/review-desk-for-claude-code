---
description: Record a source and disclosure assessment
---

Read CLAUDE.md, then run:

```bash
npm run reviews -- assess --review=<id> --finding=checked --relationship=none-known --incentive=none-known --evidence="<what was checked>" --actor="<operator>"
```

Read docs/compliance.md. Finding is checked, uncertain or concern; relationship and incentive are none-known, disclosed, undisclosed or unknown. These are evidence assessments, not a declaration that a review is genuine or fake. Record what was actually checked. Do not suppress a review because it is negative.

Writes require the operator’s supplied --actor. Keep evidence, exports and drafts private. Send nothing.
