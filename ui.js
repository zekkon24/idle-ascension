/* Idle Ascension · INTERFAZ
   Dibuja la pantalla y traduce toques en acciones del motor (engine.js).
   No contiene reglas del juego: todo número o regla sale de G (el motor) o de CFG. */
(function(){
'use strict';

/* ---------- motor ---------- */
const storage={
  get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},
  set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},
  del:k=>{try{localStorage.removeItem(k)}catch(e){}},
};
const G=createGame({cfg:window.CFG,storage});
window.G=G; // útil para depurar desde la consola
if(window.Telemetry) Telemetry.attach(G); // envío a la base de datos (solo dentro de Telegram y con servidor)
const CFG=G.CFG, R=G.R, CLASSES=G.CLASSES;
let S=null; // alias de G.S (se actualiza al cargar, crear o borrar partida)
const syncS=()=>{S=G.S};

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
function fmt(n){ if(n===undefined||n===null||isNaN(n))return '0'; const a=Math.abs(n);
  if(a<10) return (Math.round(n*10)/10).toLocaleString('es-ES');
  if(a<100000) return Math.round(n).toLocaleString('es-ES');
  const u=[['K',1e3],['M',1e6],['B',1e9]]; let s='';
  for(const [k,v] of u) if(a>=v) s=(n/v).toFixed(n/v<10?2:n/v<100?1:0)+k; return s; }
const pct=v=>(Math.round(v*1000)/10).toLocaleString('es-ES')+' %';
const clsLabel=c=>CFG.classes[c].label||c;
const wName=it=>CFG.names[it.cls][R.indexOf(it.r)];
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const battery=()=>!!(S&&S.opt&&S.opt.battery); // Modo batería: sin barras, números, proyectiles ni parpadeo
const CHEST_TYPES=['wood','silver','mode'];
const chestTotal=()=>CHEST_TYPES.reduce((a,k)=>a+G.chestCount(k),0);

/* ---------- estado de la interfaz ---------- */
let tab='up', upOpen=false, invView='armas', shopView='cofres', evView=null;
let expandedId=null, filtersOpen=false, forgeId=null, reforgeId=null, lockSel=[];
let pendingName='', pendingReforge=null, pendingDis=null, pendingSpin=null, buyCtx=null, modeReady=null;
const reduceMotion=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
// escribe HTML solo si cambia (evita rehacer botones mientras se tocan)
const setHTML=(el,h)=>{ if(el&&el.__h!==h){ el.__h=h; el.innerHTML=h; } };
const F={rar:'all',cls:'all',stat:'any',min:'',max:''};
const fx={shots:[],floats:[],flash:0};

/* ---------- eventos del motor -> pantalla ---------- */
G.on('hit',({e,d,crit,ranged})=>{ if(battery()||tab!=='up') return; fx.shots.push({e,t:0,ranged}); fx.floats.push({e,txt:fmt(d),crit,life:0.9}) });
G.on('heroHit',({d})=>{ if(battery()||tab!=='up') return; fx.flash=0.15; fx.floats.push({hero:true,txt:'-'+fmt(d),life:0.8}) });
G.on('dodge',()=>{ if(!battery()&&tab==='up') fx.floats.push({hero:true,txt:'esquiva',life:0.8}) });
G.on('level',l=>toast('¡Nivel '+l+'!'));
// Jefes: sin ventana; el botín va a la bolsa (icono de cofre) y el icono da un pequeño salto
G.on('boss',()=>{ const b=$('#lootBtn'); if(b){ updateHUD(); if(!reduceMotion()) b.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:450}); } });
G.on('bossFarm',({mat})=>{ if(mat){ const b=$('#lootBtn'); updateHUD(); if(b&&!reduceMotion()) b.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:450}); } });
G.on('mode',({name})=>{ upOpen=false; showModal(`<h3>Modo ${name}</h3><p class="hint">Vuelves a la fase 1. Los enemigos son mucho más fuertes, dan más oro y los jefes sueltan ${G.modeCfg().mat}.</p><button class="btn gold" data-act="close">Continuar</button>`) });
G.on('defeat',({fase,kind})=>toast(kind==='farm'?'Derrota: farmeando la fase '+fase:'Retrocedes a la fase '+fase));
G.on('fase',()=>refreshTabIfStatic());
G.on('wave',()=>{fx.shots.length=0});
G.on('eventStart',()=>{fx.shots.length=0; fx.floats.length=0});
G.on('eventEnd',r=>{ later(()=>evEndModal(r)); renderTab(); });
function evEndModal(r){ const boss=r.kind==='boss', rw=r.best>0?(boss?G.wbReward(r.pos):G.evReward(r.pos)):null; if(!r.best) r={...r,pos:'–'};
  showModal(`<h3>${boss?'Jefe semanal':'Laberinto'}</h3>
    <div class="evhead"><div><span class="s">${boss?'Daño':'Muertes'}</span><b>${boss?fmt(r.dmg):r.kills}</b></div><div><span class="s">Puesto</span><b>${r.pos}</b></div><div><span class="s">${boss?'Total semana':'Total hoy'}</span><b>${boss?fmt(r.best):r.best}</b></div></div>
    ${r.died?'<p class="hint">Te han derrotado.</p>':''}${rw?`<p class="hint">Premio ${boss?'(se reparte el lunes a las 01:00 UTC)':'(se recoge mañana)'}: ${evRewText(rw)}.</p>`:''}
    <button class="btn gold" data-act="close">Continuar</button>`); }

/* ---------- textos ---------- */
// r (rareza): muestra también el máximo posible de cada stat para saber si aún se puede mejorar
function chips(list,lockable,r){
  return list.map((s,i)=>{ const mx=r?CFG.sec[s.k][r][1]:null, top=mx!=null&&s.v>=mx;
    return `<span class="chip${lockable&&lockSel.includes(i)?' lock':''}${top?' top':''}" ${lockable?`data-act="lock" data-i="${i}" role="button" tabindex="0"`:''}>${CFG.sec[s.k].n} +${s.v.toLocaleString('es-ES')} %${mx!=null?` <small>/ ${mx.toLocaleString('es-ES')}</small>`:''}</span>` }).join('');
}
function lootHTML(list){
  const sorted=[...list].sort((a,b)=>R.indexOf(b.r)-R.indexOf(a.r)||(a.cls===S.cls?-1:1));
  return `<div class="loot">${sorted.map(x=>`<div><span style="color:var(--r${x.r})">${wName(x)}</span><span class="s">${clsLabel(x.cls)}${x.cls===S.cls?' · <b style="color:var(--gold)">tu clase</b>':''}${x.autoEq?' · equipada':''}${x.auto?' · desmontada (+'+x.auto+')':''}</span></div>`).join('')}</div>`;
}

