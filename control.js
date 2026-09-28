/* Idle Ascension · CONTROL (mantenimiento y actualizaciones obligatorias)
   - Mantenimiento: si en Supabase (tabla control) "mantenimiento" = true, el juego se pausa, guarda y muestra un cartel
     que no se puede cerrar. Al quitarlo, se recarga con la última versión.
   - Actualización: si hay una versión publicada más nueva (version.json), el juego se pausa, guarda y se reinicia solo
     (todas las actualizaciones son obligatorias).
   - Reinicio para todos: si en la tabla control cambias el número "reiniciar", todos los juegos abiertos se reinician.
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
  function update(v,msg){ if(updating||inMaint) return; updating=true; screen(msg?'Reinicio':'Actualización',(msg||'Hay una versión nueva.')+' Guardando y reiniciando…',true);
    let n=5; const w=$('#ctlBox .ctlw'); const t=setInterval(()=>{ n--; if(w) w.textContent=n>0?n+' s':''; if(n<=0){ clearInterval(t); reload(v) } },1000); if(w) w.textContent=n+' s' }
  function maint(on,msg){
    if(on){ if(updating) return; inMaint=true; screen('En mantenimiento',String(msg||'Vuelve en unos minutos.').replace(/[<>&]/g,'')); }
    else if(inMaint) reload();                                 // se acabó el mantenimiento: recarga con lo último
  }
  // Reinicio para todos: si el número "reiniciar" cambia mientras el juego está abierto, guarda y se reinicia.
  // (El valor que hay al abrir el juego es el de partida: quien entra después no se reinicia.)
  let restartSeen=null;
  function apply(c){ if(!c) return; if(c.mantenimiento) return maint(true,c.mensaje); maint(false);
    const r=+c.reiniciar||0; if(restartSeen===null) restartSeen=r; else if(r!==restartSeen) update(null,'El juego se va a reiniciar.') }
  // Para gastar poco: la versión se mira en GitHub (version.json, gratis) cada 'every' s; el estado de Supabase solo al abrir
  // y al volver a la app (y al instante por Realtime si hay clave pública). Con el juego en mantenimiento, se mira cada 'every' s.
  const checkVersion=()=>fetch('version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).then(j=>{ if(j&&j.v&&V!=='DEV'&&j.v!==V) update(j.v) }).catch(()=>{});
  const checkControl=()=>{ if(SV.url) fetch(SV.url,{cache:'no-store'}).then(r=>r.ok?r.json():null).then(c=>{ if(c&&c.now&&root.setServerTime) root.setServerTime(c.now); apply(c) }).catch(()=>{}) };
  // al abrir: la pantalla de carga ya consultó el mantenimiento (BOOT_CONTROL) y la versión; si no, se consultan ahora
  if(root.BOOT_CONTROL){ const b=root.BOOT_CONTROL; root.BOOT_CONTROL=null; if(b.now&&root.setServerTime) root.setServerTime(b.now); apply(b) }
  else { checkVersion(); checkControl(); }
  setInterval(checkVersion,(C.every||300)*1000);
  setInterval(()=>{ if(inMaint) checkControl() },(C.maintEvery||15)*1000);   // en mantenimiento: mira cada 15 s si ya se puede volver
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ checkVersion(); checkControl() } });
  // Aviso en directo (Supabase Realtime): cambios en la tabla control
  const K=(CFG.supabase||{}).key, U=(CFG.supabase||{}).url;
  if(K&&U){ const s=document.createElement('script'); s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';
    s.onload=()=>{ try{ const sb=root.supabase.createClient(U,K);
      sb.channel('control').on('postgres_changes',{event:'*',schema:'public',table:'control'},p=>apply(p.new)).subscribe() }catch(e){} };
    document.head.appendChild(s); }
}
root.Control={attach};
})(typeof window!=='undefined'?window:globalThis);
