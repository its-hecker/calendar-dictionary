# SabCal 2.0

Standalone offline calendar on the `calendar` branch. Developed by **Sabber Kazmi**.

## What's included

- A redesigned light/dark interface, subtle month/day transitions, and reduced-motion support.
- Select any date to see Gregorian, tabular Hijri and approximate Desi/Bikrami dates together.
- Month navigation, keyboard date navigation, a date picker and a one-tap return to today.
- A separate occasions view. Select an occasion to open its date in the calendar.
- Persistent system/light/dark appearance and ±2-day Hijri/Desi adjustments.
- An info screen with developer credit and [Telegram channel](https://t.me/pixel4seriesupdates).
- Native system-bar appearance, display-cutout/keyboard insets and modal-aware Android Back.

Hijri dates retain the supplied tabular Islamic calendar and religious occasion list. Local moon sighting may differ; use the adjustment in Settings. Desi starts are approximate.

## Install or build

Download **SabCal.apk** from [Releases](https://github.com/its-hecker/calendar-dictionary/releases). Android 10+ is required. The app ID stays `com.sabber.taqwim`, so preferences can migrate when updating with a compatible signing key; the launcher name is **SabCal**.

```sh
./gradlew :app:assembleDebug :app:lintDebug
```

Requires Java 17, Android SDK platform 35 / build tools 34.0.0. The Gradle 8.9 wrapper is included. Windows: `gradlew.bat`.

Pushes to `calendar` build this committed source, check JavaScript, run Android lint and publish a debug-signed test prerelease. To build manually, open [Actions](https://github.com/its-hecker/calendar-dictionary/actions/workflows/build.yml), run the workflow on `main`, and select `calendar`.

## Source

- `app/src/main/assets/index.html`, `app.css`, `app.js`: interface and interactions.
- `app/src/main/assets/calendar-data.js`: original month names and occasion data.
- `app/src/main/java/com/sabber/offline/OfflineActivity.java`: Android host.

All content works offline; the app requests no internet permission. Telegram opens in an external app. APKs are development-signed test builds. A different CI signing certificate can require uninstalling the prior test build, which removes preferences. Configure a consistent private release key before distributing production updates.
