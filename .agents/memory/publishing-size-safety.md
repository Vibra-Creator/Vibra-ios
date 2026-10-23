---
name: Publishing size safety
description: Safety boundary for reducing the publishing image without removing source history or application media.
---

Limit size reduction to build-only copies of caches and version-control history in the isolated publishing environment. Keep ordinary workspace builds non-destructive and preserve runtime images, videos, uploads and attachments.

**Why:** Publishing failed after compilation succeeded because the total image layers exceeded 8 GiB. Local browser caches, source media and generated copies make workspace size misleading; removing application media to reduce size would break existing content.

**How to apply:** Preserve an explicit publishing-environment guard and completed-build checks before any cleanup. Test cleanup against temporary fixtures, never against the real workspace history. Only another publishing attempt can confirm the remote image fits its total layer limit.
