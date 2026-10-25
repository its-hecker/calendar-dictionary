# Teen Taqwim — Calendar

Standalone Android app on the `calendar` branch. Application ID: `com.sabber.taqwim`.

The HTML/CSS/JavaScript page is copied unchanged from the supplied Taqwim project. It includes the Gregorian, tabular Hijri and approximate Desi/Bikrami calendars, the supplied religious event list, month navigation, Today, the theme switch and persistent ±2-day Hijri/Desi adjustments. The Android host keeps the page clear of system bars and display cutouts.

## Build or download

Download **Teen-Taqwim.apk** from [Releases](https://github.com/its-hecker/calendar-dictionary/releases), or run:

```sh
./gradlew :app:assembleDebug :app:lintDebug
```

Requires Java 17, SDK platform 35, build tools 34.0.0 and Android 10+ on the phone. The included wrapper uses Gradle 8.9. Windows: use `gradlew.bat`.

Pushes to `calendar` automatically compile this source, run lint and publish a debug-signed test prerelease. Manual builds: [Actions](https://github.com/its-hecker/calendar-dictionary/actions/workflows/build.yml) → Run workflow on `main` → choose `calendar`.

## Source

- Page: `app/src/main/assets/index.html`.
- Entry point: `app/src/main/java/com/sabber/taqwim/MainActivity.java`.
- Android host: `app/src/main/java/com/sabber/offline/OfflineActivity.java`.
- Build output: `app/build/outputs/apk/debug/app-debug.apk`.

No internet permission, remote assets or dictionary dependency. Calendar preferences are stored locally. The source's Hijri moon-sighting and approximate Desi start-date qualifications still apply. The `dictionary` branch is a separate installable app.

Test APKs use development signing. If a later CI build has a different certificate, Android requires uninstalling the previous test build, which removes its preferences. Production updates need a consistent private signing key.
