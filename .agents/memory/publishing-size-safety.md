---
name: Publishing size safety
description: Safety boundary for reducing the publishing image without removing source history or application media.
---

Limit size reduction to build-only copies of caches and version-control history in the isolated publishing environment. Keep ordinary workspace builds non-destructive and preserve runtime images, videos, uploads and attachments.

**Why:** Publishing failed after compilation succeeded because the total image layers exceeded 8 GiB. Local browser caches, source media and generated copies make workspace size misleading; removing application media to reduce size would break existing content.

**How to apply:** Preserve an explicit publishing-environment guard and completed-build checks before any cleanup. Test cleanup against temporary fixtures, never against the real workspace history. Only another publishing attempt can confirm the remote image fits its total layer limit.

Do not rely on `REPLIT_DEPLOYMENT` being set during the publishing **build**. It was absent in actual remote build logs even though it is documented for published runtime. Keep cleanup authorization scoped explicitly to the publishing command, never ordinary workspace commands.

**Why:** Using the runtime variable as a build-time detector caused successful compilations to fail before image packaging.

Preserve the cache root and platform-managed caches; remove only explicitly identified heavy development-cache subdirectories. Use bounded filesystem retries for transient deletion conflicts.

**Why:** The security scanner can still write cache state while the build finishes. Removing the cache root caused a real `ENOTEMPTY` build failure; deleting platform state also risks disrupting that concurrent process.

Successful cache/history cleanup does not establish that the image fits: an actual publish still exceeded the limit after that step completed. Inspect additional build inputs and runtime dependencies before suggesting another retry; preserve runtime-served assets when considering source-asset exclusions.

For this publishing-size investigation, the user declined modifying or excluding attachments. Leave the original attachments and their inclusion unchanged unless the user explicitly changes that decision.

**Why:** The user selected “No, non modificare gli allegati” when asked whether unused attachments could be excluded from publishing while preserving originals.

Keep Java and Python installed during this publishing-size investigation.

**Why:** The user explicitly declined removing these tools to reduce the publishing package.
