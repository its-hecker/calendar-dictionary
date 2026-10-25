#!/usr/bin/env python3
"""Build an indexed offline Urdu/English sentence collection, without changing definitions.

Download the exact public source files in example-sources.json into --sources first.
--lexicon is the uncompressed database produced by build_lexicon.py.
The optional JSONL export makes every adapted pair and its attribution easy to reuse.
"""
import argparse
import bz2
import collections
import gzip
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import tarfile
import zipfile
from urllib.parse import quote

from build_lexicon import norm, clean

ROOT = Path(__file__).resolve().parents[1]
TOKEN = re.compile(r"[^\W_]+(?:['’\-][^\W_]+)*", re.UNICODE)
URDU = re.compile(r'[\u0600-\u06ff]')


def words(text):
    return TOKEN.findall(norm(text))


def phrases(text, maximum=6):
    """Whole word/phrase boundaries: 'he' never matches 'the' or 'help'."""
    tokens = words(text)
    return {' '.join(tokens[i:i+length]) for length in range(1, maximum+1)
            for i in range(len(tokens)-length+1)}


def source_people(path, wanted):
    people = {}
    with bz2.open(path, 'rt', encoding='utf-8') as stream:
        for line in stream:
            row = line.rstrip('\n').split('\t')
            if len(row) >= 4 and row[2] in wanted and row[3] not in {'', r'\N'}:
                people.setdefault(row[2], (row[0], row[3]))
    return people


