---
name: Playwright browser setup
description: Workspace-specific behavior when preparing Chromium for end-to-end tests
---

The Playwright setup script can fail while installing system packages in Replit after Chromium downloads successfully. If Chromium then reports `libudev.so.1` missing, add the Nix `systemd` dependency; it supplies the library required by the headless browser.

**Why:** Replit blocks the setup script’s apt-based dependency installation and manages system libraries through Nix. The Chromium binary can be present but still fail to launch without libudev.

**How to apply:** If Playwright reports a missing executable, run the repository setup script once. If its package-install step fails, inspect the browser’s missing libraries; use Nix dependencies such as `systemd` rather than retrying apt.

For UI tests that simulate missing public objects, block the service worker in the test context so browser request interception reliably produces the intended response. On data-rich Marketplace screens, wait for the specific listing rather than assuming the app has mounted shortly after navigation, and scope assertions to that listing.

**Why:** A real 404 test initially kept receiving 200 through the service worker; later, the page loaded after the default assertion timeout and accumulated test listings made unscoped text checks ambiguous.

**How to apply:** Isolate the fixture response where appropriate, verify the object request was intercepted, then assert within the target listing after it appears.