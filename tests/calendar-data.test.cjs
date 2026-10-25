const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context={window:{}};
const assets=path.join(__dirname,'../app/src/main/assets');
vm.createContext(context);
for(const file of ['calendar-data.js','themes.js'])vm.runInContext(fs.readFileSync(path.join(assets,file),'utf8'),context);
const {EVENTS,PROFILES,EV,DOW}=context.window.CalData;
const themes=context.window.SabCalThemes;

test('calendar headings run from Monday through Sunday',()=>{
 assert.equal(Array.from(DOW).join(','),'Mon,Tue,Wed,Thu,Fri,Sat,Sun');
});

test('birth and martyrdom occasions retain their semantic marker categories',()=>{
 for(const item of Object.values(EVENTS).flat()){
  if(/Wiladat|Milad/.test(item.title))assert.equal(item.kind,'celebration',item.id);
  if(/Shahadat|Wafat/.test(item.title))assert.equal(item.kind,'remembrance',item.id);
 }
});

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

test('preset and custom colors keep today and navigation text readable',()=>{
 assert.equal(themes.presets.length,6);
 const choices=themes.presets.map(p=>[p.id,p.color]).concat([
  ['custom','#ffff00'],['custom','#ffffff'],['custom','#000000'],['custom','#808080'],['custom','#00ffff']
 ]);
 for(const [id,color]of choices)for(const dark of [false,true]){
  const p=themes.resolve(id,dark,color);
  assert.ok(themes.contrast(p.accent,p['on-accent'])>=4.5,id+' current date');
  assert.ok(themes.contrast(p['accent-text'],p.bg)>=4.5,id+' navigation');
  assert.ok(themes.contrast(p.ink,p.bg)>=4.5,id+' body text');
 }
});

test('Wiladat stays green and Shahadat stays red with visible markers across themes',()=>{
 for(const dark of [false,true]){
  const reference=themes.resolve('ocean',dark);
  for(const preset of themes.presets){
   const p=themes.resolve(preset.id,dark);
   assert.equal(p.wiladat,reference.wiladat);
   assert.equal(p.shahadat,reference.shahadat);
   const rgb=color=>[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
   const green=rgb(p.wiladat),red=rgb(p.shahadat);
   assert.ok(green[1]>green[0]&&green[1]>green[2]);
   assert.ok(red[0]>red[1]&&red[0]>red[2]);
   assert.ok(themes.contrast(p.wiladat,p.card)>=3,preset.id+' green marker');
   assert.ok(themes.contrast(p.shahadat,p.card)>=3,preset.id+' red marker');
  }
 }
});
