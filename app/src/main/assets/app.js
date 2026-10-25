'use strict';
const $=id=>document.getElementById(id);
const {HM,DM,EV,EVENTS,PROFILES,DOW,MN}=window.CalData;
const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const presets=window.SabCalThemes.presets;
function day(year,month,date){const value=new Date(0);value.setHours(12,0,0,0);value.setFullYear(year,month,date);return value;}
function today(){const value=new Date();return day(value.getFullYear(),value.getMonth(),value.getDate());}
function iso(date){return String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
function fromISO(value){const parts=value.split('-').map(Number);return day(parts[0],parts[1]-1,parts[2]);}
function same(a,b){return iso(a)===iso(b);}
function gregorian(date){return date.getDate()+' '+MN[date.getMonth()]+' '+date.getFullYear();}
function clamp(value,min,max,fallback){return Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;}
let S={h:0,d:0,theme:'system',palette:'ocean',accent:'#2563eb',textSize:100};
try{
 const old=JSON.parse(localStorage.getItem('tt')||'{}');
 S.h=clamp(old.h,-2,2,0);S.d=clamp(old.d,-2,2,0);
 S.theme=['dark','light'].includes(old.theme)?old.theme:'system';
 S.palette=presets.some(p=>p.id===old.palette)||old.palette==='custom'?old.palette:'ocean';
 S.accent=/^#[\da-f]{6}$/i.test(old.accent||'')?old.accent:'#2563eb';
 S.textSize=Math.round(clamp(old.textSize,90,160,100)/10)*10;
}catch(_){}
let selected=today(),cur=day(selected.getFullYear(),selected.getMonth(),1),activeTab='calendar',events=[],activeDetailId='';
function save(){try{localStorage.setItem('tt',JSON.stringify(S));}catch(_){}}
function applyTheme(){
 if(S.theme==='system')document.documentElement.removeAttribute('data-theme');else document.documentElement.dataset.theme=S.theme;
 const dark=S.theme==='dark'||(S.theme==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);
 const colors=SabCalThemes.resolve(S.palette,dark,S.accent);
 Object.entries(colors).forEach(([key,value])=>document.documentElement.style.setProperty('--'+key,value));
 document.documentElement.dataset.palette=S.palette;
 $('themeButton').innerHTML=icon(dark?'sun':'moon');
 $('themeButton').setAttribute('aria-label',dark?'Switch to light appearance':'Switch to dark appearance');
 document.querySelectorAll('button[data-theme]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.theme===S.theme)));
 document.querySelectorAll('[data-palette]').forEach(button=>{if(button.tagName==='BUTTON')button.setAttribute('aria-pressed',String(button.dataset.palette===S.palette));});
 $('customAccent').value=S.accent;
 $('customAccent').closest('label').classList.toggle('active',S.palette==='custom');
 if(window.AppTheme){if(AppTheme.setPalette)AppTheme.setPalette(colors.bg,dark);else AppTheme.setDark(dark);}
}
function applyTextSize(){
 document.documentElement.style.setProperty('--text-scale',S.textSize/100);
 document.documentElement.dataset.largeText=String(S.textSize>=130);
 $('fontSize').value=S.textSize;$('fontSizeValue').textContent=S.textSize+'%';
 $('fontSmaller').disabled=S.textSize<=90;$('fontLarger').disabled=S.textSize>=160;
 $('fontSize').setAttribute('aria-valuetext',S.textSize+' percent');
}
function textSize(value){S.textSize=Math.round(clamp(value,90,160,100)/10)*10;save();applyTextSize();}
$('paletteOptions').innerHTML=presets.map(p=>`<button data-palette="${p.id}" aria-pressed="false"><span class="palette-sample" style="--sample:${p.color}"><i></i><i></i><i></i></span><strong>${p.name}</strong><span class="palette-selected" aria-hidden="true">✓</span></button>`).join('');
const hf=new Intl.DateTimeFormat('en-u-ca-islamic-civil-nu-latn',{day:'numeric',month:'numeric',year:'numeric'});
function hijri(date){const adjusted=day(date.getFullYear(),date.getMonth(),date.getDate()+S.h),out={};hf.formatToParts(adjusted).forEach(part=>{if(part.type!=='literal'&&part.type!=='era')out[part.type]=parseInt(part.value,10);});return out;}
function hijriLabel(h){return h.day+' '+HM[h.month-1]+' '+h.year+' AH';}
function desi(date){
 const year=date.getFullYear();let index=null;
 for(let i=0;i<12;i++)if(day(year,DM[i][1],DM[i][2]+S.d)<=date)index=i;
 const i=index===null?11:index,start=index===null?day(year-1,11,DM[11][2]+S.d):day(year,DM[i][1],DM[i][2]+S.d);
 return {name:DM[i][0],day:Math.round((date-start)/864e5)+1,year:date>=day(year,2,DM[2][2]+S.d)?year+57:year+56};
}
function eventsOf(h){return EVENTS[h.month+'-'+h.day]||[];}
function evOf(h){return eventsOf(h).map(item=>item.title).join(' · ');}
function eventMarkers(items,inline=false){
 const kinds=[...new Set(items.map(item=>['celebration','remembrance'].includes(item.kind)?item.kind:'observance'))];
 return kinds.length?`<span class="event-dots${inline?' inline':''}" aria-hidden="true">${kinds.map(kind=>`<i class="event-dot ${kind}"></i>`).join('')}</span>`:'';
}
function nextOccasion(date){
 for(let i=1;i<=400;i++){
  const next=day(date.getFullYear(),date.getMonth(),date.getDate()+i),h=hijri(next),items=eventsOf(h);
  if(items.length)return {date:next,h,items,days:i};
 }
 return null;
}
function occasionRow(event){
 return `<button class="occasion" data-date="${iso(event.date)}" data-event="${event.item.id}"><span class="occasion-date"><strong>${event.date.getDate()}</strong><small>${MN[event.date.getMonth()].slice(0,3)}</small></span><span class="occasion-text"><strong>${eventMarkers([event.item],true)}${esc(event.item.title)}</strong><small>${event.h.day} ${esc(HM[event.h.month-1])} · ${weekdays[event.date.getDay()]}</small></span>${icon('right')}</button>`;
}
function nextButton(next){
 if(!next)return '';
 return `<button class="next-occasion" data-goto-date="${iso(next.date)}"><span class="next-label">NEXT AFTER THIS DAY</span><strong>${esc(next.items[0].title)}${next.items.length>1?' + '+(next.items.length-1)+' more':''}</strong><span>${next.days} ${next.days===1?'day':'days'} later · ${gregorian(next.date)} ${icon('right')}</span></button>`;
}
function heroOccasions(h){
 const list=eventsOf(h),next=nextOccasion(selected);
 const label=same(selected,today())?'Today':'Selected day';
 const kind=list.some(e=>e.kind==='remembrance')?'remembrance':list.some(e=>e.kind==='celebration')?'celebration':'';
 $('selectedOccasion').innerHTML=`<button class="hero-event ${kind}" data-show-day><span class="event-label">${label}</span><strong>${eventMarkers(list,true)}${list.length?esc(list.map(e=>e.title).join(' · ')):'No occasion listed for this date'}</strong><span class="event-action">${list.length?'Read about this day':'View date details'} ${icon('arrow')}</span></button>`+nextButton(next);
}
function renderDayDetails(requestedId=''){
 const h=hijri(selected),d=desi(selected),items=eventsOf(h);
 const item=items.find(event=>event.id===requestedId)||(items.length===1?items[0]:null);
 activeDetailId=item?.id||'';
 $('dayDialogLabel').textContent=item?'OCCASION DETAILS':'DAY DETAILS';
 const dateSummary=`<div class="sheet-date-summary"><span>${weekdays[selected.getDay()]} · ${gregorian(selected)}</span><strong>${hijriLabel(h)}</strong><span>${d.day} ${d.name} ${d.year} Bikrami</span></div>`;
 let body='';
 if(item){
  const profile=PROFILES[item.profile];
  body=`<p class="event-kicker ${item.kind}">${eventMarkers([item],true)}${esc(item.title)}</p><h2 id="dayDialogTitle">${esc(profile?.name||item.title)}</h2>`;
  if(profile?.subtitle)body+=`<p class="profile-subtitle">${esc(profile.subtitle)}</p>`;
  body+=dateSummary+`<p class="event-summary">${esc(item.summary)}</p>`;
  if(profile?.facts?.length)body+='<dl class="profile-facts">'+profile.facts.map(([label,value])=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')+'</dl>';
  if(profile?.summary)body+=`<p class="profile-summary">${esc(profile.summary)}</p>`;
  if(items.length>1)body+='<h3 class="detail-heading">Also on this date</h3>'+items.filter(other=>other.id!==item.id).map(other=>`<button class="detail-related" data-show-event="${other.id}">${esc(other.title)} ${icon('right')}</button>`).join('');
  body+='<p class="historical-note">Historical accounts and dates can differ. The observed Gregorian date also depends on your local moon sighting and Hijri adjustment.</p>';
  if(profile?.sources?.length)body+='<details class="event-sources"><summary>Sources & further reading</summary>'+profile.sources.map(source=>`<a href="${esc(source.url)}">${esc(source.title)} ${icon('arrow')}</a>`).join('')+'</details>';
 }else{
  body=`<h2 id="dayDialogTitle">${weekdays[selected.getDay()]}, ${selected.getDate()} ${MN[selected.getMonth()]}</h2>`+dateSummary;
  if(items.length){
   body+='<h3 class="detail-heading">Occasions on this date</h3>'+items.map(event=>`<button class="detail-related" data-show-event="${event.id}"><span><strong>${esc(event.title)}</strong><small>Open details</small></span>${icon('right')}</button>`).join('');
  }else body+='<div class="no-occasion"><span>'+icon('calendar')+'</span><h3>No occasion listed</h3><p>This date has no occasion in Calendar’s current collection.</p></div>'+nextButton(nextOccasion(selected));
 }
 $('dayDialogContent').innerHTML=body;
}
function showDayDetails(id=''){
 renderDayDetails(id);
 if(!$('dayDialog').open)$('dayDialog').showModal();
 $('dayDialog').scrollTop=0;
}
function render(){
 const now=today(),year=cur.getFullYear(),month=cur.getMonth(),first=day(year,month,1),last=day(year,month+1,0),selectedH=hijri(selected),selectedD=desi(selected);
 $('selectedLabel').textContent=same(selected,now)?'TODAY':'SELECTED DAY';$('todayButton').hidden=same(selected,now);
 $('selectedNumber').textContent=selected.getDate();$('selectedWeekday').textContent=weekdays[selected.getDay()];$('selectedGregorian').textContent=MN[selected.getMonth()]+' '+selected.getFullYear();
 $('selectedHijri').textContent=hijriLabel(selectedH);$('selectedDesi').textContent=selectedD.day+' '+selectedD.name+' '+selectedD.year+' Bikrami';
 heroOccasions(selectedH);
 const h1=hijri(first),h2=hijri(last),d1=desi(first),d2=desi(last);
 $('monthTitle').textContent=MN[month]+' '+year;
 $('monthSubtitle').textContent=HM[h1.month-1]+(h1.month!==h2.month?' – '+HM[h2.month-1]:'')+' '+h2.year+' AH · '+d1.name+(d1.name!==d2.name?' – '+d2.name:'')+' '+d2.year;
 let html=DOW.map(n=>'<div class="dow" aria-hidden="true">'+n.toUpperCase()+'</div>').join('');
 const offset=(first.getDay()+6)%7;
 events=[];const start=day(year,month,1-offset),cells=Math.max(35,Math.ceil((offset+last.getDate())/7)*7);
 for(let i=0;i<cells;i++){
  const date=day(start.getFullYear(),start.getMonth(),start.getDate()+i);
  const h=hijri(date),d=desi(date),items=eventsOf(h),inMonth=date.getMonth()===month,isSelected=same(date,selected),isToday=same(date,now);
  const label=weekdays[date.getDay()]+', '+gregorian(date)+'. '+h.day+' '+HM[h.month-1]+'. '+d.day+' '+d.name+(items.length?'. '+evOf(h):'. No listed occasion');
  const hMonth=h.day===1?`<span class="mini-month">${HM[h.month-1].slice(0,3)}</span>`:'';
  const dMonth=d.day===1?`<span class="mini-month">${esc(d.name.slice(0,3))}</span>`:'';
  html+=`<button class="date-cell${inMonth?'':' outside'}${isToday?' is-today':''}${isSelected?' selected':''}${date.getDay()===5?' friday':''}" data-date="${iso(date)}" aria-label="${esc(label)}" aria-pressed="${isSelected}" aria-haspopup="dialog"${isToday?' aria-current="date"':''}><span class="g">${date.getDate()}</span><span class="h"><span>${h.day}</span>${hMonth}</span><span class="d"><span>${d.day}</span>${dMonth}</span>${eventMarkers(items)}</button>`;
  if(inMonth)items.forEach(item=>events.push({date,h,item,name:item.title}));
 }
 $('grid').innerHTML=html;$('grid').setAttribute('aria-label',MN[month]+' '+year+' dates');
 const quiet='<div class="quiet-day">No occasions listed this month. Tap a date to explore its details.</div>';
 $('monthPreview').innerHTML=events.length?events.slice(0,2).map(occasionRow).join(''):quiet;
 $('occasionMonth').textContent=MN[month]+' '+year;$('occasionList').innerHTML=events.length?events.map(occasionRow).join(''):quiet;
 $('hValue').textContent=(S.h>0?'+':'')+S.h;$('dValue').textContent=(S.d>0?'+':'')+S.d;
 document.querySelectorAll('[data-adjust]').forEach(button=>{const [key,delta]=button.dataset.adjust.split(':');button.disabled=Number(delta)<0?S[key]<=-2:S[key]>=2;});
 if($('dayDialog').open)renderDayDetails(activeDetailId);
}
function animate(element,delta=0){if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;element.animate([{opacity:.35,transform:`translateX(${delta*12}px)`},{opacity:1,transform:'none'}],{duration:210,easing:'ease-out'});}
function selectDate(date,focus=false){selected=date;cur=day(date.getFullYear(),date.getMonth(),1);render();animate($('selectedNumber'));if(focus)$('grid').querySelector(`[data-date="${iso(date)}"]`)?.focus({preventScroll:true});}
function moveMonth(delta){const next=day(cur.getFullYear(),cur.getMonth()+delta,1),last=day(next.getFullYear(),next.getMonth()+1,0);selected=day(next.getFullYear(),next.getMonth(),Math.min(selected.getDate(),last.getDate()));cur=next;render();animate($('grid'),delta);}
function setTab(tab){activeTab=tab;['calendar','occasions','settings'].forEach(name=>{$(name+'Pane').hidden=name!==tab;});document.querySelectorAll('[data-tab]').forEach(button=>{if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});animate($(tab+'Pane'));scrollTo({top:0,behavior:'auto'});}
$('prev').onclick=()=>moveMonth(-1);$('next').onclick=()=>moveMonth(1);
$('todayButton').onclick=()=>selectDate(today());
$('chooseDate').onclick=()=>{$('jumpDate').value=iso(selected);$('dateDialog').showModal();};
$('dateForm').onsubmit=event=>{event.preventDefault();const value=$('jumpDate').value;if(!/^\d{4,}-\d{2}-\d{2}$/.test(value))return;const date=fromISO(value);if(Number.isNaN(date.getTime()))return;$('dateDialog').close();selectDate(date);showDayDetails();};
$('allOccasions').onclick=()=>setTab('occasions');
$('infoButton').onclick=$('settingsInfo').onclick=()=>$('infoDialog').showModal();
$('themeButton').onclick=()=>{const dark=S.theme==='dark'||(S.theme==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);S.theme=dark?'light':'dark';applyTheme();save();};
$('fontSize').oninput=event=>textSize(event.target.value);
$('fontSmaller').onclick=()=>textSize(S.textSize-10);$('fontLarger').onclick=()=>textSize(S.textSize+10);$('resetTextSize').onclick=()=>textSize(100);
$('customAccent').oninput=event=>{S.palette='custom';S.accent=event.target.value;save();applyTheme();};
document.addEventListener('click',event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.tab)setTab(button.dataset.tab);
 else if(button.dataset.date){const date=fromISO(button.dataset.date);if(activeTab!=='calendar')setTab('calendar');selectDate(date,true);showDayDetails(button.dataset.event||'');}
 else if(button.hasAttribute('data-show-day'))showDayDetails();
 else if(button.dataset.showEvent)showDayDetails(button.dataset.showEvent);
 else if(button.dataset.gotoDate){if(activeTab!=='calendar')setTab('calendar');selectDate(fromISO(button.dataset.gotoDate));showDayDetails();}
 else if(button.dataset.month)moveMonth(Number(button.dataset.month));
 else if(button.dataset.adjust){const [key,delta]=button.dataset.adjust.split(':');S[key]=Math.max(-2,Math.min(2,S[key]+Number(delta)));save();render();}
 else if(button.dataset.theme){S.theme=button.dataset.theme;save();applyTheme();}
 else if(button.dataset.palette){S.palette=button.dataset.palette;save();applyTheme();}
 else if(button.dataset.close)$(button.dataset.close).close();
});
$('grid').addEventListener('keydown',event=>{const button=event.target.closest('[data-date]');if(!button)return;const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(delta){event.preventDefault();const date=fromISO(button.dataset.date);selectDate(day(date.getFullYear(),date.getMonth(),date.getDate()+delta),true);}});
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
window.AppUi={back(){if($('dayDialog').open){$('dayDialog').close();return true;}if($('dateDialog').open){$('dateDialog').close();return true;}if($('infoDialog').open){$('infoDialog').close();return true;}if(activeTab!=='calendar'){setTab('calendar');return true;}return false;}};
const themeMedia=matchMedia('(prefers-color-scheme:dark)');if(themeMedia.addEventListener)themeMedia.addEventListener('change',applyTheme);
applyTextSize();applyTheme();render();