def build(lexicon, source_dir, out, export=None):
    manifest = json.loads((ROOT/'tools/example-sources.json').read_text())
    for item in manifest['files']:
        path = source_dir/item['file']
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], path
    dictionary = sqlite3.connect(f'file:{lexicon}?mode=ro', uri=True)
    dictionary.row_factory = sqlite3.Row
    matches = {'ur': collections.defaultdict(set), 'en': collections.defaultdict(set)}
    candidates = collections.defaultdict(dict)
    pairs = {}

    def add(ur, en, source, attribution, links, priority=10, roman='', entry_id=None):
        ur, en = clean(ur), clean(en)
        if not URDU.search(ur) or URDU.search(en) or not ur or not en:
            return
        if len(ur) > 650 or len(en) > 420 or len(en.split()) > 65:
            return
        key = norm(ur)+'\t'+norm(en)
        pair_id = hashlib.sha256(key.encode()).hexdigest()[:20]
        example = {'id': pair_id, 'urdu': ur, 'english': en, 'roman': roman,
                   'source': source, 'attribution': attribution, 'links': links}
        score = priority*100 + len(en.split())
        # The same sentence from several sources keeps the preferred attribution.
        if pair_id not in pairs or score < pairs[pair_id][0]:
            pairs[pair_id] = (score, example)
        linked = set()
        for kind, text in [('ur', ur), ('en', en)]:
            for phrase in phrases(text):
                linked.update(matches[kind].get(phrase, ()))
        if entry_id:
            linked.add(entry_id)
        for ident in linked:
            candidates[ident][pair_id] = min(score, candidates[ident].get(pair_id, score))

    # Match actual headwords and Urdu inflected forms, never a synonym or a gloss.
    # A corpus pair belongs to the word as a whole; it does not claim every sense.
    for row in dictionary.execute('SELECT id, word, kind, data FROM entries'):
        entry = json.loads(row['data'])
        forms = [row['word']]
        if row['kind'] == 'ur':
            forms.extend(form for form in entry.get('forms', []) if URDU.search(form))
        for form in forms:
            key = ' '.join(words(form))
            if key and len(key.split()) <= 6:
                matches[row['kind']][key].add(row['id'])

    # Short original examples take precedence over longer corpus excerpts.
    for line in (ROOT/'tools/example-sentences.tsv').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        en, ur = line.split('\t')
        add(ur, en, 'Project example', 'Original sentence pair written for this project.', [], 0)

    for row in dictionary.execute("SELECT id,word,data FROM entries WHERE kind='ur'"):
        entry = json.loads(row['data'])
        for sense in entry['senses']:
            for example in sense.get('examples', []):
                if not example.get('english'):
                    continue
                original = sense.get('source') == 'original'
                source = 'Original project example' if original else 'Wiktionary'
                links = [] if original else [{'label': 'Original entry & contributors',
                    'url': 'https://en.wiktionary.org/wiki/'+quote(row['word'])+'#Urdu'}]
                add(example['text'], example['english'], source,
                    'Original supplied example.' if original else 'Wiktionary contributors via Kaikki · CC BY-SA 4.0',
                    links, 0 if original else 1, example.get('roman', ''), row['id'])

    with tarfile.open(source_dir/'flores200.tar.gz', 'r:gz') as archive:
        for split in ['dev', 'devtest']:
            def lines(lang):
                name = f'./flores200_dataset/{split}/{lang}.{split}'
                return archive.extractfile(name).read().decode('utf-8').splitlines()
            english, urdu = lines('eng_Latn'), lines('urd_Arab')
            assert len(english) == len(urdu)
            for i, (en, ur) in enumerate(zip(english, urdu), 1):
                # Favor shorter excerpts, but retain intact original translations.
                add(ur, en, 'FLORES-200',
                    f'FLORES-200 contributors / Meta AI · CC BY-SA 4.0 · {split} sentence {i}',
                    [{'label': 'Dataset & license', 'url': 'https://github.com/facebookresearch/flores/tree/main/flores200'}], 20)

    with zipfile.ZipFile(source_dir/'tatoeba-opus.zip') as archive:
        english = archive.read('Tatoeba.en-ur.en').decode('utf-8').splitlines()
        urdu = archive.read('Tatoeba.en-ur.ur').decode('utf-8').splitlines()
    assert len(english) == len(urdu)
    en_people = source_people(source_dir/'eng_detailed.tsv.bz2', set(english))
    ur_people = source_people(source_dir/'urd_detailed.tsv.bz2', set(urdu))
    for en, ur in zip(english, urdu):
        # Only use pairs whose two current authors can be attributed precisely.
        if en not in en_people or ur not in ur_people:
            continue
        ei, ea = en_people[en]
        ui, ua = ur_people[ur]
        add(ur, en, 'Tatoeba', f'Tatoeba: English by {ea}; Urdu by {ua} · CC BY 2.0 FR',
            [{'label': f'English · {ea}', 'url': 'https://tatoeba.org/en/sentences/show/'+ei},
             {'label': f'Urdu · {ua}', 'url': 'https://tatoeba.org/en/sentences/show/'+ui}], 10)

    out.mkdir(parents=True, exist_ok=True)
    database_path = out/'examples.db'
    database_path.unlink(missing_ok=True)
    database = sqlite3.connect(database_path)
    database.executescript('''PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
        CREATE TABLE examples(id TEXT PRIMARY KEY,data TEXT NOT NULL);
        CREATE TABLE entry_examples(entry_id TEXT NOT NULL,example_id TEXT NOT NULL,rank INTEGER NOT NULL,
            PRIMARY KEY(entry_id,example_id)) WITHOUT ROWID;
        CREATE INDEX examples_by_entry ON entry_examples(entry_id,rank);
    ''')
    selected = []
    used = set()
    for ident, options in sorted(candidates.items()):
        best = sorted(options, key=lambda key: (options[key], key))[:5]
        for rank, key in enumerate(best):
            selected.append((ident, key, rank))
            used.add(key)
    examples = [pairs[key][1] for key in sorted(used)]
    database.executemany('INSERT INTO examples VALUES(?,?)',
        [(x['id'], json.dumps(x, ensure_ascii=False, separators=(',', ':'))) for x in examples])
    database.executemany('INSERT INTO entry_examples VALUES(?,?,?)', selected)
    database.commit()
    database.execute('VACUUM')
    assert database.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
    database.close()
    dictionary.close()
    compressed = out/'examples.gzpart'
    with compressed.open('wb') as output:
        with gzip.GzipFile(filename='', fileobj=output, mode='wb', compresslevel=9, mtime=0) as target:
            target.write(database_path.read_bytes())
    stats = {'version': 1, 'sentencePairs': len(examples), 'coveredHeadwords': len(candidates),
        'urduHeadwords': sum(x.startswith('ur:') for x in candidates),
        'englishHeadwords': sum(x.startswith('en:') for x in candidates),
        'associations': len(selected), 'databaseBytes': database_path.stat().st_size,
        'databaseSha256': hashlib.sha256(database_path.read_bytes()).hexdigest(),
        'compressedBytes': compressed.stat().st_size,
        'compressedSha256': hashlib.sha256(compressed.read_bytes()).hexdigest(),
        'sources': dict(collections.Counter(x['source'] for x in examples)),
        'date': manifest['retrieved']}
    (out/'examples-metadata.json').write_text(json.dumps(stats, indent=2)+'\n')
    if export:
        with export.open('w') as stream:
            for x in examples:
                stream.write(json.dumps(x, ensure_ascii=False)+'\n')
    print(json.dumps(stats, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lexicon', required=True, type=Path)
    parser.add_argument('--sources', required=True, type=Path)
    parser.add_argument('--out', required=True, type=Path)
    parser.add_argument('--export-jsonl', type=Path)
    args = parser.parse_args()
    build(args.lexicon, args.sources, args.out, args.export_jsonl)
