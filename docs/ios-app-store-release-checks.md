# App Store bundle and metadata checks

The web build has a separate filtered output for iOS:

```sh
npm run build:ios-safe-web
```

This runs the production build and creates `dist/ios-web`. Android continues to use
`dist/public`, so its Google Play marketing assets are left untouched.

The available native wrapper source is in
`deliverables/Vibra_iOS_Review_Fixes.zip`. Its `src/Vibra/Settings.swift` sets the
`WKWebView` root to `https://vibraalienmatch.com`; the Xcode project does not copy
or consume `dist/ios-web`. This wrapper therefore loads the live website rather
than the filtered local bundle. The ZIP is source code, not a signed app archive,
and does not prove which source was used for a submission.

## Current workspace audit (2026-10-09)

- The available wrapper ZIP was scanned as source: 72 files, no Google Play
  reference strings or platform-specific asset names. SHA-256:
  `7bc4ba26bf92c6c57479bd2f23e29e2e4f0d81638b5b4c86470f64a79ef806b1`.
- Its review notes refer to version 2.3.10, while the Xcode project sets
  `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION` to `1`. No archive or
  App Store Connect build record is available to reconcile them.
- `npm run build:ios-safe-web` passed; the generated `dist/ios-web` folder was
  scanned separately (949 files, no matching reference strings or asset names).
  This is not evidence that the native wrapper uses that folder.
- The local candidate screenshots and four App Store preview videos passed the
  text/asset-name scan (19 files); the reviewed images and sampled video frames
  showed no Google Play branding. These files are not confirmed to match the
  live App Store Connect listing.
- No `.ipa`, `.xcarchive`, or App Store Connect metadata export for the intended
  submission is available in the workspace. **Submission status: not confirmed.**
  Do not record a pass for the submitted app until its exact archive and the
  listing text/screenshots for all locales are identified and checked.

After Xcode creates the final `.ipa` or `.xcarchive`, scan that exact artifact:

```sh
npm run check:ios-artifact -- /path/to/Vibra.ipa
# or
npm run check:ios-artifact -- /path/to/Vibra.xcarchive
```

The artifact check rejects Google Play text and URLs found in packaged files,
Google Play-specific asset names, Google site-verification files, unsafe archive
paths, and artifacts without the expected app bundle. It reads the archive itself;
it does not sign, create, or modify an iOS build.

Check App Store Connect listing metadata separately. Export or collect every
locale's app name, subtitle, promotional text, description, keywords, What's New,
and review notes into UTF-8 text/JSON/CSV files, then pass those files or their
containing directory:

```sh
npm run check:ios-metadata -- /path/to/app-store-metadata
```

This local check does not connect to App Store Connect and cannot confirm that the
files match the live listing. Run it against the final metadata for all locales
before submission. Both release checks are covered by:

```sh
npm run test:ios-release-checks
```