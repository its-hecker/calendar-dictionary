'use strict';
const $=id=>document.getElementById(id), {HM,DM,EV,DOW,MN}=window.CalData;
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
function day(year,month,date){const value=new Date(0);value.setHours(12,0,0,0);value.setFullYear(year,month,date);return value;}
function today(){const value=new Date();return day(value.getFullYear(),value.getMonth(),value.getDate());}
function iso(date){return String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
function fromISO(value){const parts=value.split('-').map(Number);return day(parts[0],parts[1]-1,parts[2]);}
function same(a,b){return iso(a)===iso(b);}
let S={h:0,d:0,theme:'system'};
try{const old=JSON.parse(localStorage.getItem('tt')||'{}');S.h=Math.max(-2,Math.min(2,Number(old.h)||0));S.d=Math.max(-2,Math.min(2,Number(old.d)||0));S.theme=['dark','light'].includes(old.theme)?old.theme:'system';}catch(_){}
let selected=today(),cur=day(selected.getFullYear(),selected.getMonth(),1),activeTab='calendar',events=[];
function save(){try{localStorage.setItem('tt',JSON.stringify(S));}catch(_){}}
function applyTheme(){
 if(S.theme==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.dataset.theme=S.theme;
 const dark=S.theme==='dark'||(S.theme==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);
 $('themeButton').innerHTML=icon(dark?'sun':'moon');$('themeButton').setAttribute('aria-label',dark?'Switch to light appearance':'Switch to dark appearance');
 document.querySelectorAll('button[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===S.theme)));
 if(window.AppTheme)AppTheme.setDark(dark);
}
const hf=new Intl.DateTimeFormat('en-u-ca-islamic-civil-nu-latn',{day:'numeric',month:'numeric',year:'numeric'});
function hijri(date){const adjusted=day(date.getFullYear(),date.getMonth(),date.getDate()+S.h),out={};hf.formatToParts(adjusted).forEach(part=>{if(part.type!=='literal'&&part.type!=='era')out[part.type]=parseInt(part.value,10);});return out;}
function desi(date){
 const year=date.getFullYear();let index=null;
 for(let i=0;i<12;i++)if(day(year,DM[i][1],DM[i][2]+S.d)<=date)index=i;
 const i=index===null?11:index,start=index===null?day(year-1,11,DM[11][2]+S.d):day(year,DM[i][1],DM[i][2]+S.d);
 const count=Math.round((date-start)/864e5)+1,yearStart=day(year,2,DM[2][2]+S.d);
 return {name:DM[i][0],day:count,year:date>=yearStart?year+57:year+56};
}
function evOf(h){return EV[h.month+'-'+h.day]||'';}
function occasionRow(event){return `<button class="occasion" data-date="${iso(event.date)}"><span class="occasion-date"><strong>${event.date.getDate()}</strong><small>${MN[event.date.getMonth()].slice(0,3)}</small></span><span class="occasion-text"><strong>${esc(event.name)}</strong><small>${event.h.day} ${esc(HM[event.h.month-1])} · ${weekdays[event.date.getDay()]}</small></span>${icon('right')}</button>`;}
function render(){
 const now=today(),year=cur.getFullYear(),month=cur.getMonth(),first=day(year,month,1),last=day(year,month+1,0);
 const selectedH=hijri(selected),selectedD=desi(selected);
 $('selectedLabel').textContent=same(selected,now)?'TODAY':'SELECTED DAY';$('todayButton').hidden=same(selected,now);
 $('selectedNumber').textContent=selected.getDate();$('selectedWeekday').textContent=weekdays[selected.getDay()];$('selectedGregorian').textContent=MN[selected.getMonth()]+' '+selected.getFullYear();
 $('selectedHijri').textContent=selectedH.day+' '+HM[selectedH.month-1]+' '+selectedH.year+' AH';
 $('selectedDesi').textContent=selectedD.day+' '+selectedD.name+' '+selectedD.year+' Bikrami';
 const h1=hijri(first),h2=hijri(last),d1=desi(first),d2=desi(last);
 $('monthTitle').textContent=MN[month]+' '+year;
 $('monthSubtitle').textContent=HM[h1.month-1]+(h1.month!==h2.month?' – '+HM[h2.month-1]:'')+' '+h2.year+' AH · '+d1.name+(d1.name!==d2.name?' – '+d2.name:'')+' '+d2.year;
 let html=DOW.map(n=>'<div class="dow" aria-hidden="true">'+n.toUpperCase()+'</div>').join('');
 events=[];const start=day(year,month,1-first.getDay());
 for(let i=0;i<42;i++){
  const date=day(start.getFullYear(),start.getMonth(),start.getDate()+i);
  if(i>=35&&date.getMonth()!==month)break;
  const h=hijri(date),d=desi(date),event=evOf(h),inMonth=date.getMonth()===month,isSelected=same(date,selected),isToday=same(date,now);
  const label=weekdays[date.getDay()]+', '+date.getDate()+' '+MN[date.getMonth()]+' '+date.getFullYear()+'. '+h.day+' '+HM[h.month-1]+'. '+d.day+' '+d.name+(event?'. '+event:'');
  html+=`<button class="date-cell${inMonth?'':' outside'}${isToday?' is-today':''}${isSelected?' selected':''}${date.getDay()===5?' friday':''}" data-date="${iso(date)}" aria-label="${esc(label)}" aria-pressed="${isSelected}"${isToday?' aria-current="date"':''}><span class="g">${date.getDate()}</span><span class="h">${h.day}${h.day===1?' '+HM[h.month-1].slice(0,3):''}</span><span class="d">${d.day}${d.day===1?' '+d.name:''}</span>${event?'<i class="event-dot" aria-hidden="true"></i>':''}</button>`;
  if(inMonth&&event)events.push({date,h,name:event});
 }
 $('grid').innerHTML=html;$('grid').setAttribute('aria-label',MN[month]+' '+year+' dates');
 const selectedEvent=evOf(selectedH);
 $('selectedOccasion').innerHTML=selectedEvent?'<div class="selected-occasion">'+icon('spark')+'<span>'+esc(selectedEvent)+'</span></div>':'';
 const quiet='<div class="quiet-day">No listed occasions this month. Every day is still a little worth celebrating.</div>';
 $('monthPreview').innerHTML=events.length?events.slice(0,2).map(occasionRow).join(''):quiet;
 $('occasionMonth').textContent=MN[month]+' '+year;$('occasionList').innerHTML=events.length?events.map(occasionRow).join(''):quiet;
 $('hValue').textContent=(S.h>0?'+':'')+S.h;$('dValue').textContent=(S.d>0?'+':'')+S.d;
 document.querySelectorAll('[data-adjust]').forEach(button=>{const [key,delta]=button.dataset.adjust.split(':');button.disabled=Number(delta)<0?S[key]<=-2:S[key]>=2;});
}
function animate(element,delta=0){if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;element.animate([{opacity:.35,transform:`translateX(${delta*12}px)`},{opacity:1,transform:'none'}],{duration:210,easing:'ease-out'});}
function selectDate(date,focus=false){selected=date;cur=day(date.getFullYear(),date.getMonth(),1);render();animate($('selectedNumber'));if(focus)$('grid').querySelector(`[data-date="${iso(date)}"]`)?.focus({preventScroll:true});}
function moveMonth(delta){const next=day(cur.getFullYear(),cur.getMonth()+delta,1),last=day(next.getFullYear(),next.getMonth()+1,0);selected=day(next.getFullYear(),next.getMonth(),Math.min(selected.getDate(),last.getDate()));cur=next;render();animate($('grid'),delta);}
function setTab(tab){activeTab=tab;['calendar','occasions','settings'].forEach(name=>{$(name+'Pane').hidden=name!==tab;});document.querySelectorAll('[data-tab]').forEach(button=>{if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});animate($(tab+'Pane'));scrollTo({top:0,behavior:'auto'});}
$('prev').onclick=()=>moveMonth(-1);$('next').onclick=()=>moveMonth(1);
$('todayButton').onclick=()=>selectDate(today());
$('chooseDate').onclick=()=>{$('jumpDate').value=iso(selected);$('dateDialog').showModal();};
$('dateForm').onsubmit=event=>{event.preventDefault();const value=$('jumpDate').value;if(!/^\d{4,}-\d{2}-\d{2}$/.test(value))return;const date=fromISO(value);if(Number.isNaN(date.getTime()))return;selectDate(date);$('dateDialog').close();};
$('allOccasions').onclick=()=>setTab('occasions');
$('infoButton').onclick=$('settingsInfo').onclick=()=>$('infoDialog').showModal();
$('themeButton').onclick=()=>{const dark=S.theme==='dark'||(S.theme==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);S.theme=dark?'light':'dark';applyTheme();save();};
document.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;
 if(button.dataset.tab)setTab(button.dataset.tab);
 else if(button.dataset.date){const date=fromISO(button.dataset.date);if(activeTab!=='calendar')setTab('calendar');selectDate(date,true);}
 else if(button.dataset.month)moveMonth(Number(button.dataset.month));
 else if(button.dataset.adjust){const [key,delta]=button.dataset.adjust.split(':');S[key]=Math.max(-2,Math.min(2,S[key]+Number(delta)));save();render();}
 else if(button.dataset.theme){S.theme=button.dataset.theme;save();applyTheme();}
 else if(button.dataset.close)$(button.dataset.close).close();
});
$('grid').addEventListener('keydown',event=>{const button=event.target.closest('[data-date]');if(!button)return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(delta){event.preventDefault();const date=fromISO(button.dataset.date);selectDate(day(date.getFullYear(),date.getMonth(),date.getDate()+delta),true);}});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
window.AppUi={back(){if($('dateDialog').open){$('dateDialog').close();return true;}if($('infoDialog').open){$('infoDialog').close();return true;}if(activeTab!=='calendar'){setTab('calendar');return true;}return false;}};
const themeMedia=matchMedia('(prefers-color-scheme:dark)');if(themeMedia.addEventListener)themeMedia.addEventListener('change',applyTheme);
applyTheme();render();
