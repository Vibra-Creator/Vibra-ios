---
name: iOS launch validation
description: Boundary between workspace smoke checks and the Apple tooling required to validate an iOS/PWA launch crash
---

The workspace can validate the built web app, service-worker fallbacks, and mobile-sized browser behavior, but it cannot prove behavior on iOS Simulator or a real Apple device when Xcode, CoreSimulator, and device tooling are absent. App Store Connect crash-log review also requires an accessible Apple report; a connected mailbox is not sufficient if its provider API denies the search.

**Why:** A Linux WebKit run or a successful web preview is not equivalent to iOS WebKit on a named device/OS, and claiming otherwise would create unsafe Apple-submission evidence.

**How to apply:** Report workspace checks separately from device and crash-log evidence; only mark real-device validation complete after recording a successful launch on the requested iOS target and reviewing the corresponding Apple crash report.