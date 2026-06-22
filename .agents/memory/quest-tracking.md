---
name: Quest Tracking Hooks
description: Where trackQuestProgress is called in server/routes.ts for each quest type
---

Quest types and their hook locations in server/routes.ts:
- swipe_10 → POST /api/swipe (only on liked=true swipes)
- message_5 → POST /api/messages (after DNA tracking)
- room_visit → POST /api/rooms/:id/join (after DNA tracking)
- signal_post → POST /api/signals (using getProfileByUserId lookup for signal user)
- gift_send → POST /api/gifts/send (after deductPoints + sendGift)

All calls are fire-and-forget: `.catch(() => {})` pattern.

**Why:** Quest progress must not block the main operation. Partial tracking is acceptable.
**How to apply:** Always add `.catch(() => {})` to any quest tracking call in routes.
