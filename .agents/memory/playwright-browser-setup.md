---
name: Playwright browser setup
description: Workspace-specific behavior when preparing Chromium for end-to-end tests
---

The Playwright setup script can report failure while installing system packages in Replit, even though the Chromium binaries have already been downloaded successfully. Run the focused test after that step; browser tests may still execute normally.

**Why:** The workspace manages system dependencies through Nix rather than allowing the script’s package-manager escalation, but the browser download itself can complete before that failure.

**How to apply:** If Playwright reports a missing executable, run the setup script once. If it fails only during system-dependency installation and the browser executable exists, try the test before changing project code.

For UI tests that simulate missing public objects, block the service worker in the test context so browser request interception reliably produces the intended response. On data-rich Marketplace screens, wait for the specific listing rather than assuming the app has mounted shortly after navigation, and scope assertions to that listing.

**Why:** A real 404 test initially kept receiving 200 through the service worker; later, the page loaded after the default assertion timeout and accumulated test listings made unscoped text checks ambiguous.

**How to apply:** Isolate the fixture response where appropriate, verify the object request was intercepted, then assert within the target listing after it appears.