# Calendar & Dictionary

Two independent Android apps, each maintained on its own branch. Both can be installed on the same phone.

| App | Source branch | Application ID | APK |
| --- | --- | --- | --- |
| Teen Taqwim | [calendar](https://github.com/its-hecker/calendar-dictionary/tree/calendar) | `com.sabber.taqwim` | `Teen-Taqwim.apk` |
| Urdu ⇄ English Dictionary | [dictionary](https://github.com/its-hecker/calendar-dictionary/tree/dictionary) | `com.sabber.urdudictionary` | `Urdu-Dictionary.apk` |

The supplied calendar page and dictionary design, content, search, saved words, themes and calculations are preserved. The dictionary contains the 22 words in the supplied file; its Android adapter connects the existing microphone and speaker buttons to Android speech services.

## Download

Open [Releases](https://github.com/its-hecker/calendar-dictionary/releases) and download the APK for the desired app. The builds are marked as test prereleases. Android 10 or newer is required.

Each push to `calendar` or `dictionary` builds only that app, runs Android lint, uploads an APK artifact and publishes a test APK release with a SHA-256 checksum. Builds compile the committed source instead of regenerating and overwriting it.

To start a build manually, open [Build Android APK](https://github.com/its-hecker/calendar-dictionary/actions/workflows/build.yml), select **Run workflow**, keep the workflow branch as `main`, and choose `calendar` or `dictionary` in **App branch to build**.

## Build locally

```sh
git clone --branch calendar https://github.com/its-hecker/calendar-dictionary.git
cd calendar-dictionary
./gradlew :app:assembleDebug :app:lintDebug
```

Use `--branch dictionary` for the dictionary. Java 17 and Android SDK platform 35/build tools 34.0.0 are required. The Gradle 8.9 wrapper is included with a distribution checksum. APK output: `app/build/outputs/apk/debug/app-debug.apk`.

## Offline behavior

All page assets, calendar calculations and dictionary entries are packaged in each APK. No server is required. Saved words and calendar preferences stay in each app's own local storage.

Dictionary pronunciation uses installed text-to-speech voices, preferring an offline voice. When no Urdu voice is available, the supplied Roman/Hindi fallback is retained if that voice is installed. Voice search uses the phone's speech recognition app and may require internet access or downloaded language packs. The dictionary itself requests neither internet nor microphone permission; the recognition provider handles its microphone permission.

These APKs use Android's development signing configuration, matching the supplied workflow. Fresh CI runners may generate different signing certificates; an update can then require uninstalling the previous test build, which removes its saved words/preferences. Use a consistent private signing key before distributing updateable production releases.
