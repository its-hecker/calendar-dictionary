'use strict';
window.OnlineWords=(()=>{
 const text=(value,max=1200)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';
 const urdu=value=>/[\u0600-\u06ff]/.test(value);
 const language=query=>urdu(query)?'ur':'en';
 const key=query=>'online:'+language(query)+':'+query.normalize('NFKC').replace(/\s+/g,' ').trim();
 const https=url=>typeof url==='string'&&url.startsWith('https://')?url:'';
 function parse(payload,query){
  const lang=language(query),senses=[],synonyms=new Set();let ipa='',roman='',limited=false;
  const source=payload?.source||{},entries=payload?.entries;
  if(!Array.isArray(entries))throw new Error('The online dictionary returned an invalid response. Try again later.');
  function visit(items,pos,depth=0){
   if(!Array.isArray(items)||depth>3)return;
   for(const item of items){
    if(!item||typeof item!=='object')continue;
    if(senses.length>=24){limited=true;return;}
    if(text(item.definition)){
     const translations=(Array.isArray(item.translations)?item.translations:[])
      .filter(x=>x?.language?.code===(lang==='en'?'ur':'en')).map(x=>text(x.word,100)).filter(Boolean).slice(0,8);
     senses.push({text:text(item.definition),pos:text(pos,60)||'word',source:'online-wiktionary',
      tags:(Array.isArray(item.tags)?item.tags:[]).map(x=>text(x,60)).slice(0,8),translations,
      examples:(Array.isArray(item.examples)?item.examples:[]).map(x=>({text:text(x,2000),english:lang==='en'?text(x,2000):'',roman:''})).filter(x=>x.text).slice(0,2)});
    }
    (Array.isArray(item.synonyms)?item.synonyms:[]).forEach(x=>{if(text(x,100))synonyms.add(text(x,100));});
    visit(item.subsenses,pos,depth+1);
   }
  }
  for(const entry of entries){
   if(entry?.language?.code!==lang)continue;
   if(!ipa)ipa=text((Array.isArray(entry.pronunciations)?entry.pronunciations:[]).find(x=>x?.type==='ipa')?.text,120);
   if(!roman)roman=text((Array.isArray(entry.forms)?entry.forms:[]).find(x=>x?.tags?.includes('romanization'))?.word,120);
   visit(entry.senses,entry.partOfSpeech);
   (Array.isArray(entry.synonyms)?entry.synonyms:[]).forEach(x=>{if(text(x,100))synonyms.add(text(x,100));});
  }
  if(!senses.length)throw new Error('No online entry was found. Try another spelling or search the offline library.');
  const word=text(payload.word,100)||query;
  return {id:key(query),word,kind:lang,ur:lang==='ur'?word:'',roman,ipa,online:true,query,
   pos:senses[0].pos,preview:senses[0].text,senses,synonyms:[...synonyms].slice(0,30),bilingualExamples:[],limited,
   fetchedAt:Date.now(),provider:source.provider==='Wiktionary'?'Wiktionary':'FreeDictionaryAPI.com',sourceUrl:https(source.url)||'https://en.wiktionary.org/wiki/'+encodeURIComponent(word),
   license:{name:text(source.license?.name,100)||'CC BY-SA 4.0',url:https(source.license?.url)||'https://creativecommons.org/licenses/by-sa/4.0/'}};
 }
 function example(entry){
  for(const sense of entry.senses||[])for(const item of sense.examples||[]){
   if(item.text&&new TextEncoder().encode(item.text).length<=500)return {text:item.text,language:urdu(item.text)?'ur':'en'};
  }
  return null;
 }
 function decode(value){return value.replace(/&(amp|quot|apos|lt|gt|#39|#x27);/g,(m,x)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>','#39':"'",'#x27':"'"}[x]));}
 function translation(value,target){
  const out=decode(text(value,2000));
  if(!out||(target==='ur'&&!urdu(out))||(target==='en'&&urdu(out)))throw new Error('The service did not return the requested language. The original text remains available.');
  return out;
 }
 function pair(entry,original,translation){
  translation=decode(text(translation,2000));
  const ur=original.language==='ur'?original.text:translation,en=original.language==='en'?original.text:translation;
  if(!urdu(ur)||!en||urdu(en))throw new Error('The service did not return the requested language. The original example remains available.');
  return {urdu:ur,english:en,roman:'',source:'Online example',
   attribution:'English/Urdu source example: Wiktionary contributors. Translated text: MyMemory, automatic translation; it may contain errors.',
   links:[{label:'Original entry',url:entry.sourceUrl},{label:'MyMemory',url:'https://mymemory.translated.net/'}]};
 }
 return {parse,key,language,example,pair,translation};
})();
