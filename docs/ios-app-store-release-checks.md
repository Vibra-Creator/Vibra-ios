# App Store bundle and metadata checks

The web build has a separate filtered output for iOS:

```sh
npm run build:ios-safe-web
```

This runs the production build and creates `dist/ios-web`. Android continues to use
`dist/public`, so its Google Play marketing assets are left untouched.

There is currently no iOS wrapper, Xcode project, or archive configuration in this
repository. When that native project is added, configure its web asset input to
consume `dist/ios-web` (not `dist/public`) and make these checks required release
steps. The filtered web build alone does not prove which directory an archive used.

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