/* ---------- estructura ---------- */
function renderShell(){
  $('#app').innerHTML=`
  <div class="top"><div class="uname" id="uName"></div>
    <div class="res"><span title="Oro"><i class="dot" style="background:var(--gold)"></i><b id="rGold"></b></span>
    <span title="Tokens (comprados + ganados)"><i class="dot" style="background:var(--tok)"></i><b id="rTok"></b></span>
    <span title="Chatarra"><i class="dot" style="background:var(--scrap)"></i><b id="rScrap"></b></span></div></div>
  <div id="battle" class="battle"><div class="stage"><canvas id="cv" width="600" height="220"></canvas><div class="tag" id="tag"></div><div class="modes"><div class="micons" id="modeIcons" role="group" aria-label="Modos"></div></div><span class="fasetxt" id="faseTxt"></span><button class="calbtn boostbtn" id="boostBtn" data-act="boostOpen" aria-label="Potenciadores" title="Potenciadores"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg></button><span class="boosttime" id="boostTime" hidden></span><button class="calbtn lootbtn" id="lootBtn" data-act="lootOpen" aria-label="Botín de jefes" title="Botín de jefes" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9H3z"/><path d="M3 12h18M11 12v3h2v-3"/></svg><i class="lootn" id="lootN"></i></button></div>
  <div class="hero"><div class="name" id="hName"></div><div id="evoSlot"></div>
    <div class="bar"><i id="hpBar"></i></div><div class="bar xp"><i id="xpBar"></i></div>
    </div>
  </div>
  <div id="tab"></div>`;
  $('#nav').hidden=false; renderTab();
}
function updateHUD(){
  if(!S||!$('#rGold')) return;
  const h=G.heroStats(), B=G.B;
  const ev=G.inEvent();
  // a la derecha de las calaveras: la fase (o, en un evento, el tiempo y la puntuación)
  setHTML($('#faseTxt'),ev&&B.kind==='boss'?`${mmss(Math.max(0,CFG.wboss.dur-B.t)*1000)} · ${fmt(B.dmg)}`
    :ev?`${mmss(Math.max(0,CFG.event.dur-B.t)*1000)} · ${B.kills}`:`Fase ${S.fase}`);
  setHTML($('#uName'),esc(S.name||''));
  $('#rGold').textContent=fmt(S.gold); $('#rTok').textContent=fmt(G.tokens()); $('#rScrap').textContent=fmt(S.scrap);
  const tag=$('#tag'); tag.textContent=ev?(B.kind==='boss'?'JEFE SEMANAL':'LABERINTO'):B&&B.boss?(B.elite?'JEFE DE ÉLITE':'JEFE'):(S.fase===S.best+1?'Avanzando':'Farmeando'); tag.className='tag'+(ev?' ev':B&&B.boss?' boss':'');
  const fab=$('#upFab'); if(fab) fab.hidden=tab!=='up'||ev;
  $('#hName').innerHTML=`${heroName()} <em>Nv ${S.lvl}${S.lvl>=G.lvlCap()?' · máx.':''}</em>`;
  const es=$('#evoSlot'); if(es){ const can=!ev&&G.evoLvlOk(), key=can+'|'+S.mode+'|'+(S.lvl>=G.lvlCap())+'|'+ev;
    if(es.dataset.k!==key){ es.dataset.k=key; es.innerHTML=can?'<button class="btn sm gold" data-act="evoOpen">Evolucionar</button>'
      :(G.nextEvo()&&G.nextEvo().pending&&S.lvl>=G.lvlCap()?'<span class="pill">Evolución: próximamente</span>':''); } }
  $('#hpBar').style.width=(B?Math.max(0,B.hp/h.hp*100):100)+'%';
  $('#xpBar').style.width=Math.min(100,S.xp/G.xpReq(S.lvl)*100)+'%';
  const hs=$('#hStats'); if(hs) hs.innerHTML=`<div class="sl">
      <span>Vida <b>${fmt(h.hp)}</b></span><span>Def <b>${fmt(h.df)}</b></span>${h.ls?`<span>Robo <b>${pct(h.ls)}</b></span>`:''}${h.ev?`<span>Evasión <b>${pct(h.ev)}</b></span>`:''}</div>
    <div class="sl"><span>Daño <b>${fmt(h.atk)}</b></span><span>Vel <b>${h.spd.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})}/s</b></span><span>Crít <b>${pct(h.cr)}</b></span><span>D. crít <b>+${Math.round(h.cd*100)} %</b></span>${h.bd?`<span>Jefes <b>+${pct(h.bd)}</b></span>`:''}</div>`;
  const lb=$('#lootBtn'); if(lb){ lb.hidden=!S.loot; const n=S.loot?S.loot.n:0, ln=$('#lootN'); ln.hidden=!n; ln.textContent=n; }
  const ep=$('#evPause'); if(ep){ const l=G.evPauseLeft(); if(l>0) ep.textContent=mmss(l); else if(tab==='ev') renderTab(); }
  const bl=G.boostLeft(), bt=$('#boostTime'), bb=$('#boostBtn');
  if(bt){ bt.hidden=!bl; if(bl) bt.textContent='×'+CFG.boosts.speed.mult+' '+mmss(bl); } if(bb) bb.classList.toggle('on',bl>0);
  if(boostModalOpen) updateBoostModal();
  const mi=$('#modeIcons'); if(mi){ const on=!ev&&G.canAdvanceMode();
    setHTML(mi,CFG.modes.slice(0,3).map((M,m)=>{ const st=m===S.mode?'cur':m<S.mode?'done':M.locked?'lock soon':(m===S.mode+1&&on)?'ready':'lock';
      const lab=`${M.name}: ${st==='cur'?'modo actual':st==='done'?'completado':st==='ready'?'desbloqueado, toca para entrar':M.locked?'próximamente':'bloqueado'}`;
      return `<button class="mskull m${m} ${st}" data-act="modeIcon" data-k="${m}" aria-label="${lab}" title="${lab}">${skullSVG(m)}</button>` }).join(''));
    if(on&&modeReady===false){ toast(`¡${CFG.modes[S.mode+1].name} desbloqueado!`); const b=mi.querySelector('.ready'); if(b&&!reduceMotion()) b.animate([{transform:'scale(1)'},{transform:'scale(1.3)'},{transform:'scale(1)'}],{duration:500,iterations:3}); }
    modeReady=on; }
  const ab=$('#autoBtn'); if(ab){ab.setAttribute('aria-label',S.autoPush?'Avance automático activado':'Avance automático desactivado');ab.classList.toggle('off',!S.autoPush);ab.setAttribute('aria-pressed',S.autoPush)}
  document.querySelectorAll('[data-need]').forEach(b=>{const [k,v]=b.dataset.need.split(':');b.disabled=(S[k]<+v)});
  const nc=chestTotal();
  setHTML(document.querySelector('[data-tab="ev"]'),(n=>n?`Evento<sup class="nb">${n}</sup>`:'Evento')(S.tickets+S.bossTickets+G.evFreeLeft()+G.wbFreeLeft()+(G.evPending()?1:0)+(G.wbPending()?1:0)));
  setHTML(document.querySelector('[data-tab="inv"]'),nc?`Inventario<sup class="nb">${nc>99?'99+':nc}</sup>`:'Inventario');
}
function renderTab(){
  if(!S) return;
  document.querySelectorAll('.nav button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
  const el=$('#tab'); if(!el) return;
  const bt=$('#battle'); if(bt) bt.hidden=tab!=='up'; $('#app').classList.toggle('home',tab==='up'); // el combate sigue funcionando por detrás
  if(tab==='up') el.innerHTML='';
  const fab=$('#upFab'); if(fab) fab.hidden=tab!=='up'||G.inEvent();
  if(upOpen) showUpgrades();
  if(tab==='inv'){ el.innerHTML=(invView==='forja'?`<button class="banner" data-act="invview" data-v="armas"><span>← Volver al inventario</span></button>`:`<button class="banner" data-act="invview" data-v="forja"><span>Ir a la Forja</span><span aria-hidden="true">→</span></button>`)+tabInv(); if(invView==='armas') renderList(); }
  if(tab==='shop') el.innerHTML=tabShop();
  if(tab==='ev') el.innerHTML=tabEv();
  if(tab==='dev') el.innerHTML=tabDev();
  updateHUD();
}
function refreshTabIfStatic(){ if(tab==='shop'||tab==='ev'||(tab==='inv'&&invView==='cofres')) renderTab(); else updateHUD(); }

/* ---------- Inicio: mejoras y niveles ---------- */
function showUpgrades(){upOpen=true;showModal(tabUp()+'<button class="btn gold" data-act="upClose">Cerrar</button>');updateHUD()}
function tabUp(){
  const rows=Object.entries(CFG.upgrades).map(([k,u])=>{
    const c=G.upCost(k), dv=G.upgradeGain(k);
    const eff=k==='spd'?'+'+pct(dv/G.heroStats().spd):'+'+fmt(dv);
    return `<div class="row"><div><div class="t">${u.name} <span class="s">nv ${S.up[k]}</span></div><div class="s">${eff}</div></div>
      <div class="acts"><button class="btn sm gold" data-act="buy" data-k="${k}" data-need="gold:${c}">${fmt(c)} oro</button><button class="btn sm" data-act="buymax" data-k="${k}">Máx.</button></div></div>`}).join('');
  return `<section class="panel"><h3>Mejoras</h3><div class="statline" id="hStats"></div>${rows}</section>`;
}
// Modos: Normal, Pesadilla, Infierno. Muestra dónde estás, qué da cada uno y qué hace falta para pasar al siguiente.
// Calavera de jefe para cada modo (Normal lisa, Pesadilla con cuernos, Infierno con cuernos grandes)
function skullSVG(m){
  const horns=m===1?'<path d="M6 7.5 3 3.2l4.6 2.4zM18 7.5 21 3.2l-4.6 2.4z"/>':m===2?'<path d="M5.6 8 1.6 1.8l6 3.2zM18.4 8l4-6.2-6 3.2z"/>':'';
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">${horns}<path d="M12 3C7.4 3 4 6.3 4 10.6c0 2.4 1.1 4.2 2.8 5.3V19a1 1 0 0 0 1 1h1.4v-2h1.4v2h2.8v-2h1.4v2h1.4a1 1 0 0 0 1-1v-3.1c1.7-1.1 2.8-2.9 2.8-5.3C20 6.3 16.6 3 12 3z"/><circle cx="8.9" cy="10.8" r="2" fill="#12141c"/><circle cx="15.1" cy="10.8" r="2" fill="#12141c"/><path d="M12 13.4l-1.1 2h2.2z" fill="#12141c"/></svg>`;
}
// Solo para partidas antiguas sin nombre: el nombre se elige una vez y es permanente
function nameModal(){ showModal(`<h3>Tu nombre</h3><input id="nameIn" class="nameinp" maxlength="16" autocomplete="nickname" placeholder="3-16 letras" value="${esc(S.name||'')}">
  <p class="hint">No se podrá cambiar.</p><div class="ctrl"><button class="btn gold" data-act="nameSave">Guardar</button></div>`); const i=$('#nameIn'); if(i) i.focus() }
function modeModal(){
  const CAP=CFG.phaseCap, rows=CFG.modes.map((M,m)=>{
    const cur=m===S.mode, done=m<S.mode, next=m===S.mode+1, tier=CFG.evo.tiers[m-1];
    const need=M.locked?'Próximamente':m?`Vencer la fase ${CAP} de ${CFG.modes[m-1].name} y hacer la evolución ${m}${tier&&tier.pending?' (próximamente)':''}`:'';
    const st=cur?`<span class="pill" style="color:var(--gold)">Actual · fase ${S.best}/${CAP}</span>`:done?'<span class="pill">Completado</span>':`<span class="pill">${M.locked?'Próximamente':next&&G.canAdvanceMode()?'Desbloqueado':'Bloqueado'}</span>`;
    return `<div class="mcard${cur?' cur':''}${!cur&&!done&&!(next&&G.canAdvanceMode())?' lock':''}">
      <div class="ctrl" style="justify-content:space-between"><b>${M.name}</b>${st}</div>
      <span class="s">Oro ×${(M.gold||1).toLocaleString('es-ES')} · ${M.mat}</span>
      ${!cur&&!done?`<span class="s">${need}</span>`:''}
      ${next&&G.canAdvanceMode()?`<button class="btn sm gold" data-act="modeGo">Ir a ${M.name}</button>`:''}</div>`; }).join('');
  showModal(`<h3>Modo</h3><div class="mlist">${rows}</div><p class="hint">Cada modo tiene ${CAP} fases; al pasar al siguiente vuelves a la fase 1 con enemigos mucho más fuertes.</p><button class="btn" data-act="close">${G.canAdvanceMode()?'Seguir farmeando':'Cerrar'}</button>`);
}

/* ---------- Inventario ---------- */
// ¿daño y velocidad base mejores que el arma equipada? (las armas ya no se equipan solas)
function betterThanEquipped(it){ const e=G.equipped(); if(!e) return true; const a=G.weaponMain(it), b=G.weaponMain(e); return a.d+a.s*0.5>b.d+b.s*0.5 }
function itemCard(it){
  const m=G.weaponMain(it), eq=it.id===S.equippedId, own=it.cls===S.cls, open=expandedId===it.id, up=own&&!eq&&betterThanEquipped(it);
  return `<div class="irow${eq?' eq':''}${open?' open':''}">
    <div class="ihd" data-act="expand" data-id="${it.id}" role="button" tabindex="0" aria-expanded="${open}">
      <span class="nm" style="color:var(--r${it.r})">${wName(it)} <span class="s">nv ${it.lvl}</span>${eq?' <span class="pill">Equipada</span>':''}${up?' <span class="better" title="Mejor que tu arma equipada" aria-label="Mejor que tu arma equipada">▲</span>':''}</span>
      <span class="meta"><span class="s">${clsLabel(it.cls)}</span><span class="rar" style="color:var(--r${it.r})">${CFG.rarName[it.r]}</span>
      <button class="star${it.fav?' on':''}" data-act="fav" data-id="${it.id}" aria-label="${it.fav?'Quitar bloqueo':'Bloquear: no se desmonta ni se usa para forjar'}" title="Bloquear: no se desmonta ni se usa para forjar">★</button></span>
    </div>
    ${open?`<div class="idet">
      <div class="s">Daño +${pct(m.d)} · Velocidad +${pct(m.s)} · nivel ${it.lvl}/${CFG.weapon.maxLvl}</div>
      <div class="sec">${chips(it.sec,false,it.r)}</div>
      <div class="ctrl">
        ${eq?'':own?`<button class="btn sm" data-act="equip" data-id="${it.id}">Equipar</button>`:'<span class="s">Otra clase: no se puede equipar</span>'}
        <button class="btn sm gold" data-act="forge" data-id="${it.id}">Forjar</button>
        ${eq||it.fav?'':`<button class="btn sm" data-act="dis1" data-id="${it.id}">Desmontar (+${G.disValue(it)} chatarra)</button>`}
      </div></div>`:''}
  </div>`;
}
function tabForja(){
  const it=G.findItem(forgeId)||G.equipped();
  if(!it) return `<section class="panel"><h3>Forja</h3><p class="hint">Vacío.</p></section>`;
  forgeId=it.id;
  const m=G.weaponMain(it), eq=it.id===S.equippedId, own=it.cls===S.cls, max=it.lvl>=CFG.weapon.maxLvl;
  const n=G.lvlCostItems(it), sc=G.lvlCostScrap(it), have=G.fodderFor(it).length;
  const mn=G.weaponMain({r:it.r,lvl:Math.min(CFG.weapon.maxLvl,it.lvl+1)}), rc=G.reforgeCost(it), rOpen=reforgeId===it.id;
  return `<section class="panel"><h3>Forja</h3>
    <div class="wcard${eq?' eq':''}">
      <div class="hd"><span class="nm" style="color:var(--r${it.r});font-size:16px">${wName(it)}</span><span class="rar" style="color:var(--r${it.r})">${CFG.rarName[it.r]} · nv ${it.lvl}/${CFG.weapon.maxLvl}</span></div>
      <div class="s">${clsLabel(it.cls)}${eq?' · equipada':''}</div>
      <div class="s">Daño +${pct(m.d)}${max?'':` → <b style="color:var(--good)">+${pct(mn.d)}</b>`} · Velocidad +${pct(m.s)}${max?'':` → <b style="color:var(--good)">+${pct(mn.s)}</b>`}</div>
      <div class="sec">${chips(it.sec,rOpen,it.r)}</div>
      <div class="ctrl">
        ${eq?'<span class="pill">Equipada</span>':own?`<button class="btn sm" data-act="equip" data-id="${it.id}">Equipar</button>`:''}
        ${max?'<span class="pill">Nivel máximo</span>':`<button class="btn sm gold" data-act="lvl" data-id="${it.id}" ${have<n||S.scrap<sc?'disabled':''}>Subir a nv ${it.lvl+1}: ${n} arma${n>1?'s':''} igual${n>1?'es':''} (tienes ${have})${sc?' + '+sc+' chat.':''}</button>`}
        <button class="btn sm" data-act="refopen" data-id="${it.id}">${rOpen?'Cerrar reforja':'Reforjar'}</button>
      </div>
      ${rOpen?`<div class="panel" style="padding:10px">
        <div class="hint">Toca un stat para bloquearlo (${lockSel.length}/${G.maxLocks(it)}).</div>
        <div class="ctrl"><button class="btn sm" data-act="ref" data-id="${it.id}" data-pay="scrap">${refLabel(it,'scrap')}</button>
        ${lockSel.length===1?`<button class="btn sm" data-act="ref" data-id="${it.id}" data-pay="token">${refLabel(it,'token')}</button>`:''}
        </div>
        <div class="hint" style="margin-top:6px">Mejora automática: reforja solo el valor de un stat hasta que suba (${G.reforgeCost(it)} chat. por intento).</div>
        <div class="ctrl">${it.sec.map((x,i)=>{ const mx=CFG.sec[x.k][it.r][1]; return x.v>=mx?`<span class="pill">${CFG.sec[x.k].n} al máximo</span>`:`<button class="btn sm" data-act="impAsk" data-id="${it.id}" data-k="${i}">${CFG.sec[x.k].n} ↑</button>` }).join('')}</div>
        <ul class="refhelp">
          <li><b>Reforjar</b>: cambia los stats no bloqueados al azar; luego eliges quedarte el nuevo o el actual.</li>
          <li><b>Bloqueo con chatarra</b>: pagas el doble de chatarra y ese stat se queda igual. Si el arma solo tiene uno, cambia su valor.</li>
          <li><b>Bloqueo con token</b>: pagas 1 token en vez de chatarra extra. Con los dos a la vez bloqueas 2 stats (siempre queda uno que cambia).</li>
        </ul></div>`:''}
    </div>
    ${!eq&&G.equipped()?`<button class="btn sm" data-act="forge" data-id="${S.equippedId}">Volver a mi arma equipada</button>`:''}
    </section>`;
}
function tabInv(){
  if(invView==='forja') return tabForja();
  const nc=chestTotal(), nm=(S.scrap>0?1:0)+(S.tokens>0?1:0)+(S.won>0?1:0)+Object.values(S.mats||{}).filter(n=>n>0).length+(S.evm>0?1:0)+(S.tickets>0?1:0)+(S.bossTickets>0?1:0);
  const head=`<div class="fchips" role="tablist">
    <button data-act="invview" data-v="armas" aria-pressed="${invView==='armas'}">Armas (${S.items.length})</button>
    <button data-act="invview" data-v="cofres" aria-pressed="${invView==='cofres'}">Cofres (${nc})</button>
    <button data-act="invview" data-v="mat" aria-pressed="${invView==='mat'}">Materiales (${nm})</button></div>`;
  if(invView==='cofres'){
    const row=k=>{const n=G.chestCount(k);return `<div class="chest">
      <div><div class="cn">${CFG.chests[k].name}</div><div class="s">${n} ${n===1?'cofre':'cofres'}</div></div>
      <div class="acts"><button class="btn sm" data-act="info" data-k="${k}">Info</button>
        <button class="btn sm gold" data-act="open1" data-k="${k}">Abrir 1</button>
        ${n>1?`<button class="btn sm" data-act="openAll" data-k="${k}">Abrir todos</button>`:''}</div></div>`};
    const owned=CHEST_TYPES.filter(k=>G.chestCount(k)>0);
    return `<section class="panel"><h3>Inventario</h3>${head}${owned.map(row).join('')||'<p class="hint">Vacío.</p>'}</section>`;
  }
  if(invView==='mat'){
    const rows=[];
    if(S.scrap>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--scrap)"></i> Chatarra</span><span class="meta"><b>${fmt(S.scrap)}</b></span></div></div>`);
    if(S.evm>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--rL)"></i> ${CFG.event.mat}s</span><span class="meta"><b>${S.evm}</b></span></div></div>`);
    if(S.tickets>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--rE)"></i> Tickets de Laberinto</span><span class="meta"><b>${S.tickets}</b></span></div></div>`);
    if(S.bossTickets>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--bad)"></i> Tickets Jefe</span><span class="meta"><b>${S.bossTickets}</b></span></div></div>`);
    for(const [m,n] of Object.entries(S.mats||{})) if(n>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--rE)"></i> ${CFG.modes[m].mat}</span><span class="meta"><b>${n}</b></span></div></div>`);
    if(S.tokens>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--tok)"></i> Tokens comprados</span><span class="meta"><b>${fmt(S.tokens)}</b></span></div></div>`);
    if(S.won>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--good)"></i> Tokens ganados (retirables)</span><span class="meta"><b>${fmt(S.won)}</b></span></div></div>`);
    return `<section class="panel"><h3>Inventario</h3>${head}${rows.join('')||'<p class="hint">Vacío.</p>'}</section>`;
  }
  const statOpts=Object.entries(CFG.sec).map(([k,s])=>`<option value="${k}" ${F.stat===k?'selected':''}>${s.n}</option>`).join('');
  return `<section class="panel"><h3>Inventario</h3>${head}
    <div class="ctrl" id="fHead">${fHead()}</div>
    ${filtersOpen?`<div class="filters fpanel">
      <div class="fchips" role="group" aria-label="Rareza">${['all',...R].map(r=>`<button data-f="rar" data-v="${r}" aria-pressed="${F.rar===r}" ${r!=='all'?`style="color:var(--r${r})"`:''}>${r==='all'?'Todas':CFG.rarName[r]}</button>`).join('')}</div>
      <div class="fchips" role="group" aria-label="Clase">${['all','mine',...CLASSES].map(c=>`<button data-f="cls" data-v="${c}" aria-pressed="${F.cls===c}">${c==='all'?'Todas las clases':c==='mine'?'Mi clase':clsLabel(c)}</button>`).join('')}</div>
      <div class="frow"><label for="fStat">Stat</label><select id="fStat"><option value="any">Cualquiera</option>${statOpts}</select>
        <label for="fMin">entre</label><input type="number" id="fMin" inputmode="decimal" placeholder="mín %" value="${esc(F.min)}">
        <label for="fMax">y</label><input type="number" id="fMax" inputmode="decimal" placeholder="máx %" value="${esc(F.max)}"></div>
      <div id="bulk"></div>
    </div>`:''}
    <div id="invList" class="ilist"></div></section>`;
}
function fHead(){ const active=(F.rar!=='all')+(F.cls!=='all')+(F.stat!=='any');
  return `<button class="btn sm${filtersOpen?' on':''}" data-act="ftoggle" aria-expanded="${filtersOpen}">Filtros${active?' ('+active+')':''}</button>${active?'<button class="btn sm" data-act="fclear">Quitar filtros</button>':''}` }
function filtered(){
  const mn=F.min===''?-Infinity:+F.min, mx=F.max===''?Infinity:+F.max;
  return S.items.filter(it=>{
    if(F.rar!=='all'&&it.r!==F.rar) return false;
    if(F.cls==='mine'&&it.cls!==S.cls) return false;
    if(F.cls!=='all'&&F.cls!=='mine'&&it.cls!==F.cls) return false;
    if(F.stat!=='any'){const s=it.sec.find(x=>x.k===F.stat); if(!s||s.v<mn||s.v>mx) return false;}
    return true;
  }).sort((a,b)=>(b.id===S.equippedId)-(a.id===S.equippedId)||(a.cls===S.cls?0:1)-(b.cls===S.cls?0:1)||R.indexOf(b.r)-R.indexOf(a.r)||b.lvl-a.lvl);
}
function renderList(){
  const el=$('#invList'); if(!el) return; setHTML($('#fHead'),fHead());
  const list=filtered(), dis=list.filter(x=>x.id!==S.equippedId&&!x.fav);
  const bulk=$('#bulk'); if(bulk) bulk.innerHTML=`<div class="ctrl"><span class="s">${list.length} de ${S.items.length} armas</span><button class="btn sm" data-act="disAsk" ${dis.length?'':'disabled'}>Desmontar las filtradas (${dis.length})</button></div>`;
  el.innerHTML=`${list.slice(0,80).map(itemCard).join('')||(S.items.length?'<p class="hint">Sin resultados.</p>':'<p class="hint">Vacío.</p>')}
    ${list.length>80?`<p class="hint">+${list.length-80} más</p>`:''}`;
  updateHUD();
}
function oddsModal(type){
  const ch=CFG.chests[type], cur=G.chestProbs(type), rows=[];
  ch.odds.forEach((tr,m)=>tr.forEach(([a,p],i)=>{ const nx=tr[i+1], name=CFG.modes[m].name+(tr.length>1?(nx?` ${a}–${nx[0]-1}`:` ${a}+`):'');
    const here=m===S.mode&&p===cur; rows.push(`<tr class="${here?'here':''}"><td>${name}</td>${p.map(v=>`<td>${v?v.toLocaleString('es-ES'):'—'}</td>`).join('')}</tr>`) }));
  showModal(`<h3>Cofre de ${ch.name.toLowerCase()}</h3>
    <div class="tw"><table class="odds-t"><thead><tr><th>%</th>${R.map(r=>`<th style="color:var(--r${r})" title="${CFG.rarName[r]}">${RAR_S[r]}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
    <p class="hint">${R.map(r=>`<b style="color:var(--r${r})">${RAR_S[r]}</b> ${CFG.rarName[r]}`).join(' · ')}. ${type==='mode'?'El contenido depende del modo en que estés al abrirlo. ':''}Se usa el % de donde estés al abrirlo (resaltado). Clase aleatoria.</p>
    <button class="btn gold" data-act="close">Cerrar</button>`);
}
function impModal(id,i){ const it=G.findItem(id), x=it.sec[i], o=G.improveOdds(id,i);
  // límites de gasto: lo esperado, el triple o toda la chatarra (siempre al menos un intento)
  const lims=[...new Set([o.expSpend,o.expSpend*3,S.scrap].filter(Number.isFinite).map(v=>Math.max(o.cost,Math.min(S.scrap,v))))].sort((a,b)=>a-b);
  showModal(`<h3>Mejorar ${CFG.sec[x.k].n}</h3>
    <div class="loot"><div><span>Ahora</span><b>+${x.v.toLocaleString('es-ES')} %</b></div><div><span>Máximo</span><b>+${o.max.toLocaleString('es-ES')} %</b></div>
    <div><span>Por intento</span><b>${o.cost} chat. · ${pct(o.p)}</b></div><div><span>Intentos esperados</span><b>≈${o.exp}</b></div><div><span>Tienes</span><b>${fmt(S.scrap)} chat.</b></div></div>
    <p class="hint">Reforja solo el valor de este stat hasta que salga más alto. Los demás no cambian. Elige cuánto gastar como mucho:</p>
    <div class="ctrl">${S.scrap<o.cost?'<span class="s">Te falta chatarra.</span>':lims.map(v=>`<button class="btn sm gold" data-act="impGo" data-id="${id}" data-k="${i}" data-v="${v}">Hasta ${fmt(v)}</button>`).join('')}</div>
    <div class="ctrl"><button class="btn" data-act="close">Cancelar</button></div>`) }
function refLabel(it,pay){ const p=G.reforgePrice(it,lockSel.length,pay); return `Reforjar: ${p.scrap} chat.${p.tokens?' + '+p.tokens+' token':''}` }
function doReforge(id,pay){
  const res=G.reforge(id,lockSel,pay);
  if(!res.ok){ if(res.why==='scrap') toast('Te falta chatarra'); else if(res.why==='token') toast('Te falta 1 token'); else if(res.why==='locks') toast('Demasiados bloqueos'); return }
  const it=G.findItem(id); pendingReforge={id,sec:res.sec};
  showModal(`<h3>Resultado de la reforja</h3>
    <div class="s">Actual</div><div class="sec">${chips(it.sec,false,it.r)}</div><div class="s">Nuevo</div><div class="sec">${chips(res.sec,false,it.r)}</div>
    <div class="ctrl"><button class="btn" data-act="close">Mantener actual</button><button class="btn gold" data-act="applyReforge">Quedarme el nuevo</button></div>`);
  renderTab();
}

/* ---------- Tienda ---------- */
// Todo se paga en tokens (100 tokens = 1 $). Los tokens se compran con dinero (simulado hasta que haya pasarela de pago).
const SHOP={
  silver:{name:'Cofre de plata',info:true},
  mode:{name:'Cofre de modo',info:true},
  ticket:{name:'Ticket de Laberinto'},
  bossTicket:{name:'Ticket Jefe'},
};
const usd=t=>(t/CFG.tokens.perUsd).toLocaleString('es-ES',{minimumFractionDigits:t%CFG.tokens.perUsd?2:0,maximumFractionDigits:2})+' $';
const priceTxt=(k,n=1)=>k==='silver'?`${fmt(G.silverPrice()*n)} oro`:`${fmt(G.shopPrice(k)*n)} tokens`;
function shopRow(k){const it=SHOP[k];return `<div class="chest"><div><div class="cn">${it.name}</div>${k==='silver'?`<div class="s">Quedan ${G.silverLeft()} hoy</div>`:''}</div>
  <div class="acts">${it.info?`<button class="btn sm" data-act="info" data-k="${k}">Info</button>`:''}<button class="btn sm gold" data-act="buyAsk" data-k="${k}">${priceTxt(k)}</button></div></div>`}
function tabShop(){
  const today=G.dayKey();
  const head=`<div class="fchips" role="tablist">${[['cofres','Cofres'],['tokens','Tokens'],['subs','Suscripciones']].map(([v,l])=>`<button data-act="shopview" data-v="${v}" aria-pressed="${shopView===v}">${l}</button>`).join('')}</div>`;
  let body='';
  if(shopView==='cofres') body=shopRow('silver')+shopRow('mode')+shopRow('ticket')+shopRow('bossTicket');
  if(shopView==='tokens') body=`<div class="loot"><div><span>Comprados</span><b>${fmt(S.tokens)}</b></div><div><span>Ganados (retirables)</span><b>${fmt(S.won)}</b></div></div>
    ${CFG.tokens.packs.map(n=>`<div class="chest"><div><div class="cn">${fmt(n)} tokens</div></div><div class="acts"><button class="btn sm gold" data-act="tokBuy" data-k="${n}">${usd(n)}</button></div></div>`).join('')}
    <div class="ctrl"><button class="btn sm" data-act="wdAsk" ${S.won>=CFG.tokens.withdraw.min?'':'disabled'}>Retirar ganados</button></div>
    <p class="hint">${CFG.tokens.perUsd} tokens = 1 $. Se gastan primero los comprados. Los ganados en los pools se pueden retirar (mínimo ${fmt(CFG.tokens.withdraw.min)}, comisión ${Math.round(CFG.tokens.withdraw.fee*100)} %). Compras y retiros de prueba.</p>`;
  if(shopView==='subs') body=`
    <div class="row"><div><div class="t">Tarjeta mensual</div><div class="s">+${Math.round(CFG.cardGold*100)} % oro · 30 días${G.hasCard()?' · quedan '+(S.cardUntil-today)+' días':''}</div></div><div class="acts"><button class="btn sm gold" data-act="sub" data-k="card">${fmt(CFG.cardPrice)} tokens</button></div></div>
    <div class="row"><div><div class="t">VIP</div><div class="s">Combate ×${CFG.vipSpeed} · sin conexión hasta ${CFG.offlineVipH} h · 30 días${G.hasVip()?' · quedan '+(S.vipUntil-today)+' días':''}</div></div><div class="acts"><button class="btn sm gold" data-act="sub" data-k="vip">${fmt(CFG.vipPrice)} tokens</button></div></div>`;
  return `<section class="panel"><h3>Tienda</h3>${head}${body}</section>`;
}
function maxBuy(k){ return k==='silver'?Math.min(G.silverLeft(),Math.floor(S.gold/G.silverPrice())):Math.floor(G.tokens()/G.shopPrice(k)) }
function buyModal(){
  const k=buyCtx.k, it=SHOP[k], n=buyCtx.n, mx=maxBuy(k), ok=n>=1&&n<=mx;
  showModal(`<h3>${it.name}</h3>
    <div class="ctrl"><button class="btn" data-act="qty" data-v="-1" aria-label="Uno menos">−</button>
      <input type="number" id="buyQty" aria-label="Cantidad" min="1" max="${mx}" value="${n}" style="width:80px;text-align:center;font-size:16px;padding:8px">
      <button class="btn" data-act="qty" data-v="1" aria-label="Uno más">+</button></div>
    <div class="ctrl">${[1,5,10].map(v=>`<button class="btn sm" data-act="qtyset" data-v="${v}">${v}</button>`).join('')}<button class="btn sm" data-act="qtyset" data-v="${Math.max(1,mx)}">Máx. (${mx})</button></div>
    <div class="loot"><div><span>Total</span><b id="buyTotal">${priceTxt(k,n)}</b></div><div><span>Tienes</span><b>${k==='silver'?fmt(S.gold)+' oro':fmt(G.tokens())+' tokens'}</b></div>${k==='silver'?`<div><span>Quedan hoy</span><b>${G.silverLeft()}</b></div>`:''}</div>
    ${mx<1?`<p class="hint">${k==='silver'&&!G.silverLeft()?'Ya compraste los de hoy.':k==='silver'?'Oro insuficiente.':'Tokens insuficientes.'}</p>`:''}
    <div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="buyConfirm" id="buyOk" ${ok?'':'disabled'}>Comprar</button></div>`);
}
function doBuy(){
  const k=buyCtx.k, n=buyCtx.n; if(n<1||n>maxBuy(k)) return;
  if(!G.buy(k,n)) return;
  closeModal(); toast(`+${n} ${SHOP[k].name.toLowerCase()}${n>1?' (x'+n+')':''} al inventario`); buyCtx=null; renderTab();
}
function wdModal(){ const W=CFG.tokens.withdraw, n=S.won, fee=Math.ceil(n*W.fee);
  showModal(`<h3>Retirar tokens ganados</h3>
    <div class="loot"><div><span>Retiras</span><b>${fmt(n)} tokens</b></div><div><span>Comisión (${Math.round(W.fee*100)} %)</span><b>−${fmt(fee)}</b></div><div><span>Recibes</span><b>${usd(n-fee)}</b></div></div>
    <p class="hint">Prueba: no se mueve dinero real.</p>
    <div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="wdGo">Retirar</button></div>`) }

/* ---------- botín de jefes ---------- */
function lootRows(L){ const r=[]; if(L.scrap) r.push(`<div><span>Chatarra</span><b>+${fmt(L.scrap)}</b></div>`); if(L.wood) r.push(`<div><span>Cofre de madera</span><b>+${L.wood}</b></div>`);
  for(const m in L.mats) if(L.mats[m]) r.push(`<div><span>${CFG.modes[m].mat}</span><b>+${L.mats[m]}</b></div>`); return r.join('') }
function lootModal(){ if(!S.loot) return; const n=S.loot.n; showModal(`<h3>Botín${n?` · ${n} jefe${n>1?'s':''}`:''}</h3><div class="loot">${lootRows(S.loot)}</div>
  <div class="ctrl"><button class="btn" data-act="close">Cerrar</button><button class="btn gold" data-act="lootClaim">Recoger</button></div>`) }

/* ---------- Evento ---------- */
const CH_N={wood:'madera',silver:'plata',mode:'modo'};
const RAR_S={C:'Com',U:'PCom',R:'Rara',E:'Épi',L:'Leg',M:'Mít'}; // abreviaturas para tablas estrechas
function evRewText(r){ return [r.em?`${r.em} ${CFG.event.mat.toLowerCase()}${r.em>1?'s':''}`:'', r.ch?`${r.n||1} cofre${(r.n||1)>1?'s':''} de ${CH_N[r.ch]}`:''].filter(Boolean).join(' + ') }
// Ranking: los 10 primeros y tu puesto con sus vecinos
function rankHTML(riv,mine,pos,show){
  const list=riv.map(x=>({...x})); if(mine) list.splice(pos-1,0,{name:S.name||'Tú',score:mine,me:true});
  const idx=new Set([...Array(10).keys()]); if(mine) for(let i=pos-3;i<=pos+1;i++) if(i>=0&&i<list.length) idx.add(i);
  let rows='', prev=-1; [...idx].sort((a,b)=>a-b).forEach(i=>{ if(i>prev+1) rows+='<div class="gap">···</div>'; const x=list[i];
    rows+=`<div class="${x.me?'me':''}"><span>${i+1}</span><span>${esc(x.name)}</span><b>${show(x.score)}</b></div>`; prev=i; });
  return `<div class="rank">${rows}</div>`;
}
const rewTable=list=>`<div class="rank evrew">${list.map((r,i)=>{ const from=i?list[i-1].to+1:1; return `<div><b>${from===r.to?r.to:from+'–'+r.to}</b><span>${evRewText(r)}</span></div>` }).join('')}</div>`;
const dhm=ms=>{ const m=Math.max(0,Math.floor(ms/60000)), d=Math.floor(m/1440), h=Math.floor(m%1440/60); return d?`${d} d ${h} h`:h?`${h} h ${m%60} min`:`${m%60} min` };
const pauseBox=()=>`<div class="misTop"><b>Pausa · reparto de premios</b><span class="s">Vuelve en <span id="evPause">${mmss(G.evPauseLeft())}</span>. Los intentos empezados antes pueden terminar.</span></div>`;
// Pestaña Evento: paneles (Laberinto, Jefe semanal); al tocar uno se abre
function tabEv(){
  if(evView==='lab') return tabLab();
  if(evView==='boss') return tabBoss();
  const paused=G.evPaused(), lp=G.evPending(), bp=G.wbPending();
  const lb=G.evToday(), lpos=lb?G.evRank(G.evShownDay(),lb):null, bd=G.wbWeekDmg(), bpos=bd?G.wbRank(G.wbShownWeek(),bd):null;
  const card=(k,title,sub,tk,line,pend)=>`<button class="evcard" data-act="evOpen" data-k="${k}"><span class="evt">${title}${pend?' <sup class="nb">!</sup>':''}</span><span class="s">${sub}</span>
    <span class="evl"><span>${tk}</span><span>${line}</span></span></button>`;
  return `<section class="panel"><h3>Eventos</h3>
    ${card('lab','Laberinto','3 min de monstruos sin parar · ranking diario por muertes',`Entradas <b>${G.evFreeLeft()+S.tickets}</b>`,paused?'En pausa':lb?`Hoy ${lb} · puesto ${lpos}`:'Sin intentos hoy',!!lp)}
    ${card('boss','Jefe semanal','1 min contra un jefe inmortal · ranking semanal por daño',`Entradas <b>${G.wbFreeLeft()+S.bossTickets}</b>`,paused?'En pausa':bd?`Semana ${fmt(bd)} · puesto ${bpos}`:`Cierra en ${dhm(G.weekLeft())}`,!!bp)}
  </section>`;
}
function tabLab(){
  const V=CFG.event, paused=G.evPaused(), d=G.evShownDay(), best=G.evToday(), pend=G.evPending(), live=G.inEvent();
  const pos=best?G.evRank(d,best):null;
  return `<button class="banner" data-act="evBack"><span>← Eventos</span></button>
  <section class="panel"><h3>Laberinto</h3>
    ${pend?`<div class="misTop"><div class="ctrl" style="justify-content:space-between"><b>Premio de ayer · puesto ${pend.pos}</b><button class="btn sm gold" data-act="evClaim">Recoger</button></div><span class="s">${pend.rew?evRewText(pend.rew):'Sin premio'}</span></div>`:''}
    ${paused?pauseBox():''}
    <div class="evhead"><div><span class="s">${G.evFreeLeft()?'Gratis + tickets':'Tickets'}</span><b>${G.evFreeLeft()?'1 + ':''}${S.tickets}</b></div><div><span class="s">${paused?'Total de ayer':'Total hoy'}</span><b>${best||'–'}</b></div><div><span class="s">Puesto</span><b>${pos||'–'}</b></div></div>
    <div class="ctrl"><button class="btn gold" style="flex:1" data-act="evGo" ${(S.tickets>0||G.evFreeLeft())&&!live&&!paused?'':'disabled'}>${live?'En curso…':paused?'En pausa':'Entrar'}</button>
    <button class="btn" data-act="buyAsk" data-k="ticket">+1 ticket · ${V.ticketCost} tok</button></div>
    <p class="hint">${V.dur/60} min de monstruos sin parar, cada vez más fuertes. Las muertes de todos tus intentos del día se suman. 1 entrada gratis al día; las demás, con ticket.</p>
    ${rankHTML(G.evRivals(d),best,pos,x=>x)}</section>
  <section class="panel"><h3>Premios del día</h3>${rewTable(V.rewards)}<p class="hint">Se reparten a las 01:00 UTC del día siguiente.</p></section>`;
}
function tabBoss(){
  const W=CFG.wboss, paused=G.evPaused(), w=G.wbShownWeek(), dmg=G.wbWeekDmg(), pend=G.wbPending(), live=G.inEvent();
  const pos=dmg?G.wbRank(w,dmg):null;
  return `<button class="banner" data-act="evBack"><span>← Eventos</span></button>
  <section class="panel"><h3>Jefe semanal</h3>
    ${pend?`<div class="misTop"><div class="ctrl" style="justify-content:space-between"><b>Premio de la semana pasada · puesto ${pend.pos}</b><button class="btn sm gold" data-act="wbClaim">Recoger</button></div><span class="s">${pend.rew?evRewText(pend.rew):'Sin premio'}</span></div>`:''}
    ${paused?pauseBox():''}
    <div class="evhead"><div><span class="s">${G.wbFreeLeft()?'Gratis + tickets':'Tickets Jefe'}</span><b>${G.wbFreeLeft()?'1 + ':''}${S.bossTickets}</b></div><div><span class="s">Daño semana</span><b>${dmg?fmt(dmg):'–'}</b></div><div><span class="s">Puesto</span><b>${pos||'–'}</b></div></div>
    <div class="ctrl"><button class="btn gold" style="flex:1" data-act="wbGo" ${(S.bossTickets>0||G.wbFreeLeft())&&!live&&!paused?'':'disabled'}>${live?'En curso…':paused?'En pausa':'Luchar'}</button>
    <button class="btn" data-act="buyAsk" data-k="bossTicket">+1 ticket · ${W.ticketCost} tok</button></div>
    <p class="hint">${W.dur} s contra un jefe inmortal que pega cada vez más fuerte. Cuenta el daño que le haces; se suma el de todos tus intentos de la semana. Cierra en ${dhm(G.weekLeft())}. 1 entrada gratis por semana; las demás, con Ticket Jefe.</p>
    ${rankHTML(G.wbRivals(w),dmg,pos,x=>fmt(x))}</section>
  <section class="panel"><h3>Premios de la semana</h3>${rewTable(W.rewards)}<p class="hint">Se reparten el lunes a las 01:00 UTC.</p></section>`;
}

/* ---------- potenciadores por anuncios ---------- */
const mmss=ms=>{const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
let boostModalOpen=false, adTimer=null;
const adTimerOn=()=>adTimer!==null;
function boostModal(){
  boostModalOpen=true;
  const B=CFG.boosts, a=G.adsState(), row=(k,t,sub)=>{const left=G.boostUsesLeft(k);
    return `<div class="row"><div><div class="t">${t}</div><div class="s" id="bs_${k}">${sub}</div></div>
      <div class="acts"><button class="btn sm gold" data-act="adWatch" data-k="${k}" ${left>0?'':'disabled'}>Anuncio ${a.p[k]||0}/${B[k].ads}</button></div></div>`};
  showModal(`<h3>Potenciadores</h3>
    ${row('speed',`Velocidad ×${B.speed.mult} · ${B.speed.min} min`,boostSub('speed'))}
    ${row('gold',`Oro · ${G.goldBoostHours()>=1?G.goldBoostHours()+' h':G.goldBoostHours()*60+' min'}`,boostSub('gold'))}
    <button class="btn" data-act="boostClose">Cerrar</button>`);
}
function boostSub(k){
  const left=G.boostUsesLeft(k), bl=G.boostLeft();
  if(k==='speed') return `Quedan ${left} hoy${bl?` · activo ${mmss(bl)}`:''}`;
  return `+${fmt(G.goldBoostValue())} · quedan ${left} hoy`;
}
function updateBoostModal(){ const e=$('#bs_speed'); if(e) e.textContent=boostSub('speed') }
// Anuncio simulado hasta que haya proveedor real de anuncios
function showAd(k){ playAd(()=>{ const r=G.watchAd(k);
  if(r.applied) toast(k==='speed'?`Velocidad ×${CFG.boosts.speed.mult} activada`:`+${fmt(r.gold)} oro`);
  boostModal(); }) }
function playAd(done){
  boostModalOpen=false; let t=3;
  showModal(`<div class="adbox"><span class="demo">Anuncio (demo)</span><b id="adT">${t}</b><div class="bar"><i id="adBar" style="width:0%;background:var(--gold)"></i></div></div>`);
  const t0=performance.now();
  clearInterval(adTimer); adTimer=setInterval(()=>{
    const p=Math.min(1,(performance.now()-t0)/3000), el=$('#adBar'), tt=$('#adT');
    if(!el){clearInterval(adTimer);adTimer=null;return} el.style.width=p*100+'%'; tt.textContent=Math.ceil(3-p*3);
    if(p>=1){ clearInterval(adTimer); adTimer=null; done(); }
  },100);
}

/* ---------- evolución ---------- */
const heroName=()=>S.evo>0?G.evoP().name:clsLabel(S.cls);
// Coste: lo que tienes / lo que pide (en rojo si falta)
function evoCostHtml(){ const c=G.evoCost(); if(!c) return '';
  const row=(n,have,need)=>`<div><span>${n}</span><b style="color:var(--${have>=need?'good':'bad'})">${fmt(Math.floor(have))} / ${fmt(need)}</b></div>`;
  return `<div class="loot">${c.ess?row(CFG.modes[c.essMode].mat,S.mats[c.essMode]||0,c.ess):''}${c.gold?row('Oro',S.gold,c.gold):''}${c.tokens?row('Tokens',G.tokens(),c.tokens):''}${c.ev?row(CFG.event.mat+'s',S.evm||0,c.ev):''}</div>
  ${S.loot?'<p class="hint">Tienes botín de jefes sin recoger.</p>':''}${G.canEvolve()?'':`<p class="hint">Los jefes de ${CFG.modes[c.essMode].name} sueltan esencias (más cuanto más alta la fase). Los ${CFG.event.mat.toLowerCase()}s se ganan en el Evento.</p>`}` }
function evoModal(){
  const E=G.nextEvo().classes[S.cls];
  showModal(`<h3>Evolución</h3>
    <div class="win-card" style="--rc:var(--gold)"><span class="s">${heroName()} →</span><b>${E.name}</b><span class="s">${E.passive}</span></div>
    ${evoCostHtml()}
    <p class="hint">Sigues en nivel ${S.lvl}; ${CFG.evo.tiers[S.evo+1]?'el tope de nivel pasa a '+CFG.evo.tiers[S.evo+1].lvl:'el nivel deja de tener tope'}.</p>
    <div class="ctrl"><button class="btn" data-act="close">Ahora no</button><button class="btn gold" data-act="evoGo" ${G.canEvolve()?'':'disabled'}>Evolucionar</button></div>`);
}

/* ---------- farmeo sin conexión ---------- */
function offlineModal(off){
  const h=Math.floor(off.secs/3600), mi=Math.round((off.secs%3600)/60);
  showModal(`<h3>Mientras no estabas</h3><p class="hint">Fase ${off.fase} · ${h?h+' h ':''}${mi?mi+' min':''}${off.capped?' · máximo':''}</p>
    <div class="loot"><div><span>Oro</span><b>+${fmt(off.gold)}</b></div>${off.lvlTo>off.lvlFrom?`<div><span>Nivel</span><b>${off.lvlFrom} → ${off.lvlTo}</b></div>`:''}</div>
    <div class="ctrl"><button class="btn${off.capped?'':' gold'}" data-act="close">Recoger</button>
    ${off.bonus?`<button class="btn gold" data-act="offAd">×${CFG.offlineAdMult.toLocaleString('es-ES')} con anuncio (+${fmt(off.bonus)})</button>`:''}</div>`);
}

/* ---------- ruleta al abrir cofres ---------- */
function tileHTML(x){return `<div class="tile" style="--rc:var(--r${x.r})"><span class="tr" style="color:var(--r${x.r})">${CFG.rarName[x.r]}</span><span class="tn">${wName(x)}</span><span class="tc">${clsLabel(x.cls)}</span></div>`}
const CHEST_COL={wood:['#8a5a34','#5e3a1f'],silver:['#b9c0cc','#6f7787'],mode:['#c86bff','#6a2aa8']};
// Las casillas de relleno son solo decoración: usan Math.random para no gastar el azar del motor.
function fakePick(probs){const tot=probs.reduce((a,b)=>a+b,0);let x=Math.random()*tot;for(let i=0;i<probs.length;i++){x-=probs[i];if(x<0)return R[i]}return R[0]}
function spin(type,loot,nc=1){
  const best=[...loot].sort((a,b)=>R.indexOf(b.r)-R.indexOf(a.r)||((a.cls===S.cls)?-1:1))[0];
  const probs=G.chestProbs(type), idx=42, tiles=[];
  for(let i=0;i<52;i++) tiles.push(i===idx?best:{r:fakePick(probs),cls:CLASSES[Math.floor(Math.random()*CLASSES.length)]});
  const title=nc===1?`Cofre de ${CFG.chests[type].name.toLowerCase()}`:`${nc} cofres de ${CFG.chests[type].name.toLowerCase()}`;
  const [c1,c2]=CHEST_COL[type];
  showModal(`<h3>${title}</h3>
    <div class="cbox" id="cbox" style="--c1:${c1};--c2:${c2}"><div class="glow" id="cglow"></div><div class="lid" id="clid"></div><div class="base"><i></i></div></div>
    <div class="rl" id="rl" hidden><div class="rl-mark"></div><div class="rl-strip" id="rlStrip">${tiles.map(tileHTML).join('')}</div></div>
    <div id="rlOut"><button class="btn" data-act="rlskip">Saltar</button></div>`);
  pendingSpin={loot,best,raf:null,timers:[]};
  if(reduceMotion()) return spinDone();
  const box=$('#cbox'), lid=$('#clid'), glow=$('#cglow');
  // 1) el cofre tiembla  2) se abre con un destello  3) aparece la ruleta y gira
  box.animate([{transform:'translateX(0) rotate(0)'},{transform:'translateX(-4px) rotate(-3deg)'},{transform:'translateX(4px) rotate(3deg)'},{transform:'translateX(-3px) rotate(-2deg)'},{transform:'translateX(3px) rotate(2deg)'},{transform:'translateX(0) rotate(0)'}],{duration:900,easing:'ease-in-out'});
  pendingSpin.timers.push(setTimeout(()=>{
    lid.animate([{transform:'translateY(0) rotate(0)'},{transform:'translateY(-26px) rotate(-18deg)'}],{duration:380,easing:'cubic-bezier(.2,1.6,.4,1)',fill:'forwards'});
    glow.animate([{opacity:0,transform:'scale(.4)'},{opacity:1,transform:'scale(1.3)'},{opacity:0,transform:'scale(1.8)'}],{duration:700,easing:'ease-out',fill:'forwards'});
  },900));
  pendingSpin.timers.push(setTimeout(()=>{
    if(!pendingSpin) return;
    box.hidden=true; const rl=$('#rl'); rl.hidden=false;
    const strip=$('#rlStrip'), vw=rl.clientWidth, tw=94, center=8+idx*tw+44, jitter=(Math.random()-0.5)*60;
    const target=vw/2-center+jitter, start=vw/2-(8+44), dur=5200, t0=performance.now();
    const ease=t=>1-Math.pow(1-t,4);
    const frame=now=>{
      if(!pendingSpin) return;
      const t=Math.min(1,(now-t0)/dur); strip.style.transform=`translateX(${start+(target-start)*ease(t)}px)`;
      if(t<1) pendingSpin.raf=requestAnimationFrame(frame); else spinDone();
    };
    pendingSpin.raf=requestAnimationFrame(frame);
  },1500));
}
function stopSpin(){ if(pendingSpin){cancelAnimationFrame(pendingSpin.raf);pendingSpin.timers.forEach(clearTimeout)} pendingSpin=null }
function spinDone(){
  if(!pendingSpin) return; const {loot,best}=pendingSpin; stopSpin();
  const out=$('#rlOut'); if(!out) return;
  const rl=$('#rl'), box=$('#cbox'); if(box) box.hidden=true;
  if(rl&&rl.hidden){rl.hidden=false;$('#rlStrip').style.transform=`translateX(${rl.clientWidth/2-(8+42*94+44)}px)`}
  const tile=$('#rlStrip').children[42]; if(tile) tile.classList.add('win');
  out.innerHTML=`<div class="win-card" style="--rc:var(--r${best.r})"><span class="rar" style="color:var(--r${best.r})">${CFG.rarName[best.r]}</span><b>${wName(best)}</b><span class="s">${clsLabel(best.cls)}${best.cls===S.cls?' · tu clase':''}${best.autoEq?' · equipada':''}</span></div>
    ${loot.length>1?lootHTML(loot):''}
    <button class="btn gold" data-act="close">Continuar</button>`;
}

/* ---------- Ajustes ---------- */
function tabDev(){
  const on=battery(), ad=!!(S.opt&&S.opt.autoDis);
  return `<section class="panel"><h3>Ajustes</h3><div class="row"><div><div class="t">Nombre</div><div class="s">${esc(S.name||'—')}</div></div></div><div class="row"><div><div class="t">Modo batería</div><div class="s">Sin barras de vida, números, proyectiles ni parpadeo</div></div><div class="acts"><button class="btn sm${on?' gold':''}" data-act="battery" aria-pressed="${on}">${on?'Activado':'Desactivado'}</button></div></div>
  ${inviteRow()}
  <div class="row"><div><div class="t">Desmontar Comunes de otras clases</div><div class="s">Al abrir cofres, directamente a chatarra</div></div><div class="acts"><button class="btn sm${ad?' gold':''}" data-act="autoDis" aria-pressed="${ad}">${ad?'Activado':'Desactivado'}</button></div></div></section>
  ${CFG.devTools?`<section class="panel"><h3>Ajustes de prueba</h3>
  <div class="ctrl">Velocidad: ${[1,2,5,20].map(v=>`<button class="btn sm ${S.speed===v?'gold':''}" data-act="speed" data-v="${v}">×${v}</button>`).join('')}</div>
  <div class="ctrl"><button class="btn sm" data-act="dev" data-k="gold">+ oro (1 h)</button><button class="btn sm" data-act="dev" data-k="tok">+100 tokens</button><button class="btn sm" data-act="dev" data-k="scrap">+100 chatarra</button><button class="btn sm" data-act="dev" data-k="wood">+10 cofres de madera</button><button class="btn sm" data-act="dev" data-k="day">Avanzar 1 día</button><button class="btn sm" data-act="dev" data-k="ticket">+1 ticket</button></div>
  </section>`:''}
`;
}
// Invitar amigos: solo dentro de Telegram (hace falta el id del jugador y el enlace de la mini app)
function inviteRow(){ const T=window.Telemetry, link=T&&T.inviteLink(CFG), R=CFG.referral; if(!link) return '';
  return `<div class="row"><div><div class="t">Invitar amigos${T.refs!=null?` · ${T.refs}`:''}</div><div class="s">Tu amigo recibe ${R.giftSilver} cofre de plata. Tú, ${R.goalSilver} cofres cuando llegue a la fase ${R.goalFase} y el ${Math.round(R.buyPct*100)} % de sus compras en tokens.</div></div>
    <div class="acts"><button class="btn sm gold" data-act="invShare">Compartir</button><button class="btn sm" data-act="invCopy">Copiar</button></div></div>` }
const REW_T={invitado:'Regalo de bienvenida',amigo_fase50:'Tu amigo llegó a la fase '+CFG.referral.goalFase,amigo_compra:'Tu amigo compró tokens'};
if(window.Telemetry) Telemetry.onReward=list=>later(()=>showModal(`<h3>¡Premio por invitar!</h3><div class="loot">${list.map(r=>`<div><span>${REW_T[r.reason]||'Premio'}</span><b>+${fmt(r.amount)} ${r.kind==='silver'?'cofre'+(r.amount>1?'s':'')+' de plata':'tokens'}</b></div>`).join('')}</div><button class="btn gold" data-act="close">Genial</button>`));
function renderSelect(){
  $('#nav').hidden=true; $('#upFab').hidden=true; upOpen=false;
  $('#app').classList.remove('home');
  $('#app').innerHTML=`<div><div class="hero-title">Idle Ascension</div></div>
  <label class="namebox"><span class="s">Tu nombre</span><input id="pNameIn" maxlength="16" autocomplete="nickname" placeholder="3-16 letras" value="${esc(pendingName)}"></label>
  <p class="hint">Elige tu clase</p>
  <div class="classes">${Object.entries(CFG.classes).map(([k,c])=>`<button class="ccard" data-act="pick" data-c="${k}">
    <span class="pill" style="color:${c.color}">${c.role}</span><span class="cn">${clsLabel(k)}</span>
    <span class="cs">Vida ${c.hp} · Daño ${c.atk} · Def ${c.df}<br>Velocidad ${c.spd.toFixed(2)}/s${c.cr?` · Crít ${Math.round(c.cr*100)} %`:''}</span>
    <span class="cs">${c.passive}</span></button>`).join('')}</div>`;
}

/* ---------- modal y avisos ---------- */
function showModal(html){$('#modal').innerHTML=`<div class="modal"><div class="box" role="dialog" aria-modal="true">${html}</div></div>`; const f=$('#modal .box button.gold')||$('#modal .box button'); if(f&&!reduceMotion()) f.focus({preventScroll:true})}
function closeModal(){$('#modal').innerHTML=''; if(modalQ.length) setTimeout(drainQ,150)}
// Avisos que no deben pisar otra ventana (fin del evento, tiempo sin conexión): esperan su turno
const modalQ=[];
const modalOpen=()=>!!$('#modal').innerHTML;
function later(fn){ if(modalOpen()) modalQ.push(fn); else fn() }
function drainQ(){ if(!modalOpen()&&modalQ.length) modalQ.shift()() }
let toastT=null;
function toast(t){let el=$('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.appendChild(el)}el.textContent=t;clearTimeout(toastT);toastT=setTimeout(()=>el.remove(),1800)}

/* ---------- toques ---------- */
const ACT={
  pick:b=>{ const inp=$('#pNameIn'), n=inp?inp.value:''; if(!G.validName(n)){ toast('Escribe tu nombre (3-16 letras)'); if(inp) inp.focus(); return } G.newGame(b.dataset.c,n);syncS();pendingName='';renderShell();G.save()},
  nameSave:()=>{ const n=($('#nameIn')||{}).value; if(!G.setName(n)) return toast('Escribe tu nombre (3-16 letras)'); closeModal(); toast('Nombre guardado'); updateHUD(); if(tab==='dev') renderTab(); },
  upOpen:()=>showUpgrades(),
  upClose:()=>{upOpen=false;closeModal()},
  autoToggle:()=>{G.setAuto(!S.autoPush);toast(S.autoPush?'Avance automático activado':'Avance automático desactivado: te quedas farmeando');updateHUD()},
  // calaveras de modo: la actual abre la lista; la siguiente, si está desbloqueada, lleva a ese modo
  modeIcon:(b,k)=>{ const m=+k, M=CFG.modes[m];
    if(m===S.mode) return modeModal();
    if(m<S.mode) return toast(`${M.name}: completado`);
    if(G.inEvent()) return toast('Termina el evento primero');
    if(m===S.mode+1&&G.canAdvanceMode()) return ACT.modeGo();
    const prev=CFG.modes[m-1], t=CFG.evo.tiers[m-1];
    if(M.locked) return toast(`${M.name}: próximamente`);
    toast(t&&t.pending&&S.evo>=m-1&&m===S.mode+1?`${M.name}: próximamente`:`${M.name}: vence la fase ${CFG.phaseCap} de ${prev.name} y haz la evolución ${m}`); },
  evoOpen:()=>evoModal(),
  modeGo:()=>{ if(G.inEvent()) return toast('Termina el evento primero'); const nx=CFG.modes[S.mode+1].name;
    showModal(`<h3>¿Ir a ${nx}?</h3><p class="hint">Vuelves a la fase 1 de ${nx}. No se puede volver a ${G.modeCfg().name}.</p><div class="ctrl"><button class="btn" data-act="close">Seguir farmeando</button><button class="btn gold" data-act="modeYes">Ir a ${nx}</button></div>`) },
  modeYes:()=>{ closeModal(); if(G.advanceMode()) updateHUD(); },
  evoGo:()=>{ const r=G.evolve(); if(!r.ok) return; closeModal(); showModal(`<h3>¡Ahora eres ${G.evoP().name}!</h3><p class="hint">${G.evoP().passive}</p><button class="btn gold" data-act="close">Continuar</button>`); updateHUD(); },
  boostOpen:()=>boostModal(),
  boostClose:()=>{boostModalOpen=false;closeModal()},
  adWatch:(b,k)=>showAd(k),
  offAd:()=>playAd(()=>{ const g=G.claimOfflineBonus(); closeModal(); if(g) toast(`+${fmt(g)} oro`); }),
  impAsk:(b,k,id)=>impModal(id,+k),
  impGo:(b,k,id)=>{ const r=G.improveStat(id,+k,+b.dataset.v), n=CFG.sec[r.k]?CFG.sec[r.k].n:'';
    showModal(r.ok?`<h3>¡${n} mejorado!</h3><p class="hint">+${r.old.toLocaleString('es-ES')} % → <b style="color:var(--good)">+${r.v.toLocaleString('es-ES')} %</b> en ${r.tries} intento${r.tries>1?'s':''} · −${fmt(r.spent)} chatarra</p><button class="btn gold" data-act="close">Genial</button>`
      :`<h3>Sin mejora</h3><p class="hint">${r.why==='max'?'Ya está al máximo.':`${r.why==='limit'?'Llegaste al límite de gasto':'Te quedaste sin chatarra'} tras ${r.tries} intento${r.tries===1?'':'s'} (−${fmt(r.spent||0)}). El stat no cambia.`}</p><button class="btn gold" data-act="close">Vale</button>`); renderTab(); },
  lootOpen:()=>lootModal(),
  lootClaim:()=>{ if(G.claimLoot()){ closeModal(); toast('Botín al inventario'); renderTab(); } },
  evGo:()=>{ if(G.startEvent()){ tab='up'; renderTab(); } else if(G.evPaused()) toast('Evento en pausa hasta la 01:00 UTC'); },
  wbGo:()=>{ if(G.wbStart()){ tab='up'; renderTab(); } else if(G.evPaused()) toast('Evento en pausa hasta la 01:00 UTC'); },
  wbClaim:()=>{ const p=G.wbClaim(); if(p){ toast(p.rew?evRewText(p.rew):'Sin premio'); renderTab(); } },
  evOpen:(b,k)=>{ evView=k; renderTab(); window.scrollTo({top:0}); },
  evBack:()=>{ evView=null; renderTab(); },
  evClaim:()=>{ const p=G.claimEvent(); if(p){ toast(p.rew?evRewText(p.rew):'Sin premio'); renderTab(); } },
  close:()=>{stopSpin();boostModalOpen=false;clearInterval(adTimer);adTimer=null;closeModal()},
  buy:(b,k)=>{if(G.buyUpgrade(k))renderTab()},
  buymax:(b,k)=>{const n=G.buyMax(k);toast(n?'+'+n+' niveles':'No tienes oro suficiente');renderTab()},
  equip:(b,k,id)=>{if(G.equip(id))renderTab()},
  fav:(b,k,id)=>{const f=G.toggleFav(id);if(f===null)return;toast(f?'Arma bloqueada: no se desmonta ni se usa para forjar':'Arma desbloqueada');if(tab==='inv'&&invView==='armas')renderList();else renderTab()},
  lvl:(b,k,id)=>{const r=G.levelUp(id),it=G.findItem(id);
    if(r.ok) toast(wName(it)+' sube a nivel '+r.lvl);
    else if(r.why==='items') toast(`Necesitas ${r.need} ${wName(it)} más`);
    else if(r.why==='scrap') toast('Te falta chatarra');
    renderTab()},
  dis1:(b,k,id)=>{ const it=G.findItem(id); if(!it) return; if(R.indexOf(it.r)>=2||it.lvl>1){ pendingDis=[id]; return showModal(`<h3>¿Desmontar ${esc(wName(it))}?</h3><p class="hint">${CFG.rarName[it.r]} nv ${it.lvl} · +${G.disValue(it)} chatarra</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="disYes">Desmontar</button></div>`) } disToast(G.dismantle([id]));renderTab()},
  disAsk:()=>{const ids=filtered().filter(x=>x.id!==S.equippedId&&!x.fav).map(x=>x.id);const v=ids.reduce((s,id)=>s+G.disValue(G.findItem(id)),0);
    pendingDis=ids;showModal(`<h3>¿Desmontar ${ids.length} armas?</h3><p class="hint">+${v} chatarra</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="disYes">Desmontar</button></div>`)},
  disYes:()=>{closeModal();disToast(G.dismantle(pendingDis||[]));pendingDis=null;renderTab()},
  refopen:(b,k,id)=>{reforgeId=reforgeId===id?null:id;lockSel=[];renderTab()},
  forge:(b,k,id)=>{forgeId=id;reforgeId=null;lockSel=[];tab='inv';invView='forja';renderTab();window.scrollTo({top:0})},
  invview:b=>{invView=b.dataset.v;renderTab()},
  expand:(b,k,id)=>{expandedId=expandedId===id?null:id;renderList()},
  ftoggle:()=>{filtersOpen=!filtersOpen;renderTab()},
  fclear:()=>{F.rar='all';F.cls='all';F.stat='any';F.min='';F.max='';renderTab()},
  rlskip:()=>spinDone(),
  shopview:b=>{shopView=b.dataset.v;renderTab()},
  buyAsk:(b,k)=>{buyCtx={k,n:1};buyModal()},
  qty:b=>{buyCtx.n=Math.max(1,Math.min(maxBuy(buyCtx.k),buyCtx.n+(+b.dataset.v)));buyModal()},
  qtyset:b=>{buyCtx.n=Math.max(1,Math.min(maxBuy(buyCtx.k)||1,+b.dataset.v));buyModal()},
  buyConfirm:()=>doBuy(),
  sub:(b,k)=>{ if(!G.buy(k,1)) return toast('Tokens insuficientes'); toast(k==='card'?'Tarjeta mensual activada':'VIP activado'); renderTab() },
  tokBuy:(b,k)=>{ if(G.buyTokens(+k)){ toast(`+${fmt(+k)} tokens (prueba)`); renderTab(); } },
  wdAsk:()=>wdModal(),
  invShare:()=>{ const link=Telemetry.inviteLink(CFG), tg=window.Telegram&&Telegram.WebApp, txt='¡Juega conmigo a Idle Ascension!';
    const url='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(txt);
    if(tg&&tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url,'_blank') },
  invCopy:()=>{ const link=Telemetry.inviteLink(CFG); const ok=()=>toast('Enlace copiado'), no=()=>toast(link);
    try{ navigator.clipboard.writeText(link).then(ok,no) }catch(e){ no() } },
  wdGo:()=>{ const r=G.withdraw(S.won); closeModal(); toast(r.ok?`Retirados ${fmt(r.n)} tokens (prueba)`:'No se puede retirar'); renderTab(); },
  lock:b=>{const i=+b.dataset.i, it=G.findItem(forgeId); if(lockSel.includes(i)) lockSel=lockSel.filter(x=>x!==i); else if(it&&lockSel.length<G.maxLocks(it)) lockSel=[...lockSel,i]; else { toast('Máximo '+(it?G.maxLocks(it):0)+' bloqueo'+(it&&G.maxLocks(it)>1?'s':'')); return } renderTab()},
  ref:(b,k,id)=>doReforge(id,b.dataset.pay),
  applyReforge:()=>{if(pendingReforge)G.applyReforge(pendingReforge.id);pendingReforge=null;closeModal();renderTab()},
  info:(b,k)=>oddsModal(k),
  open1:(b,k)=>openChests(k,false),
  openAll:(b,k)=>openChests(k,true),
  autoDis:()=>{G.setOpt('autoDis',!(S.opt&&S.opt.autoDis));renderTab()},
  battery:()=>{G.setOpt('battery',!battery());if(battery()){fx.floats.length=0;fx.shots.length=0;fx.flash=0}renderTab()},
  speed:b=>{if(CFG.devTools){S.speed=+b.dataset.v;renderTab()}},
  dev:(b,k)=>{G.dev(k);renderTab()},
  reset:()=>{closeModal();G.reset();syncS();tab='up';invView='armas';shopView='cofres';forgeId=null;reforgeId=null;lockSel=[];expandedId=null;filtersOpen=false;F.rar='all';F.cls='all';F.stat='any';F.min='';F.max='';modalQ.length=0;renderSelect()},
};
function disToast(r){ if(r.n) toast(`${r.n} arma${r.n>1?'s':''} desmontada${r.n>1?'s':''}: +${r.v} chatarra`) }
function openChests(k,all){ const n0=G.chestCount(k), l=G.openChests(k,all); if(!l.length) return; renderTab(); spin(k,l,n0-G.chestCount(k)) }

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act],[data-tab],[data-f]'); if(!b) return;
  if(b.dataset.tab){ if(adTimerOn()) return; if(b.dataset.tab==="ev"&&tab==="ev") evView=null; /* tocar Evento estando dentro vuelve a la lista */ upOpen=false;boostModalOpen=false;stopSpin();closeModal();tab=b.dataset.tab;reforgeId=null;lockSel=[];renderTab();return}
  if(b.dataset.f){F[b.dataset.f]=b.dataset.v;document.querySelectorAll(`[data-f="${b.dataset.f}"]`).forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===b.dataset.v));renderList();return}
  const fn=ACT[b.dataset.act]; if(fn) fn(b,b.dataset.k,+b.dataset.id);
});
document.addEventListener('change',e=>{ if(e.target.id==='fStat'){F.stat=e.target.value;renderList()} });
document.addEventListener('input',e=>{
  if(e.target.id==='buyQty'&&buyCtx){const n=Math.floor(+e.target.value||0);buyCtx.n=n;const mx=maxBuy(buyCtx.k);$('#buyTotal').textContent=priceTxt(buyCtx.k,Math.max(0,n));$('#buyOk').disabled=!(n>=1&&n<=mx)}
  if(e.target.id==='fMin'){F.min=e.target.value;renderList()}
  if(e.target.id==='fMax'){F.max=e.target.value;renderList()}
});
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='nameIn'){ ACT.nameSave(); return }
  if(e.key==='Escape'&&modalOpen()&&!pendingSpin&&!adTimerOn()&&!($('#nameIn')&&!S.name)){ ACT.close(); return } if((e.key==='Enter'||e.key===' ')&&e.target.matches('.ihd[data-act],.chip[data-act]')){e.preventDefault();e.target.click()}});
document.addEventListener('visibilitychange',()=>{ if(!S) return;
  if(document.hidden) G.save();
  else { const off=G.applyOffline(); if(off) later(()=>offlineModal(off)); } }); // al volver a la app se cobra el tiempo fuera (el evento en curso lo pausa)
setInterval(()=>{ if(!document.hidden) G.save() },5000); // en segundo plano no se guarda: así no se pierde el tiempo sin conexión

/* ---------- dibujo ---------- */
// tamaño del lienzo: se mide solo cuando cambia (ResizeObserver) y la resolución se limita a 2× (1× en modo batería)
const CV={el:null,ctx:null,w:0,h:0,grd:null,gk:''};
function canvasReady(){
  const cv=$('#cv'); if(!cv) return null;
  if(CV.el!==cv){ CV.el=cv; CV.ctx=cv.getContext('2d'); CV.w=cv.clientWidth; CV.h=cv.clientHeight; CV.gk='';
    if(window.ResizeObserver) new ResizeObserver(()=>{ if(CV.el===cv){ CV.w=cv.clientWidth; CV.h=cv.clientHeight; } }).observe(cv); }
  return CV;
}
function draw(dt){
  if(!S||tab!=='up'||modalOpen()) return;               // detrás de una ventana no se ve: no se dibuja
  const C=canvasReady(), B=G.B; if(!C) return; const cv=C.el;
  const CW=C.w||cv.clientWidth, CH=C.h||cv.clientHeight, dpr=battery()?1:Math.min(2,window.devicePixelRatio||1);
  if(!CW||!CH) return;
  if(cv.width!==Math.round(CW*dpr)||cv.height!==Math.round(CH*dpr)){cv.width=Math.round(CW*dpr);cv.height=Math.round(CH*dpr)}
  const sc=Math.max(1,Math.min(1.5,CH/230)), W=CW/sc, H=CH/sc; // escala los dibujos al tamaño de la pantalla
  const g=C.ctx; g.setTransform(dpr*sc,0,0,dpr*sc,0,0);
  const bars=!battery();
  const tier=Math.floor((S.fase-1)/10), hue=(220+tier*37)%360, gk=hue+'|'+H;
  if(C.gk!==gk){ C.gk=gk; C.grd=g.createLinearGradient(0,0,0,H); C.grd.addColorStop(0,`hsl(${hue} 30% 16%)`); C.grd.addColorStop(1,`hsl(${hue} 25% 9%)`); }
  g.fillStyle=C.grd; g.fillRect(0,0,W,H);
  const gy=Math.min(H-42,Math.round(H*0.66)); g.fillStyle=`hsl(${hue} 20% 22%)`; g.fillRect(0,gy,W,H-gy);
  g.fillStyle=`hsl(${hue} 20% 28%)`; for(let x=(bars?-(performance.now()/40)%24:0);x<W;x+=24) g.fillRect(x,gy+6,10,3); // en modo batería el suelo no se mueve
  const hx=W*0.24, c=CFG.classes[S.cls];
  g.save(); g.translate(hx,gy); if(fx.flash>0){g.globalAlpha=0.6}
  g.fillStyle=c.color; g.fillRect(-11,-40,22,30); g.beginPath(); g.arc(0,-50,10,0,7); g.fill();
  g.fillStyle='#12141c'; g.fillRect(2,-53,3,3);
  g.strokeStyle='#ece7da'; g.lineWidth=3; g.beginPath(); g.moveTo(10,-30); g.lineTo(c.ranged?16:26,c.ranged?-44:-40); g.stroke();
  g.fillStyle='#0008'; g.beginPath(); g.ellipse(0,2,14,4,0,0,7); g.fill(); g.restore();
  if(!B) return;
  const h=G.heroStats(), contact=hx+34, spawnX=W+24;
  let q=0;
  for(const e of B.enemies){
    if(e.dead) continue;
    const p=Math.min(1,(B.t-e.spawn)/(e.walk||CFG.enemy.walk));
    let x=spawnX-(spawnX-contact)*p; if(p>=1){x+=q*20;q++}
    e.x=x; const r=B.boss?(B.elite?30:24):13, y=gy-r;
    g.fillStyle=B.boss?(B.elite?'#9b3fd0':'#c2463f'):`hsl(${(hue+140)%360} 45% 52%)`;
    g.beginPath(); g.ellipse(x,y+2,r+2,r,0,0,7); g.fill();
    g.fillStyle='#fff'; g.fillRect(x-r*0.45,y-r*0.25,4,4); g.fillRect(x-r*0.05,y-r*0.25,4,4);
    if(B.boss){g.fillStyle='#e8b04a';g.beginPath();g.moveTo(x-12,y-r+2);g.lineTo(x-8,y-r-10);g.lineTo(x-2,y-r);g.lineTo(x+4,y-r-10);g.lineTo(x+10,y-r+2);g.fill()}
    if(bars&&!e.immortal){ g.fillStyle='#0009'; g.fillRect(x-18,y-r-14,36,4); g.fillStyle='#e2605a'; g.fillRect(x-18,y-r-14,36*Math.max(0,e.hp/e.max),4); }
  }
  fx.shots=fx.shots.filter(s=>(s.t+=dt)<0.18);
  for(const s of fx.shots){ if(s.e.x===undefined) continue;
    if(s.ranged){const k=s.t/0.18, sx=hx+14, ex=s.e.x; g.fillStyle=c.color; g.beginPath(); g.arc(sx+(ex-sx)*k,gy-34+(k*20),4,0,7); g.fill()}
    else {g.strokeStyle='#fff8';g.lineWidth=2;g.beginPath();g.arc(s.e.x-6,gy-16,14,-1,1);g.stroke()} }
  fx.floats=fx.floats.filter(f=>(f.life-=dt)>0);
  g.textAlign='center'; g.font='800 13px "Nunito Sans", system-ui, sans-serif';
  for(const f of fx.floats){ const y=(f.hero?gy-70:gy-48)-(0.9-f.life)*30; const x=f.hero?hx:(f.e&&f.e.x)||0;
    g.globalAlpha=Math.min(1,f.life*2); g.fillStyle=f.hero?'#e2605a':(f.crit?'#e8b04a':'#ece7da');
    g.fillText(f.txt+(f.crit?'!':''),x,y); }
  g.globalAlpha=1; fx.flash=Math.max(0,fx.flash-dt);
  if(bars){ g.fillStyle='#0009'; g.fillRect(hx-20,gy-72,40,5); g.fillStyle='#6cc47a'; g.fillRect(hx-20,gy-72,40*Math.max(0,G.B.hp/h.hp),5); }
}

/* ---------- bucle ---------- */
let last=performance.now(), hudT=0, drawT=0;
function loop(now){
  const real=Math.min(0.25,(now-last)/1000); last=now;
  if(S&&G.B){
    G.tickBoost(real*1000); // el ×2 solo se gasta mientras se juega
    let sim=real*(S.speed||1)*G.speedMult();
    while(sim>0){const d=Math.min(0.02,sim);G.step(d);sim-=d}
    // el motor solo avisa; si los golpes ocurren sin dibujar (pestaña oculta) se descartan
    if(tab!=='up'){fx.shots.length=0;fx.floats.length=0}
    drawT+=real; if(!battery()||drawT>=0.1){draw(drawT);drawT=0}
    hudT+=real; if(hudT>0.25){hudT=0;updateHUD()}
  }
  requestAnimationFrame(loop);
}

/* ---------- arranque ---------- */
G.load(); syncS();
if(S){
  renderShell(); G.startWave();
  if(G.autoLoot()) setTimeout(()=>toast('Botín de jefes sin recoger: enviado al inventario'),400);
  if(!S.name) later(nameModal);
  const ae=G.autoEvent(); if(ae) later(()=>evEndModal(ae));   // intento del evento que quedó a medias al cerrar
  const off=G.applyOffline();
  if(off) later(()=>offlineModal(off));
} else renderSelect();
requestAnimationFrame(loop);
})();
