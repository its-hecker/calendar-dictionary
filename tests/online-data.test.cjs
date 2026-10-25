const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const context={window:{},TextEncoder};vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/online-data.js'),'utf8'),context);
const data=context.window.OnlineWords;
const fixture=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',name),'utf8'));
test('English live schema retains meanings, Urdu translations, examples and source license',()=>{
 const entry=data.parse(fixture('en-hello.json'),'hello');
 assert.equal(entry.online,true);assert.equal(entry.kind,'en');assert.ok(entry.senses.length);
 assert.ok(entry.senses.some(s=>s.translations.some(x=>/[\u0600-\u06ff]/.test(x))));
 assert.ok(data.example(entry)?.text);assert.match(entry.sourceUrl,/wiktionary/);assert.match(entry.license.name,/CC BY-SA/);
});
test('Urdu live schema retains English definitions, romanization, phonetics and related words',()=>{
 const entry=data.parse(fixture('ur-water.json'),'پانی');
 assert.equal(entry.kind,'ur');assert.equal(entry.word,'پانی');assert.equal(entry.senses[0].text,'water');
 assert.ok(entry.roman);assert.ok(entry.ipa);assert.ok(entry.synonyms.length);
});
test('empty/malformed responses fail clearly and mixed-language results are filtered',()=>{
 assert.throws(()=>data.parse({},'hello'),/invalid response/);
 assert.throws(()=>data.parse({entries:[]},'hello'),/No online entry/);
 assert.throws(()=>data.parse(fixture('ur-water.json'),'water'),/No online entry/);
});
test('large entries are bounded and long examples are not offered as truncated translations',()=>{
 const entry=fixture('en-hello.json');entry.entries[0].senses=Array.from({length:40},(_,i)=>({definition:'Meaning '+i,examples:['A'.repeat(700)]}));
 const result=data.parse(entry,'hello');assert.equal(result.senses.length,24);assert.equal(result.limited,true);assert.equal(data.example(result),null);
});
test('automatic paired examples retain language direction and source provenance',()=>{
 const entry=data.parse(fixture('en-hello.json'),'hello');
 const paired=data.pair(entry,{text:'Hello, everyone.',language:'en'},'سب کو سلام۔');
 assert.equal(paired.english,'Hello, everyone.');assert.equal(paired.urdu,'سب کو سلام۔');assert.match(paired.attribution,/automatic translation/);
 const reverse=data.pair(entry,{text:'یہ پانی صاف ہے۔',language:'ur'},'This water is clean.');
 assert.equal(reverse.english,'This water is clean.');assert.throws(()=>data.pair(entry,{text:'Hello.',language:'en'},'Hello.'),/requested language/);
});
test('cache keys preserve case-sensitive dictionary words and translation entities are decoded',()=>{
 assert.notEqual(data.key('US'),data.key('us'));assert.equal(data.language('پانی'),'ur');
 assert.equal(data.translation('This isn&#39;t water.','en'),"This isn't water.");
 assert.throws(()=>data.translation('No translation','ur'),/requested language/);
});
