# SabCal 2.1

Standalone offline calendar on the `calendar` branch. Developed by **Sabber Kazmi**.

## What's included

- Six brighter color themes (Ocean, Jade, Violet, Sunset, Rose and Amber), a custom accent picker, and system/light/dark appearance.
- Saved app-wide text size from 90% to 160%, with live preview and responsive wrapping.
- Subtle month/day transitions and reduced-motion support.
- Select any date to see Gregorian, tabular Hijri and approximate Desi/Bikrami dates together.
- Month navigation, keyboard date navigation, a date picker and a one-tap return to today.
- Date taps open an event/day detail sheet. No-event days and multiple occasions are handled explicitly.
- Offline event summaries/profiles, a selected-day banner and the next listed occasion.
- Both Bibi Fatima 75-day (13 Jumada I) and 95-day (3 Jumada II) accounts, clearly labelled.
- A separate occasions view; tapping an item opens its specific event details.
- Persistent system/light/dark appearance and ±2-day Hijri/Desi adjustments.
- An info screen with developer credit and [Telegram channel](https://t.me/pixel4seriesupdates).
- Native system-bar appearance, display-cutout/keyboard insets and modal-aware Android Back.

Hijri dates retain the supplied tabular Islamic calendar; the original occasion list is supplemented with the missing Fatimiyya account and profile details. Local moon sighting may differ; use the adjustment in Settings. Desi starts are approximate.

## Install or build

Download **SabCal.apk** from [Releases](https://github.com/its-hecker/calendar-dictionary/releases). Android 10+ is required. The app ID stays `com.sabber.taqwim`, so preferences can migrate when updating with a compatible signing key; the launcher name is **SabCal**.

```sh
./gradlew :app:assembleDebug :app:lintDebug
```

Requires Java 17, Android SDK platform 35 / build tools 34.0.0. The Gradle 8.9 wrapper is included. Windows: `gradlew.bat`.

Pushes to `calendar` build this committed source, check JavaScript, run Android lint and publish a debug-signed test prerelease. To build manually, open [Actions](https://github.com/its-hecker/calendar-dictionary/actions/workflows/build.yml), run the workflow on `main`, and select `calendar`.

## Source

- `app/src/main/assets/index.html`, `app.css`, `app.js`: interface and interactions.
- `app/src/main/assets/calendar-data.js`: month names, occasion records and short profiles.
- `app/src/main/assets/themes.js`: six palettes, custom accent and contrast-aware colors.
- `docs/occasions.md`: event-date behavior and historical source notes.
- `app/src/main/java/com/sabber/offline/OfflineActivity.java`: Android host.

All content works offline; the app requests no internet permission. Telegram opens in an external app. APKs are development-signed test builds. A different CI signing certificate can require uninstalling the prior test build, which removes preferences. Configure a consistent private release key before distributing production updates.

## Text and color controls

Open **Settings → Text size** for the slider and plus/minus controls. Open **Settings → Color theme** for six presets or your own accent color. Text size, color, appearance mode and date adjustments are stored together and survive normal app restarts. Color controls update the native system-bar background as well as the page.
