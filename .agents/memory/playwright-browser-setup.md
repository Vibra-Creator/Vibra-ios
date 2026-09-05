---
name: Playwright browser setup
description: Workspace-specific behavior when preparing Chromium for end-to-end tests
---

The Playwright setup script can report failure while installing system packages in Replit, even though the Chromium binaries have already been downloaded successfully. Run the focused test after that step; browser tests may still execute normally.

**Why:** The workspace manages system dependencies through Nix rather than allowing the script’s package-manager escalation, but the browser download itself can complete before that failure.

**How to apply:** If Playwright reports a missing executable, run the setup script once. If it fails only during system-dependency installation and the browser executable exists, try the test before changing project code.