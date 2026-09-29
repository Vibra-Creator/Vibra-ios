---
name: UGC report moderation
description: Safety constraints for moderator removal and suspension actions on user-generated-content reports.
---

Moderation must act only on content explicitly linked to a report, with the reported author and participants verified. If the content row is already gone, the action may rely on a snapshot only when the report-to-content link was validated when the report was created. Preserve the report and its snapshot after resolution.

**Why:** Generic profile and chat-user reports do not identify one exact item. Guessing what to delete can remove unrelated content or suspend the wrong account, while deleting the report destroys useful review evidence.

**How to apply:** When adding reportable content types, store an explicit typed content ID and snapshot; validate the reporter, target, and author at submission and revalidate before deletion. Keep deletion and enforcement transactional. Do not substitute whole-profile deletion or arbitrary IDs for an exact content link.