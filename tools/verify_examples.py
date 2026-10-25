#!/usr/bin/env python3
"""Check the shipped paired-sentence database, provenance and headword associations."""
import gzip
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import tempfile


def verify(assets, lexicon=None):
    info = json.loads((assets/'examples-metadata.json').read_text())
    compressed = (assets/'examples.gzpart').read_bytes()
    assert hashlib.sha256(compressed).hexdigest() == info['compressedSha256']
    data = gzip.decompress(compressed)
    assert len(data) == info['databaseBytes']
    assert hashlib.sha256(data).hexdigest() == info['databaseSha256']
    with tempfile.TemporaryDirectory() as temporary:
        path = Path(temporary)/'examples.db'
        path.write_bytes(data)
        connection = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
        assert connection.execute('PRAGMA quick_check').fetchone()[0] == 'ok'
        assert connection.execute('SELECT count(*) FROM examples').fetchone()[0] == info['sentencePairs']
        assert connection.execute('SELECT count(*) FROM entry_examples').fetchone()[0] == info['associations']
        assert connection.execute('SELECT count(DISTINCT entry_id) FROM entry_examples').fetchone()[0] == info['coveredHeadwords']
        for kind, key in [('ur:', 'urduHeadwords'), ('en:', 'englishHeadwords')]:
            assert connection.execute('SELECT count(DISTINCT entry_id) FROM entry_examples WHERE entry_id LIKE ?',
                                      (kind+'%',)).fetchone()[0] == info[key]
        assert not connection.execute('SELECT entry_id FROM entry_examples GROUP BY entry_id HAVING count(*)>5 OR min(rank)!=0 OR max(rank)!=count(*)-1').fetchone()
        assert not connection.execute('SELECT 1 FROM entry_examples l LEFT JOIN examples x ON x.id=l.example_id WHERE x.id IS NULL').fetchone()
        assert not connection.execute('SELECT 1 FROM examples x LEFT JOIN entry_examples l ON l.example_id=x.id WHERE l.entry_id IS NULL').fetchone()
        for ident, value in connection.execute('SELECT id,data FROM examples'):
            example = json.loads(value)
            assert example['id'] == ident
            assert re.search(r'[\u0600-\u06ff]', example['urdu'])
            assert example['english'].strip() and not re.search(r'[\u0600-\u06ff]', example['english'])
            assert example['source'] and example['attribution']
            assert all(link['url'].startswith('https://') for link in example['links'])
            if example['source'] == 'Tatoeba':
                assert len(example['links']) == 2 and 'CC BY 2.0 FR' in example['attribution']
            elif example['source'] in {'FLORES-200', 'Wiktionary'}:
                assert 'CC BY-SA 4.0' in example['attribution'] and example['links']
        def examples(ident):
            return [json.loads(row[0]) for row in connection.execute(
                'SELECT x.data FROM entry_examples l JOIN examples x ON x.id=l.example_id WHERE l.entry_id=? ORDER BY l.rank', (ident,))]
        for ident in ['en:computer', 'en:hope', 'en:accounting', 'en:serendipity', 'en:beautiful', 'en:happiness', 'ur:پانی', 'ur:علم', 'ur:محبت']:
            assert examples(ident), ident
        assert 'computer' in examples('en:computer')[0]['english'].lower()
        assert 'کمپیوٹر' in examples('en:computer')[0]['urdu']
        assert 'خوشی' in examples('en:happiness')[0]['urdu']
        # An absent rare word has no invented or loosely matched fallback pair.
        assert not examples('en:zymurgy')
        plan = connection.execute('EXPLAIN QUERY PLAN SELECT example_id FROM entry_examples WHERE entry_id=? ORDER BY rank LIMIT 5', ('en:computer',)).fetchall()
        assert any('INDEX' in row[3] or 'PRIMARY KEY' in row[3] for row in plan), plan
        if lexicon:
            for (ident,) in connection.execute('SELECT DISTINCT entry_id FROM entry_examples'):
                assert lexicon.execute('SELECT 1 FROM entries WHERE id=?', (ident,)).fetchone(), ident
            legacy = json.loads(lexicon.execute("SELECT value FROM meta WHERE key='stats'").fetchone()[0])['legacyIds']
            assert all(examples(ident) for ident in legacy), 'A supplied example was lost'
        connection.close()
    print(f"Verified {info['sentencePairs']:,} Urdu–English sentence pairs / {info['coveredHeadwords']:,} headwords, checksums, two-language content, attribution, associations and indexed example lookup.")


if __name__ == '__main__':
    verify(Path(__file__).resolve().parents[1]/'app/src/main/assets/data')
