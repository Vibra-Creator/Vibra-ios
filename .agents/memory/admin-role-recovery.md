---
name: Admin role recovery
description: Admin access for allowlisted Vibra email accounts must survive deleting and recreating an account.
---

If an allowlisted admin account is recreated after the startup seed has already run, restore its `isAdmin` role during authenticated user loading or sign-in so the admin navigation appears immediately. Keep authorization bound to the explicit allowlist and apply the same normalized email check everywhere.

**Why:** the seed only promotes accounts that exist at startup, while the admin menu checks the persisted `isAdmin` flag.

**How to apply:** when changing account registration, login, or admin navigation, verify the allowlisted account's role is restored without writing directly to production.
