'use strict';
window.SabCalThemes=(function(){
 const presets=[
  {id:'ocean',name:'Ocean',color:'#2563EB'},
  {id:'jade',name:'Jade',color:'#00875A'},
  {id:'violet',name:'Violet',color:'#7C3AED'},
  {id:'sunset',name:'Sunset',color:'#E85A16'},
  {id:'rose',name:'Rose',color:'#C72564'},
  {id:'amber',name:'Amber',color:'#B56B07'}
 ];
 function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
 function mix(a,b,t){const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');}
 function luminance(hex){return rgb(hex).map(v=>{v/=255;return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
 function readable(color,bg){let out=color;for(let i=0;i<12&&contrast(out,bg)<4.6;i++)out=mix(out,luminance(bg)>.4?'#000000':'#ffffff',.16);return out;}
 function resolve(id,dark,custom){
  const preset=presets.find(p=>p.id===id)||presets[0];
  const base=id==='custom'&&/^#[\da-f]{6}$/i.test(custom)?custom:preset.color;
  const bg=dark?mix(base,'#08121f',.94):mix(base,'#ffffff',.965);
  const accent=dark?mix(base,'#ffffff',.43):base;
  const onAccent=contrast(accent,'#ffffff')>=contrast(accent,'#000000')?'#ffffff':'#000000';
  return {
   bg,card:dark?mix(base,'#14222f',.89):'#ffffff',
   ink:dark?'#f0f5ff':mix(base,'#122638',.86),
   muted:dark?'#afc1ce':'#526879',line:dark?mix(base,'#334656',.78):mix(base,'#e6edf4',.86),
   accent,'accent-text':readable(accent,bg),'on-accent':onAccent,
   soft:dark?mix(base,'#1e3244',.83):mix(base,'#ffffff',.89),
   hijri:dark?'#72e8b4':'#05794e',desi:dark?'#ffd08c':'#9b4b0b',event:dark?'#ffd08c':'#9b4b0b',
   wiladat:dark?'#4ade80':'#087f42',shahadat:dark?'#ff6978':'#c42335',
   nav:dark?mix(base,'#14222f',.89):'#ffffff',
   'hero-start':dark?mix(base,'#14222f',.89):'#ffffff',
   'hero-end':dark?mix(base,'#14222f',.68):mix(base,'#ffffff',.87)
  };
 }
 return {presets,resolve,contrast};
}());
