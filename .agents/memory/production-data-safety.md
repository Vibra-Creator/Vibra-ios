---
name: Production data safety
description: Production database queries are read-only through the agent database interface; destructive cleanup must ship in application code and run after publish.
---

The agent can inspect the production database but cannot directly mutate it through the supported database interface. For production data cleanup, scope the operation narrowly in application code, run it before the server begins accepting traffic, and require a new publish for the change to take effect.

**Why:** The live database can differ from development, and direct production writes are intentionally blocked.

**How to apply:** Verify production counts read-only, add an idempotent startup cleanup only when the user explicitly authorizes it, test against development first, then tell the user to publish.