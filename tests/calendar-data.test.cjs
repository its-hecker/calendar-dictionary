const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={window:{}};
const assets=path.join(__dirname,'../app/src/main/assets');
vm.createContext(context);
for(const file of ['calendar-data.js','themes.js'])vm.runInContext(fs.readFileSync(path.join(assets,file),'utf8'),context);
const {EVENTS,PROFILES,EV}=context.window.CalData;
const themes=context.window.SabCalThemes;

test('both Fatimiyya accounts are retained as separate dated observances',()=>{
 assert.equal(EVENTS['5-13'][0].id,'fatima-75');
 assert.match(EVENTS['5-13'][0].title,/75-day account/);
 assert.equal(EVENTS['6-3'][0].id,'fatima-95');
 assert.match(EVENTS['6-3'][0].title,/95-day account/);
 assert.equal(EVENTS['5-13'][0].profile,EVENTS['6-3'][0].profile);
 assert.equal(PROFILES.fatima.facts.length,3);
 assert.ok(PROFILES.fatima.sources.every(source=>source.url.startsWith('https://')));
});

test('multiple observances on 28 Safar have independent details',()=>{
 assert.equal(EVENTS['2-28'].length,2);
 assert.equal(EVENTS['2-28'][0].profile,'prophet');
 assert.equal(EVENTS['2-28'][1].profile,'hasan');
});

test('every occasion has a usable unique record and a valid profile link',()=>{
 const ids=new Set();
 for(const [key,items]of Object.entries(EVENTS)){
  const [month,day]=key.split('-').map(Number);
  assert.ok(month>=1&&month<=12&&day>=1&&day<=30);
  assert.equal(EV[key],items.map(item=>item.title).join(' & '));
  for(const item of items){
   assert.ok(!ids.has(item.id));ids.add(item.id);
   assert.ok(item.title&&item.summary);
   if(item.profile)assert.ok(PROFILES[item.profile]?.name);
  }
 }
 assert.equal(ids.size,18);
});

test('preset and custom colors keep selected-day and navigation text readable',()=>{
 assert.equal(themes.presets.length,6);
 const choices=themes.presets.map(p=>[p.id,p.color]).concat([
  ['custom','#ffff00'],['custom','#ffffff'],['custom','#000000'],['custom','#808080'],['custom','#00ffff']
 ]);
 for(const [id,color]of choices)for(const dark of [false,true]){
  const p=themes.resolve(id,dark,color);
  assert.ok(themes.contrast(p.accent,p['on-accent'])>=4.5,id+' selected date');
  assert.ok(themes.contrast(p['accent-text'],p.bg)>=4.5,id+' navigation');
  assert.ok(themes.contrast(p.ink,p.bg)>=4.5,id+' body text');
 }
});
