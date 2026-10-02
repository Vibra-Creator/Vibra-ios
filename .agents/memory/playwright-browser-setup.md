---
name: Playwright browser setup
description: Workspace-specific behavior when preparing Chromium for end-to-end tests
---

The Playwright setup script can fail while installing system packages in Replit after Chromium downloads successfully. If Chromium then reports `libudev.so.1` missing, add the Nix `systemd` dependency; it supplies the library required by the headless browser.

**Why:** Replit blocks the setup script’s apt-based dependency installation and manages system libraries through Nix. The Chromium binary can be present but still fail to launch without libudev.

**How to apply:** If Playwright reports a missing executable, run `npx playwright install chromium` to align the cached browser with the installed Playwright version, then run the repository setup script if system libraries are missing. If its package-install step fails, inspect the browser’s missing libraries; use Nix dependencies such as `systemd` rather than retrying apt.

For UI tests that simulate missing public objects, block the service worker in the test context so browser request interception reliably produces the intended response. On data-rich Marketplace screens, wait for the specific listing rather than assuming the app has mounted shortly after navigation, and scope assertions to that listing.

**Why:** A real 404 test initially kept receiving 200 through the service worker; later, the page loaded after the default assertion timeout and accumulated test listings made unscoped text checks ambiguous.

**How to apply:** Isolate the fixture response where appropriate, verify the object request was intercepted, then assert within the target listing after it appears.

In headless Chromium, Playwright pages in isolated browser contexts may all report `document.visibilityState === "visible"` even after another page is brought to the front. A synthetic notification-click event may also navigate its client successfully while rejecting `client.focus()` because the event is not a trusted user gesture.

**Why:** Headless browser focus does not always model real tab visibility or native notification gestures, so tests can fail despite the visibility and navigation handlers running.

**How to apply:** To test visibility signaling, override `document.visibilityState` and dispatch `visibilitychange`; for synthetic notification clicks, assert the resulting URL/navigation separately from the final focus call.