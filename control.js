/* Idle Ascension · CONTROL (mantenimiento y actualizaciones obligatorias)
   - Mantenimiento: si en Supabase (tabla control) "mantenimiento" = true, el juego se pausa, guarda y muestra un cartel
     que no se puede cerrar. Al quitarlo, se recarga con la última versión.
   - Actualización: si hay una versión publicada más nueva (version.json) o la tuya es más vieja que "version_minima",
     el juego se pausa, guarda y se reinicia solo (todas las actualizaciones son obligatorias).
   - Aviso en directo con Supabase Realtime si CFG.supabase.key tiene la clave pública; si no, comprueba cada 'every' segundos
     (y siempre al volver a la app). Solo funciona en la versión publicada (no en local: versión DEV). */
(function(root){
'use strict';
function attach(G){
  const CFG=G.CFG, C=CFG.control||{}, V=root.APP_VERSION||'DEV', SV=CFG.server||{};
  if(V==='DEV'&&!C.dev) return;
  let blocked=false, inMaint=false, updating=false;
  const $=s=>document.querySelector(s);
  function screen(title,msg,wait){ blocked=true; root.GAME_PAUSED=true; try{ G.save() }catch(e){}
    let el=$('#ctlBox'); if(!el){ el=document.createElement('div'); el.id='ctlBox'; el.className='boot'; el.setAttribute('role','alertdialog'); document.body.appendChild(el); }
    el.innerHTML=`<b>${title}</b><span>${msg}</span>${wait?'<span class="ctlw"></span>':''}` }
  function reload(v){ const u=new URL(location.href); u.searchParams.set('v',v||Date.now()); location.replace(u.toString()) } // conserva los datos de Telegram (#…)
  function update(v){ if(updating||inMaint) return; updating=true; screen('Actualización','Hay una versión nueva. Guardando y reiniciando…',true);
    let n=5; const w=$('#ctlBox .ctlw'); const t=setInterval(()=>{ n--; if(w) w.textContent=n>0?n+' s':''; if(n<=0){ clearInterval(t); reload(v) } },1000); if(w) w.textContent=n+' s' }
  function maint(on,msg){
    if(on){ if(updating) return; inMaint=true; screen('En mantenimiento',String(msg||'Vuelve en unos minutos.').replace(/[<>&]/g,'')); }
    else if(inMaint) reload();                                 // se acabó el mantenimiento: recarga con lo último
  }
  // version_minima: solo reinicia si la versión publicada ya la cumple (si no, se reiniciaría sin parar)
  function apply(c){ if(!c) return; if(c.mantenimiento) return maint(true,c.mensaje); maint(false);
    if(c.version_minima&&V!=='DEV'&&V<c.version_minima)
      fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(j=>{ if(j&&j.v&&j.v>=c.version_minima) update(j.v) }).catch(()=>{}) }
  // Para gastar poco: la versión se mira en GitHub (version.json, gratis) cada 'every' s; el estado de Supabase solo al abrir
  // y al volver a la app (y al instante por Realtime si hay clave pública). Con el juego en mantenimiento, se mira cada 'every' s.
  const checkVersion=()=>fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(j=>{ if(j&&j.v&&V!=='DEV'&&j.v!==V) update(j.v) }).catch(()=>{});
  const checkControl=()=>{ if(SV.url) fetch(SV.url,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(apply).catch(()=>{}) };
  checkVersion(); checkControl();
  setInterval(()=>{ checkVersion(); if(inMaint) checkControl() },(C.every||300)*1000);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ checkVersion(); checkControl() } });
  // Aviso en directo (Supabase Realtime): cambios en la tabla control
  const K=(CFG.supabase||{}).key, U=(CFG.supabase||{}).url;
  if(K&&U){ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
    s.onload=()=>{ try{ const sb=root.supabase.createClient(U,K);
      sb.channel('control').on('postgres_changes',{event:'*',schema:'public',table:'control'},p=>apply(p.new)).subscribe() }catch(e){} };
    document.head.appendChild(s); }
}
root.Control={attach};
})(typeof window!=='undefined'?window:globalThis);
