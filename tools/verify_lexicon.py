#!/usr/bin/env python3
"""Verify the exact offline assets shipped in the APK, without network access."""
from pathlib import Path
import gzip,hashlib,json,shutil,sqlite3,tempfile

root=Path(__file__).resolve().parents[1]
assets=root/'app/src/main/assets/data'
meta=json.loads((assets/'metadata.json').read_text())
with tempfile.TemporaryDirectory() as temporary:
    temporary=Path(temporary)
    compressed=temporary/'lexicon.gz';digest=hashlib.sha256()
    with compressed.open('wb') as output:
        for name in meta['parts']:
            assert Path(name).name==name,'Unexpected asset path'
            with (assets/name).open('rb') as source:
                while True:
                    chunk=source.read(65536)
                    if not chunk:break
                    digest.update(chunk);output.write(chunk)
    assert digest.hexdigest()==meta['compressedSha256'],'Compressed data checksum mismatch'
    db_path=temporary/'lexicon.db'
    with gzip.open(compressed,'rb') as source,db_path.open('wb') as output:
        shutil.copyfileobj(source,output)
    assert db_path.stat().st_size==meta['databaseBytes']
    with db_path.open('rb') as source:
        digest=hashlib.file_digest(source,'sha256') if hasattr(hashlib,'file_digest') else None
    if digest:assert digest.hexdigest()==meta['databaseSha256'],'Database checksum mismatch'
    con=sqlite3.connect('file:'+str(db_path)+'?mode=ro',uri=True)
    assert con.execute('PRAGMA quick_check').fetchone()[0]=='ok'
    assert con.execute('SELECT count(*) FROM entries').fetchone()[0]==meta['totalHeadwords']
    assert con.execute("SELECT count(*) FROM entries WHERE kind='ur'").fetchone()[0]==meta['urduHeadwords']
    assert con.execute("SELECT count(*) FROM entries WHERE kind='en'").fetchone()[0]==meta['englishHeadwords']
    assert con.execute("SELECT sum(json_array_length(data,'$.senses')) FROM entries").fetchone()[0]==meta['definitions']
    for entry_id in meta['legacyIds']+['en:computer','en:smartphone','en:accounting','en:serendipity']:
        data=json.loads(con.execute('SELECT data FROM entries WHERE id=?',(entry_id,)).fetchone()[0])
        assert data['senses'],entry_id
    computer=json.loads(con.execute("SELECT data FROM entries WHERE id='en:computer'").fetchone()[0])
    assert 'machine' in computer['preview'],'Contemporary definition was lost'
    for query in ['hope','mohabbat','water','محبت','پانی','accounting']:
        assert con.execute('SELECT id FROM lookup WHERE key>=? AND key<? LIMIT 1',(query,query+'\uffff')).fetchone(),query
    plan=con.execute('EXPLAIN QUERY PLAN SELECT id FROM lookup WHERE key>=? AND key<? LIMIT 40',('com','com\uffff')).fetchall()
    assert any('PRIMARY KEY' in row[3] for row in plan),plan
    con.close()
print('Verified {:,} headwords / {:,} definitions, all data segments, checksums, old saved-word IDs and indexed search.'.format(meta['totalHeadwords'],meta['definitions']))
