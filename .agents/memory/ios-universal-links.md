---
name: iOS Universal Links
description: why iOS links (e.g. email verification) open in Safari instead of the app, and what the AASA file must contain
---
The iOS app (WKWebView wrapper, bundle com.vibraalienmatch, Team ID MA8PHU39TR) declares applinks:vibraalienmatch.com, so the server must serve /.well-known/apple-app-site-association as JSON without a redirect. Without it the SPA fallback returns HTML and iOS opens links in Safari.
**Why:** new users confirming their email were sent to the website instead of the app (Oct 2026).
**How to apply:** keep the AASA route in place; Apple's CDN can take ~24h to pick up changes after publishing.
