/* Idle Ascension · ENVÍO A LA BASE DE DATOS
   Cuando pasa algo importante (subir de nivel, comprar, depositar, retirar, ver un anuncio…) lo apunta y, como mucho
   cada 'every' segundos, lo envía al servidor junto con una foto del jugador. El servidor comprueba la cuenta de Telegram.
   Solo funciona dentro de Telegram y si CFG.server.url tiene la dirección de la función "track". */
(function(root){
'use strict';
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
  function flush(keep){ clearTimeout(timer); timer=null; if(!queue.length) return; const events=queue; queue=[];
    const body=JSON.stringify({initData,snap:snap(),events});
    fetch(SV.url,{method:'POST',headers:{'content-type':'application/json'},body,keepalive:!!keep})
      .then(r=>{ if(!r.ok&&r.status>=500) queue=events.concat(queue).slice(-200) })   // fallo del servidor: se reintenta con lo siguiente
      .catch(()=>{ queue=events.concat(queue).slice(-200) }); }

  G.on('track',e=>{ const {type,...d}=e; add(type,d) });
  G.on('level',l=>add('level',{to:l}));
  G.on('evolve',e=>add('evolve',{evo:e.evo,name:e.name}));
  G.on('boss',b=>add('boss',{f:b.f,mode:b.mode,elite:b.elite,mat:b.mat||0}));
  G.on('mode',m=>add('mode',{mode:m.mode}));
  G.on('eventEnd',r=>add(r.kind==='boss'?'wboss':'lab',r.kind==='boss'?{dmg:r.dmg,week:r.best,pos:r.pos,died:r.died}:{kills:r.kills,day:r.best,pos:r.pos,died:r.died}));
  add('open',{});                                              // abrir la app también se apunta
  document.addEventListener('visibilitychange',()=>{ if(document.hidden) flush(true) });
}
root.Telemetry={attach};
})(typeof window!=='undefined'?window:globalThis);
