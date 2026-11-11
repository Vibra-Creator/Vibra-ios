---
name: Production data safety
description: Keep production database changes on the Publish path and stop on unrelated destructive schema drift.
---

Production queries through the supported database interface are read-only. Managed production schema changes must go through Replit Publish; do not add startup-time DDL or custom scripts that mutate production. Use the supported development schema flow, then let Publish apply the schema diff.

This workspace has schema drift: `drizzle-kit push` has warned that it would remove populated legacy profile columns that are absent from the current schema source. Never confirm a schema push that includes unrelated data-loss changes.

**Why:** The development and production databases can contain valuable fields not represented in the current schema source; a broad push can delete unrelated user data.

**How to apply:** Query production only for verification, inspect every data-loss warning from the development schema flow, and stop for a safe reconciliation if unrelated populated fields are included. Never mutate production outside Publish.