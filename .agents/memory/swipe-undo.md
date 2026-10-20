---
name: Swipe undo
description: The swipe-back action must restore the exact profile the user intends to revisit.
---

Undo must be tied to the exact profile ID captured by the client and the server must delete that user's swipe for that same profile. The UI should use the profile ID returned by the server when restoring the card, and should not allow undo while a swipe request is still pending.

**Why:** choosing the latest database row by timestamp can diverge from the client’s current profile after queued or closely timed swipes, causing the wrong profile to be restored.

**How to apply:** preserve the client/server profile-ID contract whenever changing swipe ordering, request queuing, or undo behavior.
