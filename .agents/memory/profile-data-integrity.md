---
name: Profile data integrity
description: User rules for Swipe data and safeguards when reconciling profiles belonging to one person.
---

«Riportare età reale che è stata registrata nel profilo così come la foto. Se non appare l’età o la foto non mettere niente. Tutto dipende dai dati presenti nel profilo.»

**Why:** The user explicitly required saved profile data, not guessed ages, invented photos or generic avatars.

**How to apply:** Omit missing data in Swipe. A stored age of 25 alone does not prove whether the age is real or an old default. Recover a different value only from a verified source.

Do not infer that profiles belong to the same or different people from first names, surnames, or distinct login account IDs. Confirm the human identity explicitly before reconciliation.

**Why:** Name-based interpretation caused repeated incorrect conclusions during a profile-data investigation. One person can have multiple login accounts.

**How to apply:** Trace exact profile/account records; separate observed stored values from the user's confirmed identity. A confirmed merge must preserve relationships, both login credentials, old links, and a private recovery snapshot. Do not generalize a confirmed pair to other similarly named users.
