# Urdu & English Dictionary 2.2

Standalone Android dictionary with a bundled offline library and optional online lookup on the `dictionary` branch. Developed by **Sabber Kazmi**.

## Optional online mode

Use **Online lookup** above the search box, enter an English or Urdu word, then tap **Search online** or press Enter. Typing alone sends no request. **Offline library** remains the default and supports the existing English, Urdu and Roman Urdu search.

Live meanings and available Urdu translations come from [FreeDictionaryAPI.com](https://freedictionaryapi.com/), using English Wiktionary data under CC BY-SA 4.0. Urdu queries return English glosses and available romanizations. Up to 24 meanings and available source usage examples are shown, with original-entry and license links. Coverage varies by word. Quoted literary passages are not imported into the online UI.

**Translate word to Urdu** and **Add Urdu/English translation** are optional, separate actions using [MyMemory](https://mymemory.translated.net/doc/spec.php). Translations are labelled automatic and may contain errors. Only the selected word or example is submitted. The service limits a segment to 500 UTF-8 bytes and anonymous use to [5,000 characters per day](https://mymemory.translated.net/doc/usagelimits.php); quota or connection failures preserve the original text. No account, email or API key is embedded.

Viewed online entries are stored on the device, including their source/license and any requested translations. **Refresh result** explicitly fetches a newer version. The most recent 20 unsaved online history entries are retained; up to 50 online entries can be pinned in Saved and opened without internet. Offline saved words share the existing collection and original IDs. Cache entries are separate from the bundled SQLite databases. Clearing app data/uninstalling removes the cache.

An explicit new lookup/translation uses HTTPS with bounded response size and timeouts on a background worker. Switching modes, editing a pending search, or closing a translating entry cancels the request; stale callbacks are discarded. Provider failures show a message and allow Offline use; refreshing a cached word can fall back to its clearly labelled stored result. Online works while the offline library is preparing.

The app now requests Android's normal **INTERNET** permission, with cleartext traffic disabled. The native bridge only calls the fixed dictionary/translation hosts. The local WebView still blocks remote page/network loads and general filesystem access. There are no automatic online requests in Offline mode; external source/Telegram links open only when tapped.

Source/usage details are also under **Info → Online lookup & privacy**. Provider endpoints and response shapes were verified on 26 October 2026. Example test fixtures retain their original Wiktionary license/source metadata.

## The offline library

| Collection | Unique headwords |
| --- | ---: |
| Urdu entries with English meanings | 9,205 |
| English headwords with English definitions | 221,497 |
| Total headwords (including phrases) | **230,702** |
| Definitions across all entries | **407,041** |

An Urdu translation is **not** available for every English word. The interface labels the two collections and offers All words, Urdu ↔ English and English definitions filters. Counts are based on grouped, nonempty headwords, rather than padding the count with searchable inflections or repeated senses.

The original 22 entries, examples and synonyms are retained. Numeric favorites from the original page migrate to stable word IDs when app data is retained. No generated translations were used to inflate the library.

## Paired Urdu–English example sentences

Word details now start with a clearly labelled **Example sentences** section, with Urdu and English text together, optional Roman Urdu, separate pronunciation buttons and a source credit. Additional pairs expand under **More examples**. The same examples appear when opening a word from search, Saved, History or the daily word.

The APK bundles **4,609 sentence pairs for 11,983 headwords** (3,641 Urdu and 8,342 English), with up to five pairs per headword. This is partial coverage of the 230,702-headword library. Words without a pair explicitly say so; existing source usage examples and all meanings remain accessible. Whole words, phrases and available Urdu inflections are matched, rather than substrings or synonyms. Corpus examples illustrate a headword and may use a different sense from the first numbered meaning.

Examples combine 2,008 original FLORES-200 pairs (Meta AI / contributors, CC BY-SA 4.0), 1,475 Tatoeba pairs (CC BY 2.0 France, both authors and original sentence links retained), 905 existing Wiktionary pairs (CC BY-SA 4.0), the 22 supplied pairs and 199 additional original project pairs. The FLORES snapshot is the original publicly released 2022 dataset. These are bundled translations, with no runtime translation service. Full notices are readable under **Info → Example sentence sources & licenses**.

The compressed database uses the `.gzpart` extension so Android packaging preserves its filename and bytes.

The independent, read-only example database adds about 5.2 MB installed / 1.8 MB compressed. It is verified and unpacked by the same background installer as the dictionary; opening a word uses an indexed query. The existing definitions database and saved-word IDs are unchanged.

To rebuild, download the exact files/URLs and hashes in `tools/example-sources.json` into a folder, retain their notices, then run:

```sh
python3 tools/build_examples.py --lexicon /tmp/lexicon/lexicon.db \
  --sources /path/to/source-files --out /tmp/examples \
  --export-jsonl /tmp/examples/examples.jsonl
cp /tmp/examples/examples.gzpart /tmp/examples/examples-metadata.json app/src/main/assets/data/
python3 tools/verify_lexicon.py
```

Tatoeba exports change weekly; rebuilding a later snapshot requires updating the recorded hashes after reviewing it. A free plain-text export of the shipped pairs can also be made without any source downloads:

```python
import gzip, sqlite3, pathlib
p = pathlib.Path("/tmp/examples.db")
p.write_bytes(gzip.decompress(pathlib.Path("app/src/main/assets/data/examples.gzpart").read_bytes()))
con = sqlite3.connect(p)
pathlib.Path("/tmp/examples.jsonl").write_text("\n".join(row[0] for row in con.execute("SELECT data FROM examples ORDER BY id")) + "\n")
```

## Interface and features

- A new cream/forest interface, dark/system themes, bundled Noto Nastaliq Urdu font and subtle motion.
- Discover, Saved and History screens; daily Urdu word; paginated browsing and search.
- Indexed English/Urdu/Roman Urdu prefix search and normalized Urdu/Arabic spelling. Urdu substring matching remains available when prefix search finds nothing.
- Detailed meanings, examples, romanizations, related words and source credits. Contemporary English definitions appear first; historical Webster senses are labelled.
- Android pronunciation and Urdu/English voice search, with missing-provider/voice messages.
- Info screen: **Developed by Sabber Kazmi**, [Telegram](https://t.me/pixel4seriesupdates), collection counts and offline data/font notices.
- Insets, native theme synchronization, modal-aware Android Back and reduced-motion support.

## Offline behavior and storage

Every data segment is inside the APK. The bundled library needs no first-run download, server or API key. The optional online mode uses the INTERNET permission. A background worker verifies and unpacks the bundled library once; the interface shows progress. The read-only SQLite database is approximately **190 MB** and the compressed data is **37.2 MB** (decimal). Indexed queries and small result pages keep the full library out of WebView memory. Search work runs off the UI thread; stale results are discarded.

Pronunciation depends on installed Android TTS voices; offline voices are preferred. Urdu retains the supplied Roman/Hindi fallback where that voice exists. The speech recognition provider owns microphone permission and may need internet access or downloaded language packs. The dictionary requests INTERNET for optional online lookup; it does not request microphone permission itself.

## Install or build

Download **Urdu-Dictionary.apk** from [Releases](https://github.com/its-hecker/calendar-dictionary/releases). Android 10+ is required. App ID: `com.sabber.urdudictionary`.

```sh
python3 tools/verify_lexicon.py
./gradlew :app:assembleDebug :app:lintDebug
```

Requires Java 17, Android SDK platform 35 / build tools 34.0.0 and the included Gradle 8.9 wrapper. Windows: `gradlew.bat`.

Each push builds the committed source, verifies every dictionary data segment, checks database integrity/counts and indexed lookups, checks page JavaScript, runs Android lint, verifies the exact packaged assets and publishes a debug-signed test prerelease. Manual builds are available through [Actions](https://github.com/its-hecker/calendar-dictionary/actions/workflows/build.yml) on `main`, selecting `dictionary`.

## Sources and rebuilding the data

Urdu entries: [Wiktionary contributors via Kaikki](https://kaikki.org/dictionary/Urdu/), CC BY-SA 4.0. English definitions: [CloudBytes-Academy / English-Dictionary-Open-Source v2](https://github.com/CloudBytes-Academy/English-Dictionary-Open-Source), combining Open English WordNet (CC BY 4.0 / WordNet notice) and Webster 1913 via OPTED / Project Gutenberg (public domain USA). Definitions can include specialist, historical, regional or sensitive language; the app retains source wording and available labels.

Attribution and original conditions are in `app/src/main/assets/licenses/`, also readable inside the app. Font license: `app/src/main/assets/fonts/OFL.txt`. The adapted Wiktionary data remains under CC BY-SA 4.0. Dataset licenses apply to their data, rather than unrelated app code.

The exact import pipeline is `tools/build_lexicon.py`. Download the two source files listed in that script, retain their license notices, then run:

```sh
python3 tools/build_lexicon.py --urdu /path/urdu.jsonl --english /path/dictionary.jsonl.gz \
  --curated tools/original-entries.json --out /tmp/lexicon \
  --export-jsonl /tmp/lexicon/entries.jsonl
cp /tmp/lexicon/*.gzpart /tmp/lexicon/metadata.json app/src/main/assets/data/
python3 tools/verify_lexicon.py
```

`--export-jsonl` produces a free, unencoded plain-text export of all adapted entries. The build groups headwords, normalizes search keys, retains all senses/examples, and reconstructs WordNet synonyms. No network call is needed by the installed app.

## Test signing

These APKs use development signing. A fresh CI runner can generate a different certificate; Android can then require uninstalling the previous test build, which removes saved words. Migration is supported when app data survives an update or compatible restore. Configure a consistent private release key before distributing production updates.
