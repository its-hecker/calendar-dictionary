'use strict';
const $ = id => document.getElementById(id);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isUrdu = text => /[\u0600-\u06ff]/.test(text);
function read(key, fallback) { try { const value=JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch (_) { return fallback; } }
function write(key, value) { try { localStorage.setItem(key,JSON.stringify(value)); } catch (_) {} }
const savedRaw=read('dictionary.saved.v2',[]), historyRaw=read('dictionary.history.v2',[]), snapshotRaw=read('dictionary.snapshots.v2',{});
const state={ready:false,stats:null,tab:'discover',filter:'all',browse:false,items:[],more:false,offset:0,
  saved:Array.isArray(savedRaw)?savedRaw.filter(x=>typeof x==='string').slice(0,1000):[],
  history:Array.isArray(historyRaw)?historyRaw.filter(x=>typeof x==='string').slice(0,50):[],
  snapshots:snapshotRaw && typeof snapshotRaw==='object' && !Array.isArray(snapshotRaw)?snapshotRaw:{},
  currentEntry:null,daily:null,request:0,queryToken:'',entryToken:'',theme:read('dictionary.theme','system')};
const q=$('q');
let searchTimer,toastTimer,activeMic=null;
const number = n => new Intl.NumberFormat('en').format(n);
function msg(text) { $('msg').textContent=text||''; $('msg').hidden=!text; const box=$('detailMessage');if(box){box.textContent=text||'';box.hidden=!text;} }
function toast(text) { $('toast').textContent=text; $('toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>{$('toast').hidden=true;},1800); }
function applyTheme() {
  if (state.theme==='light' || state.theme==='dark') document.documentElement.dataset.theme=state.theme;
  else document.documentElement.removeAttribute('data-theme');
  const dark=state.theme==='dark' || (state.theme==='system' && matchMedia('(prefers-color-scheme:dark)').matches);
  $('themeButton').innerHTML=icon(dark?'sun':'moon');
  $('themeButton').setAttribute('aria-label',dark?'Switch to light appearance':'Switch to dark appearance');
  document.querySelectorAll('[data-theme]').forEach(button=>{ if (button.tagName==='BUTTON') button.setAttribute('aria-pressed',String(button.dataset.theme===state.theme)); });
  if (window.AppTheme) AppTheme.setDark(dark);
}
function persist() {
  write('dictionary.saved.v2',state.saved); write('dictionary.history.v2',state.history);
  const keep=new Set([...state.saved,...state.history]);
  Object.keys(state.snapshots).forEach(id=>{if(!keep.has(id)) delete state.snapshots[id];});
  write('dictionary.snapshots.v2',state.snapshots);
  $('savedCount').textContent=state.saved.length; $('savedCount').hidden=!state.saved.length;
}
function snapshot(item) {
  state.snapshots[item.id]={id:item.id,word:item.word,ur:item.ur,roman:item.roman,pos:item.pos,preview:item.preview || item.senses?.[0]?.text || '',kind:item.kind};
}
function saveWord(id) {
  if (state.saved.includes(id)) {state.saved=state.saved.filter(x=>x!==id);toast('Removed from saved words');}
  else if (state.saved.length<1000) {state.saved.unshift(id);toast('Word saved');}
  else return toast('Your collection has reached 1,000 saved words');
  const item=[state.currentEntry,state.daily,...state.items].find(x=>x?.id===id);
  if(item)snapshot(item);
  persist(); updateSaveButtons();
  if(state.tab==='saved') renderCollection();
}
function updateSaveButtons() {
  document.querySelectorAll('[data-save]').forEach(button=>{
    const saved=state.saved.includes(button.dataset.save);
    button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',saved?'Remove saved word':'Save word');
    if(button.id==='saveEntry') button.innerHTML=icon(saved?'check':'save')+(saved?'Saved':'Save word');
  });
}
function row(item) {
  return `<article class="result-card" data-kind="${item.kind==='ur'?'ur':'en'}"><button class="result-open" data-entry="${esc(item.id)}"><strong class="result-word ${item.kind==='ur'?'ur':''}" ${item.kind==='ur'?'lang="ur" dir="rtl"':''}>${esc(item.word)}</strong><span class="result-roman">${esc(item.roman || item.pos || '')}</span><p class="result-meaning">${esc(item.preview)}</p><span class="result-footer"><span class="type-badge">${item.kind==='ur'?'URDU ↔ ENGLISH':'ENGLISH DEFINITION'}</span>${icon('arrow')}</span></button><button class="save-button" data-save="${esc(item.id)}" aria-label="Save word" aria-pressed="${state.saved.includes(item.id)}">${icon('save')}</button></article>`;
}
function empty(title,text) { $('emptyTitle').textContent=title; $('emptyText').textContent=text; $('emptyState').hidden=false; }
function showHome() {
  $('home').hidden=false;$('listView').hidden=true;$('intro').hidden=false;
  const recent=state.history.slice(0,3).map(id=>state.snapshots[id]).filter(Boolean);
  $('recentPreview').innerHTML=recent.length?recent.map(row).join(''):'<p class="fine">Words you open will appear here. A little curiosity goes a long way.</p>';
  updateSaveButtons();
}
function showList(title) {
  $('home').hidden=true;$('listView').hidden=false;$('intro').hidden=true;
  $('listTitle').textContent=title;$('emptyState').hidden=true;
}
function renderCollection() {
  const ids=state.tab==='saved'?state.saved:state.history;
  showList(state.tab==='saved'?'Your saved words':'Recently explored');
  state.items=ids.map(id=>state.snapshots[id]).filter(Boolean);
  $('results').innerHTML=state.items.map(row).join('');$('loadMore').hidden=true;
  $('listMeta').textContent=`${ids.length} ${ids.length===1?'word':'words'}`;
  if(!state.items.length) empty(state.tab==='saved'?'Build your word collection':'Follow your curiosity',state.tab==='saved'?'Tap the bookmark on a word to keep it here, ready whenever you need it.':'Open a word to see its meaning. Your recent discoveries will be collected here.');
  updateSaveButtons();
}
function setTab(tab) {
  state.tab=tab; state.queryToken=''; state.browse=false; q.value='';$('clearSearch').hidden=true;msg('');
  document.querySelectorAll('[data-tab]').forEach(button=>{if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  if(tab==='discover') showHome(); else renderCollection();
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches) $('main').animate([{opacity:.4,transform:'translateY(5px)'},{opacity:1,transform:'none'}],{duration:200});
  scrollTo({top:0,behavior:'auto'});
}
function search(reset=true) {
  clearTimeout(searchTimer);
  if(!state.ready)return;
  if(state.tab!=='discover') {
    state.tab='discover';document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab==='discover')b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  }
  const query=q.value.trim();$('clearSearch').hidden=!query;
  if(!query && !state.browse) return showHome();
  showList(query?'Search results':'Browse the library');
  if(reset) {state.items=[];state.offset=0;$('results').innerHTML='';}
  const token='search-'+(++state.request);state.queryToken=token;
  $('listMeta').textContent='Finding your word…';$('loadMore').hidden=true;
  DictionaryApi.search(query,state.filter,token,state.offset);
}
function explore(text) {setTab('discover');q.value=text;search();}
function openEntry(id) {
  if(!state.ready)return;
  state.entryToken='entry-'+(++state.request);
  DictionaryApi.entry(id,state.entryToken);
}
function pronunciationButton(language,text,roman,label) {
  return `<button data-speak="${esc(text)}" data-language="${language}" data-roman="${esc(roman||'')}">${icon('volume')}${label}</button>`;
}
function exampleKey(urdu,english) {
  return [urdu,english].map(x=>String(x||'').replace(/\s+/g,' ').trim()).join('\t');
}
function pairedExamples(entry) {
  const items=[...(entry.bilingualExamples||[])];
  // Retain supplied sense examples even if an entry has no corpus association.
  (entry.senses||[]).forEach(sense=>(sense.examples||[]).forEach(example=>{
    if(isUrdu(example.text)&&example.english&&!isUrdu(example.english))items.push({urdu:example.text,english:example.english,roman:example.roman,
      source:sense.source==='original'?'Original project example':'Wiktionary',links:[]});
  }));
  const seen=new Set();
  return items.filter(example=>{
    if(!isUrdu(example.urdu)||!example.english||isUrdu(example.english))return false;
    const key=exampleKey(example.urdu,example.english);if(seen.has(key))return false;seen.add(key);return true;
  }).slice(0,5);
}
function exampleCard(example) {
  let body='<article class="example-card"><div class="example-language"><span>URDU · <span lang="ur" dir="rtl">اردو</span></span>';
  body+=`<button class="example-listen" data-speak="${esc(example.urdu)}" data-language="ur-PK" data-roman="${esc(example.roman||'')}" aria-label="Listen to Urdu example">${icon('volume')}Listen</button></div>`;
  body+=`<p class="example-urdu ur" lang="ur" dir="rtl">${esc(example.urdu)}</p>`;
  if(example.roman)body+=`<p class="example-roman" lang="ur-Latn">${esc(example.roman)}</p>`;
  body+='<div class="example-language"><span>ENGLISH</span>';
  body+=`<button class="example-listen" data-speak="${esc(example.english)}" data-language="en-US" aria-label="Listen to English example">${icon('volume')}Listen</button></div>`;
  body+=`<p class="example-english" lang="en" dir="ltr">${esc(example.english)}</p><footer class="example-source">${esc(example.attribution||example.source||'Project example')}`;
  (example.links||[]).filter(link=>/^https:\/\//.test(link.url)).forEach(link=>{body+=` · <a href="${esc(link.url)}">${esc(link.label)}</a>`;});
  return body+'</footer></article>';
}
function detail(entry) {
  const ur=entry.kind==='ur';
  $('entryKind').textContent=ur?'URDU ↔ ENGLISH':'ENGLISH DEFINITION';
  const senses=entry.senses || [];
  let body=`<h2 class="detail-title ${ur?'ur':''}" ${ur?'dir="rtl" lang="ur"':''}>${esc(entry.word)}</h2><p class="detail-roman">${esc([entry.roman,entry.ipa].filter(Boolean).join(' · '))}</p><div class="detail-actions">`;
  body+=pronunciationButton(ur?'ur-PK':'en-US',entry.word,entry.roman,ur?'Listen in Urdu':'Listen');
  if(ur)body+=pronunciationButton('en-US',senses[0]?.text||'',null,'English meaning');
  body+=`<button id="saveEntry" data-save="${esc(entry.id)}" aria-pressed="${state.saved.includes(entry.id)}">${icon('save')}Save word</button></div><div class="message" id="detailMessage" role="status" hidden></div>`;
  const examples=pairedExamples(entry), shown=new Set(examples.map(x=>exampleKey(x.urdu,x.english)));
  body+='<section class="word-examples" aria-labelledby="examplesHeading"><div class="examples-heading"><h3 id="examplesHeading">Example sentences</h3><span>URDU + ENGLISH</span></div>';
  if(examples.length){
    body+='<p class="examples-intro">See this word in context.</p>'+exampleCard(examples[0]);
    if(examples.length>1)body+=`<details class="more-examples"><summary>${examples.length-1} more ${examples.length===2?'example':'examples'}</summary>${examples.slice(1).map(exampleCard).join('')}</details>`;
  }else body+='<p class="examples-unavailable">An Urdu–English sentence pair is not yet available for this word in the offline collection. Meanings and any source examples are shown below.</p>';
  body+='</section><h3 class="meanings-heading">Meanings & usage</h3>';
  senses.forEach((sense,i)=>{
    body+=`<section class="sense"><div class="sense-label"><span class="sense-number">${i+1}</span><span>${esc(sense.pos || 'word')}</span>${sense.tags?.length?'<span>· '+esc(sense.tags.join(', '))+'</span>':''}${sense.source==='webster1913'?'<span>· Historical · 1913</span>':''}</div><p>${esc(sense.text)}</p>`;
    (sense.examples||[]).forEach(example=>{
      if(shown.has(exampleKey(example.text,example.english)))return;
      body+='<blockquote>';
      body+=`<span class="usage-label">${isUrdu(example.text)?'Urdu source example':'English source example'}</span>`;
      if(isUrdu(example.text))body+=`<p class="ur" lang="ur" dir="rtl">${esc(example.text)}</p>`;
      else body+=`<p>${esc(example.text)}</p>`;
      if(example.roman)body+=`<small>${esc(example.roman)}</small>`;
      if(example.english && example.english!==example.text)body+=`<p>${esc(example.english)}</p>`;
      body+='</blockquote>';
    });
    body+='</section>';
  });
  if(entry.synonyms?.length)body+='<h3 class="about-heading">Related words & synonyms</h3><div class="synonyms">'+entry.synonyms.map(word=>`<button data-search="${esc(word)}" class="${isUrdu(word)?'ur':''}" dir="auto">${esc(word)}</button>`).join('')+'</div>';
  body+='<div class="source-note">';
  if(ur)body+=`Wiktionary contributors via Kaikki · CC BY-SA 4.0. <a href="https://en.wiktionary.org/wiki/${encodeURIComponent(entry.word)}#Urdu">Original entry & contributor history</a>`;
  else body+='English definitions from Open English WordNet and/or Webster’s 1913. Historical meanings are retained; see the info screen for source credits and notices.';
  body+='</div>';
  $('entryContent').innerHTML=body;updateSaveButtons();
  if(!$('entryDialog').open)$('entryDialog').showModal();
  $('entryDialog').scrollTop=0;
}
window.DictionaryNative={
  onProgress(percent){$('progressBar').style.width=percent+'%';$('loadingText').textContent='Making '+percent+'% of your library ready. This only happens once.';},
  onReady(stats){
    state.ready=true;state.stats=stats;$('loading').hidden=true;$('main').hidden=false;
    $('headwordCount').textContent=number(stats.totalHeadwords)+' headwords, always with you';
    $('countSubtitle').textContent=number(stats.urduHeadwords)+' Urdu · '+number(stats.englishHeadwords)+' English';
    $('infoBilingual').textContent=number(stats.urduHeadwords);$('infoEnglish').textContent=number(stats.englishHeadwords);$('infoDefinitions').textContent=number(stats.definitions);
    if(stats.examples)$('exampleCoverage').textContent=number(stats.examples.sentencePairs)+' Urdu–English sentence pairs for '+number(stats.examples.coveredHeadwords)+' headwords, stored offline. Coverage varies by word.';
    $('dailyDate').textContent=new Intl.DateTimeFormat('en',{day:'numeric',month:'short'}).format(new Date());
    DictionaryApi.daily(Math.floor(Date.now()/864e5),'daily');
    if(!read('dictionary.migrated.v2',false)){
      const old=read('fav',[]);
      if(Array.isArray(old))state.saved=[...new Set([...old.filter(i=>Number.isInteger(i)&&stats.legacyIds[i]).map(i=>stats.legacyIds[i]),...state.saved])];
      write('dictionary.migrated.v2',true);
    }
    const ids=[...new Set([...state.saved,...state.history])];
    if(ids.length)DictionaryApi.summaries(JSON.stringify(ids),'restore');
    persist();if(q.value.trim() || state.browse)search();else if(state.tab==='discover')showHome();else renderCollection();
  },
  onResults(token,items,more,offset){
    if(token!==state.queryToken)return;
    state.items=offset?state.items.concat(items):items;state.more=more;state.offset=state.items.length;
    $('results').innerHTML=state.items.map(row).join('');$('loadMore').hidden=!more;
    $('listMeta').textContent=state.items.length?number(state.items.length)+(more?'+ results':' results'):'';
    if(!state.items.length)empty('No match just yet',state.filter==='bilingual'?'Try another spelling, Roman Urdu, or switch to All words for the English definitions collection.':'Try a shorter spelling or search an Urdu or Roman Urdu word.');
    updateSaveButtons();
  },
  onEntry(token,entry){
    if(token==='daily'){
      state.daily=entry;$('dailyWord').textContent=entry.word;$('dailyRoman').textContent=entry.roman;
      $('dailyMeaning').textContent=entry.senses?.[0]?.text||'';return;
    }
    if(token!==state.entryToken)return;
    state.currentEntry=entry;snapshot(entry);state.history=[entry.id,...state.history.filter(id=>id!==entry.id)].slice(0,50);persist();detail(entry);
    if(state.tab==='history')renderCollection();else if(state.tab==='discover'&&!q.value.trim()&&!state.browse)showHome();
  },
  onSummaries(token,items){items.forEach(snapshot);persist();if(state.tab==='discover'&&!q.value.trim()&&!state.browse)showHome();else if(state.tab!=='discover')renderCollection();},
  onError(token,text){
    if(token==='init'){$('loadingTitle').textContent='Your library needs another moment';$('loadingText').textContent=text;$('retryLoad').hidden=false;return;}
    if(token.startsWith('search')&&token!==state.queryToken)return;
    msg(text);
  }
};
function speak(text,language,roman) {
  msg('');
  if(window.AndroidVoice) return AndroidVoice.speak(text,language,roman||'');
  if(!window.speechSynthesis || !window.SpeechSynthesisUtterance)return msg('Pronunciation is available through Android text-to-speech in the app.');
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang=language;utterance.rate=.9;speechSynthesis.speak(utterance);
}
window.onAndroidSpeechResult=function(text,error){
  if(activeMic){activeMic.disabled=false;activeMic.innerHTML=icon('mic')+`<span>${activeMic.dataset.l==='ur-PK'?'Urdu':'English'}</span>`;}
  activeMic=null;$('mic').querySelectorAll('button').forEach(b=>{b.disabled=false;});msg(error||'');
  if(text){q.value=text.trim();search();}
};
function voice(button){
  if(activeMic)return;activeMic=button;msg('');
  button.innerHTML=icon('mic')+'<span>Listening…</span>';$('mic').querySelectorAll('button').forEach(b=>{b.disabled=true;});
  if(window.AndroidVoice){try{AndroidVoice.recognize(button.dataset.l);}catch(_){onAndroidSpeechResult('','Voice input could not start. Please try again.');}return;}
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR)return onAndroidSpeechResult('','Voice search is available through Android speech services in the app.');
  try{const recognition=new SR();recognition.lang=button.dataset.l;recognition.onresult=e=>onAndroidSpeechResult(e.results[0][0].transcript,'');recognition.onerror=()=>onAndroidSpeechResult('','Voice input could not finish. Please try again.');recognition.onend=()=>{if(activeMic)onAndroidSpeechResult('','');};recognition.start();}catch(_){onAndroidSpeechResult('','Voice input could not start.');}
}
q.oninput=()=>{state.browse=false;$('clearSearch').hidden=!q.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>search(),130);};
q.onkeydown=e=>{if(e.key==='Enter'){q.blur();search();}};
$('clearSearch').onclick=()=>{q.value='';state.browse=false;search();q.focus();};
$('themeButton').onclick=()=>{const dark=state.theme==='dark'||(state.theme==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);state.theme=dark?'light':'dark';write('dictionary.theme',state.theme);applyTheme();};
$('infoButton').onclick=()=>{$('infoDialog').showModal();};
$('openDaily').onclick=()=>{if(state.daily)openEntry(state.daily.id);};
$('browseAll').onclick=()=>{state.browse=true;search();};
$('viewHistory').onclick=()=>setTab('history');
$('loadMore').onclick=()=>search(false);
$('retryLoad').onclick=()=>{$('retryLoad').hidden=true;DictionaryApi.init();};
$('mic').onclick=e=>{const button=e.target.closest('button[data-l]');if(button)voice(button);};
document.addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button)return;
  if(button.dataset.close)$(button.dataset.close).close();
  else if(button.dataset.tab)setTab(button.dataset.tab);
  else if(button.dataset.entry)openEntry(button.dataset.entry);
  else if(button.dataset.save)saveWord(button.dataset.save);
  else if(button.dataset.search){if($('entryDialog').open)$('entryDialog').close();explore(button.dataset.search);}
  else if(button.dataset.speak)speak(button.dataset.speak,button.dataset.language,button.dataset.roman);
  else if(button.dataset.filter){state.filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));if(q.value.trim()||state.browse)search();else{state.browse=true;search();}}
  else if(button.dataset.theme){state.theme=button.dataset.theme;write('dictionary.theme',state.theme);applyTheme();}
});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
window.AppUi={back(){if($('entryDialog').open){$('entryDialog').close();return true;}if($('infoDialog').open){$('infoDialog').close();return true;}if(state.tab!=='discover'||q.value.trim()||state.browse){setTab('discover');return true;}return false;}};
const themeMedia=matchMedia('(prefers-color-scheme:dark)');if(themeMedia.addEventListener)themeMedia.addEventListener('change',applyTheme);
$('exampleCredits').textContent=window.EXAMPLE_CREDITS||'';
$('dataCredits').textContent=window.LICENSE_TEXT?.credits||'';$('englishLicense').textContent=window.LICENSE_TEXT?.english||'';$('fontLicense').textContent=window.LICENSE_TEXT?.font||'';
applyTheme();persist();
if(window.DictionaryApi)DictionaryApi.init();else{$('loadingTitle').textContent='Your offline dictionary';$('loadingText').textContent='Open the Android app to explore the complete bundled library.';}
