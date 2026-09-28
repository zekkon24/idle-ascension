/* Idle Ascension · ENVÍO A LA BASE DE DATOS
   Cuando pasa algo importante (subir de nivel, comprar, depositar, retirar, ver un anuncio…) lo apunta y, como mucho
   cada 'every' segundos, lo envía al servidor junto con una foto del jugador. El servidor comprueba la cuenta de Telegram.
   Solo funciona dentro de Telegram y si CFG.server.url tiene la dirección de la función "track". */
(function(root){
'use strict';
const myId=()=>{ const tg=root.Telegram&&root.Telegram.WebApp, u=tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user; return u&&u.id||null };
const api={refs:null, onReward:null, onConflict:null, attach, inviteLink, canSync, loadRemote, startSync, myId, drain:null, handle:null, requeue:null};
/* ---------- partida en el servidor ----------
   Al entrar se descarga la partida (y se comprueba la cuenta de Telegram). Mientras juegas se sube cada 'saveEvery' s y al
   salir de la app. Cada partida tiene una versión (rev): solo se acepta guardar si partes de la última; si otro dispositivo la
   cambió, hay conflicto y el juego recarga la más reciente. */
const tgData=()=>{ const tg=root.Telegram&&root.Telegram.WebApp; return tg&&tg.initData||'' };
function canSync(CFG){ return !!(CFG.server&&CFG.server.url&&tgData()) }
function loadRemote(CFG){
  return fetch(CFG.server.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:tgData(),action:'load'})})
    .then(r=>r.status===401?{error:'auth'}:r.ok?r.json():{error:'net'}).catch(()=>({error:'net'})) }
function startSync(G,me){
  const CFG=G.CFG, url=CFG.server.url, every=((CFG.server||{}).saveEvery||60)*1000; let busy=false, dead=false, last='', again=false;
  // La subida de la partida lleva también los eventos pendientes (una petición en vez de dos)
  function push(keep){ const S=G.S; if(!S||dead) return; if(busy){ again=again||keep||true; return }
    S.tgId=me; const save=JSON.stringify(S), ev=api.drain?api.drain():null; if(save===last&&!keep&&!ev) return;
    const body=JSON.stringify({initData:tgData(),save:S,baseRev:S.srvRev||0,...(ev||{})}); busy=true;
    const done=()=>{ busy=false; if(again){ again=false; push(true) } };   // si al salir había una subida en curso, se repite
    fetch(url,{method:'POST',headers:{'content-type':'application/json'},body,keepalive:!!keep&&body.length<60000})
      .then(r=>r.json().then(j=>({st:r.status,j}))).then(({st,j})=>{
        if(j&&j.now&&root.setServerTime) root.setServerTime(j.now);
        if(j&&j.ok&&j.rev){ G.S.srvRev=j.rev; last=save; G.save(); if(api.handle&&api.handle(j)) { busy=false; return push(false) } } // premios recibidos: se suben ya
        else if(st===409){ dead=true; if(api.onConflict) api.onConflict(); }
        else if(ev&&api.requeue) api.requeue(ev.events);
        done(); })
      .catch(()=>{ if(ev&&api.requeue) api.requeue(ev.events); done() }) }
  setInterval(()=>push(false),every);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) push(true) });
  setTimeout(()=>push(false),2000);                           // primera subida al poco de entrar (con el evento 'open')
  api.push=push;
}
// Enlace de invitación del jugador: t.me/<bot>/<app>?startapp=ref_<id de Telegram> (null fuera de Telegram)
function inviteLink(CFG){ const tg=root.Telegram&&root.Telegram.WebApp, u=tg&&tg.initDataUnsafe&&tg.initDataUnsafe.user, base=(CFG.referral||{}).link;
  return u&&u.id&&base?base+'?startapp=ref_'+u.id:null }
