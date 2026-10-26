# Calendar & Urdu–English Dictionary

Two standalone Android apps with bundled offline content, each on its own branch. Both are developed by **Sabber Kazmi** and can be installed together on Android 10+.

| App | Branch | APK | App ID |
| --- | --- | --- | --- |
| Calendar 2.3 | [calendar](https://github.com/its-hecker/calendar-dictionary/tree/calendar) | `Calendar.apk` | `com.sabber.taqwim` |
| Urdu & English Dictionary 2.3 | [dictionary](https://github.com/its-hecker/calendar-dictionary/tree/dictionary) | `Urdu-Dictionary.apk` | `com.sabber.urdudictionary` |

**Calendar** has a blue/white adaptive launcher icon and a redesigned light/dark interface, Monday-first weeks, a bold persistent highlight for today, green Wiladat/Eid and red Shahadat markers, selectable Gregorian/Hijri/Desi dates, a date picker, month navigation, event/profile sheets, both Fatimiyya accounts, adjustable text size, six color palettes plus a custom accent, adjustments and subtle motion. The previous Teen Taqwim launcher name is replaced by Calendar; its app ID remains compatible with existing data.

**Dictionary** offers an Offline/Online switch, optional live English/Urdu lookup with capitalization retries and a backup Wiktionary service, stored online results and on-demand automatic translations. Its offline library contains **230,702 headwords / 407,041 definitions**: **9,205 Urdu entries with English meanings** and **221,497 English headwords with English definitions**. Entries without Urdu translations are clearly labelled. It includes an indexed offline database, Urdu font, search filters, word details, 4,609 paired Urdu–English example sentences covering 11,983 headwords, saved words, history, voice buttons and source credits. Example coverage varies by word. The compressed dictionary is bundled in the APK and unpacked locally; it never requires a data download. Online lookup and new automatic translations require internet.

Both apps include an info button, **Developed by Sabber Kazmi**, and the [Telegram channel](https://t.me/pixel4seriesupdates). Light, dark, system appearance and reduced-motion preferences are supported.

## Downloads and builds

Download installable test APKs from [Releases](https://github.com/its-hecker/calendar-dictionary/releases). Pushes to an app branch compile only that app, validate source/data, run Android lint, exercise dictionary lookup in an Android emulator and publish a test prerelease with a checksum. Sources are compiled directly and never regenerated over your changes.

To build manually, open [Build Android APK](https://github.com/its-hecker/calendar-dictionary/actions/workflows/build.yml), run the workflow on `main` and select `calendar` or `dictionary`.

```sh
git clone --branch calendar https://github.com/its-hecker/calendar-dictionary.git
cd calendar-dictionary
./gradlew :app:assembleDebug :app:lintDebug
```

Use `--branch dictionary` for the dictionary. Java 17 and Android SDK platform 35/build tools 34.0.0 are required; Gradle 8.9 is included through the wrapper. Detailed features, data sources/licenses, storage requirements and rebuild instructions are documented on each branch.

APKs are development-signed test builds. A different CI signing certificate can require uninstalling an older test build, which removes its local data. Use a consistent private key for production updates.
