---
name: Backup isolation
description: Shared AppStorage makes backup naming and retention an environment boundary.
---

Development and production share the AppStorage bucket; backup namespaces and retention must therefore be isolated by environment.

**Why:** Development restarts can otherwise create snapshots in the production directory and prune older live-data backups. Keeping the newest few files is not equivalent to retaining several days when startup also creates backups.

**How to apply:** Use separate environment namespaces, retain daily recovery points, and keep irreversible-operation snapshots outside the ordinary rotating backup set.
