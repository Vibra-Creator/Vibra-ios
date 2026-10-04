---
name: Database fixture IDs
description: Test database schema defaults can differ from the current Drizzle definitions for existing tables.
---

Integration tests should set explicit IDs for fixture rows on tables where a live migrated database may not have the same server-side ID default declared in the current schema.

**Why:** An insert into an existing story table failed with a null ID even though the Drizzle definition declares a generated UUID default.

**How to apply:** When a database-backed test relies on a generated ID, confirm the deployed test database actually has that default; otherwise use explicit unique test IDs and clean them up.