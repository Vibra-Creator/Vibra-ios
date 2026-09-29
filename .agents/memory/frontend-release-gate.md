---
name: Frontend release gate
description: Why production builds validate the browser code separately from the full-project type check.
---

The frontend type check is a release gate. Keep it clean and blocking; do not suppress diagnostics or couple it to a failing whole-project check until server type debt is resolved.

**Why:** Bundling without TypeScript validation once allowed an undefined UI identifier to reach users, while unrelated server diagnostics made the old combined check unusable as a release gate.

**How to apply:** When changing the production build, preserve the client-only check before bundling. Resolve new client diagnostics rather than broadening exclusions to pass the build.