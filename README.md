# SabCal & Urdu–English Dictionary

Two standalone offline Android apps, each on its own branch. Both are developed by **Sabber Kazmi** and can be installed together on Android 10+.

| App | Branch | APK | App ID |
| --- | --- | --- | --- |
| SabCal 2.1 | [calendar](https://github.com/its-hecker/calendar-dictionary/tree/calendar) | `SabCal.apk` | `com.sabber.taqwim` |
| Urdu & English Dictionary 2.0 | [dictionary](https://github.com/its-hecker/calendar-dictionary/tree/dictionary) | `Urdu-Dictionary.apk` | `com.sabber.urdudictionary` |

**SabCal** has a redesigned light/dark interface, selectable Gregorian/Hijri/Desi dates, a date picker, month navigation, event/profile sheets, both Fatimiyya accounts, adjustable text size, six color palettes plus a custom accent, adjustments and subtle motion. The previous Teen Taqwim launcher name is replaced by SabCal; its app ID remains compatible with existing data.

**Dictionary** contains **230,702 headwords / 407,041 definitions**: **9,205 Urdu entries with English meanings** and **221,497 English headwords with English definitions**. Entries without Urdu translations are clearly labelled. It includes an indexed offline database, Urdu font, search filters, word details/examples, saved words, history, voice buttons and source credits. The compressed dictionary is bundled in the APK and unpacked locally; it never requires a data download.

Both apps include an info button, **Developed by Sabber Kazmi**, and the [Telegram channel](https://t.me/pixel4seriesupdates). Light, dark, system appearance and reduced-motion preferences are supported.

## Downloads and builds

Download installable test APKs from [Releases](https://github.com/its-hecker/calendar-dictionary/releases). Pushes to an app branch compile only that app, validate source/data, run Android lint and publish a test prerelease with a checksum. Sources are compiled directly and never regenerated over your changes.

To build manually, open [Build Android APK](https://github.com/its-hecker/calendar-dictionary/actions/workflows/build.yml), run the workflow on `main` and select `calendar` or `dictionary`.

```sh
git clone --branch calendar https://github.com/its-hecker/calendar-dictionary.git
cd calendar-dictionary
./gradlew :app:assembleDebug :app:lintDebug
```

Use `--branch dictionary` for the dictionary. Java 17 and Android SDK platform 35/build tools 34.0.0 are required; Gradle 8.9 is included through the wrapper. Detailed features, data sources/licenses, storage requirements and rebuild instructions are documented on each branch.

APKs are development-signed test builds. A different CI signing certificate can require uninstalling an older test build, which removes its local data. Use a consistent private key for production updates.
