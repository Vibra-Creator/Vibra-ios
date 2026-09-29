---
name: Marketplace image ownership
description: Why older generic object uploads must not be deleted solely because a listing references them
---

Marketplace image cleanup must only remove purpose-scoped uploads with matching object ownership, after confirming they are no longer referenced. Do not infer ownership or purpose from an image URL stored on a listing.

**Why:** Listings may contain arbitrary object URLs, and older generic uploads share the same path shape across profile photos and other features. Deleting a URL merely because an announcement used it can erase another person's photo. Older generic uploads have no reliable purpose marker, so they must be left untouched unless a separate provenance migration proves their origin.

**How to apply:** Keep deletion conservative for legacy objects. If adding cleanup or migration for them, establish provenance before deletion and account for references outside listings.