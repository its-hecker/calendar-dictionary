# Urdu ⇄ English Dictionary

Standalone Android app on the `dictionary` branch. Application ID: `com.sabber.urdudictionary`; launcher name: **Urdu Dictionary**.

The supplied page's UI, CSS, 22 entries, search ranking, Roman Urdu, examples, synonyms, saved words and word of the day are preserved. Both light and dark designs follow the device theme. A separate Android adapter connects the existing speaker and microphone buttons to native speech services.

## Build or download

Download **Urdu-Dictionary.apk** from [Releases](https://github.com/its-hecker/calendar-dictionary/releases), or run:

```sh
./gradlew :app:assembleDebug :app:lintDebug
```

Requires Java 17, SDK platform 35, build tools 34.0.0 and Android 10+ on the phone. The included wrapper uses Gradle 8.9. Windows: use `gradlew.bat`.

Pushes to `dictionary` automatically compile this source, run lint and publish a debug-signed test prerelease. Manual builds: [Actions](https://github.com/its-hecker/calendar-dictionary/actions/workflows/build.yml) → Run workflow on `main` → choose `dictionary`.

## Offline and speech behavior

The full supplied vocabulary is bundled; typed search, examples, synonyms, saved words and daily word need no network. Favorites persist in the app's local storage. The page uses the system's installed Urdu/Arabic font fallback, as in the source.

Pronunciation uses Android text-to-speech at the supplied 0.9 speech rate, preferring offline voices. Urdu uses an installed Urdu voice when available; otherwise the source's Roman/Hindi fallback is used if available. Missing voices produce a message in the existing message area. Download voice data through Android's text-to-speech settings for offline playback.

The Urdu and English microphone buttons launch the device's speech recognition app and return its transcript to the existing search box. Availability, supported languages and any network requirement depend on that provider. The provider owns microphone permission; this app requests no microphone or internet permission.

## Source

- Supplied page: `app/src/main/assets/index.html` (only an adapter script tag was added).
- Android button adapter: `app/src/main/assets/android-voice.js`.
- Native TTS/recognition: `app/src/main/java/com/sabber/urdudictionary/MainActivity.java`.
- Android host: `app/src/main/java/com/sabber/offline/OfflineActivity.java`.
- Build output: `app/build/outputs/apk/debug/app-debug.apk`.

The `calendar` branch is an independent app and can be installed alongside this one.

Test APKs use development signing. If a later CI build has a different certificate, Android requires uninstalling the previous test build, which removes saved words. Production updates need a consistent private signing key.
