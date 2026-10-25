#!/usr/bin/env python3
"""Build the offline lexicon from openly distributed sources; no runtime network needed.

Download sources (and retain their licenses) before running:
  https://kaikki.org/dictionary/Urdu/kaikki.org-dictionary-Urdu.jsonl
  https://raw.githubusercontent.com/CloudBytes-Academy/English-Dictionary-Open-Source/main/v2/dictionary.jsonl.gz
Pass --export-jsonl PATH for a free, plain-text export of all adapted entries.
"""
import argparse
import collections
import gzip
import hashlib
import json
from pathlib import Path
import re
import sqlite3
import unicodedata

def norm(value):
    value = unicodedata.normalize('NFKD', str(value)).lower()
    value = ''.join(c for c in value if not unicodedata.combining(c))
    value = value.translate(str.maketrans({'ي':'ی','ى':'ی','ك':'ک','ـ':'','’':"'",'‘':"'"}))
    return re.sub(r'\s+', ' ', value).strip()

def clean(value):
    return re.sub(r'\s+', ' ', str(value)).strip()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--urdu', type=Path, required=True)
    parser.add_argument('--english', type=Path, required=True)
    parser.add_argument('--curated', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--export-jsonl', type=Path)
    args = parser.parse_args()
    entries = {}
    keys = {}
    synsets = collections.defaultdict(set)

    def add_key(key, entry_id, rank):
        key = norm(key)
        if not key or len(key) > 160 or key in {'no-table-tags','l-self'}: return
        pair = (key,entry_id)
        keys[pair] = min(rank,keys.get(pair,99))

    def ur_entry(word):
        entry_id = 'ur:' + norm(word)
        if entry_id not in entries:
            entries[entry_id] = {'id':entry_id,'word':word,'ur':word,'roman':'','kind':'ur',
                'senses':[],'synonyms':[],'sources':['wiktionary'],'ipa':'','forms':[]}
        return entries[entry_id]

    # Keep the full senses, examples, romanizations and searchable inflected forms.
    with args.urdu.open(encoding='utf-8') as stream:
        for line in stream:
            item = json.loads(line)
            if not item.get('word'): continue
            entry = ur_entry(item['word'])
            entry_id = entry['id']
            add_key(item['word'],entry_id,0)
            for form in item.get('forms',[]):
                value = form.get('form','')
                if 'romanization' in form.get('tags',[]) and not entry['roman']:
                    entry['roman'] = value
                    add_key(value,entry_id,2)
                if re.search('[\u0600-\u06ff]',value) or 'romanization' in form.get('tags',[]):
                    add_key(value,entry_id,5)
                    if value and value not in entry['forms']: entry['forms'].append(value)
            for sound in item.get('sounds',[]):
                if sound.get('ipa') and not entry['ipa']: entry['ipa'] = sound['ipa']
            for sense in item.get('senses',[]):
                examples = []
                for example in sense.get('examples',[]):
                    if example.get('text'):
                        examples.append({'text':clean(example['text']),'roman':clean(example.get('roman','')),
                            'english':clean(example.get('english',example.get('translation','')))})
                for gloss in sense.get('glosses',[]):
                    gloss = clean(gloss)
                    if not gloss: continue
                    data = {'text':gloss,'pos':item.get('pos','word'),'examples':examples,
                        'source':'wiktionary','tags':sense.get('tags',[])}
                    if data not in entry['senses']: entry['senses'].append(data)
                    # Whole gloss and leading translation terms; do not treat every definition token as a translation.
                    add_key(gloss,entry_id,3)
                    lead = re.sub(r'^\([^)]*\)\s*','',gloss)
                    for part in re.split(r'[,;:()]',lead):
                        part = re.sub(r'^(?:a|an|the|to)\s+','',part.strip(),flags=re.I)
                        if 0 < len(part.split()) <= 5: add_key(part,entry_id,1)
                for synonym in sense.get('synonyms',[]):
                    value = synonym.get('word','')
                    if value and value not in entry['synonyms']: entry['synonyms'].append(value)
                    add_key(value,entry_id,4)
            for synonym in item.get('synonyms',[]):
                value = synonym.get('word','')
                if value and value not in entry['synonyms']: entry['synonyms'].append(value)
                add_key(value,entry_id,4)

    # Enrich the original 22 entries and retain their exact saved-word migration IDs.
    curated = json.loads(args.curated.read_text())
    legacy = []
    for old in curated:
        entry = ur_entry(old[0]); entry_id=entry['id']; legacy.append(entry_id)
        entry['roman'] = old[1]
        entry['sources'] = list(dict.fromkeys(['original']+entry['sources']))
        sense = {'text':old[2],'pos':old[3],'source':'original','examples':[
            {'text':old[4],'roman':old[5],'english':old[6]}]}
        entry['senses'].insert(0,sense)
        entry['synonyms'] = list(dict.fromkeys(old[7]+old[8]+entry['synonyms']))
        for key in [old[0],old[1]]: add_key(key,entry_id,0)
        for key in old[2].split(', ')+old[7]+old[8]: add_key(key,entry_id,0)

    with gzip.open(args.english,'rt',encoding='utf-8') as stream:
        for line in stream:
            item=json.loads(line)
            word=clean(item['word']); entry_id='en:'+norm(word)
            if not word or not item.get('definition'): continue
            if entry_id not in entries:
                entries[entry_id]={'id':entry_id,'word':word,'ur':'','roman':'','kind':'en',
                    'senses':[],'synonyms':[],'sources':[],'ipa':'','forms':[],'synsets':set()}
            entry=entries[entry_id]
            source=item['source']
            if source not in entry['sources']: entry['sources'].append(source)
            data={'text':clean(item['definition']),'pos':item.get('pos') or item.get('wordtype') or 'word',
                'examples':[{'text':clean(x),'english':clean(x),'roman':''} for x in item.get('examples',[])],
                'source':source}
            if data not in entry['senses']: entry['senses'].append(data)
            if item.get('synset_id'):
                synsets[item['synset_id']].add(word)
                entry['synsets'].add(item['synset_id'])
            add_key(word,entry_id,2)

    # Remove empty extraction stubs; keep meanings instead of padding the word count.
    entries={key:entry for key,entry in entries.items() if entry['senses']}
    for entry in entries.values():
        for synset in entry.pop('synsets',[]):
            entry['synonyms'].extend(x for x in sorted(synsets[synset]) if x!=entry['word'])
        entry['synonyms']=list(dict.fromkeys(entry['synonyms']))
        entry['pos']=entry['senses'][0]['pos']
        entry['preview']=entry['senses'][0]['text']
        # Prefer the contemporary WordNet definition for the preview, while keeping every historical sense.
        if entry['kind']=='en':
            entry['senses'].sort(key=lambda s:s['source']!='oewn')
            entry['preview']=entry['senses'][0]['text'];entry['pos']=entry['senses'][0]['pos']

    args.out.mkdir(parents=True,exist_ok=True)
    db=args.out/'lexicon.db'
    db.unlink(missing_ok=True)
    con=sqlite3.connect(db)
    con.executescript('''PRAGMA page_size=4096; PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;
        CREATE TABLE entries(id TEXT PRIMARY KEY, word TEXT NOT NULL, ur TEXT NOT NULL,
            roman TEXT NOT NULL,pos TEXT NOT NULL,preview TEXT NOT NULL,kind TEXT NOT NULL,
            sort_key TEXT NOT NULL,data TEXT NOT NULL);
        CREATE TABLE lookup(key TEXT NOT NULL,id TEXT NOT NULL,rank INTEGER NOT NULL,PRIMARY KEY(key,id)) WITHOUT ROWID;
        CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    ''')
    rows=[]
    for entry in entries.values():
        rows.append((entry['id'],entry['word'],entry['ur'],entry['roman'],entry['pos'],entry['preview'],
            entry['kind'],norm(entry['word']),json.dumps(entry,ensure_ascii=False,separators=(',',':'))))
    con.executemany('INSERT INTO entries VALUES(?,?,?,?,?,?,?,?,?)',rows)
    con.executemany('INSERT INTO lookup VALUES(?,?,?)',
        [(key,entry_id,rank) for (key,entry_id),rank in keys.items() if entry_id in entries])
    con.executescript('CREATE INDEX entries_kind_sort ON entries(kind,sort_key); CREATE INDEX entries_sort ON entries(sort_key);')
    total=len(entries);urdu=sum(x['kind']=='ur' for x in entries.values())
    stats={'version':2,'totalHeadwords':total,'urduHeadwords':urdu,'englishHeadwords':total-urdu,
        'definitions':sum(len(x['senses']) for x in entries.values()),'lookupKeys':len(keys),
        'legacyIds':legacy,'date':'2026-10-25',
        'sources':{'urdu':'Wiktionary contributors via Kaikki, CC BY-SA 4.0',
            'english':'Open English WordNet, CC BY 4.0 / WordNet notice; Webster 1913 via OPTED, public domain USA'}}
    con.execute('INSERT INTO meta VALUES(?,?)',('stats',json.dumps(stats,ensure_ascii=False)))
    con.commit();con.execute('VACUUM')
    assert con.execute('PRAGMA quick_check').fetchone()[0]=='ok'
    con.close()
    stats['databaseSha256']=hashlib.sha256(db.read_bytes()).hexdigest()
    stats['databaseBytes']=db.stat().st_size
    compressed=args.out/'lexicon.db.gz'
    with db.open('rb') as stream,compressed.open('wb') as output:
        with gzip.GzipFile(filename='',mode='wb',compresslevel=9,mtime=0,fileobj=output) as target:
            import shutil
            shutil.copyfileobj(stream,target)
    stats['compressedBytes']=compressed.stat().st_size
    stats['compressedSha256']=hashlib.sha256(compressed.read_bytes()).hexdigest()
    # Small source blobs keep dataset updates and repository uploads manageable.
    stats['parts']=[]
    with compressed.open('rb') as stream:
        index=0
        while True:
            part=stream.read(2040000)
            if not part: break
            name=f'lexicon.{index:02}.gzpart'
            (args.out/name).write_bytes(part)
            stats['parts'].append(name)
            index+=1
    (args.out/'metadata.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2)+'\n')
    if args.export_jsonl:
        with args.export_jsonl.open('w',encoding='utf-8') as stream:
            for entry in entries.values(): stream.write(json.dumps(entry,ensure_ascii=False)+'\n')
    print(json.dumps({key:value for key,value in stats.items() if key!='legacyIds'},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
