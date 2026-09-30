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
// Hora: la del servidor cuando se conoce (Telegram + Supabase); si no, la del móvil. Así adelantar el reloj no da ventajas.
let clockOff=0; window.setServerTime=t=>{ if(Number.isFinite(t)) clockOff=t-Date.now() };
const G=createGame({cfg:window.CFG,storage,now:()=>Date.now()+clockOff});
if(window.CFG.devTools) window.G=G; // solo en local (herramientas de prueba): en la versión publicada no se puede tocar desde la consola
if(window.Telemetry) Telemetry.attach(G); // envío a la base de datos (solo dentro de Telegram y con servidor)
if(window.Control) Control.attach(G);     // mantenimiento y actualizaciones obligatorias (solo en la versión publicada)
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
// efecto de arma Legendaria/Mítica (línea para la tarjeta)
const legendLine=it=>{ const L=R.indexOf(it.r)>=R.indexOf('L')&&CFG.weapon.legend&&CFG.weapon.legend[it.cls]; return L?`<div class="s" style="color:var(--rL)">✦ <b>${L.name}</b>: ${L.desc}</div>`:'' };
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const battery=()=>!!(S&&S.opt&&S.opt.battery); // Modo batería: sin barras, números, proyectiles ni parpadeo
const CHEST_TYPES=['wood','silver','mode'];
const chestTotal=()=>CHEST_TYPES.reduce((a,k)=>a+G.chestCount(k),0);

/* ---------- estado de la interfaz ---------- */
let tab='up', upOpen=false, invView='main', shopView='cofres', evView=null, modView=null;
let expandedId=null, forgeId=null, lockSel=[], forjaBack='armas'; // forjaBack: adónde vuelve "← Volver" desde la Forja
let pendingName='', pendingReforge=null, pendingDis=null, pendingSpin=null, buyCtx=null, modeReady=null;
const reduceMotion=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
// escribe HTML solo si cambia (evita rehacer botones mientras se tocan)
const setHTML=(el,h)=>{ if(el&&el.__h!==h){ el.__h=h; el.innerHTML=nbsp(h); } };
const F={rar:'all',stat:'any',min:'',max:''};
const fx={shots:[],floats:[],flash:0};

/* ---------- Telegram: colores, vibración y botón atrás ---------- */
const TG=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initData?Telegram.WebApp:null;
if(TG){ try{ TG.setHeaderColor('#12141c'); TG.setBackgroundColor('#12141c'); if(TG.setBottomBarColor) TG.setBottomBarColor('#1b1e2a'); }catch(e){} }
// vibración corta (jefe vencido, cofres, evolución); no en modo batería
function haptic(kind){ if(!TG||!TG.HapticFeedback||battery()) return; try{ kind==='ok'?TG.HapticFeedback.notificationOccurred('success'):TG.HapticFeedback.impactOccurred(kind||'light') }catch(e){} }
// Botón atrás de Telegram: cierra la ventana abierta o vuelve a la pantalla anterior (en Inicio sin ventanas, se oculta y atrás cierra el juego)
function canGoBack(){ if(!S) return false; if(modalOpen()) return !pendingSpin&&!adTimerOn()&&!($('#nameIn')&&!S.name);
  return tab!=='up'||false }
function goBack(){ if(modalOpen()){ if(canGoBack()) ACT.close(); return }
  if(tab==='ev'&&evView){ evView=null; return renderTab() }
  if(tab==='ev'&&modView){ modView=null; return renderTab() }
  if(tab==='inv'&&invView==='forja'){ invView=forjaBack; return renderTab() }
  if(tab==='inv'&&invView!=='main'){ invView='main'; return renderTab() }
  tab='up'; upOpen=false; renderTab() }
let backShown=null;
function syncBack(){ if(!TG||!TG.BackButton) return; const v=canGoBack(); if(v===backShown) return; backShown=v; try{ v?TG.BackButton.show():TG.BackButton.hide() }catch(e){} }
if(TG&&TG.BackButton) try{ TG.BackButton.onClick(goBack) }catch(e){}

/* ---------- eventos del motor -> pantalla ---------- */
// proyectil de cada clase a distancia (el resto, tajo del color de la clase)
const PROJ={Mago:'fire',Arquero:'arrow',Clerigo:'holy'};
function attackFx(cls,side,e,crit){ const k=PROJ[cls]; if(k) ART.addFx('proj',{kind:k,side,e,color:k==='holy'?'#ffe38a':null}); else ART.addFx('slash',{side,e,crit,color:crit?'#ffd35a':ART.shade(CFG.classes[cls].color,1.4)});
  if(crit){ ART.addFx('crit',{side,e}); ART.shake(2) } }
G.on('hit',({e,d,crit,ranged,thorns,clone,skill,frost,burst,bolt,cleave})=>{ if(e) e._hitAt=performance.now(); if(!thorns&&!clone) fx.atkAt=performance.now(); if(battery()||tab!=='up') return; if(e&&e.rival) fx.rflash=0.12;
  if(!skill&&!thorns&&!clone&&!frost&&!burst&&!bolt&&!cleave) attackFx(S.cls,'hero',e,crit);
  if(d>=0.5) fx.floats.push({e,txt:fmt(d),crit,life:0.9}) });   // (sin «0» de golpes que no hacen daño)
G.on('heroHit',({d})=>{ const B=G.B, f=B&&B.enemies.find(e=>!e.dead&&e.arrive<=B.t); if(f) f._atkAt=performance.now(); fx.ratkAt=performance.now(); if(battery()||tab!=='up') return; fx.flash=0.15; if(d>0.08*G.heroStats().hp) ART.shake(3); if(d>=0.5) fx.floats.push({hero:true,txt:'-'+fmt(d),life:0.8}) });
G.on('dodge',()=>{ if(!battery()&&tab==='up') fx.floats.push({hero:true,txt:'esquiva',life:0.8}) });
G.on('level',l=>{ if(tab==='up'&&!battery()){ ART.addFx('levelup',{text:'¡Nivel '+l+'!'}); haptic('light') } else toast('¡Nivel '+l+'!') });
// Jefes: sin ventana; el botín va a la bolsa (icono de cofre) y el icono da un pequeño salto
// Botín de jefe: el cofre y los materiales salen del jefe y vuelan al icono del botín (los monstruos normales no sueltan nada)
const stageXY=e=>{ const cv=$('#cv'); if(!cv||!e||e.x==null||!fx.sc) return null; const r=cv.getBoundingClientRect(); return {x:r.left+e.x*fx.sc,y:r.top+(fx.gy-30)*fx.sc} };
function flyLoot(items){ const B=G.B, boss=B&&B.enemies.find(e=>e.x!=null), from=stageXY(boss), to=$('#lootBtn');
  if(to) to.hidden=false; if(!from||!to||tab!=='up'||battery()||reduceMotion()) return false;
  if(boss) ART.addFx('loot',{e:boss}); const tr=to.getBoundingClientRect(), tx=tr.left+tr.width/2, ty=tr.top+tr.height/2;
  items.forEach((html,i)=>{ const el=document.createElement('div'); el.className='flyi'; el.innerHTML=html; document.body.appendChild(el);
    const dx=(i-(items.length-1)/2)*26, up=-50-Math.random()*20;
    el.animate([{transform:`translate(${from.x-12}px,${from.y-12}px) scale(.4)`,opacity:0},{transform:`translate(${from.x-12+dx}px,${from.y-12+up}px) scale(1.3)`,opacity:1,offset:.35},
      {transform:`translate(${from.x-12+dx}px,${from.y-12+up+8}px) scale(1.1)`,offset:.55},{transform:`translate(${tx-12}px,${ty-12}px) scale(.6)`,opacity:.9}],{duration:1100+i*120,easing:'cubic-bezier(.3,.7,.4,1)'})
      .onfinish=()=>{ el.remove(); to.animate([{transform:'scale(1)'},{transform:'scale(1.3)'},{transform:'scale(1)'}],{duration:300}) } }); return true }
const MATI='<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l5 5-5 9-5-9z" fill="#c86bff"/><path d="M8 1l2 5-2 9-2-9z" fill="#fff5"/></svg>';
function bossLoot(mat,chest){ const b=$('#lootBtn'); updateHUD(); const items=[...(chest?[ICON.wood]:[]),ICON.scrap,...Array(Math.min(3,mat||0)).fill(MATI)];
  if(!flyLoot(items)&&b&&!reduceMotion()) b.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:450}) }
G.on('boss',({mat})=>{ haptic('medium'); bossLoot(mat,true) });
G.on('bossFarm',({mat})=>{ if(mat) bossLoot(mat,false) });
G.on('mode',({name})=>{ upOpen=false; showModal(`<h3>Modo ${name}</h3><p class="hint">Vuelves a la fase 1. Los enemigos son mucho más fuertes, dan más oro y los jefes sueltan ${G.modeCfg().mat}.</p><button class="btn gold" data-act="close">Continuar</button>`) });
G.on('defeat',({fase,kind})=>toast(kind==='farm'?'Derrota: farmeando la fase '+fase:'Retrocedes a la fase '+fase));
G.on('fase',()=>refreshTabIfStatic());
G.on('wave',()=>{});
G.on('bossPhase',({k})=>{ haptic('medium'); toast(k==='rage'?'¡El jefe se enfurece!':'¡El jefe llama refuerzos!'); });
G.on('towerEnd',r=>{ tab='ev'; modView='torre'; evView=null; renderTab(); later(()=>showModal(r.won?`<h3>¡Piso ${r.floor} superado!</h3><p class="hint">${r.k==='elite'?'Élite: eliges 2 grimorios.':'Elige tu mejora en la Torre.'}</p><button class="btn gold" data-act="close">Elegir</button>`
  :`<h3>Derrota en el piso ${r.floor}</h3><p class="hint">${r.lives>0?`Te quedan ${r.lives} vida${r.lives>1?'s':''}: vuelve a intentarlo.`:'Sin vidas: puedes comprar una o terminar la partida.'}</p><button class="btn gold" data-act="close">Vale</button>`)); });
G.on('towerReward',({floor,b})=>toast(`Piso ${floor}: ${bundleTxt(b)}`));
G.on('surprise',({k,reward})=>{ if(k==='horde'){ haptic('medium'); toast(`¡Horda! 30 s con oro ×${CFG.surprise.horde.gold}`); } else if(k==='wander'){ haptic('medium'); toast(`¡Jefe errante! Véncelo en ${CFG.surprise.wander.dur} s`); }
  else if(k==='wanderWin'){ haptic('ok'); toast('¡Jefe errante vencido! '+bundleTxt(reward)); updateHUD(); } else if(k==='wanderFled') toast('El jefe errante huyó'); });
G.on('pvpEnd',r=>{ tab='ev'; modView='pvp'; evView=null; haptic(r.win?'ok':'medium');
  if(r.rival.match&&pvpOnline()) Telemetry.pvp(CFG,'pvpResult',{match:r.rival.match,win:r.win}).then(j=>{ if(j&&j.ok){ G.pvpSync(j); if(PVI) Object.assign(PVI.me,{rating:j.rating,games:j.games,wins:j.wins,rank:j.rank,left:j.left}); pvpLoad(); } });
  renderTab(); later(()=>showModal(`<h3>${r.win?'¡Victoria!':'Derrota'}</h3><p class="hint">Contra ${esc(r.rival.name)} (${clName(r.rival.cls)}) · tú ${Math.round(r.me*100)} % de vida, rival ${Math.round(r.them*100)} %.<br>${r.d>0?'+':''}${r.d} puntos (ahora ${fmt(r.rating)}).</p><button class="btn gold" data-act="close">Vale</button>`)); });
function skillFx(ev,side,eng){ if(battery()) return;
  if(ev.k==='skill'){ const d=eng.skillDef(ev.slot)||{}, id=ev.id;
    ART.addFx('name',{side,text:ev.name});
    if(['rapido','sed','sacrificio','combustion','clon','juicio','baluarte'].includes(id)) ART.addFx(id,{side,dur:d.dur||1});
    else ART.addFx(id,{side});
    if(id==='armaduraHielo') ART.addFx('iceArmor',{side,dur:d.dur||8});
    if(id==='combustion') ART.addFx('combustionHit',{side});
    if(id==='ejecutar'||id==='bola') ART.shake(id==='ejecutar'?4:2); }
  else if(ev.k==='congelar') ART.addFx('congelar',{side,e:ev.e});
  else if(ev.k==='luzVuelve') ART.addFx('luzVuelve',{side,n:ev.n});
  else if(ev.k==='reloj') ART.addFx('reloj',{side}); }
G.on('fx',ev=>skillFx(ev,'hero',G));
G.on('eventStart',()=>{ fx.floats.length=0; ART.clearFx();
  const gh=G.pvpOn()&&G.ghost(); if(gh){   // PvP: el fantasma también lanza sus habilidades y dispara
    gh.on('fx',ev=>skillFx(ev,'rival',gh));
    gh.on('hit',({crit,skill,thorns,clone,frost,burst,bolt,cleave})=>{ if(battery()||tab!=='up'||skill||thorns||clone||frost||burst||bolt||cleave) return; attackFx(gh.S.cls,'rival',null,crit) }); } });