function attach(G){
  const CFG=G.CFG, SV=CFG.server||{};
  const tg=root.Telegram&&root.Telegram.WebApp, initData=tg&&tg.initData;
  if(!SV.url||!initData) return;                              // fuera de Telegram o sin servidor: no se envía nada
  const every=(SV.every||10)*1000;
  let queue=[], timer=null;
  // mejoras y niveles se juntan en un solo evento para no enviar cientos de filas
  function add(type,data){ const t=Date.now(), S=G.S; if(!S&&type!=='open') return;
    if(type==='upgrade'){ const u=queue.find(e=>e.type==='upgrade'&&e.k===data.k); if(u){ u.n+=data.n; u.gold+=data.gold; u.to=S.up[data.k]; return schedule(); } data={...data,to:S.up[data.k]}; }
    if(type==='level'){ const l=queue.find(e=>e.type==='level'); if(l){ l.to=data.to; return schedule(); } }
    queue.push({type,t,...data}); schedule(); }
  function schedule(){ if(!timer) timer=setTimeout(flush,every) }
  function snap(){ const S=G.S; if(!S) return null; const w=G.equipped(), st=S.stats||{}, d=G.dayKey();
    return {name:S.name,cls:S.cls,evo:S.evo,lvl:S.lvl,mode:S.mode,best:S.best,fase:S.fase,gold:S.gold,tokens:S.tokens,won:S.won,scrap:S.scrap,
      emblems:S.evm,up_atk:S.up.atk,up_hp:S.up.hp,up_df:S.up.df,up_spd:S.up.spd,weapon:w?w.r+w.lvl:null,kills:S.kills,
      deposited_tokens:st.deposited,deposited_usd:(st.deposited||0)/CFG.tokens.perUsd,withdrawn_tokens:S.withdrawn,withdrawn_usd:st.withdrawNet,
      ads:st.ads,ad_gold:st.adGold,offline_gold:st.offGold,card_days:Math.max(0,S.cardUntil-d),vip_days:Math.max(0,S.vipUntil-d)} }
  // la subida de la partida (startSync) se lleva los eventos pendientes y procesa la respuesta
  api.drain=()=>{ if(!queue.length) return null; clearTimeout(timer); timer=null; const events=queue; queue=[]; return {events,snap:snap()} };
  api.requeue=events=>{ queue=events.concat(queue).slice(-200) };
  api.handle=j=>{ if(typeof j.refs==='number') api.refs=j.refs; const got=G.applyRewards(j.rewards); if(got.length&&api.onReward) api.onReward(got); return got.length>0 };
  function flush(keep){ clearTimeout(timer); timer=null; if(!queue.length) return; const events=queue; queue=[];
    const body=JSON.stringify({initData,snap:snap(),events});
    fetch(SV.url,{method:'POST',headers:{'content-type':'application/json'},body,keepalive:!!keep})
      .then(r=>{ if(!r.ok){ if(r.status>=500) queue=events.concat(queue).slice(-200); return null } return r.json() })   // fallo del servidor: se reintenta con lo siguiente
      .then(j=>{ if(!j) return; if(j.now&&root.setServerTime) root.setServerTime(j.now); if(api.handle(j)&&api.push) api.push(false) })  // premios recibidos: se sube la partida ya
      .catch(()=>{ queue=events.concat(queue).slice(-200) }); }

  G.on('track',e=>{ const {type,...d}=e; add(type,d) });
  G.on('level',l=>add('level',{to:l}));
  G.on('evolve',e=>add('evolve',{evo:e.evo,name:e.name}));
  G.on('boss',b=>add('boss',{f:b.f,mode:b.mode,elite:b.elite,mat:b.mat||0}));
  G.on('mode',m=>add('mode',{mode:m.mode}));
  G.on('eventEnd',r=>add(r.kind==='boss'?'wboss':'lab',r.kind==='boss'?{dmg:r.dmg,week:r.best,pos:r.pos,died:r.died}:{kills:r.kills,day:r.best,pos:r.pos,died:r.died}));
  add('open',{});                                              // abrir la app también se apunta (va en la primera subida de la partida)
  if(!canSync(CFG)) setTimeout(flush,1500);
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) flush(true) });
}
root.Telemetry=api;
})(typeof window!=='undefined'?window:globalThis);
