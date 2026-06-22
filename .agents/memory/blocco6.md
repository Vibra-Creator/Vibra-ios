---
name: Blocco 6
description: VibraLegacy (messaggio nell'universo), VibraConsent (inbox consenso), VibraTime (activity tracking)
---

## VibraLegacy
- Frontend page: `/legacy` (client/src/pages/vibralegacy.tsx)
- Route registered in App.tsx, button in profile.tsx (BookMarked icon, purple)
- Backend already existed: GET/POST/DELETE /api/legacy, table vibra_legacies

## VibraConsent
- Inline component `ConsentInbox` in profile.tsx (lines ~467-530)
- Shows disabled button if no pending requests
- Shows badge count + expandable drawer with Accept/Decline per request
- Backend already existed: GET /api/consent, POST /api/consent/:id/respond

## VibraTime
- Schema: `userActivityLog` table in shared/schema.ts
- Migration: `user_activity_log` table in server/index.ts (Blocco 6 section)
- Storage: `logActivity`, `getActivityPattern`, `getActivityLabel` in DatabaseStorage
- Routes: GET /api/time/my-pattern, GET /api/time/label/:profileId
- Activity logged fire-and-forget in GET /api/profiles/me handler
- Chat UI: shows activity label (e.g. "attivo/a di sera") in chat header with Clock icon (cyan, only for real users not bots)

**Why:** Activity label helps users know when their match is most active, improving engagement.
**How to apply:** logActivity is called on every /api/profiles/me request (fire-and-forget). Label is fetched lazily in chat.
