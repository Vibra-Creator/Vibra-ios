---
name: iOS launch validation
description: Boundary between workspace smoke checks and the Apple tooling required to validate an iOS/PWA launch crash
---

The workspace can validate the built web app, service-worker fallbacks, and mobile-sized browser behavior, but it cannot prove behavior on iOS Simulator or a real Apple device when Xcode, CoreSimulator, and device tooling are absent. A filtered web payload is not a signed IPA, so scanning it cannot prove the final archive or App Store Connect listing is clean. App Store Connect crash-log review also requires an accessible Apple report; a connected mailbox is not sufficient if its provider API denies the search.

**Why:** A Linux WebKit run or a successful web preview is not equivalent to iOS WebKit on a named device/OS; likewise, inspecting source assets is not equivalent to inspecting the exact signed archive and listing. Treating either as complete evidence would create unsafe Apple-submission claims.

**How to apply:** Report workspace checks separately from device, archive, listing, and crash-log evidence. Only mark real-device validation complete after recording a successful launch on the requested iOS target and reviewing the corresponding Apple crash report; verify archive contents and listing text separately before submission.

The user reports that an Apple Developer team key is already listed. A Key ID and Issuer ID alone do not authenticate App Store Connect API requests; never request or store a `.p8` private key in chat. If API automation is explicitly requested, first check for a Replit integration, then use the secure Secrets flow for any private credential.

**Why:** the user supplied existing team-key context while discussing Apple review tasks.

**How to apply:** Distinguish identifiers from private credentials, and do not treat the existence of a team key as access to the account or as a way to build/sign an IPA.