G.on('eventEnd',r=>{ later(()=>evEndModal(r)); renderTab(); });
function evEndModal(r){ const boss=r.kind==='boss', rw=r.best>0?(boss?G.wbReward(r.pos):G.evReward(r.pos)):null; if(!r.best) r={...r,pos:'–'};
  showModal(`<h3>${boss?'Jefe semanal':'Mazmorra'}</h3>
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
  return `<div class="loot">${sorted.map(x=>`<div><span style="color:var(--r${x.r})">${wName(x)}</span><span class="s">${x.autoEq?'equipada':''}${x.auto?' · desmontada (+'+x.auto+')':''}</span></div>`).join('')}</div>`;
}

/* ---------- estructura ---------- */
// iconos de las monedas de arriba: moneda de oro, token (rombo) y chatarra (engranaje)
const ICON={
  gold:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--gold)"/><circle cx="8" cy="8" r="4.2" fill="none" stroke="#0005" stroke-width="1.4"/></svg>',
  tok:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l6 7-6 7-6-7z" fill="var(--tok)"/><path d="M8 4l3 4-3 4-3-4z" fill="#fff4"/></svg>',
  scrap:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path fill="var(--scrap)" d="M7 1h2l.4 2 1.5.6 1.7-1.2 1.4 1.4-1.2 1.7.6 1.5 2 .4v2l-2 .4-.6 1.5 1.2 1.7-1.4 1.4-1.7-1.2-1.5.6L9 15H7l-.4-2-1.5-.6-1.7 1.2-1.4-1.4 1.2-1.7-.6-1.5L1 9V7l2-.4.6-1.5-1.2-1.7 1.4-1.4 1.7 1.2 1.5-.6z"/><circle cx="8" cy="8" r="2.4" fill="#0006"/></svg>',
  // cofres: madera (marrón), plata (gris) y modo (morado)
  wood:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 7h12v7H2z" fill="#9a6a3e"/><path d="M2 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3z" fill="#9a6a3e" style="filter:brightness(1.25)"/><path d="M2 7h12v1.6H2z" fill="#5c3b1e"/><rect x="7" y="7" width="2" height="3" rx=".5" fill="#ffd66b"/></svg>',
  silver:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 7h12v7H2z" fill="#b9c0cc"/><path d="M2 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3z" fill="#b9c0cc" style="filter:brightness(1.25)"/><path d="M2 7h12v1.6H2z" fill="#6f7785"/><rect x="7" y="7" width="2" height="3" rx=".5" fill="#ffd66b"/></svg>',
  mode:'<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 7h12v7H2z" fill="#9b6ad6"/><path d="M2 7a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3z" fill="#9b6ad6" style="filter:brightness(1.25)"/><path d="M2 7h12v1.6H2z" fill="#5a3a86"/><rect x="7" y="7" width="2" height="3" rx=".5" fill="#ffd66b"/></svg>'};
// iconos de la barra de abajo y de las categorías (trazo del color del texto)
const IC=(d,sz=20)=>`<svg class="ico" viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS={
  up:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  inv:'<path d="M6 8h12l-1 12H7z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  shop:'<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9h16v1.5a2.7 2.7 0 0 1-5.3.6 2.7 2.7 0 0 1-5.4 0A2.7 2.7 0 0 1 4 10.5z"/><path d="M5.5 13v7h13v-7"/>',
  ev:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  mis:'<path d="M7 4h11v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2h3z"/><path d="M7 4a2 2 0 0 0-2 2v2h2"/><path d="M10 9h5M10 13h5"/>',
  dev:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  campana:'<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  eventos:'<path d="M12 3a7 7 0 0 0-7 7c0 2.5 1.3 4 3 5v3h8v-3c1.7-1 3-2.5 3-5a7 7 0 0 0-7-7z"/><circle cx="9.5" cy="10.5" r="1.3"/><circle cx="14.5" cy="10.5" r="1.3"/><path d="M10.5 18v2M13.5 18v2"/>',
  torre:'<path d="M7 21V9h10v12"/><path d="M6 9V4h2.5v2h2V4h3v2h2V4H18v5"/><path d="M10 21v-4h4v4"/>',
  pvp:'<path d="M5 3l12 12M19 3L7 15"/><path d="M14 18l4-4M10 18l-4-4"/><path d="M16 16l3 3M8 16l-3 3"/>',
  armas:'<path d="M20 4L9 15"/><path d="M20 4h-4.5M20 4v4.5"/><path d="M7 13l4 4"/><path d="M8 16l-4 4"/>',
  cofres:'<path d="M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9H3z"/><path d="M3 12h18M11 12v3h2v-3"/>',
  mat:'<path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18M12 20L9 9l3-5 3 5z"/>'};
const NAVL={up:'Inicio',inv:'Inventario',shop:'Tienda',ev:'Modos',mis:'Misiones',dev:'Ajustes'};
// botón de la barra: icono + nombre (+ globo)
const navSet=(k,n)=>setHTML(document.querySelector(`[data-tab="${k}"]`),`<span class="ni">${IC(ICONS[k])}${n?`<sup class="nb">${n}</sup>`:''}</span><span class="nl">${NAVL[k]}</span>`);
function renderShell(){
  $('#app').innerHTML=`
  <div class="top"><div class="uname" id="uName"></div>
    <div class="res"><span title="Oro" aria-label="Oro">${ICON.gold}<b id="rGold"></b></span>
    <span title="Tokens (comprados + ganados)" aria-label="Tokens">${ICON.tok}<b id="rTok"></b></span>
    <span title="Chatarra" aria-label="Chatarra">${ICON.scrap}<b id="rScrap"></b></span></div></div>
  <div id="battle" class="battle">
  <div class="hero"><div id="evoSlot"></div>
    <div class="hbar"><span>HP</span><div class="bar"><i id="hpBar"></i></div><b id="hpTxt"></b></div><div class="hbar"><span id="xpLbl">XP</span><div class="bar xp"><i id="xpBar"></i></div><b id="xpTxt"></b></div>
    </div>
  <div class="stage"><canvas id="cv" width="600" height="220"></canvas><div class="tag" id="tag"></div><span class="fasetxt" id="faseTxt"></span><div class="skbar" id="skBar"></div><div id="skMode"></div><div class="sidebtns"><button class="calbtn" id="calBtn" data-act="calOpen" aria-label="Calendario" title="Calendario"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg><i class="lootn" id="calN" hidden>!</i></button><button class="calbtn" id="wheelBtn" data-act="wheelOpen" aria-label="Ruleta diaria" title="Ruleta diaria"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg><i class="lootn" id="wheelN" hidden>!</i></button><button class="calbtn boostbtn" id="boostBtn" data-act="boostOpen" aria-label="Potenciadores" title="Potenciadores"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg></button><button class="calbtn" id="grimBtn" data-act="grimOpen" aria-label="Grimorio" title="Grimorio" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/></svg><i class="lootn" id="grimN" hidden>!</i></button><button class="calbtn lootbtn" id="lootBtn" data-act="lootOpen" aria-label="Botín de jefes" title="Botín de jefes" hidden><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M3 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v9H3z"/><path d="M3 12h18M11 12v3h2v-3"/></svg><i class="lootn" id="lootN"></i></button></div><span class="boosttime" id="boostTime" hidden></span></div>
  </div>
  <div id="tab"></div>`;
  for(const k in NAVL) navSet(k,0);
  $('#nav').hidden=false; { const st=document.querySelector('[data-tab="shop"]'); if(st) st.hidden=!CFG.shopTab; } if(tab==='shop'&&!CFG.shopTab) tab='up'; renderTab();
}
function updateHUD(){
  if(!S||!$('#rGold')) return;
  const h=G.heroStats(), B=G.B;
  const ev=G.inEvent();
  // abajo a la derecha: la fase (o, en un evento, el tiempo y la puntuación)
  $('#faseTxt').classList.toggle('top',ev);
  setHTML($('#faseTxt'),ev&&B.kind==='pvp'?`⏱ ${Math.ceil(Math.max(0,CFG.pvp.maxT-B.t))} s`:ev&&B.kind==='tower'?`Piso ${G.towerState().run.floor} · ♥ ${G.towerState().run.lives} · quedan ${B.enemies.filter(e=>!e.dead).length}`:ev&&B.kind==='boss'?`⏱ ${mmss(Math.max(0,CFG.wboss.dur-B.t)*1000)} · Daño ${fmt(B.dmg)}`
    :ev?`⏱ ${mmss(Math.max(0,CFG.event.maxDur-B.t)*1000)} · Nv ${(G.evRamp()||{r:0}).r+1} · ☠ ${B.kills}`:`Fase ${S.fase}${G.streak().mul>1?` · <span class="stk">🔥 +${Math.round((G.streak().mul-1)*100)} %</span>`:''}`);
  setHTML($('#uName'),`<span class="nt">${esc(S.name||'')}</span><span class="nc">- ${heroName()}</span>`);   // se recorta el nombre, la clase siempre se ve
  setHTML($('#xpLbl'),`Nv ${S.lvl}${S.lvl>=G.lvlCap()?' máx.':''}`);
  $('#rGold').textContent=fmt(S.gold); $('#rTok').textContent=fmt(G.tokens()); $('#rScrap').textContent=fmt(S.scrap);
  const sp=!ev&&G.surpriseState(), tag=$('#tag'), tt=ev?(B.kind==='pvp'?'PVP · '+String((B.enemies[0]||{}).name||'').toUpperCase():B.kind==='tower'?'TORRE · PISO '+G.towerState().run.floor:B.kind==='boss'?'JEFE SEMANAL':'MAZMORRA'):B&&B.boss?(B.elite?'JEFE DE ÉLITE':'JEFE'):sp?(sp.k==='horde'?`¡HORDA! ${Math.ceil(sp.left)} s · oro ×${CFG.surprise.horde.gold}`:`JEFE ERRANTE ${Math.ceil(sp.left)} s`):''; // (sin "Avanzando"/"Farmeando")
  tag.textContent=tt; tag.hidden=!tt; tag.className='tag'+(ev?' ev':B&&B.boss?' boss':sp?' boss':'');
  const fab=$('#upFab'); if(fab) fab.hidden=tab!=='up'||ev;
  // Grimorio: icono de libro en el combate desde el nivel grimoire.showLvl (o si ya se tiene); brilla cuando se puede evolucionar
  const gb=$('#grimBtn'); if(gb){ const shown=!ev&&(G.grimOwned()||S.lvl>=CFG.grimoire.showLvl||S.evo>=1), evoNow=shown&&!(S.evo>=1)&&G.grimDone()&&G.evoLvlOk();
    gb.hidden=!shown; gb.classList.toggle('on',evoNow); gb.dataset.act=evoNow?'evoOpen':'grimOpen'; gb.setAttribute('aria-label',evoNow?'Evolucionar':'Grimorio'); $('#grimN').hidden=!evoNow; }
  const es=$('#evoSlot'); if(es){ const soon=G.nextEvo()&&G.nextEvo().pending&&S.lvl>=G.lvlCap(); setHTML(es,soon&&!ev?'<span class="pill">Evolución: próximamente</span>':''); }
  const cb=$('#calBtn'); if(cb){ cb.hidden=ev; $('#calN').hidden=!G.calState().can; }
  const wb=$('#wheelBtn'); if(wb){ wb.hidden=ev; const w=G.wheelState(); $('#wheelN').hidden=!w.free; }
  const hpv=B?Math.max(0,B.hp):h.hp, xpp=Math.min(100,S.xp/G.xpReq(S.lvl)*100);
  $('#hpBar').style.width=hpv/h.hp*100+'%'; $('#hpTxt').textContent=fmt(Math.ceil(hpv));
  $('#xpBar').style.width=xpp+'%'; $('#xpTxt').textContent=Math.floor(xpp)+' %';
  const hs=$('#hStats'); if(hs) hs.innerHTML=`<div class="sl">
      <span>Vida <b>${fmt(h.hp)}</b></span><span>Def <b>${fmt(h.df)}</b></span>${h.ls?`<span>Robo <b>${pct(h.ls)}</b></span>`:''}${h.ev?`<span>Evasión <b>${pct(h.ev)}</b></span>`:''}</div>
    <div class="sl"><span>Daño <b>${fmt(h.atk)}</b></span><span>Vel <b>${h.spd.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})}/s</b></span><span>Crít <b>${pct(h.cr)}</b></span><span>D. crít <b>+${Math.round(h.cd*100)} %</b></span>${h.bd?`<span>Jefes <b>+${pct(h.bd)}</b></span>`:''}</div>`;
  const lb=$('#lootBtn'); if(lb){ lb.hidden=!S.loot; const n=S.loot?S.loot.n:0, ln=$('#lootN'); ln.hidden=!n; ln.textContent=n; }
  const ep=$('#evPause'); if(ep){ const l=G.evPauseLeft(); if(l>0) ep.textContent=mmss(l); else if(tab==='ev') renderTab(); }
  const bl=G.boostLeft(), bt=$('#boostTime'), bb=$('#boostBtn');
  if(bt){ bt.hidden=!bl; if(bl) bt.textContent='×'+CFG.boosts.speed.mult+' '+mmss(bl); } if(bb) bb.classList.toggle('on',bl>0);
  if(boostModalOpen) updateBoostModal();
  const on=!ev&&G.canAdvanceMode(); if(on&&modeReady===false) toast(`¡${CFG.modes[S.mode+1].name} desbloqueado! Míralo en Modos → Campaña`); modeReady=on;
  // habilidades: solo las desbloqueadas; la recarga se ve con el reloj gris (sin números). En los eventos, botón Auto/Manual
  const sb=$('#skBar'); if(sb){ const L=G.skills().filter(x=>!x.locked), inEv=G.inEvent(), pvp=G.pvpOn(), auto=pvp?!(S.opt&&S.opt.pvpAuto===false):inEv&&!!(S.opt&&S.opt.evAuto), key=L.map(x=>x.slot).join()+inEv+auto;
    if(sb.dataset.k!==key){ sb.dataset.k=key; sb.innerHTML=L.map(x=>`<button class="skb" data-act="skill" data-k="${x.slot}" aria-label="${esc(x.name||'')}"><span class="skn${(x.name||'').split(' ')[0].length>8?' long':''}">${esc((x.name||'').split(' ')[0])}</span><i class="skcd"></i></button>`).join(''); }
    const sm=$('#skMode'), on=inEv?auto:!(S.opt&&S.opt.autoSkills===false);
    setHTML(sm,L.length?`<button class="skmode${on?' on':''}" data-act="skAuto" aria-pressed="${on}" aria-label="Habilidades automáticas">Habilidades: ${on?'Auto':'Manual'}</button>`:'');
    L.forEach((x,i)=>{ const b=sb.children[i]; if(!b) return; const p=x.ready?0:x.left/x.cd; b.classList.toggle('ready',x.ready);
      b.querySelector('.skcd').style.background=p?`conic-gradient(rgba(0,0,0,.65) ${p*360}deg, transparent 0)`:'none'; }); }
  { const n=misBadge(); navSet('mis',n); if(tab==='mis'&&misKeyNow()!==misKey) renderTab(); }
  document.querySelectorAll('[data-need]').forEach(b=>{const [k,v]=b.dataset.need.split(':');b.disabled=(S[k]<+v)});
  const nc=chestTotal();
  navSet('ev',((G.evPaused()?0:G.evFreeLeft()+G.wbFreeLeft())+G.pvpFreeLeft()+(G.evPending()?1:0)+(G.wbPending()?1:0)+(CFG.league.show&&G.leaguePending()?1:0)));
  navSet('inv',nc>99?'99+':nc);
}
// entrada suave de la pantalla nueva (al cambiar de pestaña o de sección)
let lastView='';
function viewEnter(){ const v=[tab,invView,modView,evView,misView].join('|'); if(v===lastView) return; lastView=v; const el=$('#tab'); if(!el||reduceMotion()||battery()) return;
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter') }
function renderTab(){
  if(!S) return;
  document.querySelectorAll('.nav button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
  const el=$('#tab'); if(!el) return;
  const bt=$('#battle'); if(bt) bt.hidden=tab!=='up'; $('#app').classList.toggle('home',tab==='up'); // el combate sigue funcionando por detrás
  if(tab==='up') el.innerHTML='';
  const fab=$('#upFab'); if(fab) fab.hidden=tab!=='up'||G.inEvent();
  if(upOpen) showUpgrades();
  // Inventario: pantalla principal (Equipo + Cofres/Materiales); Armas y Grimorio se abren desde el Equipo, a pantalla propia
  if(tab==='inv'){ const back=(v,t)=>`<button class="back" data-act="invview" data-v="${v}">← ${t}</button>`;
    el.innerHTML=nbsp((invView==='forja'?back(forjaBack,forjaBack==='main'?'Volver al inventario':'Volver a Armas')
      :invView==='armas'?back('main','Volver al inventario')
      :invView==='grim'?back('main','Volver al inventario')
      :equipHud())+tabInv()); if(invView==='armas') renderList(); }
  if(tab==='shop') el.innerHTML=nbsp(tabShop());
  if(tab==='ev') el.innerHTML=nbsp(tabEv());
  if(tab==='dev') el.innerHTML=nbsp(tabDev());
  viewEnter();
  if(tab==='mis'){ misKey=misKeyNow(); const pl=$('.plist'), y=window.scrollY, py=pl?pl.scrollTop:0; el.innerHTML=nbsp(tabMis());   // se conserva el scroll
    const pl2=$('.plist'); if(pl2) pl2.scrollTop=py; window.scrollTo(0,y); }
  updateHUD();
}
function refreshTabIfStatic(){ if(tab==='shop'||tab==='ev'||(tab==='inv'&&invView==='cofres')) renderTab(); else updateHUD(); }

/* ---------- Inicio: mejoras y niveles ---------- */
function showUpgrades(){upOpen=true;showModal(tabUp()+'<button class="btn gold" data-act="upClose">Cerrar</button>');updateHUD()}
function tabUp(){
  const rows=Object.entries(CFG.upgrades).map(([k,u])=>{
    const c=G.upCost(k), dv=G.upgradeGain(k), v=G.heroStats()[k];
    const nv=x=>k==='spd'?x.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})+'/s':fmt(x);
    return `<div class="row"><div><div class="t">${u.name}</div><div class="s">${nv(v)} → <b style="color:var(--good)">${nv(v+dv)}</b></div></div>
      <div class="acts"><button class="btn sm gold" data-act="buy" data-k="${k}" data-need="gold:${c}">${fmt(c)} oro</button><button class="btn sm" data-act="buymax" data-k="${k}">Máx.</button></div></div>`}).join('');
  return `<section class="panel"><h3>Mejoras</h3>${rows}</section>`;
}
// Modos: Normal, Pesadilla, Infierno. Muestra dónde estás, qué da cada uno y qué hace falta para pasar al siguiente.
function nameModal(){ showModal(`<h3>Tu nombre</h3><input id="nameIn" class="nameinp" maxlength="16" autocomplete="nickname" placeholder="3-16 letras" value="${esc(S.name||'')}">
  <p class="hint">No se podrá cambiar.</p><div class="ctrl"><button class="btn gold" data-act="nameSave">Guardar</button></div>`); const i=$('#nameIn'); if(i) i.focus() }
function modeRows(){
  const CAP=CFG.phaseCap; return CFG.modes.map((M,m)=>{
    const cur=m===S.mode, done=m<S.mode, next=m===S.mode+1, tier=CFG.evo.tiers[m-1];
    const need=M.locked?'':m?`Vencer la fase ${CAP} de ${CFG.modes[m-1].name} y hacer la evolución ${m}${tier&&tier.pending?' (próximamente)':''}`:'';
    const st=cur?`<span class="pill" style="color:var(--gold)">Actual · fase ${S.best}/${CAP}</span>`:done?'<span class="pill">Completado</span>':`<span class="pill">${M.locked?'Próximamente':next&&G.canAdvanceMode()?'Desbloqueado':'Bloqueado'}</span>`;
    return `<div class="mcard${cur?' cur':''}${!cur&&!done&&!(next&&G.canAdvanceMode())?' lock':''}">
      <div class="ctrl" style="justify-content:space-between"><b>${M.name}</b>${st}</div>
      <span class="s">Oro ×${(M.gold||1).toLocaleString('es-ES')} · ${M.mat}</span>
      ${!cur&&!done&&need?`<span class="s">${need}</span>`:''}
      ${next&&G.canAdvanceMode()?`<button class="btn sm gold" data-act="modeGo">Ir a ${M.name}</button>`:''}</div>`; }).join('') }

/* ---------- Inventario ---------- */
// ¿daño y velocidad base mejores que el arma equipada? (las armas ya no se equipan solas)
function betterThanEquipped(it){ const e=G.equipped(); if(!e) return true; const a=G.weaponMain(it), b=G.weaponMain(e); return a.d+a.s*0.5>b.d+b.s*0.5 }
function itemCard(it){
  const m=G.weaponMain(it), eq=it.id===S.equippedId, own=it.cls===S.cls, open=expandedId===it.id, up=own&&!eq&&betterThanEquipped(it);
  return `<div class="irow${eq?' eq':''}${open?' open':''}">
    <div class="ihd" data-act="expand" data-id="${it.id}" role="button" tabindex="0" aria-expanded="${open}">
      <span class="nm" style="color:var(--r${it.r})"><span class="wn">${wName(it)}</span> <span class="s">nv${it.lvl}</span>${eq?' <span class="pill">Equipada</span>':''}${up?' <span class="better" title="Mejor que tu arma equipada" aria-label="Mejor que tu arma equipada">▲</span>':''}</span>
      <span class="meta"><span class="rar" style="color:var(--r${it.r})">${CFG.rarName[it.r]}</span>
      <button class="star${it.fav?' on':''}" data-act="fav" data-id="${it.id}" aria-label="${it.fav?'Quitar bloqueo':'Bloquear: no se desmonta ni se usa para forjar'}" title="Bloquear: no se desmonta ni se usa para forjar">★</button></span>
    </div>
    ${open?`<div class="idet">
      <div class="s">${CFG.rarName[it.r]} · Daño +${pct(m.d)} · Velocidad +${pct(m.s)}</div>${legendLine(it)}
      <div class="sec">${chips(it.sec,false,it.r)}</div>
      <div class="ctrl">
        ${eq?'':`<button class="btn sm" data-act="equip" data-id="${it.id}" ${own?'':'disabled title="Es de otra clase"'}>Equipar</button>`}
        <button class="btn sm gold" data-act="forge" data-id="${it.id}">Forjar</button>
        ${eq||it.fav?'':`<button class="btn sm" data-act="dis1" data-id="${it.id}">Desmontar +${G.disValue(it)}</button>`}
      </div></div>`:''}
  </div>`;
}
// Forja: arriba el arma y Subir nivel; abajo Reforja siempre a la vista. Cada stat es una fila con su barra (mín → máx),
// candado para fijarlo y ↑ para subir solo ese stat. Un solo botón Reforjar con el precio (sube si fijas stats).
const LOCK_SVG=on=>`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="${on?'M8 11V7a4 4 0 0 1 8 0v4':'M8 11V7a4 4 0 0 1 7.5-2'}"/></svg>`;
function statRow(it,x,i,opt){ const [lo,hi]=CFG.sec[x.k][it.r], top=x.v>=hi, w=hi>lo?Math.max(4,(x.v-lo)/(hi-lo)*100):100, lk=opt.lock&&lockSel.includes(i);
  return `<div class="rstat${lk?' lock':''}${top?' top':''}">
    ${opt.lock?`<button class="rlock" data-act="lock" data-i="${i}" aria-pressed="${lk}" aria-label="${lk?'Soltar':'Fijar'} ${CFG.sec[x.k].n}">${LOCK_SVG(lk)}</button>`:''}
    <div class="rinfo"><div class="rtop"><span>${CFG.sec[x.k].n}</span><b>+${x.v.toLocaleString('es-ES')} %${opt.diff!=null&&opt.diff!==0?` <em class="${opt.diff>0?'up':'dn'}">${opt.diff>0?'▲':'▼'}</em>`:''} <small>/ ${hi.toLocaleString('es-ES')}</small></b></div>
      <div class="rbar"><i style="width:${w}%;background:var(--${top?'good':'r'+it.r})"></i></div></div>
    ${opt.imp?(top?'<span class="rmax">MÁX</span>':`<button class="btn sm rup" data-act="impAsk" data-id="${it.id}" data-k="${i}" aria-label="Subir ${CFG.sec[x.k].n}">↑</button>`):''}
  </div>` }
function tabForja(){
  const it=G.findItem(forgeId)||G.equipped();
  if(!it) return `<section class="panel"><h3>Forja</h3><p class="hint">Vacío.</p></section>`;
  forgeId=it.id;
  const m=G.weaponMain(it), eq=it.id===S.equippedId, own=it.cls===S.cls, max=it.lvl>=CFG.weapon.maxLvl;
  const n=G.lvlCostItems(it), sc=G.lvlCostScrap(it), have=G.fodderFor(it).length;
  const mn=G.weaponMain({r:it.r,lvl:Math.min(CFG.weapon.maxLvl,it.lvl+1)});
  const up=(a,b)=>max?`+${pct(a)}`:`+${pct(a)} → <b style="color:var(--good)">+${pct(b)}</b>`;
  const p=G.reforgePrice(it,lockSel.length,'scrap'), pt=lockSel.length===1&&tokOpen()?G.reforgePrice(it,1,'token'):null;
  return `<section class="panel"><h3>Forja</h3>
    <div class="wcard${eq?' eq':''}">
      <div class="hd"><span class="nm" style="color:var(--r${it.r});font-size:16px">${wName(it)}</span>${eq?'<span class="pill">Equipada</span>':own?`<button class="btn sm" data-act="equip" data-id="${it.id}">Equipar</button>`:''}</div>
      <div class="s">${CFG.rarName[it.r]}</div>${legendLine(it)}
      <div class="fbox"><div class="fbh"><b>Nivel ${it.lvl}/${CFG.weapon.maxLvl}</b></div>
        <div class="s">Daño ${up(m.d,mn.d)} · Velocidad ${up(m.s,mn.s)}</div>
        ${max?'<span class="pill">Nivel máximo</span>':`<button class="btn gold" data-act="lvl" data-id="${it.id}" ${have<n||S.scrap<sc?'disabled':''}>Subir a nv ${it.lvl+1}</button>
        <div class="s">Necesita ${n} arma${n>1?'s':''} igual${n>1?'es':''} <b style="color:var(--${have>=n?'good':'bad'})">(${have}/${n})</b>${sc?` + ${sc} chatarra`:''}</div>`}</div>
      <div class="fbox"><div class="fbh"><b>Reforja</b><span class="s">${lockSel.length}/${G.maxLocks(it)} fijados</span></div>
        ${it.sec.map((x,i)=>statRow(it,x,i,{lock:true,imp:true})).join('')}
        <button class="btn gold" data-act="ref" data-id="${it.id}" data-pay="scrap" ${S.scrap<p.scrap?'disabled':''}>Reforjar · ${fmt(p.scrap)} chatarra</button>
        ${pt?`<button class="btn sm" data-act="ref" data-id="${it.id}" data-pay="token">O con token: ${fmt(pt.scrap)} chat. + ${pt.tokens} token</button>`:''}
        <div class="rlegend"><span>${LOCK_SVG(true)} fija un stat (cuesta más)</span><span><b>↑</b> sube solo ese stat</span></div>
      </div>
    </div>
    ${!eq&&G.equipped()?`<button class="btn sm" data-act="forge" data-id="${S.equippedId}">Volver a mi arma equipada</button>`:''}
    </section>`;
}
/* ---------- Equipo: silueta de tu clase, arma equipada y Grimorio activo ---------- */
// Siluetas sencillas por clase (color de la clase): Guerrero con espada y escudo, Mago con sombrero y báculo,
// Arquero con capucha y arco, Asesino con capa y dagas, Clérigo con mitra y maza
function classSVG(cls){ const c=CFG.classes[cls].color, body=`<circle cx="50" cy="30" r="12"/><path d="M34 46h32l6 44H28z"/><path d="M36 90h11v38H36zM53 90h11v38H53z"/>`;
  const extra={
    Guerrero:`<path d="M38 20q12-14 24 0v6H38z"/><path d="M76 18l4 2-6 54h-5z"/><rect x="70" y="70" width="14" height="4" rx="1"/><path d="M12 50h18v26q-9 8-18 0z"/>`,
    Mago:`<path d="M36 22l14-22 14 22z"/><path d="M28 46h44l10 82H18z" opacity=".85"/><rect x="80" y="20" width="4" height="100" rx="2"/><circle cx="82" cy="18" r="7"/>`,
    Arquero:`<path d="M36 34q0-26 14-26t14 26l-4-2q-2-16-10-16t-10 16z"/><path d="M16 22q20 38 0 76" fill="none" stroke="${c}" stroke-width="4"/><path d="M16 22v76" stroke="${c}" stroke-width="1"/><rect x="66" y="40" width="8" height="30" rx="2"/>`,
    Asesino:`<path d="M34 34q0-28 16-28t16 28l-2 10H36z"/><path d="M30 46l-12 70h16l6-50zM70 46l12 70H66l-6-50z" opacity=".8"/><path d="M22 70l-8 14 4 2 8-14zM78 70l8 14-4 2-8-14z"/>`,
    Clerigo:`<path d="M40 22l10-18 10 18z"/><path d="M28 46h44l8 82H20z" opacity=".85"/><circle cx="50" cy="30" r="17" fill="none" stroke="${c}" stroke-width="2" opacity=".6"/><rect x="78" y="44" width="4" height="40" rx="2"/><circle cx="80" cy="42" r="7"/>`,
  }[cls]||'';
  return `<svg class="silh" viewBox="0 0 100 130" width="92" height="120" aria-hidden="true" fill="${c}">${body}${extra}</svg>` }
function equipHud(){ const w=G.equipped();
  const wm=w&&G.weaponMain(w);
  const wslot=w?`<button class="eslot" data-act="forge" data-id="${w.id}" data-from="main" style="--rc:var(--r${w.r})"><span class="s">Arma</span><b style="color:var(--r${w.r})">${wName(w)}</b>
      <span class="s">${CFG.rarName[w.r]} · nv ${w.lvl}/${CFG.weapon.maxLvl} · Daño +${pct(wm.d)} · Vel +${pct(wm.s)}</span><span class="s">Toca para forjar</span></button>`
    :`<button class="eslot" data-act="invview" data-v="armas"><span class="s">Arma</span><b>Sin arma</b><span class="s">Armas: ${G.invCount()}/${G.invMax()} · Toca para verlas</span></button>`;
  return `<section class="panel equip"><div class="equip-in">${classSVG(S.cls)}<div class="eslots"><div class="s" style="font-weight:800">${heroName()} · nv ${S.lvl}</div>${wslot}</div></div></section>` }
function tabInv(){
  if(invView==='forja') return tabForja();
  const nc=chestTotal(), nm=(S.scrap>0?1:0)+(S.tokens>0?1:0)+(S.won>0?1:0)+Object.values(S.mats||{}).filter(n=>n>0).length+(S.evm>0?1:0)+(S.tickets>0?1:0)+(S.bossTickets>0?1:0)+(S.pvpTickets>0?1:0);
  // pantalla principal: solo las pestañas, sin nada abierto hasta que toques una
  const head=`<div class="fchips" role="tablist">
    <button data-act="invview" data-v="armas" aria-pressed="false">${IC(ICONS.armas,14)}Armas (${G.invCount()})</button>
    <button data-act="invview" data-v="cofres" aria-pressed="${invView==='cofres'}">${IC(ICONS.cofres,14)}Cofres (${nc})</button>
    <button data-act="invview" data-v="mat" aria-pressed="${invView==='mat'}">${IC(ICONS.mat,14)}Materiales (${nm})</button>
</div>`;
  if(invView==='grim') return `<section class="panel">${tabGrim()}</section>`;
  if(invView==='main') return `<section class="panel"><h3>Inventario</h3>${head}</section>`;
  if(invView==='cofres'){
    const row=k=>{const n=G.chestCount(k);return `<div class="chest inv">
      <div><div class="cn">${rw(ICON[k],'')}${CFG.chests[k].name}</div><div class="s">${n} ${n===1?'cofre':'cofres'}</div></div>
      <div class="acts"><button class="btn sm" data-act="info" data-k="${k}">Info</button>
        <button class="btn sm gold" data-act="open1" data-k="${k}">Abrir 1</button>
        <button class="btn sm" data-act="openAll" data-k="${k}" ${n>1?'':'disabled'}>Abrir todos</button></div></div>`}; // siempre los 3 botones: quedan alineados entre filas
    const owned=CHEST_TYPES.filter(k=>G.chestCount(k)>0);
    return `<section class="panel"><h3>Inventario</h3>${head}${owned.map(row).join('')||'<p class="hint">Vacío.</p>'}</section>`;
  }
  if(invView==='mat'){
    const rows=[];
    if(S.scrap>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--scrap)"></i> Chatarra</span><span class="meta"><b>${fmt(S.scrap)}</b></span></div></div>`);
    if(S.evm>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--rL)"></i> ${CFG.event.mat}s</span><span class="meta"><b>${S.evm}</b></span></div></div>`);
    if(S.tickets>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--rE)"></i> Tickets de Mazmorra</span><span class="meta"><b>${S.tickets}</b></span></div></div>`);
    if(S.pvpTickets>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--gold)"></i> Tickets PvP</span><span class="meta"><b>${S.pvpTickets}</b></span></div></div>`);
    if(S.bossTickets>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--bad)"></i> Tickets Jefe</span><span class="meta"><b>${S.bossTickets}</b></span></div></div>`);
    for(const [m,n] of Object.entries(S.mats||{})) if(n>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--rE)"></i> ${CFG.modes[m].mat}</span><span class="meta"><b>${n}</b></span></div></div>`);
    if(S.tokens>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--tok)"></i> Tokens comprados</span><span class="meta"><b>${fmt(S.tokens)}</b></span></div></div>`);
    if(S.won>0) rows.push(`<div class="irow"><div class="ihd" style="cursor:default"><span class="nm"><i class="dot" style="background:var(--good)"></i> Tokens ganados (retirables)</span><span class="meta"><b>${fmt(S.won)}</b></span></div></div>`);
    return `<section class="panel"><h3>Inventario</h3>${head}${rows.join('')||'<p class="hint">Vacío.</p>'}</section>`;
  }
  // solo salen las opciones que tienes (rarezas, clases y stats de tus armas); si la elegida ya no existe, vuelve a "todas"
  const have=S.items.filter(x=>x.id!==S.equippedId), hasStat=k=>have.some(x=>x.sec.some(y=>y.k===k));
  if(F.rar!=='all'&&!have.some(x=>x.r===F.rar)) F.rar='all';
  if(F.stat!=='any'&&!hasStat(F.stat)) F.stat='any';
  const statOpts=Object.entries(CFG.sec).filter(([k])=>hasStat(k)).map(([k,s])=>`<option value="${k}" ${F.stat===k?'selected':''}>${s.n}</option>`).join('');
  return `<section class="panel"><h3>Armas (${G.invCount()}/${G.invMax()})</h3>
    <div class="filters fpanel"><div class="ctrl" id="fHead">${fHead()}</div>
      <div class="frow"><select id="fRar" aria-label="Rareza">${['all',...R.filter(r=>have.some(x=>x.r===r))].map(r=>`<option value="${r}" ${F.rar===r?'selected':''}>${r==='all'?'Rareza':CFG.rarName[r]}</option>`).join('')}</select>
        <select id="fStat" aria-label="Stat"><option value="any">Cualquier stat</option>${statOpts}</select></div>
      <div class="frow"><input type="number" id="fMin" aria-label="Mínimo %" inputmode="decimal" placeholder="mín" value="${esc(F.min)}">
        <input type="number" id="fMax" aria-label="Máximo %" inputmode="decimal" placeholder="máx" value="${esc(F.max)}"></div>
      <div id="bulk"></div>
    </div>
    <div id="invList" class="ilist"></div></section>`;
}
// Grimorios: 2 por clase. Desbloquear con recursos o tokens; suben contigo; solo uno activo (cambiar cuesta tokens). Efecto desde el nivel 25 del grimorio.
// coste: si lo tienes, "124 ✓" en verde; si no, "tienes / pide" en rojo
const costRow=(n,have,v)=>`<div><span>${n}</span><b style="color:var(--${have>=v?'good':'bad'})">${have>=v?fmt(v)+' ✓':fmt(Math.floor(have))+' / '+fmt(v)}</b></div>`;
const hms=sec=>{ sec=Math.max(0,Math.ceil(sec)); const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60); return h?h+' h '+m+' min':m+' min' };
// camino: nombre, pasiva y habilidad de evolución (la del camino B puede estar por decidir)
function pathCard(k,P,cur){ const sk=(k==='B'?(CFG.skills.evoB||{}):CFG.skills.evo)[S.cls];
  return `<div class="wcard${cur?' eq':''}"><div class="hd"><span class="nm" style="font-size:16px;color:var(--rE)">${P.name}</span><span class="rar">Camino ${k}</span></div>
    <div class="s">${P.passive}</div><div class="s">Habilidad: <b>${sk?sk.name:'por decidir'}</b>${sk?' · '+sk.desc:''}</div>${cur?'<span class="pill">Tu camino</span>':''}</div>` }
function tabGrim(){ const GC=CFG.grimoire, P=G.evoPaths(), lv=G.grimLevel();
  let top='';
  if(!G.grimOwned()){ const c=G.grimCost(), miss=G.grimMissing();
    top=`<p class="hint">Es la llave de tu 1.ª evolución. Se consigue cerrado y se sube luchando hasta el nivel ${GC.levels}.</p>
      <div class="loot">${costRow('Oro',S.gold,c.gold)}${costRow(CFG.modes[0].mat+'s',S.mats[0]||0,c.ess)}${costRow(CFG.event.mat+'s',S.evm||0,c.ev)}</div>
      <div class="ctrl"><button class="btn gold" data-act="grimUnlock" ${Object.keys(miss).length?'disabled':''}>Conseguir</button>${tokOpen()?`<button class="btn" data-act="grimBuy">${fmt(G.grimPack())} tokens</button>`:''}</div>`; }
  else if(!G.grimDone()){ const u=G.grimUpInfo();
    top=`<div class="ctrl" style="justify-content:space-between"><b>Nivel ${lv}/${GC.levels} · cerrado</b><span class="s">${u.ready?'¡Listo para subir!':'Falta '+hms(u.need-u.xp)+' luchando'}</span></div>
      <div class="rbar"><i style="width:${u.xp/u.need*100}%;background:var(--rE)"></i></div>
      <div class="loot">${costRow('Oro',S.gold,u.cost.gold)}${costRow(CFG.modes[0].mat+'s',S.mats[0]||0,u.cost.ess)}${costRow(CFG.event.mat+'s',S.evm||0,u.cost.ev)}</div>
      <button class="btn gold" data-act="grimUp" ${u.ready&&!Object.keys(u.missing).length?'':'disabled'}>Subir a nivel ${u.to}</button>
      <p class="hint">Gana tiempo mientras luchas (también sin conexión). En el nivel ${GC.levels} abre la evolución.</p>`; }
  else if(!(S.evo>=1)) top=`<div class="ctrl" style="justify-content:space-between"><b>Nivel ${GC.levels} · aprendido</b><span class="pill" style="color:var(--good)">Llave lista</span></div>
      <p class="hint">${G.evoLvlOk()?'¡Ya puedes evolucionar y elegir camino!':`Evoluciona al llegar al nivel ${CFG.evo.tiers[0].lvl} y elige camino.`}</p>${G.evoLvlOk()?'<button class="btn gold" data-act="evoOpen">Evolucionar</button>':''}`;
  else top=`<div class="ctrl" style="justify-content:space-between"><b>Camino elegido: ${P[S.path].name}</b></div>
      ${tokOpen()?`<button class="btn" data-act="pathAsk">Cambiar a ${P[S.path==='B'?'A':'B'].name} · ${GC.switchCost} tokens</button>`:''}`;
  return `<h3>${G.grimName()}</h3>${top}` }
let grimOpen=false;
const showGrim=()=>{ grimOpen=true; showModal(tabGrim()+'<button class="btn" data-act="grimClose">Cerrar</button>') };
// Desmontar por rareza: un botón por rareza (con cuántas hay) y la casilla "Solo mi clase". Nunca la equipada ni las ★.
function fHead(){ const active=(F.rar!=='all')+(F.stat!=='any');
  return `<b>Filtros${active?' ('+active+')':''}</b>${active?'<button class="btn sm" data-act="fclear">Quitar filtros</button>':''}` }
function filtered(){
  const mn=F.min===''?-Infinity:+F.min, mx=F.max===''?Infinity:+F.max;
  return S.items.filter(it=>{
    if(it.id===S.equippedId) return false;                     // la equipada está en el Equipo, no en la lista
    if(F.rar!=='all'&&it.r!==F.rar) return false;
    if(F.stat!=='any'){const s=it.sec.find(x=>x.k===F.stat); if(!s||s.v<mn||s.v>mx) return false;}
    return true;
  }).sort((a,b)=>(b.id===S.equippedId)-(a.id===S.equippedId)||(a.cls===S.cls?0:1)-(b.cls===S.cls?0:1)||R.indexOf(b.r)-R.indexOf(a.r)||b.lvl-a.lvl);
}
function renderList(){
  const el=$('#invList'); if(!el) return; setHTML($('#fHead'),fHead());
  const list=filtered(), dis=list.filter(x=>x.id!==S.equippedId&&!x.fav);
  const bulk=$('#bulk'); if(bulk) bulk.innerHTML=`<div class="ctrl"><span class="s">${list.length} de ${G.invCount()} armas</span><button class="btn sm" data-act="disAsk" ${dis.length?'':'disabled'}>Desmontar las filtradas (${dis.length})</button></div>`;
  el.innerHTML=`${list.slice(0,80).map(itemCard).join('')||(G.invCount()?'<p class="hint">Sin resultados.</p>':'<p class="hint">Vacío.</p>')}
    ${list.length>80?`<p class="hint">+${list.length-80} más</p>`:''}`;
  updateHUD();
}
function oddsModal(type){
  const ch=CFG.chests[type], cur=G.chestProbs(type), rows=[];
  ch.odds.forEach((tr,m)=>tr.forEach(([a,p],i)=>{ const nx=tr[i+1], name=CFG.modes[m].name+(tr.length>1?(nx?` ${a}–${nx[0]-1}`:` ${a}+`):'');
    const here=m===S.mode&&p===cur; rows.push(`<tr class="${here?'here':''}"><td>${name}</td>${p.map(v=>`<td>${v?v.toLocaleString('es-ES'):'—'}</td>`).join('')}</tr>`) }));
  showModal(`<h3>Cofre de ${ch.name.toLowerCase()}</h3>
    <div class="tw"><table class="odds-t"><thead><tr><th>%</th>${R.map(r=>`<th style="color:var(--r${r})" title="${CFG.rarName[r]}">${RAR_S[r]}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>
    <p class="hint">${R.map(r=>`<b style="color:var(--r${r})">${RAR_S[r]}</b> ${CFG.rarName[r]}`).join(' · ')}. ${type==='mode'?'El contenido depende del modo en que estés al abrirlo. ':''}Se usa el % de donde estés al abrirlo (resaltado). Siempre armas de tu clase.</p>
    <button class="btn gold" data-act="close">Cerrar</button>`);
}
function impModal(id,i){ const it=G.findItem(id), x=it.sec[i], o=G.improveOdds(id,i);
  // límites de gasto: lo esperado, el triple o toda la chatarra (siempre al menos un intento)
  const lims=[...new Set([o.expSpend,o.expSpend*3,S.scrap].filter(Number.isFinite).map(v=>Math.max(o.cost,Math.min(S.scrap,v))))].sort((a,b)=>a-b);
  showModal(`<h3>Subir ${CFG.sec[x.k].n}</h3>
    ${statRow(it,x,i,{})}
    <p class="hint">Se reforja solo este stat hasta que salga más alto. Cada intento: <b>${o.cost} chatarra</b> (≈${o.exp} intentos).</p>
    <div class="s">Gastar como mucho:</div>
    <div class="ctrl">${S.scrap<o.cost?'<span class="s">Te falta chatarra.</span>':lims.map(v=>`<button class="btn sm gold" data-act="impGo" data-id="${id}" data-k="${i}" data-v="${v}">${fmt(v)}</button>`).join('')}</div>
    <div class="ctrl"><button class="btn" data-act="close">Cancelar</button></div>`) }
function doReforge(id,pay){
  const res=G.reforge(id,lockSel,pay);
  if(!res.ok){ if(res.why==='scrap') toast('Te falta chatarra'); else if(res.why==='token') toast('Te falta 1 token'); else if(res.why==='locks') toast('Demasiados bloqueos'); return }
  const it=G.findItem(id); pendingReforge={id,sec:res.sec};
  const q=l=>G.secQuality(l,it.r), better=q(res.sec)>q(it.sec);
  showModal(`<h3>Resultado</h3>
    <div class="rcmp"><div><div class="s">Actual</div>${it.sec.map((x,i)=>statRow(it,x,i,{})).join('')}</div>
      <div><div class="s">Nuevo</div>${res.sec.map((x,i)=>statRow(it,x,i,{diff:it.sec[i]&&it.sec[i].k===x.k?x.v-it.sec[i].v:null})).join('')}</div></div>
    <div class="ctrl"><button class="btn${better?'':' gold'}" data-act="close">Mantener actual</button><button class="btn${better?' gold':''}" data-act="applyReforge">Quedarme el nuevo</button></div>`);
  renderTab();
}

/* ---------- Tienda ---------- */
// Todo se paga en tokens (100 tokens = 1 $). Los tokens se compran con dinero (simulado hasta que haya pasarela de pago).
const SHOP={
  silver:{name:'Cofre de plata',info:true},
  mode:{name:'Cofre de modo',info:true},
  ticket:{name:'Ticket Mazmorra',desc:'Una entrada más a la Mazmorra, además de la gratis del día.'},
  pvp:{name:'Tickets PvP',desc:'Paquete de 3 tickets PvP: cada uno es un combate más, además de los 3 gratis del día.'},
  bossTicket:{name:'Ticket Jefe',desc:'Una entrada más al Jefe semanal, además de la gratis de la semana.'},
  ess:{name:'Esencia',desc:'Se usa para la Evolución y para desbloquear Grimorios. También la sueltan los jefes.'},
  ev:{name:'Emblema',desc:'Se usa para la Evolución y para desbloquear Grimorios. También se gana en los premios de Mazmorra y Jefe semanal.'},
};
const usd=t=>(t/CFG.tokens.perUsd).toLocaleString('es-ES',{minimumFractionDigits:t%CFG.tokens.perUsd?2:0,maximumFractionDigits:2})+' $';
const priceTxt=(k,n=1)=>k==='silver'?`${fmt(G.silverCost(n))} oro`:`${fmt(G.shopPrice(k)*n)} tokens`;
// ¿Se puede pagar con tokens? Hasta tener Telegram Stars no se pueden comprar: los botones en tokens salen como "Próximamente"
// (salvo en local con herramientas de prueba o si el jugador ya tiene tokens, p. ej. ganados)
const tokOpen=()=>!!(CFG.devTools||CFG.tokens.open||G.tokens()>0);
const soon='<span class="pill">Próximamente</span>';
// Botón de pago con Stars: en Telegram abre la factura; en local (pruebas) usa el botón de prueba 'dev'
let payCoin='stars';   // pestaña Tokens: pagar con Stars, TON o USDT
const canPay=()=>!!(window.Telemetry&&Telemetry.canPay(CFG));
function payBtn(item,stars,dev){ return canPay()?`<button class="btn sm gold" data-act="starBuy" data-k="${item}">${fmt(stars)} ⭐</button>`
  :CFG.devTools&&dev?`<button class="btn sm gold" ${dev}>${fmt(stars)} ⭐ (prueba)</button>`:'<span class="pill">Solo en Telegram</span>' }
// Ofertas en el momento: qué incluye y cuánto le queda
const offerTxt=o=>o.k==='inv'?`${o.inv} huecos más de inventario para siempre`:bundleHTML(o.b);
const hleft=ms=>{ const h=Math.floor(ms/3600e3), m=Math.floor(ms%3600e3/60e3); return h?h+' h '+m+' min':m+' min' };
function offerRows(){ return G.activeOffers().map(o=>`<div class="chest offer"><div><div class="cn">${o.t}</div><div class="s">${offerTxt(o)} · quedan ${hleft(o.left)}</div></div>
  <div class="acts">${payBtn('offer_'+o.k,o.stars,`data-act="devOffer" data-k="${o.k}"`)}</div></div>`).join('') }
function offerModal(k){ const o=G.activeOffers().find(x=>x.k===k); if(!o) return;
  const why={wall:'¿Atascado? Rompe el muro con más cofres.',evo:'Te faltan materiales para evolucionar.',inv:'Tu inventario está lleno.'}[k];
  later(()=>showModal(`<h3>${o.t}</h3><p class="hint">${why}</p><div class="chest offer"><div><div class="cn">${offerTxt(o)}</div><div class="s">Oferta por ${CFG.offers.dur} h</div></div>
    <div class="acts">${payBtn('offer_'+k,o.stars,`data-act="devOffer" data-k="${k}"`)}</div></div><button class="btn" data-act="close">Ahora no</button>`)) }
// Oferta de bienvenida: una sola vez
function firstOfferRow(){ const F=CFG.stars.first; if(S.firstBuy) return '';
  return `<div class="chest offer"><div><div class="cn">Oferta de bienvenida</div><div class="s">Arma ${CFG.rarName[F.r]} de tu clase + ${F.tokens} tokens + ${F.silver} cofres de plata · solo una vez</div></div>
    <div class="acts">${payBtn('first',F.stars,'data-act="devFirst"')}</div></div>` }
function shopRow(k){const it=SHOP[k];return `<div class="chest"><div><div class="cn">${it.name.replace(/ ([^ ]+)$/,' <span style="white-space:nowrap">$1')}${/ /.test(it.name)?'':'<span style="white-space:nowrap">'} <button class="ibtn" data-act="${it.info?'info':'shopInfo'}" data-k="${k}" aria-label="Info de ${it.name}">i</button></span></div>${k==='silver'?`<div class="s">${silverNote()}</div>`:''}</div>
  <div class="acts">${k==='silver'||tokOpen()?`<button class="btn sm gold" data-act="buyAsk" data-k="${k}">${priceTxt(k)}</button>`:soon}</div></div>`}
function tabShop(){
  const today=G.dayKey();
  const head=`<div class="fchips" role="tablist">${[['cofres','Cofres'],['tokens','Tokens'],['subs','Suscripciones']].map(([v,l])=>`<button data-act="shopview" data-v="${v}" aria-pressed="${shopView===v}">${l}</button>`).join('')}</div>`;
  let body='';
  if(shopView==='cofres') body=offerRows()+shopRow('silver')+shopRow('mode')+shopRow('ticket')+shopRow('bossTicket')+shopRow('ess')+shopRow('ev');
  const crypto=window.TonPay&&TonPay.on(CFG); if(!crypto) payCoin='stars';
  if(shopView==='tokens') body=`<div class="loot"><div><span>Tus tokens</span><b>${fmt(G.tokens())}</b></div></div>
    ${crypto?`<div class="ctrl" style="justify-content:space-between"><span class="s">Pagar con</span><div class="fchips">${[['stars','⭐ Stars'],['TON','TON'],['USDT','USDT']].map(([v,l])=>`<button data-act="payCoin" data-v="${v}" aria-pressed="${payCoin===v}">${l}</button>`).join('')}</div></div>`:''}
    ${payCoin==='stars'?firstOfferRow():''}
    ${CFG.tokens.packs.map(n=>{ const bn=(CFG.tokens.bonus||{})[n]||0; return `<div class="chest${bn?' deal':''}"><div><div class="cn">${fmt(n+bn)} tokens${bn?` <span class="pill" style="color:var(--good);white-space:nowrap;vertical-align:3px">+${Math.round(bn/n*100)} %</span>`:''}</div>${bn?`<div class="s">${fmt(n)} + ${fmt(bn)} de regalo</div>`:''}</div><div class="acts">${payCoin==='stars'?payBtn('t'+n,n*CFG.stars.perToken,`data-act="tokBuy" data-k="${n}"`):`<button class="btn sm gold" data-act="cryptoBuy" data-k="t${n}">${usd(n)} en ${payCoin}</button>`}</div></div>` }).join('')}
    ${CFG.devTools?`<div class="ctrl"><button class="btn sm" data-act="wdAsk" ${S.won>=CFG.tokens.withdraw.min?'':'disabled'}>Retirar ganados (prueba)</button></div>`:''}
    <p class="hint">${payCoin==='stars'?'Se pagan con Telegram Stars ⭐.':`Se paga con tu cartera (Telegram Wallet, Tonkeeper…) en la red TON. El precio en ${payCoin==='TON'?'TON se fija al cambio del momento':'USDT es en dólares'}. Llega en 1-2 min.`}</p>
    ${crypto?'<div class="ctrl"><button class="btn sm" data-act="cryptoCheck">¿Pagaste y no llegó? Comprobar</button></div>':''}`;
  if(shopView==='subs') body=`
    <div class="chest"><div><div class="cn">Tarjeta mensual</div><div class="s">+${Math.round(CFG.cardGold*100)} % oro · 30 días${G.hasCard()?' · quedan '+(S.cardUntil-today)+' días':''}</div></div><div class="acts">${tokOpen()?`<button class="btn sm gold" data-act="sub" data-k="card">${fmt(CFG.cardPrice)} tokens</button>`:soon}</div></div>
    <div class="chest"><div><div class="cn">VIP</div><div class="s">Combate ×${CFG.vipSpeed} · sin conexión hasta ${CFG.offlineVipH} h · 30 días${G.hasVip()?' · quedan '+(S.vipUntil-today)+' días':''}</div></div><div class="acts">${tokOpen()?`<button class="btn sm gold" data-act="sub" data-k="vip">${fmt(CFG.vipPrice)} tokens</button>`:soon}</div></div>`;
  return `<section class="panel"><h3>Tienda</h3>${head}${body}</section>`;
}
// plata: límite al día (si lo hay) o precio que sube con cada compra del día
const silverNote=()=>Number.isFinite(G.silverLeft())?`Quedan ${G.silverLeft()} hoy`:CFG.chests.silver.step?`+${Math.round(CFG.chests.silver.step*100)} % por cada compra hoy`:'Sin límite';
function maxBuy(k){ return k==='silver'?G.silverMax():Math.floor(G.tokens()/G.shopPrice(k)) }
function buyModal(){
  const k=buyCtx.k, it=SHOP[k], n=buyCtx.n, mx=maxBuy(k), ok=n>=1&&n<=mx;
  showModal(`<h3>${it.name}</h3>
    <div class="ctrl"><button class="btn" data-act="qty" data-v="-1" aria-label="Uno menos">−</button>
      <input type="number" id="buyQty" aria-label="Cantidad" min="1" max="${mx}" value="${n}" style="width:80px;text-align:center;font-size:16px;padding:8px">
      <button class="btn" data-act="qty" data-v="1" aria-label="Uno más">+</button></div>
    <div class="ctrl">${[1,5,10].map(v=>`<button class="btn sm" data-act="qtyset" data-v="${v}">${v}</button>`).join('')}<button class="btn sm" data-act="qtyset" data-v="${Math.max(1,mx)}">Máx. (${mx})</button></div>
    <div class="loot"><div><span>Total</span><b id="buyTotal">${priceTxt(k,n)}</b></div><div><span>Tienes</span><b>${k==='silver'?fmt(S.gold)+' oro':fmt(G.tokens())+' tokens'}</b></div>${k==='silver'&&Number.isFinite(G.silverLeft())?`<div><span>Quedan hoy</span><b>${G.silverLeft()}</b></div>`:''}</div>
    ${mx<1?`<p class="hint">${k==='silver'&&!G.silverLeft()?'Ya compraste los de hoy.':k==='silver'?'Oro insuficiente.':'Tokens insuficientes. <button class="btn sm gold" data-act="goTokens">Conseguir tokens</button>'}</p>`:''}
    <div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="buyConfirm" id="buyOk" ${ok?'':'disabled'}>Comprar</button></div>`);
}
function doBuy(){
  const k=buyCtx.k, n=buyCtx.n; if(n<1||n>maxBuy(k)) return;
  if(!G.buy(k,n)) return;
  closeModal(); toast(k==='pvp'?`+${n*CFG.pvp.pack} tickets PvP`:`+${n} ${SHOP[k].name.toLowerCase()}${n>1?' (x'+n+')':''} al inventario`); buyCtx=null; renderTab();
}
function wdModal(){ const W=CFG.tokens.withdraw, n=S.won, fee=Math.ceil(n*W.fee);
  showModal(`<h3>Retirar tokens ganados</h3>
    <div class="loot"><div><span>Retiras</span><b>${fmt(n)} tokens</b></div><div><span>Comisión (${Math.round(W.fee*100)} %)</span><b>−${fmt(fee)}</b></div><div><span>Recibes</span><b>${usd(n-fee)}</b></div></div>
    <p class="hint">Prueba: no se mueve dinero real.</p>
    <div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="wdGo">Retirar</button></div>`) }

/* ---------- botín de jefes ---------- */
function lootRows(L){ const r=[]; if(L.scrap) r.push(`<div><span>Chatarra</span><b>+${fmt(L.scrap)}</b></div>`); if(L.wood) r.push(`<div><span>${rw(ICON.wood,'Cofre de madera')}</span><b>+${L.wood}</b></div>`);
  for(const m in L.mats) if(L.mats[m]) r.push(`<div><span>${CFG.modes[m].mat}</span><b>+${L.mats[m]}</b></div>`); return r.join('') }
function lootModal(){ if(!S.loot) return; const n=S.loot.n; showModal(`<h3>Botín${n?` · ${n} jefe${n>1?'s':''}`:''}</h3><div class="loot">${lootRows(S.loot)}</div>
  <div class="ctrl"><button class="btn" data-act="close">Cerrar</button><button class="btn gold" data-act="lootClaim">Recoger</button></div>`) }

/* ---------- Modos: Campaña, Eventos (Mazmorra, Jefe semanal) y PvP ---------- */
const CH_N={wood:'madera',silver:'plata',mode:'modo'};
const RAR_S={C:'Com',U:'PCom',R:'Rara',E:'Épi',L:'Leg',M:'Mít'}; // abreviaturas para tablas estrechas
function evRewText(r){ return [r.em?`${r.em} ${CFG.event.mat.toLowerCase()}${r.em>1?'s':''}`:'', r.ch?rw(ICON[r.ch],'×'+(r.n||1)):''].filter(Boolean).join(' + ') }
const evRewPlain=r=>[r.em?`${r.em} ${CFG.event.mat.toLowerCase()}${r.em>1?'s':''}`:'', r.ch?`${r.n||1} cofre${(r.n||1)>1?'s':''} de ${CH_N[r.ch]}`:''].filter(Boolean).join(' + ');
// Ranking: los 10 primeros y tu puesto con sus vecinos
function rankHTML(riv,mine,pos,show){
  const list=riv.map(x=>({...x})); if(mine) list.splice(pos-1,0,{name:S.name||'Tú',score:mine,me:true});
  const idx=new Set([...Array(10).keys()]); if(mine) for(let i=pos-3;i<=pos+1;i++) if(i>=0&&i<list.length) idx.add(i);
  let rows='', prev=-1; [...idx].sort((a,b)=>a-b).forEach(i=>{ if(i>prev+1) rows+='<div class="gap">···</div>'; const x=list[i];
    rows+=`<div class="${x.me?'me':''}"><span>${i+1}</span><span>${esc(x.name)}</span><b>${show(x.score)}</b></div>`; prev=i; });
  return `<div class="rank">${rows}</div>`;
}
const pendText=p=>p.rew?evRewText(p.rew):'Sin premio';
const usdTxt=t=>'≈ '+(t/CFG.tokens.perUsd).toLocaleString('es-ES',{maximumFractionDigits:2})+' $';
const rewTable=list=>`<div class="rank evrew">${list.map((r,i)=>{ const from=i?list[i-1].to+1:1; return `<div><b>${from===r.to?r.to:from+'–'+r.to}</b><span>${evRewText(r)}</span></div>` }).join('')}</div>`;
const dhm=ms=>{ const m=Math.max(0,Math.floor(ms/60000)), d=Math.floor(m/1440), h=Math.floor(m%1440/60); return d?`${d} d ${h} h`:h?`${h} h ${m%60} min`:`${m%60} min` };
const pauseBox=()=>`<div class="misTop"><b>Pausa · reparto de premios</b><span class="s">Vuelve en <span id="evPause">${mmss(G.evPauseLeft())}</span>. Los intentos empezados antes pueden terminar.</span></div>`;
// Pestaña Modos: tarjetas grandes (Campaña, Eventos, PvP); en Eventos, al tocar uno se abre
/* ---------- Torre (roguelike) ---------- */
const NODE={fight:['⚔️','Combate','Enemigos normales · elige 1 mejora'],elite:['💀','Élite','Pocos y muy duros · elige 2 grimorios (pasivas de camino)'],treasure:['🎁','Cofre','Sin luchar · elige 1 objeto'],rest:['🔥','Hoguera','Te curas del todo y pasas al siguiente piso sin luchar'],boss:['👑','Jefe','Jefe del piso · elige 1 mejora']};
const RARC={C:'var(--rC)',R:'var(--rR)',L:'var(--rL)'};
function boonCard(b,i){ const f=G.boonInfo(b), c=RARC[f.r]; return `<button class="mcard bcard" data-act="towerPick" data-k="${i}" style="border-color:${c}"><div class="ctrl" style="justify-content:space-between"><b style="color:${c}">${f.name}</b><span class="pill" style="color:${c}">${f.kind}${f.r==='L'&&!f.kind.includes('Legendaria')?' · legendaria':''}</span></div><span class="s">${f.desc}</span></button>` }
function tabTower(){ const T=G.towerState(), run=T.run, TC=CFG.tower, nxt=(()=>{ for(let f=T.best+1;;f++) for(const r of TC.rewards) if(f%r.every===0) return {f,b:r.b} })();
  let body='';
  if(!run) body=`<p class="hint">Entras con tu héroe. La vida no se recupera entre combates (solo en los descansos). En cada piso eliges camino; al ganar eliges una mejora (pasiva, objeto o hechizo de cualquier clase) que se suma a lo tuyo durante la partida. ${TC.lives} vidas: si pierdes un combate repites el piso.</p>
      <button class="btn gold" data-act="towerStart">Empezar partida</button>`;
  else if(run.lives<=0) body=`<p class="hint">Te quedaste sin vidas en el piso ${run.floor}.</p><div class="ctrl"><button class="btn gold" data-act="towerLife" ${G.tokens()>=TC.lifeCost?'':'disabled'}>+1 vida · ${TC.lifeCost} tokens</button><button class="btn" data-act="towerQuit">Terminar partida</button></div>`;
  else if(run.pick) body=`<p class="hint">Elige una mejora:</p><div class="mlist">${run.pick.map(boonCard).join('')||'<p class="hint">No quedan mejoras nuevas.</p>'}</div>${run.pick.length?'':'<button class="btn gold" data-act="towerPick" data-k="0">Seguir</button>'}`;
  else body=`<p class="hint">${run.nodes.every(k=>k==='elite'||k==='fight')&&run.floor>=CFG.tower.hard.forcedFrom&&run.floor%CFG.tower.boss.every?'<b style="color:var(--bad)">¡Sin escapatoria!</b> Solo quedan combates. ':''}${run.floor>=CFG.tower.hard.eliteFrom?'Los élites están reforzados. ':''}Elige camino:</p><div class="mlist">${run.nodes.map((k,i)=>{ const N=NODE[k]; return `<button class="mcard mbig" data-act="towerGo" data-k="${i}"><div class="ctrl" style="justify-content:space-between"><b>${N[0]} ${N[1]}</b></div><span class="s">${N[2]}</span></button>` }).join('')}</div>`;
  const boons=run&&run.boons.length?`<div class="tchips">${Object.values(run.boons.reduce((o,b)=>{ const f=G.boonInfo(b), k=f.name; (o[k]=o[k]||{f,n:0}).n++; return o },{})).map(({f,n})=>`<span class="pill" title="${esc(f.desc)}" style="color:${RARC[f.r]}">${f.name}${n>1?' ×'+n:''}</span>`).join('')}</div>`:'';
  return `<section class="panel"><h3>Torre</h3><div class="evhead"><div><span class="s">Piso</span><b>${run?run.floor:'–'}</b></div><div><span class="s">Vidas</span><b>${run?'♥'.repeat(Math.max(0,run.lives))||'0':'–'}</b></div><div><span class="s">Salud</span><b>${run?Math.round((run.hp==null?1:run.hp)*100)+' %':'–'}</b></div><div><span class="s">Récord</span><b>${T.best}</b></div></div>
    ${body}${boons}${run&&run.lives>0&&!G.inEvent()?'<button class="btn sm" data-act="towerQuit">Abandonar partida</button>':''}
    <p class="hint">Premios (la 1.ª vez que llegas): cofre de madera cada 5 pisos, de plata cada 25 y de modo cada 50. Siguiente: piso ${nxt.f} · ${bundleHTML(nxt.b)}</p></section>` }
/* ---------- PvP: contra el fantasma de otro jugador (su partida al 100 %) · Elo ---------- */
// Dentro de Telegram el servidor elige el rival (jugadores reales con puntos parecidos; si no hay, bot) y guarda los puntos.
// Fuera de Telegram: bots (tu partida con otra clase) y puntos solo en el móvil.
const pvpOnline=()=>!!(window.Telemetry&&Telemetry.canSync&&Telemetry.canSync(CFG));
let PVI=null, pvpBusy=false;
function pvpLoad(){ if(!pvpOnline()) return; Telemetry.pvp(CFG,'pvpInfo').then(j=>{ if(!j||!j.ok) return; PVI=j; G.pvpSync(j.me); if(tab==='ev'&&modView==='pvp') renderTab(); }) }
// insignia de liga según los puntos
const badge=pts=>{ const L=G.pvpLeague(pts); return `<span class="pill" style="color:${L.color};border-color:${L.color}">${L.name}</span>` };
const clName=c=>CFG.classes[c]?clsLabel(c):(c||'');   // nombre de la clase (con tilde); '' si el servidor no la sabe
function tabPvp(){ const P=G.pvpState(), on=pvpOnline();
  const head=`<div class="evhead"><div><span class="s">Puntos</span><b>${fmt(P.rating)}</b>${badge(P.rating)}</div><div><span class="s">Puesto</span><b>${on&&PVI?PVI.me.rank:'–'}</b></div><div><span class="s">Victorias</span><b>${P.wins}/${P.games}</b></div></div>
    <div class="evhead"><div><span class="s">Gratis hoy</span><b>${G.pvpFreeLeft()}/${CFG.pvp.free}</b></div><div><span class="s">Tickets PvP</span><b>${S.pvpTickets||0}</b></div></div>`;
  const busy=G.inEvent()||pvpBusy, can=G.pvpCanFight();
  const riv=`<div class="ctrl"><button class="btn gold" style="flex:1" data-act="pvpGo" ${busy||!can?'disabled':''}>${pvpBusy?'Buscando rival…':G.pvpFreeLeft()?'Luchar (gratis)':can?'Luchar (1 ticket)':'Sin combates'}</button>
    ${tokOpen()?`<button class="btn" data-act="buyAsk" data-k="pvp">+${CFG.pvp.pack} tickets · ${CFG.pvp.packCost} tok</button>`:''}</div>
    ${can?'':`<p class="hint">Ya usaste tus ${CFG.pvp.free} combates gratis de hoy. ${tokOpen()?'Compra tickets PvP para seguir.':'Vuelve mañana.'}</p>`}`;
  const top=on?(PVI?`<h3>Ranking</h3><div class="rank">${PVI.top.map((x,i)=>`<div class="${x.me?'me':''}"><span>${i+1}</span><span>${esc(x.name)}${x.cls?' · '+clName(x.cls):''} ${badge(x.rating)}</span><b>${fmt(x.rating)}</b></div>`).join('')||'<div><span></span><span>Aún nadie</span><b></b></div>'}</div>`:'<p class="hint">Cargando ranking…</p>'):'<p class="hint">El ranking y los rivales reales están dentro de Telegram. Aquí luchas contra bots.</p>';
  const defs=on&&PVI&&PVI.log.length?`<h3>Te han atacado</h3><div class="rank">${PVI.log.map(x=>`<div><span style="color:${x.won?'var(--bad)':'var(--good)'}">${x.won?'✗':'✓'}</span><span>${esc(x.name)}${x.cls?' · '+clName(x.cls):''} ${x.won?'ganó a tu fantasma':'perdió contra tu fantasma'}</span><b>${x.d>0?'+':''}${x.d}</b></div>`).join('')}</div>`:'';
  const hist=P.hist.length?`<h3>Tus combates</h3><div class="rank">${P.hist.map(x=>`<div><span style="color:${x.win?'var(--good)':'var(--bad)'}">${x.win?'V':'D'}</span><span>${esc(x.name)}${x.bot?' (bot)':''} · ${clName(x.cls)}</span><b>${x.d>0?'+':''}${x.d}</b></div>`).join('')}</div>`:'';
  return `<section class="panel"><h3>PvP</h3>${head}${riv}
    <p class="hint">${CFG.pvp.free} combates gratis al día; después, 1 ticket PvP por combate (${CFG.pvp.pack} tickets por ${usd(CFG.pvp.packCost)}). Te toca el jugador más cercano a ti en puntos (no repites rival hasta pasados ${CFG.pvp.recent} duelos). Luchas contra su fantasma: su héroe con todo lo suyo (arma, mejoras, evolución, grimorio y habilidades) manejado por la IA. Tu fantasma también defiende cuando no estás. Máx. ${CFG.pvp.maxT} s; si nadie cae, gana quien tenga más % de vida.</p>
    ${top}${defs}${hist}</section>
  <details class="panel fold"><summary><h3>Premios de la semana</h3></summary>${rewTable(CFG.pvp.rewards)}<p class="hint">Cada lunes (00:00 UTC) se premia según tu puesto entre los que lucharon esa semana, y los puntos quedan a medio camino de 1000 (1400 → 1200). Cierra en ${dhm(G.weekLeft())}.${on?'':' Solo dentro de Telegram.'}</p></details>
  <p class="hint">Ligas: ${CFG.pvp.leagues.map(([p,n,c])=>`<b style="color:${c}">${n}</b> ${p?'desde '+p:''}`).join(' · ')}</p>` }
function tabEv(){
  if(evView==='lab') return tabLab();
  if(evView==='boss') return tabBoss();
  if(evView==='league') return tabLeague();
  const paused=G.evPaused(), lp=G.evPending(), bp=G.wbPending();
  const lb=G.evToday(), lpos=lb?G.evRank(G.evShownDay(),lb):null, bd=G.wbWeekDmg(), bpos=bd?G.wbRank(G.wbShownWeek(),bd):null;
  const card=(k,title,sub,tk,line,pend)=>`<button class="evcard" data-act="evOpen" data-k="${k}"><span class="evt">${title}${pend?' <sup class="nb">!</sup>':''}</span><span class="s">${sub}</span>
    <span class="evl"><span>${tk}</span><span>${line}</span></span></button>`;
  // Campaña (Normal, Pesadilla, Infierno), Eventos (Mazmorra, Jefe semanal; la Liga está oculta) y PvP (próximamente)
  const back=`<button class="back" data-act="modview" data-v="">← Modos</button>`;
  if(!modView){ const pend=(G.evPending()?1:0)+(G.wbPending()?1:0)+(CFG.league.show&&G.leaguePending()?1:0), M=G.modeCfg();
    const big=(v,t,sub,st,lock)=>`<button class="mcard mbig${lock?' lock':''}" data-act="modview" data-v="${v}"><div class="ctrl" style="justify-content:space-between"><b class="cat">${IC(ICONS[v],22)}${t}</b>${st}</div><span class="s">${sub}</span></button>`;
    return `<section class="panel"><h3>Modos</h3><div class="mlist">
      ${big('campana','Campaña','Normal · Pesadilla · Infierno',`<span class="pill" style="color:var(--gold)">${M.name} · fase ${S.best}/${CFG.phaseCap}</span>`)}
      ${big('eventos','Eventos','Mazmorra · Jefe semanal',pend?`<span class="pill" style="color:var(--gold)">${pend} premio${pend>1?'s':''}</span>`:`<span class="pill">${G.evFreeLeft()+G.wbFreeLeft()} gratis</span>`)}
      ${big('torre','Torre','Roguelike: elige caminos y combina mejoras de todas las clases',(r=>r?`<span class="pill" style="color:var(--gold)">Piso ${r.floor} · ♥ ${r.lives}</span>`:`<span class="pill">Récord ${G.towerState().best}</span>`)(G.towerState().run))}
      ${big('pvp','PvP','Lucha contra el fantasma de otros jugadores · Elo',`<span class="pill">${fmt(G.pvpState().rating)} puntos · ${G.pvpFreeLeft()} gratis</span>`)}
    </div></section>` }
  if(modView==='campana') return `${back}<section class="panel"><h3>Campaña</h3><div class="mlist">${modeRows()}</div><p class="hint">Cada modo tiene ${CFG.phaseCap} fases; al pasar al siguiente vuelves a la fase 1 con enemigos mucho más fuertes.</p></section>`;
  if(modView==='torre') return back+tabTower();
  if(modView==='pvp') return back+tabPvp();
  return `${back}<section class="panel"><h3>Eventos</h3>
    ${card('lab','Mazmorra','Hasta 5 min de monstruos, cada vez más y más rápidos · ranking diario por muertes',`Entradas <b>${G.evFreeLeft()+S.tickets}</b>`,paused?'En pausa':lb?`Hoy ${lb} · puesto ${lpos}`:'Aún no has jugado hoy',!!lp)}
    ${CFG.league&&CFG.league.show?(n=>card('league','Liga de '+n.name,'Bote mensual repartido según tus puntos',`Puntos <b>${fmt(n.pts)}</b>`,`Premio estimado ${fmt(n.tok)} tokens`,!!G.leaguePending()))(G.leagueNow()):''}
    ${card('boss','Jefe semanal','1 min contra un jefe inmortal · ranking semanal por daño',`Entradas <b>${G.wbFreeLeft()+S.bossTickets}</b>`,paused?'En pausa':bd?`Semana ${fmt(bd)} · puesto ${bpos}`:`Cierra en ${dhm(G.weekLeft())}`,!!bp)}
  </section>`;
}
function tabLab(){
  const V=CFG.event, paused=G.evPaused(), d=G.evShownDay(), best=G.evToday(), pend=G.evPending(), live=G.inEvent();
  const pos=best?G.evRank(d,best):null;
  return `<button class="back" data-act="evBack">← Eventos</button>
  <section class="panel"><h3>Mazmorra</h3>
    ${pend?`<div class="misTop"><div class="ctrl" style="justify-content:space-between"><b>Premio de ayer · puesto ${pend.pos}</b><button class="btn sm gold" data-act="evClaim">Recoger</button></div><span class="s">${pendText(pend)}</span></div>`:''}
    ${paused?pauseBox():''}
    <div class="evhead"><div><span class="s">Entradas</span><b>${G.evFreeLeft()+S.tickets}</b></div><div><span class="s">${paused?'Total de ayer':'Total hoy'}</span><b>${best||'–'}</b></div><div><span class="s">Puesto</span><b>${pos||'–'}</b></div></div>
    <div class="ctrl"><button class="btn gold" style="flex:1" data-act="evGo" ${(S.tickets>0||G.evFreeLeft())&&!live&&!paused?'':'disabled'}>${live?'En curso…':paused?'En pausa':'Entrar'}</button>
    ${tokOpen()?`<button class="btn" data-act="buyAsk" data-k="ticket">+1 ticket · ${V.ticketCost} tok</button>`:''}</div>
    <p class="hint">Aguanta todo lo que puedas (máx. ${V.maxDur/60} min); cada ${V.ramp.every} s llegan más y más rápidos · suma las muertes de tus intentos del día</p>
    ${rankHTML(G.evRivals(d),best,pos,x=>x)}</section>
  <details class="panel fold"><summary><h3>Premios del día</h3></summary>${rewTable(V.rewards)}<p class="hint">Se reparten a las 01:00 UTC del día siguiente.</p></details>`;
}
// Liga mensual: puntos por gastar tokens, ver anuncios y generar oro; el bote se reparte entre todos según sus puntos
function tabLeague(){ const n=G.leagueNow(), p=G.leaguePending(), L=CFG.league;
  return `<button class="back" data-act="evBack">← Eventos</button>
  <section class="panel"><h3>Liga de ${n.name}</h3>
    ${p?`<div class="misTop"><div class="ctrl" style="justify-content:space-between"><b>Premio de ${p.name}</b><button class="btn sm gold" data-act="lgClaim">Recoger</button></div><span class="s">${fmt(p.tok)} tokens (${fmt(p.pts)} puntos)</span></div>`:''}
    <div class="evhead"><div><span class="s">Tus puntos</span><b>${fmt(n.pts)}</b></div><div><span class="s">Bote</span><b>${fmt(n.pool)}</b></div><div><span class="s">Premio estimado</span><b>${fmt(n.tok)}</b></div></div>
    <div class="loot"><div><span>Tokens gastados · ${L.ptsToken} pt</span><b>${fmt(n.spent*L.ptsToken)}</b></div><div><span>Anuncios vistos · ${L.ptsAd} pt</span><b>${fmt(n.ads*L.ptsAd)}</b></div><div><span>Horas de oro generado · ${L.ptsGoldHour.toLocaleString('es-ES')} pt</span><b>${fmt(n.goldH*L.ptsGoldHour)}</b></div></div>
    <p class="hint">El bote es el ${Math.round(L.share*100)} % de todo lo que gastan los jugadores en el mes (${usdTxt(n.pool)}). El día 1 a las 01:00 UTC se reparte entre todos según sus puntos, en tokens ganados (se pueden retirar). Tienes el ${(n.share*100).toLocaleString('es-ES',{maximumFractionDigits:2})} % de los puntos. Quedan ${n.daysLeft} días. (Prueba: sin dinero real.)</p>
  </section>` }
function tabBoss(){
  const W=CFG.wboss, paused=G.evPaused(), w=G.wbShownWeek(), dmg=G.wbWeekDmg(), pend=G.wbPending(), live=G.inEvent();
  const pos=dmg?G.wbRank(w,dmg):null;
  return `<button class="back" data-act="evBack">← Eventos</button>
  <section class="panel"><h3>Jefe semanal</h3>
    ${pend?`<div class="misTop"><div class="ctrl" style="justify-content:space-between"><b>Premio de la semana pasada · puesto ${pend.pos}</b><button class="btn sm gold" data-act="wbClaim">Recoger</button></div><span class="s">${pendText(pend)}</span></div>`:''}
    ${paused?pauseBox():''}
    <div class="evhead"><div><span class="s">Entradas</span><b>${G.wbFreeLeft()+S.bossTickets}</b></div><div><span class="s">Daño semana</span><b>${dmg?fmt(dmg):'–'}</b></div><div><span class="s">Puesto</span><b>${pos||'–'}</b></div></div>
    <div class="ctrl"><button class="btn gold" style="flex:1" data-act="wbGo" ${(S.bossTickets>0||G.wbFreeLeft())&&!live&&!paused?'':'disabled'}>${live?'En curso…':paused?'En pausa':'Luchar'}</button>
    ${tokOpen()?`<button class="btn" data-act="buyAsk" data-k="bossTicket">+1 ticket · ${W.ticketCost} tok</button>`:''}</div>
    <p class="hint">${W.dur} s contra el jefe · suma tu daño de la semana · cierra en ${dhm(G.weekLeft())}</p>
    ${rankHTML(G.wbRivals(w),dmg,pos,x=>fmt(x))}</section>
  <details class="panel fold"><summary><h3>Premios de la semana</h3></summary>${rewTable(W.rewards)}<p class="hint">Se reparten el lunes a las 01:00 UTC.</p></details>`;
}

/* ---------- potenciadores por anuncios ---------- */
const mmss=ms=>{const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};
let boostModalOpen=false, adTimer=null;
/* ---------- misiones, calendario y pase ---------- */
let misView='dia', misKey='';
// avisos del bot: Telegram pide permiso al jugador (requestWriteAccess) y el servidor lo apunta
const canNotify=()=>!!(TG&&TG.requestWriteAccess&&window.Telemetry&&Telemetry.canPay(CFG));
function askNotify(){ if(!canNotify()) return; S.opt=S.opt||{}; S.opt.askW=1;
  try{ TG.requestWriteAccess(ok=>{ S.opt.notify=!!ok; G.save(); Telemetry.setCanWrite(CFG,!!ok); toast(ok?'Avisos activados':'Sin avisos'); if(tab==='dev') renderTab(); }) }catch(e){} }
function notifyOffer(){ if(!canNotify()||(S.opt&&S.opt.askW)) return; S.opt=S.opt||{}; S.opt.askW=1; G.save();
  later(()=>showModal(`<h3>¿Te avisamos?</h3><p class="hint">El bot te escribe cuando tu héroe llena el tiempo sin conexión, para que no pierdas oro.</p>
    <div class="ctrl"><button class="btn" data-act="close">No, gracias</button><button class="btn gold" data-act="notifyYes">Sí, avísame</button></div>`)) }
// premios: en texto (avisos) y con iconos (pantallas)
const RN={silver:'cofre de plata',wood:'cofre de madera',mode:'cofre de modo',ess:'esencia',ev:'emblema',ticket:'ticket Mazmorra',bossTicket:'ticket Jefe'};
const bundleTxt=b=>Object.entries(b).map(([k,v])=>k==='gold'?`oro de ${v} min`:k==='tok'?`${v} tokens`:k==='item'?`arma ${CFG.rarName[v]}`:RN[k]+(v>1?' ×'+v:'')).join(' + ');
const rw=(ic,t)=>`<span class="rw">${ic}${t}</span>`;
const bundleHTML=b=>Object.entries(b).map(([k,v])=>k==='gold'?rw(ICON.gold,v+' min'):k==='tok'?rw(ICON.tok,v):ICON[k]?rw(ICON[k],'×'+v)
  :k==='item'?`<span class="rw" style="color:var(--r${v})">Arma ${CFG.rarName[v]}</span>`:`<span class="rw">${RN[k]}${v>1?' ×'+v:''}</span>`).join(' ');
// Pestaña Misiones: Diarias · Semanal · Pase · Socios (el calendario va aparte, en su icono del combate)
// solo cambia con lo que se ve en la sección abierta (así el Pase no se redibuja —ni pierde el scroll— con cada enemigo)
function misKeyNow(){ const P=G.passState(), badge=[G.missionsReady(),G.weeklyReady(),G.passReady()];
  const v=misView==='dia'?[G.bonusState('day'),G.missions().map(m=>[m.prog,m.claimed])]:misView==='sem'?[G.bonusState('week'),G.weekMissions().map(m=>[m.prog,m.claimed])]
    :misView==='pass'?[P.lvl,P.prem,Object.keys(P.cf).length,Object.keys(P.cp).length,P.xp]:[window.Telemetry&&Telemetry.refs];
  return misView+JSON.stringify([badge,v]) }
const misRows=(L,act,M)=>L.map(m=>`<div class="mrow${m.claimed?' done':''}"><div class="mi"><b>${m.t}</b><div class="rbar"><i style="width:${m.prog/m.n*100}%;background:var(--${m.done?'good':'gold'})"></i></div><span class="s">${fmt(m.prog)}/${fmt(m.n)} · ${bundleHTML(m.rew||{})} ${m.xp||M.xp} XP del pase</span></div>
      ${m.claimed?'<span class="rmax">✓</span>':`<button class="btn sm gold" data-act="${act}" data-k="${m.k}" ${m.done?'':'disabled'}>Recoger</button>`}</div>`).join('');
function tabMis(){ const P=G.passState();
  const chips=`<div class="fchips">${[['dia','Diarias',G.missionsReady()],['sem','Semanal',G.weeklyReady()],['pass','Pase',G.passReady()],['soc','Socios',0]].map(([v,l,n])=>`<button data-act="misView" data-v="${v}" aria-pressed="${misView===v}">${l}${n?` <sup class="nb" style="position:static">${n}</sup>`:''}</button>`).join('')}</div>`;
  let body='';
  const bonusRow=(kind,t)=>{ const st=G.bonusState(kind); return `<div class="mrow bonus${st.got?' done':''}"><div class="mi"><b>${t}</b><span class="s">${bundleHTML(st.b)}</span></div>
      ${st.got?'<span class="rmax">✓</span>':`<button class="btn sm gold" data-act="misBonus" data-k="${kind}" ${st.can?'':'disabled'}>Recoger</button>`}</div>` };
  if(misView==='dia') body=bonusRow('day','Bonus: completa todas las diarias')+misRows(G.missions(),'misClaim',CFG.missions)+'<p class="hint">Se renuevan cada día.</p>';
  if(misView==='sem') body=bonusRow('week','Bonus: completa todas las semanales')+misRows(G.weekMissions(),'weekClaim',CFG.missions.weekly)+`<p class="hint">Se renuevan cada lunes · quedan ${dhm(G.weekLeft())}.</p>`;
  if(misView==='pass'){ const L=CFG.pass.levels, rows=[]; for(let l=1;l<=L;l++){ const open=l<=P.lvl;
      const cell=(prem)=>{ const got=prem?P.cp[l]:P.cf[l], lock=prem&&!P.prem; return `<div class="pc${got?' got':''}${open&&!got&&!lock?' can':''}${lock?' lock':''}">${bundleHTML(G.passReward(l,prem))}${got?' ✓':''}</div>` };
      rows.push(`<div class="prow${open?' open':''}"><span class="pl">${l}</span>${cell(false)}${cell(true)}</div>`) }
    body=`<div class="ctrl" style="justify-content:space-between"><b>Nivel ${P.lvl}/${L}</b><span class="s">Quedan ${P.daysLeft} días</span></div>
      <div class="rbar"><i style="width:${P.lvl>=L?100:P.into/P.need*100}%;background:var(--gold)"></i></div><span class="s">${P.lvl>=L?'¡Pase completo!':P.into+'/'+P.need+' XP · las misiones dan XP'}</span>
      ${P.prem?'':`<div class="chest offer"><div><div class="cn">Pase de pago</div><div class="s">Desbloquea la columna dorada de esta temporada</div></div><div class="acts">${payBtn('pass',CFG.stars.pass.stars,'data-act="devPass"')}</div></div>`}
      <button class="btn gold" data-act="passAll" ${G.passReady()?'':'disabled'}>Reclamar todo (${G.passReady()})</button>
      <div class="prow ph"><span class="pl">Nv</span><div class="pc">Gratis</div><div class="pc">De pago</div></div>
      <div class="plist">${rows.join('')}</div>`; }
  if(misView==='soc'){ const R=CFG.referral, inv=inviteRow();
    body=`<p class="hint">Invita a tus amigos: tu amigo recibe ${R.giftSilver} cofre de plata y tú ${R.goalSilver} cofres cuando llegue a la fase ${R.goalFase}.</p>${inv||'<p class="hint">Para invitar, abre el juego desde Telegram.</p>'}`; }
  return `<section class="panel"><h3>Misiones</h3>${chips}<div id="misBox" class="mlist">${body}</div></section>` }
const misBadge=()=>G.missionsReady()+G.weeklyReady()+G.passReady();
// Ruleta diaria: tirada gratis + tirada con anuncio; resalta el premio que toca
function wheelModal(hit){ const W=G.wheelState(), tot=W.list.reduce((a,x)=>a+x.w,0);
  showModal(`<h3>Ruleta diaria</h3><div class="wheelg">${W.list.map((x,i)=>`<div class="wcell${hit===i?' hit':''}"><b>${bundleHTML(x.b)}</b><span class="s">${Math.round(x.w/tot*100)} %</span></div>`).join('')}</div>
    <div class="ctrl"><button class="btn gold" data-act="wheelSpin" ${W.free?'':'disabled'}>${W.free?'Girar gratis':'Gratis: mañana'}</button><button class="btn" data-act="wheelAd" ${W.ad?'':'disabled'}>${W.ad?'Girar con anuncio':'Anuncio: mañana'}</button></div>
    <p class="hint">Una tirada gratis al día y otra viendo un anuncio.</p><button class="btn" data-act="close">Cerrar</button>`) }
function wheelGo(viaAd){ const r=G.spinWheel(viaAd); if(!r) return; const L=G.wheelState().list.length; let i=0, n=L*2+r.i;
  if(!$('#modal .wcell')) wheelModal();   // (tras el anuncio se vuelve a abrir la ruleta)
  if(reduceMotion()){ wheelModal(r.i); toast('Ruleta: '+bundleTxt(r.b)); return }
  const tick=()=>{ document.querySelectorAll('#modal .wcell').forEach((c,j)=>c.classList.toggle('hit',j===i%L)); if(i++<n) setTimeout(tick,40+i*6); else { haptic('ok'); wheelModal(r.i); toast('Ruleta: '+bundleTxt(r.b)); updateHUD(); } };
  document.querySelectorAll('#modal .ctrl button').forEach(b=>b.disabled=true); tick(); }
// Calendario: icono en el combate; ventana con los 7 días
function calModal(){ const C=G.calState();
  showModal(`<h3>Calendario</h3><div class="calg">${C.list.map((b,i)=>{ const d=i+1, got=d<C.day||(d===C.day&&!C.can), now=d===C.day&&C.can;
      return `<div class="cald${got?' got':''}${now?' now':''}"><span class="s">Día ${d}</span><b>${bundleHTML(b)}</b>${got?'<span class="rmax">✓</span>':''}</div>` }).join('')}</div>
    <button class="btn gold" data-act="calClaim" ${C.can?'':'disabled'}>${C.can?'Recoger día '+C.day:'Vuelve mañana'}</button><p class="hint">Un premio por cada día que entras (no hace falta seguidos).</p><button class="btn" data-act="close">Cerrar</button>`) }
const adTimerOn=()=>adTimer!==null;
function boostModal(){
  boostModalOpen=true;
  const B=CFG.boosts, a=G.adsState(), row=(k,t,sub)=>{const left=G.boostUsesLeft(k);
    return `<div class="row"><div><div class="t">${t}</div><div class="s" id="bs_${k}">${sub}</div></div>
      <div class="acts"><button class="btn sm gold" data-act="adWatch" data-k="${k}" ${left>0?'':'disabled'}>Ver anuncio (${a.p[k]||0}/${B[k].ads})</button></div></div>`};
  showModal(`<h3>Potenciadores</h3>
    ${row('speed',`Velocidad ×${B.speed.mult} · ${B.speed.min} min`,boostSub('speed'))}
    ${row('gold',`+${fmt(G.goldBoostValue())} oro`,boostSub('gold'))}
    <button class="btn" data-act="boostClose">Cerrar</button>`);
}
function boostSub(k){
  const left=G.boostUsesLeft(k), bl=G.boostLeft();
  if(k==='speed') return `Quedan ${left} hoy${bl?` · activo ${mmss(bl)}`:''}`;
  return `Oro de ${G.goldBoostHours()>=1?G.goldBoostHours()+' h':G.goldBoostHours()*60+' min'} al instante · quedan ${left} hoy`;
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
  const row=costRow;
  return `<div class="loot">${c.ess?row(CFG.modes[c.essMode].mat,S.mats[c.essMode]||0,c.ess):''}${c.gold?row('Oro',S.gold,c.gold):''}${c.tokens?row('Tokens',G.tokens(),c.tokens):''}${c.ev?row(CFG.event.mat+'s',S.evm||0,c.ev):''}</div>
  ${S.loot?'<p class="hint">Tienes botín de jefes sin recoger.</p>':''}${G.canEvolve()?'':`<p class="hint">Los jefes de ${CFG.modes[c.essMode].name} sueltan esencias (más cuanto más alta la fase). Los ${CFG.event.mat.toLowerCase()}s se ganan en Modos → Eventos.</p>`}` }
function evoModal(){
  if(S.evo===0){ const P=G.evoPaths(), ok=G.canEvolve();
    return showModal(`<h3>Evolución: elige camino</h3>
    ${G.evoKeyOk()?'':`<p class="hint">Necesitas el ${G.grimName()} en el nivel ${CFG.grimoire.levels}.</p>`}
    ${pathCard('A',P.A)}<button class="btn gold" data-act="evoGo" data-k="A" ${ok?'':'disabled'}>Ser ${P.A.name}</button>
    ${pathCard('B',P.B)}<button class="btn gold" data-act="evoGo" data-k="B" ${ok?'':'disabled'}>Ser ${P.B.name}</button>
    ${evoCostHtml()}<p class="hint">Podrás cambiar de camino más adelante por ${CFG.grimoire.switchCost} tokens.</p>
    <button class="btn" data-act="close">Ahora no</button>`) }
  const E=G.nextEvo().classes[S.cls];
  showModal(`<h3>Evolución</h3>
    <div class="win-card" style="--rc:var(--gold)"><span class="s">${heroName()} →</span><b>${E.name}</b><span class="s">${E.passive}</span></div>
    ${evoCostHtml()}
    <p class="hint">Sigues en nivel ${S.lvl}; ${CFG.evo.tiers[S.evo+1]?'el tope de nivel pasa a '+CFG.evo.tiers[S.evo+1].lvl:'el nivel deja de tener tope'}.</p>
    <div class="ctrl"><button class="btn" data-act="close">Ahora no</button><button class="btn gold" data-act="evoGo" ${G.canEvolve()?'':'disabled'}>Evolucionar</button></div>`);
}

/* ---------- combates abandonados (se cerró la app a mitad) ---------- */
function quitModal(q){ const p=q.pvp, t=q.tower;
  if(p&&p.rival.match&&pvpOnline()) Telemetry.pvp(CFG,'pvpResult',{match:p.rival.match,win:false}).then(j=>{ if(j&&j.ok) G.pvpSync(j) });
  showModal(`<h3>Combate abandonado</h3>${t?`<p class="hint">Torre, piso ${t.floor}: cerraste el juego a mitad del combate y cuenta como derrota. ${t.lives>0?`Te quedan ${t.lives} vida${t.lives>1?'s':''}.`:'Te quedaste sin vidas.'}</p>`:''}
    ${p?`<p class="hint">PvP contra ${esc(p.rival.name)}: cerraste el juego a mitad del duelo y cuenta como derrota (${p.d} puntos).</p>`:''}<button class="btn gold" data-act="close">Vale</button>`) }
/* ---------- farmeo sin conexión ---------- */
function offlineModal(off){
  const h=Math.floor(off.secs/3600), mi=Math.round((off.secs%3600)/60);
  showModal(`<h3>Mientras no estabas</h3><p class="hint">Fase ${off.fase} · ${h?h+' h ':''}${mi?mi+' min':''}${off.capped?' · máximo':''}</p>
    <div class="loot"><div><span>Oro</span><b>+${fmt(off.gold)}</b></div>${off.lvlTo>off.lvlFrom?`<div><span>Nivel</span><b>${off.lvlFrom} → ${off.lvlTo}</b></div>`:''}</div>
    <div class="ctrl"><button class="btn${off.capped?'':' gold'}" data-act="close">Recoger</button>
    ${off.bonus?`<button class="btn gold" data-act="offAd">×${CFG.offlineAdMult.toLocaleString('es-ES')} con anuncio (+${fmt(off.bonus)})</button>`:''}</div>`);
}

/* ---------- ruleta al abrir cofres ---------- */
function tileHTML(x){return `<div class="tile" style="--rc:var(--r${x.r})"><span class="tr" style="color:var(--r${x.r})">${CFG.rarName[x.r]}</span><span class="tn">${wName(x)}</span></div>`}
const CHEST_COL={wood:['#8a5a34','#5e3a1f'],silver:['#b9c0cc','#6f7787'],mode:['#c86bff','#6a2aa8']};
// Las casillas de relleno son solo decoración: usan Math.random para no gastar el azar del motor.
function fakePick(probs){const tot=probs.reduce((a,b)=>a+b,0);let x=Math.random()*tot;for(let i=0;i<probs.length;i++){x-=probs[i];if(x<0)return R[i]}return R[0]}
function spin(type,loot,nc=1){
  const best=[...loot].sort((a,b)=>R.indexOf(b.r)-R.indexOf(a.r)||((a.cls===S.cls)?-1:1))[0];
  const probs=G.chestProbs(type), idx=42, tiles=[];
  for(let i=0;i<52;i++) tiles.push(i===idx?best:{r:fakePick(probs),cls:S.cls});   // (los cofres solo dan armas de tu clase)
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
  if(R.indexOf(best.r)>=R.indexOf('E')&&!reduceMotion()) haptic('ok');
  out.innerHTML=`<div class="win-card${R.indexOf(best.r)>=R.indexOf('E')?' big':''}" style="--rc:var(--r${best.r})"><span class="rar" style="color:var(--r${best.r})">${CFG.rarName[best.r]}</span><b>${wName(best)}</b>${best.autoEq?'<span class="s">equipada</span>':''}</div>
    ${loot.length>1?lootHTML(loot):''}
    <button class="btn gold" data-act="close">Continuar</button>`;
}

/* ---------- Ajustes ---------- */
function tabDev(){
  const on=battery();
  return `<section class="panel"><h3>Ajustes</h3><div class="row"><div><div class="t">Nombre</div><div class="s">${esc(S.name||'—')}</div></div></div><div class="row"><div><div class="t">Habilidades automáticas</div><div class="s">En la campaña se lanzan solas; también con el botón Auto/Manual del combate (los eventos tienen el suyo)</div></div><div class="acts"><button class="btn sm${S.opt&&S.opt.autoSkills===false?'':' on'}" data-act="autoSkills">${S.opt&&S.opt.autoSkills===false?'Desactivadas':'Activadas'}</button></div></div>${canNotify()?`<div class="row"><div><div class="t">Avisos del bot</div><div class="s">Te escribe cuando tu héroe llena el tiempo sin conexión</div></div><div class="acts"><button class="btn sm${S.opt&&S.opt.notify?' on':''}" data-act="notifyAsk">${S.opt&&S.opt.notify?'Activados':'Activar'}</button></div></div>`:''}<div class="row"><div><div class="t">Modo batería</div><div class="s">Sin barras de vida, números, proyectiles ni parpadeo</div></div><div class="acts"><button class="btn sm${on?' gold':''}" data-act="battery" aria-pressed="${on}">${on?'Activado':'Desactivado'}</button></div></div>
  </section>
  ${CFG.devTools?`<section class="panel"><h3>Ajustes de prueba</h3>
  <div class="ctrl">Velocidad: ${[1,2,5,20].map(v=>`<button class="btn sm ${S.speed===v?'gold':''}" data-act="speed" data-v="${v}">×${v}</button>`).join('')}</div>
  <div class="ctrl"><button class="btn sm" data-act="dev" data-k="gold">+ oro (1 h)</button><button class="btn sm" data-act="dev" data-k="tok">+100 tokens</button><button class="btn sm" data-act="dev" data-k="scrap">+100 chatarra</button><button class="btn sm" data-act="dev" data-k="wood">+10 cofres de madera</button><button class="btn sm" data-act="dev" data-k="day">Avanzar 1 día</button><button class="btn sm" data-act="dev" data-k="ticket">+1 ticket</button></div>
  </section>`:''}
`;
}
// Invitar amigos: solo dentro de Telegram (hace falta el id del jugador y el enlace de la mini app)
function inviteRow(){ const T=window.Telemetry, link=T&&T.inviteLink(CFG), R=CFG.referral; if(!link) return '';
  return `<div class="row"><div><div class="t">Invitar amigos${T.refs!=null?` · ${T.refs}`:''}</div><div class="s">Tu amigo recibe ${R.giftSilver} cofre de plata. Tú, ${R.goalSilver} cofres cuando llegue a la fase ${R.goalFase}${R.buyPct?` y el ${Math.round(R.buyPct*100)} % de sus compras en tokens`:''}.</div></div>
    <div class="acts"><button class="btn sm gold" data-act="invShare">Compartir</button><button class="btn sm" data-act="invCopy">Copiar</button></div></div>` }
const REW_T={'pvp:semana':'Ranking semanal de PvP',invitado:'Regalo de bienvenida',amigo_fase50:'Tu amigo llegó a la fase '+CFG.referral.goalFase,amigo_compra:'Tu amigo compró tokens'};
// premios del servidor: por invitar o compras con Stars
const rewTxt=r=>r.kind==='silver'?rw(ICON.silver,'+'+fmt(r.amount)):r.kind==='tokens'||r.kind==='won'?rw(ICON.tok,'+'+fmt(r.amount))
  :r.kind==='first'?bundleHTML({item:CFG.stars.first.r,tok:CFG.stars.first.tokens,silver:CFG.stars.first.silver}):r.kind==='pass'?'Pase de pago activado':r.kind==='pvp'?`Puesto ${r.amount}: ${(w=>w?evRewText(w):'sin premio')(G.pvpReward(r.amount))}`:'';
if(window.Telemetry) Telemetry.onReward=list=>{ const paid=list.some(r=>/^stars:/.test(r.reason||'')); if(paid) haptic('ok');
  const pvp=list.every(r=>r.kind==='pvp');
  later(()=>showModal(`<h3>${paid?'¡Compra recibida!':pvp?'¡Premio de la semana PvP!':'¡Premio por invitar!'}</h3><div class="loot">${list.map(r=>`<div><span>${REW_T[r.reason]||(paid?'Gracias por tu compra':'Premio')}</span><b>${rewTxt(r)}</b></div>`).join('')}</div><button class="btn gold" data-act="close">Genial</button>`)); if(paid) renderTab(); };
function renderSelect(){
  $('#nav').hidden=true; $('#upFab').hidden=true; upOpen=false;
  $('#app').classList.remove('home');
  $('#app').innerHTML=`<div><div class="hero-title">Idle Ascension</div></div>
  <label class="namebox"><span class="s">Tu nombre</span><input id="pNameIn" maxlength="16" autocomplete="nickname" placeholder="3-16 letras" value="${esc(pendingName)}"></label>
  <p class="hint">Elige tu clase</p>
  <div class="classes">${Object.entries(CFG.classes).map(([k,c])=>`<button class="ccard" data-act="pick" data-c="${k}">
    <span class="cn">${clsLabel(k)}</span>
    <span class="cs">Habilidad: <b>${CFG.skills.cls[k].name}</b> · ${CFG.skills.cls[k].desc}</span></button>`).join('')}</div>`;
}

/* ---------- modal y avisos ---------- */
// Ventanas: el botón "Cerrar" se cambia por una cruz arriba a la derecha (con la misma acción)
// (también «Ahora no» cuando va solo; en las confirmaciones «Cancelar» se queda y además sale la cruz)
function withX(html){ let act=null; html=html.replace(/<button class="btn[^"]*" data-act="([^"]+)"[^>]*>(?:Cerrar|Ahora no)<\/button>/,(m,a)=>{act=a;return ''}).replace(/<div class="ctrl"><\/div>/,'');
  if(!act&&/data-act="close"/.test(html)) act='close';
  return act?`<button class="xclose" data-act="${act}" aria-label="Cerrar">✕</button>`+html:html }
// «50 %» sin que el % se quede solo en la línea siguiente
const nbsp=h=>h.replace(/(\d) %/g,'$1\u00a0%');
function showModal(html){const pop=!modalOpen()&&!reduceMotion();$('#modal').innerHTML=`<div class="modal"><div class="box${pop?' pop':''}" role="dialog" aria-modal="true">${nbsp(withX(html))}</div></div>`; const f=$('#modal .box button.gold')||$('#modal .box button:not(.xclose)'); if(f&&!reduceMotion()) f.focus({preventScroll:true})}
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
  skill:(b,k)=>{ const x=G.skills().find(s=>s.slot===k); if(!x) return; if(x.locked) return toast(`${x.name}: ${x.desc}`);
    const r=G.useSkill(k); if(r.ok){ haptic('medium'); toast(x.name) } else if(r.why==='cd') toast(`${x.name}: ${Math.ceil(r.left)} s`); else if(r.why==='nofight') toast('Espera a que empiece el combate') },
  // botón Auto/Manual del combate: en los eventos cambia opt.evAuto; en la campaña, opt.autoSkills
  skAuto:()=>{ if(G.pvpOn()){ G.setOpt('pvpAuto',S.opt&&S.opt.pvpAuto===false); toast(S.opt.pvpAuto?'Habilidades automáticas en PvP':'Habilidades a mano en PvP'); }
    else if(G.inEvent()){ G.setOpt('evAuto',!(S.opt&&S.opt.evAuto)); toast(S.opt.evAuto?'Habilidades automáticas en el evento':'Habilidades a mano en el evento'); }
    else { G.setOpt('autoSkills',S.opt&&S.opt.autoSkills===false); toast(S.opt.autoSkills===false?'Habilidades: solo a mano':'Habilidades automáticas en campaña'); } updateHUD(); if(tab==='dev') renderTab() },
  autoSkills:()=>{ G.setOpt('autoSkills',S.opt&&S.opt.autoSkills===false); toast(S.opt.autoSkills===false?'Habilidades: solo a mano':'Habilidades automáticas en campaña'); renderTab() },
  misView:b=>{ misView=b.dataset.v; renderTab() },
  calOpen:()=>calModal(),
  towerStart:()=>{ G.towerStart(); renderTab() },
  towerQuit:()=>showModal(`<h3>¿Terminar la partida?</h3><p class="hint">Pierdes las mejoras de esta partida. El récord y los premios se quedan.</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="towerQuitYes">Terminar</button></div>`),
  towerQuitYes:()=>{ G.towerAbandon(); closeModal(); renderTab() },
  towerGo:(b,k)=>{ const r=G.towerGo(+k); if(!r) return; if(r.k==='rest') toast(r.full?'Hoguera: ya tenías la vida llena':'Hoguera: vida al máximo'); if(G.inEvent()){ tab='up'; } renderTab() },
  towerPick:(b,k)=>{ if(G.towerPick(+k)) haptic('ok'); closeModal(); renderTab() },
  towerLife:()=>{ if(G.towerBuyLife()){ toast('+1 vida'); renderTab() } else toast('Tokens insuficientes') },
  wheelOpen:()=>wheelModal(),
  wheelSpin:()=>wheelGo(false),
  wheelAd:()=>playAd(()=>wheelGo(true)),
  misBonus:(b,k)=>{ const r=G.claimBonus(k); if(r){ haptic('ok'); toast('Bonus: '+bundleTxt(r)); } renderTab() },
  weekClaim:(b,k)=>{ if(G.claimWeekly(k)){ haptic('light'); { const m=CFG.missions.weekly.list.find(x=>x.k===k); toast(bundleTxt(m.rew||{})+(Object.keys(m.rew||{}).length?' + ':'')+(m.xp||CFG.missions.weekly.xp)+' XP del pase'); } } renderTab() },
  misClaim:(b,k)=>{ if(G.claimMission(k)){ haptic('light'); toast(bundleTxt(CFG.missions.list.find(x=>x.k===k).rew||{})+(Object.keys(CFG.missions.list.find(x=>x.k===k).rew||{}).length?' + ':'')+CFG.missions.xp+' XP del pase'); } renderTab() },
  calClaim:()=>{ const r=G.calState().day, b=G.claimCal(); if(b){ haptic('ok'); toast('Día '+r+': '+bundleTxt(b)); } calModal(); updateHUD(); if(b) notifyOffer() },
  notifyYes:()=>{ closeModal(); askNotify() },
  notifyAsk:()=>askNotify(),
  passAll:()=>{ const n=G.claimPassAll(); if(n){ haptic('ok'); toast('+'+n+' premios del pase'); } renderTab() },
  devPass:()=>{ if(!CFG.devTools) return; G.applyRewards([{kind:'pass',amount:G.passState().season,reason:'stars:pass'}]); renderTab() },
  evoOpen:()=>evoModal(),
  modeGo:()=>{ if(G.inEvent()) return toast('Termina el evento primero'); const nx=CFG.modes[S.mode+1].name;
    showModal(`<h3>¿Ir a ${nx}?</h3><p class="hint">Vuelves a la fase 1 de ${nx}. No se puede volver a ${G.modeCfg().name}.</p><div class="ctrl"><button class="btn" data-act="close">Seguir farmeando</button><button class="btn gold" data-act="modeYes">Ir a ${nx}</button></div>`) },
  modeYes:()=>{ closeModal(); if(G.advanceMode()) updateHUD(); },
  evoGo:(b,k)=>{ const r=G.evolve(k); if(!r.ok) return; haptic('ok'); closeModal(); showModal(`<h3>¡Ahora eres ${G.evoP().name}!</h3><p class="hint">${G.evoP().passive}</p><button class="btn gold" data-act="close">Continuar</button>`); updateHUD(); },
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
  wbClaim:()=>{ const p=G.wbClaim(); if(p){ toast(p.rew?evRewPlain(p.rew):'Sin premio'); renderTab(); } },
  evOpen:(b,k)=>{ evView=k; renderTab(); window.scrollTo({top:0}); },
  evBack:()=>{ evView=null; renderTab(); },
  pvpGo:()=>{ if(pvpBusy||G.inEvent()) return; if(!G.pvpCanFight()) return toast('Sin combates: compra tickets PvP o vuelve mañana');
    const go=()=>{ if(G.pvpFight()){ tab='up'; renderTab(); } else renderTab() };
    if(!pvpOnline()){ G.pvpBot(); return go() }                  // fuera de Telegram: bot
    pvpBusy=true; renderTab();
    Telemetry.pvp(CFG,'pvpFind').then(j=>{ pvpBusy=false;       // el servidor elige: el más cercano en puntos (sin repetir los últimos)
      if(!j||!j.ok){ toast('Sin conexión'); return renderTab() }
      if(j.bot){ const r=G.pvpBot(); r.rating=j.rating; r.match=j.match; }
      else if(!G.pvpSetRival({...j.rival,match:j.match})) return renderTab();
      go(); }) },
  syncRetry:()=>location.reload(),
  modview:b=>{ modView=b.dataset.v||null; evView=null; if(modView==='pvp') pvpLoad(); renderTab(); window.scrollTo({top:0}); },
  lgClaim:()=>{ const p=G.leagueClaim(); if(p){ toast(`+${fmt(p.tok)} tokens de la Liga`); renderTab(); } },
  evClaim:()=>{ const p=G.claimEvent(); if(p){ toast(p.rew?evRewPlain(p.rew):'Sin premio'); renderTab(); } },
  close:()=>{stopSpin();boostModalOpen=false;upOpen=false;grimOpen=false;clearInterval(adTimer);adTimer=null;closeModal()},
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
    pendingDis=ids;showModal(`<h3>¿Desmontar ${ids.length} armas?</h3><p class="hint">+${v} chatarra · la equipada y las ★ se quedan</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="disYes">Desmontar</button></div>`)},
  disYes:()=>{closeModal();disToast(G.dismantle(pendingDis||[]));pendingDis=null;renderTab()},
  invFull:()=>{ closeModal(); tab='inv'; invView='armas'; renderTab() },
  forge:(b,k,id)=>{forgeId=id;lockSel=[];forjaBack=b.dataset.from||'armas';tab='inv';invView='forja';renderTab();window.scrollTo({top:0})},
  invview:b=>{const v=b.dataset.v; if(v==='forja') forjaBack='armas'; invView=tab==='inv'&&invView===v&&(v==='cofres'||v==='mat')?'main':v; renderTab()}, // tocar la pestaña abierta la cierra
  expand:(b,k,id)=>{expandedId=expandedId===id?null:id;renderList()},
  fclear:()=>{F.rar='all';F.stat='any';F.min='';F.max='';renderTab()},
  rlskip:()=>spinDone(),
  shopview:b=>{shopView=b.dataset.v;renderTab()},
  buyAsk:(b,k)=>{buyCtx={k,n:1};buyModal()},
  qty:b=>{buyCtx.n=Math.max(1,Math.min(maxBuy(buyCtx.k),buyCtx.n+(+b.dataset.v)));buyModal()},
  qtyset:b=>{buyCtx.n=Math.max(1,Math.min(maxBuy(buyCtx.k)||1,+b.dataset.v));buyModal()},
  buyConfirm:()=>doBuy(),
  sub:(b,k)=>{ if(!G.buy(k,1)) return toast('Tokens insuficientes'); toast(k==='card'?'Tarjeta mensual activada':'VIP activado'); renderTab() },
  starBuy:(b,k)=>{ b.disabled=true; Telemetry.buyStars(CFG,k,st=>{ b.disabled=false;
      if(st==='paid') toast('¡Pago hecho! Recibiendo tu compra…'); else if(st==='done') toast('Ya lo compraste'); else if(st==='error') toast('No se pudo abrir el pago. Prueba otra vez.'); }) },
  devOffer:(b,k)=>{ if(!CFG.devTools) return; closeModal(); G.applyRewards([{kind:'offer_'+k,amount:1,reason:'stars:offer_'+k}]); toast('Oferta (prueba)'); renderTab() },
  devFirst:()=>{ if(!CFG.devTools) return; G.applyRewards([{kind:'first',amount:1,reason:'stars:first'}]); toast('Oferta de bienvenida (prueba)'); renderTab() },
  payCoin:b=>{ payCoin=b.dataset.v; renderTab() },
  cryptoBuy:(b,k)=>{ const coin=payCoin; b.disabled=true;
    showModal(`<h3>Pago con ${coin}</h3><p class="hint" id="cryptoSt">Un momento…</p><button class="btn" data-act="close">Cerrar</button>`);
    const st=t=>{ const e=$('#cryptoSt'); if(e) e.textContent=t };
    TonPay.buy(CFG,k,coin,st).then(r=>{ b.disabled=false;
      const err={cancel:'Pago cancelado.','tu cartera no tiene USDT':'Tu cartera no tiene USDT.','no tienes USDT suficientes':'No tienes USDT suficientes.',off:'Pagos con crypto: próximamente.',net:'Sin conexión con el servidor. Prueba otra vez.'};
      if(r.ok){ closeModal(); toast('¡Pago recibido!') } else if(r.pending) st('Tu pago aún no se ha confirmado en la red. Llegará solo; si tarda, toca "Comprobar" en Tokens.');
      else st(err[r.error]||('No se pudo pagar: '+r.error)) }) },
  cryptoCheck:b=>{ b.disabled=true; TonPay.check(CFG).then(c=>{ b.disabled=false; toast(c.paid?'¡Pago recibido!':c.pending?'Aún no ha llegado. Prueba en un minuto.':'No hay pagos pendientes.') }) },
  goTokens:()=>{ closeModal(); if(!CFG.shopTab) return toast('La tienda llegará más adelante'); tab='shop'; shopView='tokens'; renderTab() },
  tokBuy:(b,k)=>{ if(G.buyTokens(+k)){ toast(`+${fmt(+k+((CFG.tokens.bonus||{})[k]||0))} tokens (prueba)`); renderTab(); } },
  wdAsk:()=>wdModal(),
  grimOpen:()=>showGrim(),
  grimClose:()=>{ grimOpen=false; closeModal() },
  grimUnlock:()=>{ const r=G.grimUnlock(); toast(r.ok?'¡Grimorio conseguido! Súbelo luchando':'Te faltan recursos'); renderTab(); if(grimOpen) showGrim() },
  grimBuy:()=>{ const p=G.grimPack(); showModal(`<h3>${G.grimName()}</h3><p class="hint">Conseguirlo ahora por ${fmt(p)} tokens (tienes ${fmt(G.tokens())}).</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="grimBuyGo" ${G.tokens()>=p?'':'disabled'}>Comprar</button></div>`) },
  grimBuyGo:()=>{ const r=G.grimBuy(); closeModal(); toast(r.ok?'¡Grimorio conseguido!':'Tokens insuficientes'); renderTab() },
  grimUp:()=>{ const r=G.grimUp(); if(r.ok){ haptic('ok'); toast(r.lvl>=CFG.grimoire.levels?'¡Grimorio aprendido! Ya puedes evolucionar':'Grimorio nivel '+r.lvl) } else toast(r.why==='xp'?'Sigue luchando':'Te faltan recursos'); renderTab(); if(grimOpen) showGrim() },
  pathAsk:()=>{ const P=G.evoPaths(), to=P[S.path==='B'?'A':'B'];
    showModal(`<h3>Cambiar a ${to.name}</h3><p class="hint">${to.passive}</p><p class="hint">Cuesta ${CFG.grimoire.switchCost} tokens (tienes ${fmt(G.tokens())}).</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="pathGo" ${G.tokens()>=CFG.grimoire.switchCost?'':'disabled'}>Cambiar</button></div>`) },
  pathGo:()=>{ const r=G.pathSwitch(); closeModal(); toast(r.ok?'Ahora eres '+G.evoP().name:r.why==='event'?'Termina el evento primero':'Tokens insuficientes'); updateHUD(); renderTab() },
  invShare:()=>{ const link=Telemetry.inviteLink(CFG), tg=window.Telegram&&Telegram.WebApp, txt='¡Juega conmigo a Idle Ascension!';
    const url='https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(txt);
    if(tg&&tg.openTelegramLink) tg.openTelegramLink(url); else window.open(url,'_blank') },
  invCopy:()=>{ const link=Telemetry.inviteLink(CFG); const ok=()=>toast('Enlace copiado'), no=()=>toast(link);
    try{ navigator.clipboard.writeText(link).then(ok,no) }catch(e){ no() } },
  wdGo:()=>{ const r=G.withdraw(S.won); closeModal(); toast(r.ok?`Retirados ${fmt(r.n)} tokens (prueba)`:'No se puede retirar'); renderTab(); },
  lock:b=>{const i=+b.dataset.i, it=G.findItem(forgeId); if(lockSel.includes(i)) lockSel=lockSel.filter(x=>x!==i); else if(it&&lockSel.length<G.maxLocks(it)) lockSel=[...lockSel,i]; else { toast('Máximo '+(it?G.maxLocks(it):0)+' fijado'+(it&&G.maxLocks(it)>1?'s':'')); return } renderTab()},
  ref:(b,k,id)=>doReforge(id,b.dataset.pay),
  applyReforge:()=>{if(pendingReforge)G.applyReforge(pendingReforge.id);pendingReforge=null;closeModal();renderTab()},
  info:(b,k)=>oddsModal(k),
  shopInfo:(b,k)=>showModal(`<h3>${SHOP[k].name}</h3><p class="hint">${SHOP[k].desc}</p><div class="ctrl"><button class="btn" data-act="close">Cerrar</button></div>`),
  open1:(b,k)=>openChests(k,false),
  openAll:(b,k)=>openChests(k,true),
  battery:()=>{G.setOpt('battery',!battery());if(battery()){fx.floats.length=0;fx.flash=0;ART.clearFx();ART.clearParts()}renderTab()},
  speed:b=>{if(CFG.devTools){S.speed=+b.dataset.v;renderTab()}},
  dev:(b,k)=>{G.dev(k);renderTab()},
  reset:()=>{closeModal();G.reset();syncS();tab='up';invView='main';shopView='cofres';forgeId=null;lockSel=[];expandedId=null;F.rar='all';F.stat='any';F.min='';F.max='';modalQ.length=0;renderSelect()},
};
function disToast(r){ if(r.n) toast(`${r.n} arma${r.n>1?'s':''} desmontada${r.n>1?'s':''}: +${r.v} chatarra`) }
function openChests(k,all){ const n0=G.chestCount(k), need=all?n0:Math.min(1,n0);
  if(need>G.invFree()) return showModal(`<h3>Inventario lleno</h3><p class="hint">Para abrir ${need} cofre${need>1?'s':''} necesitas ${need} hueco${need>1?'s':''} libre${need>1?'s':''} y tienes ${G.invFree()} (${G.invCount()}/${G.invMax()} armas). Libera espacio desmontando armas.</p><div class="ctrl"><button class="btn" data-act="close">Cerrar</button><button class="btn gold" data-act="invFull">Ir a Armas</button></div>`);
  const l=G.openChests(k,all); if(!l.length) return; haptic('medium'); renderTab(); spin(k,l,n0-G.chestCount(k)) }

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act],[data-tab],[data-f]'); if(!b) return;
  if(b.dataset.tab){ if(adTimerOn()) return; if(b.dataset.tab==="ev"&&tab==="ev"){ evView=null; modView=null; } /* tocar Modos estando dentro vuelve al inicio de Modos */ upOpen=false;boostModalOpen=false;stopSpin();closeModal();if(b.dataset.tab==="inv") invView='main'; /* Inventario siempre abre la pantalla principal */ tab=b.dataset.tab;lockSel=[];renderTab();return}
  if(b.dataset.f){F[b.dataset.f]=b.dataset.v;document.querySelectorAll(`[data-f="${b.dataset.f}"]`).forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===b.dataset.v));renderList();return}
  const fn=ACT[b.dataset.act]; if(fn) fn(b,b.dataset.k,+b.dataset.id);
});
document.addEventListener('change',e=>{ if(e.target.id==='fStat'){F.stat=e.target.value;renderList()} if(e.target.id==='fRar'){F.rar=e.target.value;$('#fHead').innerHTML=fHead();renderList()} });
document.addEventListener('input',e=>{
  if(e.target.id==='buyQty'&&buyCtx){const n=Math.floor(+e.target.value||0);buyCtx.n=n;const mx=maxBuy(buyCtx.k);$('#buyTotal').textContent=priceTxt(buyCtx.k,Math.max(0,n));$('#buyOk').disabled=!(n>=1&&n<=mx)}
  if(e.target.id==='fMin'){F.min=e.target.value;renderList()}
  if(e.target.id==='fMax'){F.max=e.target.value;renderList()}
});
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='nameIn'){ ACT.nameSave(); return }
  if(e.key==='Escape'&&modalOpen()&&!pendingSpin&&!adTimerOn()&&!($('#nameIn')&&!S.name)){ const x=$('#modal .xclose'); if(x) x.click(); else ACT.close(); return } if((e.key==='Enter'||e.key===' ')&&e.target.matches('.ihd[data-act],.chip[data-act]')){e.preventDefault();e.target.click()}});
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
  const sc=Math.max(1,Math.min(2.2,CH/200,CW/200)), W=CW/sc, H=CH/sc; // escala los dibujos al tamaño de la pantalla (el ancho manda: caben los enemigos)
  const g=C.ctx; g.setTransform(dpr*sc,0,0,dpr*sc,0,0);
  if(!battery()){ const [sx,sy]=ART.shakeOffset(dt); g.translate(sx,sy); }   // sacudida (críticos, golpes fuertes)
  const bars=!battery();
  // escenario según dónde luchas: campaña (zona de la fase), Mazmorra (zona del último grupo), Torre (piso), Jefe semanal (infierno), PvP (arena)
  const zoneOf=f=>Math.floor(((f-1)%150)/30), modeOf=f=>Math.min(2,Math.floor((f-1)/150));
  const zone=!B?zoneOf(S.fase):B.kind==='pvp'?'arena':B.kind==='boss'?4:B.kind==='tower'?Math.min(4,Math.floor((G.towerState().run||{floor:1}).floor/20)):B.event?zoneOf(B.groups||1):zoneOf(S.fase);
  const smode=!B||!B.event?S.mode:B.kind?0:modeOf(B.groups||1);
  const gy=Math.min(H-30,Math.round(H*0.72)); fx.sc=sc; fx.gy=gy;
  ART.scene(g,W,H,gy,zone,battery()?0:fx.scroll||0,smode,battery()?0:performance.now()/1000);
  const hx=W*0.24, c=CFG.classes[S.cls], now=performance.now(), T=now/1000, anim=!battery();
  const prog=(at,ms)=>at&&anim?Math.max(0,Math.min(1,(now-at)/ms)):0, pulse=(at,ms)=>{ const k=prog(at,ms); return k>0&&k<1?k:0 };
  // el héroe anda mientras no hay enemigo delante (entre oleadas o mientras se acercan)
  const walking=!B||B.over||!B.enemies.some(e=>!e.dead&&B.t>=e.arrive-0.05);
  fx.walkT=walking&&anim?(fx.walkT||0)+dt:0;
  if(walking&&anim) fx.scroll=(fx.scroll||0)+dt*40;
  ART.hero(g,hx,gy,{cls:S.cls,color:c.color,evo:S.evo,path:S.path,walk:fx.walkT,atk:pulse(fx.atkAt,260),hit:fx.flash>0?fx.flash/0.15:0,t:anim?T:0});
  if(!B){ if(anim) ART.parts(g,dt); return }
  const h=G.heroStats(), contact=hx+34, spawnX=W+24;
  if(B.kind==='pvp'){ const e=B.enemies[0], rc=CFG.classes[e.cls]||c, rv=G.pvpState().rival||{}, rx=Math.max(W*0.7,hx+100), p=Math.min(1,B.t/(e.walk||0.8)), x=spawnX-(spawnX-rx)*p; e.x=x;
    ART.hero(g,x,gy,{cls:e.cls,color:rc.color,evo:rv.evo||0,path:rv.path,flip:true,walk:p<1&&anim?T:0,atk:pulse(fx.ratkAt,260),hit:fx.rflash>0?fx.rflash/0.12:0,t:anim?T+1.3:0}); fx.rflash=Math.max(0,(fx.rflash||0)-dt);
    const nm=n=>{ n=String(n||''); return n.length>10?n.slice(0,9)+'…':n };   // nombres cortos: no se pisan
    g.textAlign='center'; g.font='700 9px "Nunito Sans", system-ui, sans-serif'; g.fillStyle='#ece7da'; g.fillText(nm(e.name),x,gy-92); g.fillText(nm(S.name),hx,gy-92);
    if(bars){ g.fillStyle='#0009'; g.fillRect(x-20,gy-84,40,5); g.fillStyle='#e2605a'; g.fillRect(x-20,gy-84,40*Math.max(0,e.hp/e.max),5); } }
  // monstruos: tipo según la zona (campaña: la fase; Mazmorra: el grupo; Torre: el piso) y color según el modo
  const modeHue=m=>[0,190,300][Math.min(2,m||0)];
  let q=0, idx=0;
  for(const e of B.enemies){ if(B.kind==='pvp') break;
    const dieK=e.dead?(B.t-(e.deadAt||0))/0.45:0; if(e.dead&&(dieK>=1||e.x===undefined)) continue;
    if(!e._k){ const f=e.f||S.fase, zone=B.kind==='boss'?4:B.kind==='tower'?Math.min(4,Math.floor((G.towerState().run||{floor:1}).floor/20)):zoneOf(f);
      e._k=ART.kindFor(zone,idx+(e.minion?1:0)); e._hue=modeHue(e.f?Math.floor((e.f-1)/150):B.kind?0:S.mode); }
    idx++;
    const p=Math.min(1,(B.t-e.spawn)/(e.walk||CFG.enemy.walk));
    const r=B.boss?(B.elite?26:21):13, y=gy, cx=contact+(r-13)*2.4;   // los grandes se paran más lejos (no tapan al héroe)
    let x=e.dead?e.x:spawnX-(spawnX-cx)*p; if(!e.dead&&p>=1){x+=q*20;q++}
    e.x=x;
    if(e.dead&&!e._burst){ e._burst=1; if(anim) ART.burst(x,gy-r,'#d9d2c0',8); }
    ART.monster(g,x,y,{kind:e._k,r,hue:e._hue,boss:B.boss,elite:B.elite,t:anim?T+(e.spawn||0):0,walk:p<1&&anim?T:0,atk:pulse(e._atkAt,300),hit:anim&&e._hitAt&&now-e._hitAt<100?1-(now-e._hitAt)/100:0,die:Math.max(0,dieK)});
    if(anim&&!e.dead) ART.status(g,x,gy,r,{frozen:e.frozen>B.t,burn:(e.burn&&e.burn.some(u=>u>B.t))||(e.dot>B.t&&e.dotKind==='fuego'),poison:e.poison&&e.poison.some(p=>p.until>B.t),mark:e.mark>B.t},T);
    if(bars&&!e.immortal&&!e.dead){ const by=gy-r*3.7-6; g.fillStyle='#0009'; g.fillRect(x-18,by,36,4); g.fillStyle='#e2605a'; g.fillRect(x-18,by,36*Math.max(0,e.hp/e.max),4); }
  }
  if(anim) ART.parts(g,dt);
  if(anim){ const foes=B.kind==='pvp'?[]:B.enemies.filter(e=>!e.dead&&e.x!=null).map(e=>({x:e.x}));
    ART.drawFx(g,{W,hx,rx:B.kind==='pvp'?B.enemies[0].x:null,gy,foes,now:now/1000,
      drawClone:(x,side)=>{ if(side==='rival'){ const e=B.enemies[0], rv=G.pvpState().rival||{}; ART.hero(g,x,gy,{cls:e.cls,color:(CFG.classes[e.cls]||c).color,evo:rv.evo,path:rv.path,flip:true,t:T}) } else ART.hero(g,x,gy,{cls:S.cls,color:ART.shade(c.color,0.5),evo:S.evo,path:S.path,t:T+0.5}) }}); }
  fx.floats=fx.floats.filter(f=>(f.life-=dt)>0);
  g.textAlign='center'; g.font='800 13px "Nunito Sans", system-ui, sans-serif';
  for(const f of fx.floats){ const y=(f.hero?gy-80:gy-52)-(0.9-f.life)*30; const x=f.hero?hx:(f.e&&f.e.x)||0;
    g.globalAlpha=Math.min(1,f.life*2); g.fillStyle=f.hero?'#e2605a':(f.crit?'#e8b04a':'#ece7da');
    g.fillText(f.txt+(f.crit?'!':''),x,y); }
  g.globalAlpha=1; fx.flash=Math.max(0,fx.flash-dt);
  if(bars){ g.fillStyle='#0009'; g.fillRect(hx-20,gy-84,40,5); g.fillStyle='#6cc47a'; g.fillRect(hx-20,gy-84,40*Math.max(0,G.B.hp/h.hp),5); }
}

/* ---------- bucle ---------- */
let last=performance.now(), hudT=0, drawT=0, offT=0;
function loop(now){
  const real=Math.min(0.25,(now-last)/1000); last=now;
  if(S&&G.B&&!window.GAME_PAUSED){                        // en mantenimiento o actualizando, el juego se para
    G.tickBoost(real*1000); // el ×2 solo se gasta mientras se juega
    let sim=real*(S.speed||1)*G.speedMult();
    while(sim>0){const d=Math.min(0.02,sim);G.step(d);sim-=d}
    // el motor solo avisa; si los golpes ocurren sin dibujar (pestaña oculta) se descartan
    if(tab!=='up'){fx.floats.length=0;ART.clearFx()}
    drawT+=real; if(!battery()||drawT>=0.1){draw(drawT);drawT=0}
    hudT+=real; if(hudT>0.25){hudT=0;updateHUD()}
    offT+=real; if(offT>5){ offT=0; const k=G.offerCheck(); if(k) offerModal(k); }
    syncBack();
  }
  requestAnimationFrame(loop);
}

/* ---------- arranque ---------- */
function boot(){
G.load(); syncS();
if(S){
  renderShell(); G.startWave();
  if(G.autoLoot()) setTimeout(()=>toast('Botín de jefes sin recoger: enviado al inventario'),400);
  if(!S.name) later(nameModal);
  const ae=G.autoEvent(); if(ae) later(()=>evEndModal(ae));   // intento del evento que quedó a medias al cerrar
  const aq=G.autoQuit(); if(aq) later(()=>quitModal(aq));      // combate de la Torre o duelo PvP que quedó a medias: derrota
  const off=G.applyOffline();
  if(off) later(()=>offlineModal(off));
} else renderSelect();
}
// Dentro de Telegram: se comprueba la cuenta y se descarga la partida del servidor antes de empezar
function syncBox(title,msg,btn){ let el=$('#syncBox'); if(!el){ el=document.createElement('div'); el.id='syncBox'; el.className='boot'; document.body.appendChild(el); }
  el.innerHTML=`<b>${title}</b><span>${msg}</span>${btn?`<button class="btn gold" data-act="syncRetry">${btn}</button>`:''}` }
const SAVE_KEY='idleAscension2';
function pickSave(r){ // qué partida usar: la del servidor si es más nueva o si la del móvil es de otra cuenta
  let local=null; try{ local=JSON.parse(storage.get(SAVE_KEY)||'null') }catch(e){}
  const me=r.id, mine=local&&(!local.tgId||local.tgId===me);
  if(r.save&&(!mine||(local.srvRev||0)<r.rev)){ const sv={...r.save,tgId:me,srvRev:r.rev}; storage.set(SAVE_KEY,JSON.stringify(sv)); return 'server' }
  if(local&&!mine){ storage.del(SAVE_KEY); return 'new' }       // era de otra cuenta y esta no tiene partida: empieza de cero
  if(local){ local.tgId=me; if(!(local.srvRev<=r.rev)) local.srvRev=r.rev; storage.set(SAVE_KEY,JSON.stringify(local)); return 'local' }
  return 'new' }
function start(){
  const T=window.Telemetry;
  if(!T||!T.canSync(CFG)) return boot();                       // fuera de Telegram (o sin servidor): partida del móvil
  syncBox('Idle Ascension','Cargando partida…');
  T.loadRemote(CFG).then(r=>{
    if(r.now) setServerTime(r.now);
    if(r.error==='auth') return syncBox('No se pudo comprobar tu cuenta','Cierra el juego y vuelve a abrirlo desde Telegram.','Reintentar');
    const el=$('#syncBox'); if(el) el.remove();
    if(r.error){ boot(); if(S) toast('Sin conexión: tu partida se guardará al volver'); T.startSync(G,T.myId()); return }
    pickSave(r); boot(); T.startSync(G,r.id);
    T.onConflict=()=>{ G.S&&G.save(); syncBox('Partida en otro dispositivo','Tu partida se ha jugado en otro dispositivo. Cargando la más reciente…'); setTimeout(()=>location.reload(),2500) };
  });
}
start();
requestAnimationFrame(loop);
})();
