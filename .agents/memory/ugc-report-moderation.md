---
name: UGC report moderation
description: Safety constraints for moderator removal and suspension actions on user-generated-content reports.
---

Moderation must act only on content explicitly linked to a report, with the reported author and participants verified. If the content row is already gone, the action may rely on a snapshot only when the report-to-content link was validated when the report was created. Preserve the report and its snapshot after resolution.

**Why:** Generic profile and chat-user reports do not identify one exact item. Guessing what to delete can remove unrelated content or suspend the wrong account, while deleting the report destroys useful review evidence.

**How to apply:** When adding reportable content types, store an explicit typed content ID and snapshot; validate the reporter, target, and author at submission and revalidate before deletion. Keep deletion and enforcement transactional. Do not substitute whole-profile deletion or arbitrary IDs for an exact content link.

For a report an administrator confirms as a violation, permanently suspend the responsible account while preserving the account record, report, and evidence. A user block alone must not automatically impose this sanction.

**Why:** The user confirmed this enforcement policy to meet Apple's UGC safety requirements while retaining moderation evidence.

**How to apply:** Apply permanent suspension only as part of an administrator-confirmed report action; never at report submission or at the reporter's block action.

Keep report submission and moderation route registrations independently mountable so database-backed HTTP tests can exercise the production handlers without starting unrelated application jobs.

**Why:** The full server route bootstrap also runs migrations and schedules background cleanup work; isolated registration keeps HTTP regression tests focused and avoids those startup side effects.

**How to apply:** Wire production routes and route-level tests through the same registration functions, supplying the real authentication and admin middleware in production.