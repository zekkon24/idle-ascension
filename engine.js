/* ARCHIVO GENERADO por tools/construir.js desde src/motor/ (orden en orden.json): no lo edites aquí. */
/* Idle Ascension · MOTOR DEL JUEGO
   Toda la lógica: estado, fórmulas, combate, economía, eventos y tienda.
   No toca la pantalla (ni DOM ni canvas): la interfaz escucha sus eventos y llama a sus acciones.
   Funciona igual en el navegador y en Node (pruebas y, más adelante, el servidor).

   createGame({cfg, storage, now, seed})
     cfg     – configuración (config.js)
     storage – {get(k), set(k,v), del(k)}  (localStorage en el navegador, memoria en pruebas)
     now     – función que devuelve la hora en ms (Date.now por defecto; el servidor pondrá la suya)
     seed    – semilla opcional para que el azar sea reproducible (pruebas)
*/
(function(root){
'use strict';

function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }

function createGame(opts){
  const CFG=opts.cfg, storage=opts.storage||null, SAVE_KEY=opts.saveKey||'idleAscension2';
  const nowFn=opts.now||(()=>Date.now());
  const rand=opts.seed!=null?mulberry32(opts.seed):Math.random;
  const CLASSES=Object.keys(CFG.classes);
  /* ---------- eventos ---------- */
  const handlers={};
  const on=(ev,fn)=>{(handlers[ev]=handlers[ev]||[]).push(fn)};
  const emit=(ev,data)=>{(handlers[ev]||[]).forEach(fn=>fn(data))};
  // Acciones importantes para la base de datos (la interfaz las envía al servidor): track {type, ...datos}
  const track=(type,data)=>{ emit('track',{type,...(data||{})}); misHook(type,data||{}); };

  /* ---------- estado ---------- */
  let S=null, B=null, HS=null;
  // Día de juego (cambia a las 00 UTC). Nunca retrocede: atrasar el reloj no vuelve a abrir anuncios, entradas gratis ni evento.
  const dayKey=()=>{ const d=Math.floor((nowFn()+(S&&CFG.devTools?S.devDays||0:0)*86400000)/86400000); if(!S) return d; if(!(S.maxDay>=d)) S.maxDay=d; return S.maxDay };

  function newState(cls,name){
    return {v:3,cls,name:cleanName(name),lvl:1,xp:0,gold:0,tokens:0,won:0,withdrawn:0,up:{atk:0,hp:0,df:0,spd:0},
      best:0,fase:1,wave:1,push:true,autoPush:true,farmClears:0,repF:null,   // repF: fase que se repite con el botón «Repetir fase» (null: sube sola)
      gear:{arma:[1,0,0,0,0,0],armadura:[0,0,0,0,0,0],anillo:[0,0,0,0,0,0],amuleto:[0,0,0,0,0,0]},gearNv:{arma:[0,0,0,0,0,0],armadura:[0,0,0,0,0,0],anillo:[0,0,0,0,0,0],amuleto:[0,0,0,0,0,0]},gearEq:{arma:0,armadura:null,anillo:null,amuleto:null},gearNew:{},mineral:0,minF:0,chatarra:0,boxT:0,boxP:{free:{mid:0,top:0}},boxDay:null,   // gear: copias de cada rareza en cada hueco (la Común del arma es de regalo; las de los demás, al abrirse) · boxT: tickets de invocación · boxP: contadores de la garantía (pity) de la caja, una para todos los huecos
      opt:{},legacy:null,   // legacy: lo que tenía una partida antigua de objetos (armas, cofres, chatarra), apartado sin borrarlo
      startDay:null,cardUntil:0,vipUntil:0,          // startDay: día en que empezó la partida (para los rivales simulados)
      lastSeen:nowFn(),devDays:0,speed:1,kills:0,boostMs:0,ads:null,evo:0,absorb:{},mode:0,mats:{0:0},essF:1,tal:{},reto:0,selF:1,evm:0,evLog:null,loot:null,evRun:null,maxDay:0,wbLog:null,wbRun:null,clan:null,clanRun:null,clanQ:[],clanHits:null,evFree:null,wbFree:null,league:null,leagueLast:null,grim:{lvl:0,xp:0},
      stats:{deposited:0,withdrawNet:0,adGold:0,ads:0,offGold:0}}; // registro para la base de datos: tokens comprados, $ retirados (neto), oro de anuncios, anuncios vistos, oro sin conexión
  }
  function migrate(st){ // pone al día partidas guardadas con versiones anteriores (rellena todo campo que falte y limpia números rotos)
    if(!st||!CFG.classes[st.cls]) return null;
    const eq0=st.gearEq;   // (antes de rellenar lo que falta: sin ella, la partida es de antes del «equipar a mano»)
    const essF0=st.essF;   // (lo mismo: sin ella, la partida es de antes de la Esencia segura)
    const selF0=st.selF;   // (y sin esta, de antes de los Sellos y el Ticket de reto)
    { const G=st.grim; if(G&&G.owned){ const had=Object.keys(G.owned).length>0; st.grim={lvl:had?((st.evo||0)>=1?5:1):0,xp:0}; } }   // grimorios antiguos → la llave
    st.repF=st.repF>0?Math.min(st.repF|0,Math.max(1,(st.best|0)+1)):null; st.autoPush=!st.repF;   // sube sola de fase salvo con «Repetir fase»
    if((st.evo||0)>=1&&!st.path) st.path='A';                                                                              // evolución antigua = camino A
    { const L={};   // los objetos y los cofres ya no existen: lo de las partidas antiguas se aparta en st.legacy (no se pierde) por si hay que compensarlo
      if(Array.isArray(st.items)&&st.items.length) L.items=st.items; if(st.chestInv&&Object.keys(st.chestInv).length) L.chestInv=st.chestInv;
      if(st.scrap) L.scrap=st.scrap; if(st.invBonus) L.invBonus=st.invBonus; if(st.equippedId!=null) L.equippedId=st.equippedId;
      if(Object.keys(L).length) st.legacy={...(st.legacy||{}),...L};
      for(const k of ['items','nextId','equippedId','chestInv','scrap','invBonus','refPend','silverDay']) delete st[k];
      if(st.loot){ delete st.loot.wood; delete st.loot.scrap; } }
    const d=newState(st.cls);
    for(const k in d) if(st[k]===undefined) st[k]=d[k];
    clanClean(st);
    { const W=CFG.weapon, n=Math.max(0,Math.min(W.max,st.wlvl|0)); if(n&&st.gear&&st.gear.arma) st.gear.arma[0]=Math.max(st.gear.arma[0]||1,W.need[n]); delete st.wlvl;   // la mejora con oro de una versión de pruebas → copias de la Común
      const g0=st.gear||{}; st.gear={}; for(const s of ['arma','armadura','anillo','amuleto']){ const a=g0[s]; st.gear[s]=W.base.map((_,i)=>Number.isFinite(a&&a[i])&&a[i]>0?Math.floor(a[i]):0); } if(!st.gear.arma.some(x=>x>0)) st.gear.arma[0]=1;   // (la Común del arma, de regalo; si la rompiste teniendo otra, no vuelve)
      { const g1=st.gearNv||{}, e0=eq0; st.gearNv={}; st.gearEq={};   // nivel con mineral de cada pieza (solo las que tienes, hasta su tope) y la pieza equipada
        for(const s of ['arma','armadura','anillo','amuleto']){ const a=g1[s], c=st.gear[s], C=s==='arma'?CFG.weapon:CFG.equip[s], PL=CFG.pieceLv;
          st.gearNv[s]=W.base.map((_,i)=>Number.isFinite(a&&a[i])&&a[i]>0&&c[i]>0?Math.min(Math.floor(a[i]),PL?PL.cap[i]||0:0):0);
          const e=e0&&e0[s]; let r=Number.isInteger(e)&&c[e]>0?e:-1;   // (partidas de antes del «equipar a mano», o la equipada ya no está: la mejor, como se equipaba sola)
          if(r<0){ let bp=-1; for(let i=0;i<c.length;i++){ if(!(c[i]>0)) continue; const l=W.need.reduce((k,q,ii)=>c[i]>=q?ii:k,-1), v=(C.base[i]+C.step[i]*Math.max(0,l))*(1+((PL&&PL.pct)||0)*st.gearNv[s][i]); if(v>=bp){ bp=v; r=i } } }
          st.gearEq[s]=r>=0?r:(s==='arma'?0:null); }
        st.gearNew=st.gearNew&&typeof st.gearNew==='object'?st.gearNew:{}; for(const k of ['mineral','chatarra']) st[k]=Number.isFinite(st[k])&&st[k]>0?Math.floor(st[k]):0; st.minF=Number.isFinite(st.minF)?Math.max(0,Math.min(1,st.minF)):0; }
      st.boxP={...d.boxP,...(st.boxP||{})}; st.boxP.free={...d.boxP.free,...(st.boxP.free||{})}; st.boxT=Math.max(0,Math.floor(st.boxT)||0); }
    st.up={...d.up,...(st.up||{})}; st.stats={...d.stats,...(st.stats||{})}; for(const k in st.up) if(!Number.isFinite(st.up[k])) st.up[k]=0;
    for(const k of ['gold','tokens','won','withdrawn','xp','lvl','best','fase','wave','reto','evm','kills','boostMs','evo','mode','cardUntil','vipUntil'])
      if(!Number.isFinite(st[k])) st[k]=d[k];
    st.lvl=Math.max(1,st.lvl|0); st.fase=Math.max(1,st.fase|0); st.wave=Math.min(10,Math.max(1,st.wave|0));
    st.opt=st.opt||{}; st.mats=st.mats||{};
    // Esencia única: las de los 3 modos se suman (1 a 1) en S.mats[0]
    { let n=0; for(const k in st.mats) if(Number.isFinite(st.mats[k])&&st.mats[k]>0) n+=st.mats[k]; st.mats={0:Math.floor(n)}; }
    // partidas de antes de la Esencia segura: reciben la de los élites (1) y JEFES (3) que ya vencieron, una sola vez
    if(!essF0){ const E=CFG.essFirst||{}, cap=(CFG.phaseCap||150), md=Number.isFinite(st.mode)?st.mode:0, bt=Number.isFinite(st.best)?st.best:0; let n=0;
      for(let m=0;m<=md;m++){ const top=m<md?cap:Math.min(cap,bt); for(let f=10;f<=top;f+=10) n+=(f%30===0?E.jefe:E.elite)||0; }
      st.mats[0]+=n; st.essF=1; }
    // Sellos y Ticket de reto: los emblemas valen 10 Sellos; los tickets de Mazmorra y Jefe pasan a Tickets de reto (1 a 1) y los de PvP, 1 por cada 3
    if(!selF0){ const n=x=>Math.max(0,Math.floor(Number(x)||0)); st.evm=n(st.evm)*10; st.reto=n(st.reto)+n(st.tickets)+n(st.bossTickets)+Math.floor(n(st.pvpTickets)/3); st.pvpTickets=n(st.pvpTickets)%3; st.selF=1; }
    delete st.tickets; delete st.bossTickets; st.reto=Math.max(0,Math.floor(st.reto)||0);
    { const T=st.tal&&typeof st.tal==='object'?st.tal:{}; st.tal={}; for(const t of ((CFG.talents||{}).list||[])){ const v=Math.floor(Number(T[t.k])||0); if(v>0) st.tal[t.k]=Math.min(v,10000); } }
    if(st.boostUntil!=null){ st.boostMs=Math.max(0,st.boostUntil-nowFn()); delete st.boostUntil; } st.boostMs=st.boostMs||0; st.evo=st.evo||0; st.absorb=st.absorb||{}; st.mode=st.mode||0; delete st.rare;
    delete st.pity; delete st.dropDay; delete st.firstDone; delete st.gps; delete st.xps; delete st.calLast; delete st.mis; delete st.week; // (calendario y misiones ya no existen)
    if(st.calStart!=null&&st.startDay==null) st.startDay=st.calStart; delete st.calStart;
    st.v=3; return st;
  }
  // lastSeen nunca retrocede: atrasar y adelantar el reloj no regala tiempo sin conexión
  const packed=()=>S||null;       // la partida tal como se guarda (también en el servidor)
  function save(){ if(!S||!storage) return; S.lastSeen=Math.max(S.lastSeen||0,nowFn()); try{storage.set(SAVE_KEY,JSON.stringify(packed()))}catch(e){} }
  let autoLoot=null; // botín de jefes que quedó sin recoger al cerrar: al volver a entrar va directo al inventario
  let autoEvent=null; // intento del evento que quedó a medias al cerrar: se cuenta con las muertes que llevaba
  function load(){ if(!storage) return null; try{const t=storage.get(SAVE_KEY); S=t?migrate(JSON.parse(t)):null}catch(e){S=null} HS=null; B=null; if(S) gearOpenCheck();   // (huecos que ya tocaban)
    autoLoot=S&&S.loot?claimLoot():null; autoEvent=S&&S.evRun?finishRun(S.evRun.kills,false):S&&S.wbRun?wbFinish(S.wbRun.dmg,false):S&&S.clanRun?clanFinish(S.clanRun.dmg):null;
    autoQuit=S?quitFights():null; return S }
  // combate de la Torre o duelo PvP que quedó a medias al cerrar la app: cuenta como derrota (así cerrar no sirve para no perder)
  let autoQuit=null;
  function quitFights(){ const out={}; const run=S.tower&&S.tower.run;
    if(run&&run.fight&&run.fight.rew){ run.fight=null; }   // cerró la app eligiendo la recompensa: el combate estaba ganado, la elección sigue en la Torre
    else if(run&&run.fight){ run.fight=null; run.lives--; run.hp=1; out.tower={floor:run.floor,lives:run.lives}; }
    const P=S.pvp; if(P&&P.fight){ out.pvp=pvpLoss(P.fight); P.fight=null; P.rival=null; }
    return out.tower||out.pvp?out:null }
  function reset(){ S=null; B=null; HS=null; if(storage) try{storage.del(SAVE_KEY)}catch(e){} }
  // Nombre del jugador: 3-16 caracteres (letras, números, espacio, _ y -)
  function cleanName(n){ return String(n||'').replace(/[^\p{L}\p{N} _-]/gu,'').replace(/\s+/g,' ').trim().slice(0,16) }
  const validName=n=>cleanName(n).length>=3;
  // El nombre es permanente: solo se puede poner si la partida aún no tiene (partidas antiguas)
  function setName(n){ const c=cleanName(n); if(c.length<3||S.name) return false; S.name=c; save(); emit('change'); return true }
  function newGame(cls,name){ S=newState(cls,name); HS=null; S.startDay=dayKey(); S.boxT=CFG.box.welcome; startWave(); track('start',{cls,name:S.name}); emit('change'); return S }
  /* ---------- fórmulas ---------- */
  const hasCard=()=>dayKey()<S.cardUntil, hasVip=()=>dayKey()<S.vipUntil;
  const goldMul=()=>(hasCard()?1+CFG.cardGold:1)*(1+talBonus('gold'))*(1+clanBonus('gold'));   // oro de los enemigos (también sin conexión): Tarjeta mensual, talento Fortuna y bonus de clan
  const statsDirty=()=>{HS=null};
  const heroStats=()=>HS||(HS=computeStats());
  // niveles ganados (contando lo que valen): los de después de cada evolución valen grow[i] × lo de antes (en vida, daño y defensa)
  function lvlGain(lvl,evo,cls){ const L=lvl-1, T=evoTiers(), G=(CFG.classes[cls]||{}).grow||[]; let v=0, from=0;
    for(let i=0;i<=Math.min(evo,T.length);i++){ const to=i<evo&&T[i]?T[i].lvl-1:Infinity, n=Math.max(0,Math.min(L,to)-from);
      v+=n*(i===0?1:G[i-1]||1); from=Math.max(from,to); if(L<=to) break; }
    return v }
  function computeStats(){
    if(towerOn()) return towerStats();
    const c=CFG.classes[S.cls], u=S.up, U=CFG.upgrades, A=S.absorb||{}, KS=(kitNow()||{}).stat||{};   // KS: ajuste de daño de la etapa del kit (equilibrio)
    // equipo (heroe/equipo.js): el Arma suma daño, la Armadura vida y defensa, el Anillo crítico y daño crítico, el Amuleto daño de las habilidades (sk); cada pieza, su
    // extra fijo (vida, defensa, crítico o daño a jefes; no sube con el nivel); el set, vida, daño y defensa (ss)
    const lg=lvlGain(S.lvl,S.evo,S.cls), ar=1+slotV('armadura'), ss=1+setInfo().st, ring=slotV('anillo');
    return {
      // talentos (heroe/talentos.js): Fuerza, Vitalidad y Coraza multiplican; Cazador suma daño a élites y JEFES; Sabiduría, experiencia
      hp:(c.hp+(A.hp||0)+c.ghp*lg)*Math.pow(U.hp.mult,u.hp)*evoBonus('hp')*(1+extraOf('hp'))*ar*ss*(1+talBonus('hp'))*(pvpOn()&&B.hpM||1),
      atk:(c.atk+(A.atk||0)+c.gatk*lg)*Math.pow(U.atk.mult,u.atk)*evoBonus('atk')*(1+weaponBonus())*ss*(1+talBonus('atk'))*(KS.atk||1),
      df:(c.df+(A.df||0)+c.gdf*lg)*Math.pow(U.df.mult,u.df)*evoBonus('df')*(1+extraOf('df'))*ar*ss*(1+talBonus('df')),
      spd:c.spd*Math.pow(U.spd.mult,u.spd),
      cr:Math.min(CFG.caps.cr,c.cr+extraOf('cr')+ring), cd:c.cd+extraOf('cd')+ring*(CFG.equip.anillo.cd||0), sk:slotV('amuleto'),
      ls:Math.min(CFG.caps.ls,extraOf('ls')), bd:extraOf('bd')+talBonus('bd'), ranged:c.ranged,
      regen:c.regen||0, dmgTaken:c.dmgTaken||1, xpMult:(1+talBonus('xp'))*(1+clanBonus('xp')), fx:weaponFx(),   // fx: el efecto del arma Épica o Legendaria (combate/arma-efecto.js)
    };
  }
  // Torre: héroe único (CFG.tower.hero) + solo las cartas, grimorios y maldiciones de la partida.
  // Las cartas de estadística se suman por copia; Talismán se multiplica (×0,8 por copia). Sin topes: el crítico de más de
  // 100 % se suma al daño crítico. Furia ciega: la velocidad extra también suma daño crítico.
  function towerStats(){ const H=CFG.tower.hero, run=S.tower.run, X={atk:0,hp:0,spd:0,cr:0,cd:0,df:0,ls:0,regen:0,refl:0,dbl:0};
    for(const b of run.boons){ const d=boonDef(b); if(!d||(d.type!=='stat'&&b.id!=='segador')) continue; for(const k of ['atk','hp','spd','cr','cd','df','ls','regen']) X[k]+=d[k]||0; X.refl+=d.reflect||0; X.dbl+=d.dbl||0; }
    const spd=H.spd*(1+X.spd), crT=H.cr+X.cr;
    return {
      hp:H.hp*Math.max(0.2,1+X.hp+(run.hpBonus||0)+CFG.tower.curses.fragil.hp*tcurse('fragil')), atk:H.atk*(1+X.atk), df:H.df*(1+X.df), spd,
      cr:Math.min(1,crT), cd:H.cd+X.cd+Math.max(0,crT-1)+(tgH('furiaCiega')?X.spd:0),
      ls:Math.min(1,X.ls), bd:0, ranged:false, regen:X.regen, refl:X.refl, dbl:X.dbl,
      dmgTaken:Math.pow(1-CFG.tower.cards.talisman.taken,tcN('talisman')), xpMult:1, fx:null, sk:0 } }
  /* ---------- equipo: 4 huecos por copias, sets y la caja de invocación con garantía ---------- */
  // Huecos (SLOTS): Arma (CFG.weapon) y Armadura, Anillo y Amuleto (CFG.equip), que se abren en la fase «open» de Normal con su Común de regalo. Cada rareza es una
  // pieza distinta: se tiene con 1 copia (+0) y sube con 1, 2, 3, 4 y 5 copias más (16 en total); en cada hueco se equipa sola la mejor. Sets (CFG.sets): con 2 y 4
  // piezas de una rareza o mejor. La caja (CFG.box) da una copia del hueco que elijas por tirada; tira en cascada (la rareza más alta primero, con su % fijo) y la
  // garantía es una para todos los huecos. Se paga con tickets de invocación (boxT) o con oro (minutos de farmeo de tu récord, máximo 5 al día).
  const SLOTS=['arma','armadura','anillo','amuleto'], SNAME={arma:'Arma',armadura:'Armadura',anillo:'Anillo',amuleto:'Amuleto'};
  const slotCfg=s=>s==='arma'?CFG.weapon:CFG.equip[s];
  const slotOpen=s=>s==='arma'||!!(S&&((S.mode||0)>0||(S.evo||0)>=1||(S.best||0)>=slotCfg(s).open));
  const gearCopies=s=>S.gear[s||'arma'];
  const gearLvl=n=>{ const need=CFG.weapon.need; let l=-1; for(let i=0;i<need.length;i++) if(n>=need[i]) l=i; return l };
  // nivel (Nv) de cada pieza con mineral (CFG.pieceLv, S.gearNv): aparte del +0…+5 de las copias; cada nivel suma pct del valor principal
  const PL=()=>CFG.pieceLv;
  const nvOf=(s,r)=>{ const a=S&&S.gearNv&&S.gearNv[s]; return a&&a[r]>0?a[r]|0:0 };
  const nvCap=r=>PL()?PL().cap[r]||0:0;
  const slotVal=(s,r,l,nv)=>{ const C=slotCfg(s); return (C.base[r]+C.step[r]*l)*(1+(PL()?PL().pct:0)*(nv||0)) };
  const gearDmg=(r,l)=>slotVal('arma',r,l);
  // la mejor pieza de un hueco, contando su nivel (a igualdad, la de más rareza); -1 si no tiene ninguna (el arma, la Común)
  function bestLine(c,s){ s=s||'arma'; c=c||gearCopies(s); let best=-1,bp=-1; for(let r=0;r<c.length;r++){ const l=gearLvl(c[r]); if(l<0) continue; const p=slotVal(s,r,l,nvOf(s,r)); if(p>=bp){ bp=p; best=r } } return best<0&&s==='arma'?0:best }
  // la pieza equipada de un hueco (su rareza): la que eligió el jugador (S.gearEq; se equipa a mano). Sin una elección válida (partidas de antes, fantasmas de PvP,
  // herramientas de prueba), la mejor
  function eqR(s,c){ c=c||gearCopies(s); const e=S&&S.gearEq?S.gearEq[s]:null; if(e!=null&&c&&gearLvl(c[e])>=0) return e; return bestLine(c,s) }
  // la pieza equipada en un hueco: {r, l, nv, v} (rareza, +N de copias, nivel con mineral y valor), o null (hueco cerrado o vacío)
  function piece(s){ if(!S||!S.gear||!slotOpen(s)) return null; const c=gearCopies(s); if(!c) return null; const r=eqR(s,c); if(r<0) return null; const l=gearLvl(c[r]); if(l<0) return null; const nv=nvOf(s,r); return {r,l,nv,v:slotVal(s,r,l,nv)} }
  const slotV=s=>{ const p=piece(s); return p?p.v:0 };
  // el extra fijo de cada pieza (el de su rareza, su hueco y tu clase): {s: estadística, v: valor}; no depende del nivel. Cuentan los de todas las piezas equipadas.
  const slotExtra=(s,r)=>{ const e=S&&slotCfg(s).extra&&slotCfg(s).extra[S.cls]; return e&&e[r]&&typeof e[r]==='object'?e[r]:null };
  const weaponExtra=(r)=>slotExtra('arma',r==null?eqR('arma'):r);
  const XNAME={hp:'Vida',df:'Defensa',cr:'Crítico',bd:'Daño a jefes'};
  const extraOf=(st)=>{ let v=0; for(const s of SLOTS){ const p=piece(s), e=p&&slotExtra(s,p.r); if(e&&e.s===st) v+=e.v; } return v };
  const weaponBonus=()=>{ if(!S||!S.gear) return CFG.weapon.base[0]; const p=piece('arma'); return p?p.v:CFG.weapon.base[0] };
  // sets: las piezas equipadas de cada rareza o mejor; st: lo que suman a vida, daño y defensa (2 piezas + 4 piezas); fx: lo que cambian del efecto del arma
  function setInfo(){ const C=CFG.sets, rs=SLOTS.map(piece).filter(Boolean).map(p=>p.r), n=r=>rs.filter(x=>x>=r).length;
    const best=k=>{ for(let r=CFG.rar.length-1;r>=0;r--) if(n(r)>=k) return r; return -1 }, r2=best(2), r4=best(4);
    return {pieces:rs.length,count:CFG.rar.map((_,r)=>n(r)),r2,r4,st:C?(r2>=0?C.two[r2]:0)+(r4>=0?C.four[r4]:0):0,fx:C&&r4>=0?C.fx[r4]:null} }
  // el efecto de las armas Épica y Legendaria (CFG.weapon.fx; lo que hace, en combate/arma-efecto.js): {id, name, …números} de la rareza r (o de la equipada, con lo
  // que le cambie el set), o null. Un número puede ser distinto por camino, {A, B} (sin evolucionar, el de A); ch (cargas por efecto) es 1 si no se dice
  const wfxPick=(k,v,p)=>v&&typeof v==='object'&&!Array.isArray(v)?(v[p]!=null?v[p]:k==='ch'?1:v.A):v;
  const weaponFx=(r)=>{ const F=S&&CFG.weapon.fx&&CFG.weapon.fx[S.cls], eq=r==null; if(eq) r=S&&S.gear?eqR('arma'):0; const L=F&&(r===3?F.ep:r===4?F.lg:null); if(!L) return null;
    const p=S.evo>=1&&S.path==='B'?'B':'A', o={id:F.id,name:F.name,r}; for(const [k,v] of Object.entries({ch:F.ch,...L})) if(v!=null) o[k]=wfxPick(k,v,p);
    const f=eq&&setInfo().fx;   // set de 4 Épicas o mejores: sale más a menudo; de 4 Legendarias, además más cargas (el clon dura más)
    if(f){ const hits=o.id==='tajo'||o.id==='llama'||o.id==='reflejo'; if(f.every) o.every=hits?Math.max(1,Math.round(o.every*f.every)):Math.round(o.every*f.every*100)/100;
      if(f.ch){ if(o.id==='reflejo') o.dur+=f.ch; else o.ch=(o.ch==null?1:o.ch)+f.ch; } o.set=true; }
    return o };
  // qué hace, en palabras (con los números de la rareza); lo que da en cada camino (a, b: cuántas cargas en A y en B)
  const WFX_C={Guerrero:(a,b)=>`${a} de Guardia (camino A) o ${b} de Furia (camino B)`,Mago:(a,b)=>`${a>1?`le pone ${a} quemaduras`:'lo quema'} (camino A) o le clava ${b} ${b>1?'esquirlas':'esquirla'} (camino B)`,
    Arquero:(a,b)=>`${a} de Concentración (camino A) o ${b} de Ritmo (camino B)`,Asesino:()=>'sus críticos dan cuchillas (camino A) y sus golpes envenenan (camino B)',
    Clerigo:(a,b)=>`${a} de Luz (camino A) o ${b} ${b>1?'Sombras':'Sombra'} (camino B)`};
  // (con números por camino {A, B}: «220 % en A / 90 % en B»)
  function weaponFxDesc(F,cls){ if(!F) return ''; const ab=(v,f)=>v&&typeof v==='object'?(v.A===v.B?f(v.A):`${f(v.A)} en A / ${f(v.B)} en B`):f(v), pc=x=>ab(x,y=>Math.round(y*100)+' %'), sec=x=>ab(x,y=>String(y).replace('.',',')), num=x=>ab(x,y=>y);
    const ch=k=>{ const v=F.ch; return v==null?1:typeof v==='object'?(v[k]!=null?v[k]:1):v }, c=WFX_C[cls]?WFX_C[cls](ch('A'),ch('B')):'';
    switch(F.id){
      case 'tajo': return `Cada ${num(F.every)} golpes, una onda de corte del ${pc(F.mult)} a hasta ${num(F.n)} (el doble si hay uno solo). Da ${c}.`+(F.onSkill?' Cada habilidad que lanzas también la suelta.':'');
      case 'orbe': return `Un orbe lanza cada ${sec(F.every)} s un rayo del ${pc(F.mult)} al primer enemigo, que ${c}.`+(F.onSkill?` Cada habilidad que lanzas dispara ${num(F.onSkill)} rayos más.`:'');
      case 'halcon': return `Cada ${sec(F.every)} s, un halcón cae sobre el enemigo con menos vida (${pc(F.mult)}). Da ${c}.`+(F.onSkill?' Cada habilidad que lanzas lo hace caer al momento.':'');
      case 'reflejo': return `Cada ${num(F.every)} golpes, un clon copia tus golpes, tu veneno y tus cuchillas ${sec(F.dur)} s (al ${pc(F.copy)}); ${c}.`+(F.skills?' También copia tus habilidades.':'');
      case 'llama': return `Cada ${num(F.every)} golpes, un destello del ${pc(F.mult)} a hasta ${num(F.n)} (el doble si hay uno solo). Da ${c}.`+(F.onSkill?' Cada habilidad que lanzas también lo suelta.':'');
    } return '' }
  const fxInfo=r=>{ const F=CFG.weapon.fx&&CFG.weapon.fx[S.cls], L=F&&(r===3?F.ep:r===4?F.lg:null); return L?{id:F.id,name:F.name,desc:weaponFxDesc({id:F.id,ch:F.ch,...L},S.cls)}:null };   // (el texto, con los números de los dos caminos)
  // poder del arma en daño equivalente: su daño, su extra (weapon.extraPower) y su efecto (fxPower)
  const weaponPower=()=>{ const p=piece('arma')||{r:0,l:0,v:CFG.weapon.base[0]}, W=CFG.weapon; return (1+p.v)*(1+W.extraPower[p.r])*(1+((W.fxPower||[])[p.r]||0))-1 };
  // poder de todo el equipo en daño del arma equivalente, como lo cuenta el héroe de referencia (lo que rinde en la campaña, medido con el ritmo): cada pieza vale
  // power × el daño del arma de su rareza y nivel, con la mitad de su extra y, el arma, ¾ de su efecto (la Legendaria, 70 %); los sets, lo que suman a vida, daño y
  // defensa (×2: valen en ataque y en defensa)
  const REF_FX={3:0.75,4:0.7};
  const pieceRef=(s,p)=>{ if(!p) return 0; const W=CFG.weapon, k=s==='arma'?1:slotCfg(s).power;
    return (1+k*gearDmg(p.r,p.l)*(1+(PL()?PL().pct:0)*(p.nv||0)))*(1+0.5*k*W.extraPower[p.r])*(s==='arma'?1+(REF_FX[p.r]||0)*((W.fxPower||[])[p.r]||0):1)-1 };
  const gearPower=()=>{ let m=1; for(const s of SLOTS) m*=1+pieceRef(s,piece(s)); return m*(1+2*setInfo().st)-1 };
  // un hueco para la pantalla: la pieza equipada y una línea por rareza (copias, nivel, valor, extra y, en el arma, el efecto)
  // (por línea: nv, nvCap y nvCost, el nivel con mineral; eq, si es la equipada; extra, copias que pasan del +5; scrap, la chatarra al romperla entera)
  function gear(s){ s=SLOTS.includes(s)?s:'arma'; if(!S) return null; const C=slotCfg(s), W=CFG.weapon, c=gearCopies(s), names=C.names[S.cls], rb=eqR(s,c), r=Math.max(0,rb), l=gearLvl(c[r]), MAXC=W.need[W.max];
    const lines=[0,1,2,3,4].map(i=>{ const li=gearLvl(c[i]), e=slotExtra(s,i), nv=nvOf(s,i), v=slotVal(s,i,Math.max(0,li),nv);
      return {r:i,id:CFG.rar[i].id,rar:CFG.rar[i].name,name:names[i],copies:c[i],owned:li>=0,lvl:li,nv,nvCap:nvCap(i),nvCost:li>=0?nvCost(s,i):null,eq:li>=0&&i===rb,v,dmg:v,
        extra:e?{s:e.s,name:XNAME[e.s],v:e.v}:null,fx:s==='arma'?fxInfo(i):null,toNext:li<0?W.need[0]-c[i]:li<W.max?W.need[li+1]-c[i]:0,over:Math.max(0,c[i]-MAXC),
        scrap:li>=0?c[i]*scrapPer(i)+0:0,refund:li>=0?Math.floor(nvSpent(i,nv)*(PL()?PL().refund:0)):0}});
    const has=rb>=0&&l>=0, nv=has?nvOf(s,r):0, v=has?slotVal(s,r,l,nv):0, nextV=has&&l<W.max?slotVal(s,r,l+1,nv):null;
    return {slot:s,slotName:SNAME[s],open:slotOpen(s),openAt:C.open||0,has,name:names[r],rar:CFG.rar[r].name,rarId:CFG.rar[r].id,r,lvl:l,nv,max:W.max,v,dmg:v,cd:s==='anillo'?v*(C.cd||0):0,
      extra:lines[r].extra,fx:lines[r].fx,copies:c[r],toNext:has&&l<W.max?W.need[l+1]-c[r]:0,nextV,nextDmg:nextV,lines,isNew:!!(S.gearNew&&S.gearNew[s])} }
  const weapon=()=>gear('arma');
  const gearSlots=()=>S?SLOTS.map(gear):[];
  // abre los huecos que ya tocan (por la fase de Normal, o al pasar a Pesadilla): su Común de regalo y box.slotGift tickets (una vez: si aún no tenía ninguna copia)
  function gearOpenCheck(){ if(!S||!S.gear) return false; let any=false;
    for(const s of SLOTS){ if(s==='arma'||!slotOpen(s)) continue; const c=S.gear[s]; if(!c||c.some(x=>x>0)) continue; c[0]=1; S.gearEq=S.gearEq||{}; S.gearEq[s]=0; S.boxT=(S.boxT||0)+(CFG.box.slotGift||0); any=true; emit('slotOpen',{slot:s,name:SNAME[s],tickets:CFG.box.slotGift||0}); }
    if(any) statsDirty(); return any }
  // --- la caja ---
  const boxT=()=>CFG.box.free[Math.min(S.mode||0,CFG.box.free.length-1)];
  const boxDay=()=>{ const d=dayKey(); if(!S.boxDay||S.boxDay.d!==d) S.boxDay={d,n:0}; return S.boxDay };
  const boxGoldCost=()=>Math.max(20,farmRate(Math.max(1,S.best)).g*60*CFG.box.gold.min*(1+CFG.box.gold.step*boxDay().n));
  const boxGoldLeft=()=>Math.max(0,CFG.box.gold.perDay-boxDay().n);
  // probabilidad de la rareza máxima en la tirada nº c desde la última: su % fijo, y desde «soft» sube en línea recta hasta el 100 % en «hard»
  function boxTopP(T,c){ const tot=T.odds.reduce((a,b)=>a+b,0), pb=T.odds[T.top.r]/tot; if(c>=T.top.hard) return 1; if(c<T.top.soft) return pb; return Math.min(1,pb+(c-T.top.soft+1)*(1-pb)/(T.top.hard-T.top.soft+1)) }
  // en cascada: primero la rareza máxima (con su garantía); si falla, la media si toca garantizarla; si no, de arriba abajo, cada una con su % fijo (lo que queda, Común)
  function boxDraw(T,P){ P.top++; let r=-1;
    if(rand()<boxTopP(T,P.top)) r=T.top.r;
    else if(P.mid+1>=T.mid.n) r=T.mid.r;
    else { let left=T.odds.reduce((a,b)=>a+b,0)-T.odds[T.top.r]; for(let i=T.top.r-1;i>0;i--){ const p=T.odds[i]; if(rand()<p/left){ r=i; break } left-=p; } if(r<0) r=0; }
    if(r>=T.top.r) P.top=0; if(r>=T.mid.r) P.mid=0; else P.mid++; return r }
  function boxInfo(){ if(!S) return null; const T=boxT(), P=S.boxP.free, tot=T.odds.reduce((a,b)=>a+b,0);
    return {mode:S.mode||0, rates:T.odds.map((o,i)=>({r:i,id:CFG.rar[i].id,name:CFG.rar[i].name,pct:o/tot*100})).reverse(),   // (de la más alta a la más baja: el orden de la cascada)
      mid:{r:T.mid.r,name:CFG.rar[T.mid.r].name,n:T.mid.n,left:Math.max(1,T.mid.n-P.mid)},
      top:{r:T.top.r,name:CFG.rar[T.top.r].name,soft:T.top.soft,hard:T.top.hard,count:P.top,left:Math.max(1,T.top.hard-P.top),pNext:boxTopP(T,P.top+1)},
      tickets:S.boxT||0, gold:{cost:boxGoldCost(),left:boxGoldLeft(),limit:CFG.box.gold.perDay}, slots:SLOTS.filter(slotOpen)} }
  // botín de un élite o JEFE ya vencido (al farmear su fase o en la Sala de jefes): con su probabilidad (CFG.box.drop, que sube con la fase), una pieza de un hueco
  // abierto al azar; su rareza en cascada como la caja gratis del modo, sin garantía y con la máxima × top
  const dropP=f=>{ const D=CFG.box.drop, j=f%30===0, [a,b]=j?D.jefe:D.elite, f0=j?30:10, f1=j?CAP():CAP()-10; return a+(b-a)*Math.max(0,Math.min(1,(f-f0)/(f1-f0))) };
  function gearDrop(f,m){ const D=CFG.box.drop; if(!D||!S||!(rand()<dropP(f))) return null;   // (m: el modo del jefe; si no, el actual)
    const res={...gearPiece(m),f}; track('drop',{f,slot:res.slot,r:res.id}); emit('gearDrop',res); return res }
  // una pieza de un hueco abierto al azar; su rareza en cascada como la caja gratis del modo m, sin garantía y con la máxima × box.drop.top (top: forzar la máxima)
  function gearPiece(m,top){ const D=CFG.box.drop, open=SLOTS.filter(slotOpen), slot=open[Math.floor(rand()*open.length)], T=m==null?boxT():CFG.box.free[Math.min(m,CFG.box.free.length-1)], tot=T.odds.reduce((a,b)=>a+b,0); let r=-1;
    if(top||rand()<T.odds[T.top.r]/tot*(D?D.top:1)) r=T.top.r;
    else { let left=tot-T.odds[T.top.r]; for(let i=T.top.r-1;i>0;i--){ const q=T.odds[i]; if(rand()<q/left){ r=i; break } left-=q; } if(r<0) r=0; }
    return addCopy(slot,r) }
  // n tiradas (1 a 10) del hueco «slot» (abierto), pagadas con 'ticket' u 'oro'; devuelve lo que salió en cada una. Si no llega para todas, hace las que pueda.
  function pull(n,via,slot){ if(!S) return {ok:false,why:'nogame'}; slot=SLOTS.includes(slot)?slot:'arma'; if(!slotOpen(slot)) return {ok:false,why:'closed'};
    n=Math.max(1,Math.min(10,Math.floor(n)||1)); const T=boxT(), P=S.boxP.free, res=[]; let spent=0, why=null;
    for(let i=0;i<n;i++){
      if(via==='ticket'){ if((S.boxT||0)<1){ why='tickets'; break } S.boxT--; }
      else { if(boxGoldLeft()<1){ why='limit'; break } const g=boxGoldCost(); if(S.gold<g){ why='gold'; break } S.gold-=g; spent+=g; boxDay().n++; }
      res.push(addCopy(slot,boxDraw(T,P)));
    }
    if(!res.length) return {ok:false,why};
    statsDirty(); track('pull',{n:res.length,via,slot,gold:Math.round(spent),r:res.map(x=>x.id).join('')}); save(); emit('pull',res); emit('change'); return {ok:true,res,why} }
  // una copia más de la pieza r del hueco s (caja, botín o Forja). No se equipa sola: si es una pieza nueva de más rareza que la equipada, queda el aviso
  // (S.gearNew[s], hasta que abras ese hueco) y el evento 'gearNew'. equipped: si subió el valor de la equipada (copias de esa misma pieza); extra: pasa del +5
  function addCopy(s,r){ const c=gearCopies(s), p0=slotV(s), l0=gearLvl(c[r]); c[r]++; const l1=gearLvl(c[r]); statsDirty();
    const fresh=l0<0&&l1>=0, better=fresh&&r>eqR(s,c), W=CFG.weapon;
    const res={r,id:CFG.rar[r].id,name:CFG.rar[r].name,slot:s,slotName:SNAME[s],piece:slotCfg(s).names[S.cls][r],fresh,up:l1>l0&&l0>=0,lvl:l1,equipped:slotV(s)>p0+1e-12,better,extra:c[r]>W.need[W.max]};
    if(better){ S.gearNew=S.gearNew||{}; S.gearNew[s]=1; emit('gearNew',res); }
    return res }
  // equipar a mano la pieza r (que tengas) del hueco s · equipar la mejor de cada hueco (herramientas, bot de ritmo)
  function equipPiece(s,r){ if(!S||!SLOTS.includes(s)||!slotOpen(s)) return false; r=r|0; const c=gearCopies(s); if(!c||gearLvl(c[r])<0) return false;
    S.gearEq=S.gearEq||{}; S.gearEq[s]=r; if(S.gearNew) delete S.gearNew[s]; statsDirty(); save(); emit('change'); return true }
  function equipBest(){ if(!S||!S.gear) return; S.gearEq=S.gearEq||{}; for(const s of SLOTS){ const c=gearCopies(s), r=c?bestLine(c,s):-1; S.gearEq[s]=r>=0&&c&&gearLvl(c[r])>=0?r:(s==='arma'?0:null); } statsDirty() }
  const seenNew=s=>{ if(S&&S.gearNew&&S.gearNew[s]){ delete S.gearNew[s]; emit('change'); } };   // (al abrir la ventana del hueco se quita el aviso)
  // --- nivel de las piezas con mineral ---
  const nvSpent=(r,L)=>PL()?PL().base[r]*L*(L+1)/2:0;   // mineral gastado para llegar al nivel L
  const nvCost=(s,r)=>{ const L=nvOf(s,r); return !PL()||L>=nvCap(r)?null:Math.round(PL().base[r]*(L+1)) };
  // sube n niveles (los que alcancen) la pieza r del hueco s; why: 'cap' (tope de su rareza) o 'mineral'
  function nvUp(s,r,n){ if(!S||!PL()||!SLOTS.includes(s)) return {ok:false,why:'nogame'}; r=r|0; const c=gearCopies(s); if(!c||gearLvl(c[r])<0) return {ok:false,why:'owned'};
    n=Math.max(1,Math.floor(n)||1); S.gearNv=S.gearNv||{}; const a=S.gearNv[s]=S.gearNv[s]||[0,0,0,0,0,0]; let done=0, why=null;
    for(let i=0;i<n;i++){ const k=nvCost(s,r); if(k==null){ why='cap'; break } if((S.mineral||0)<k){ why='mineral'; break } S.mineral-=k; a[r]=(a[r]||0)+1; done++; }
    if(!done) return {ok:false,why}; statsDirty(); save(); emit('change'); return {ok:true,n:done,nv:a[r],why} }
  // --- romper: chatarra y la mitad del mineral gastado ---
  const scrapPer=r=>(CFG.scrap&&CFG.scrap.per[r])||0;
  // list: [{s, r, k}] con k 'all' (la pieza entera: todas sus copias; nunca la equipada) o 'extra' (solo las copias que pasan del +5; la pieza se queda)
  function breakCalc(list){ const W=CFG.weapon, MAXC=W.need[W.max], all=new Set(), out=[]; let scrap=0, mineral=0, copies=0;
    for(const x of list||[]) if(x&&x.k==='all') all.add(x.s+'|'+(x.r|0));
    const seen=new Set(); for(const x of list||[]){ if(!x||!SLOTS.includes(x.s)) continue; const s=x.s, r=x.r|0, key=s+'|'+r, c=gearCopies(s); if(!c||!(c[r]>0)) continue;
      if(x.k==='all'){ if(seen.has(key+'a')||r===eqR(s,c)) continue; seen.add(key+'a'); const m=Math.floor(nvSpent(r,nvOf(s,r))*(PL()?PL().refund:0)); scrap+=c[r]*scrapPer(r); mineral+=m; copies+=c[r]; out.push({s,r,k:'all',n:c[r],mineral:m}); }
      else if(x.k==='extra'){ if(all.has(key)||seen.has(key+'e')) continue; const e=c[r]-MAXC; if(e<=0) continue; seen.add(key+'e'); scrap+=e*scrapPer(r); copies+=e; out.push({s,r,k:'extra',n:e,mineral:0}); } }
    return {scrap,mineral,copies,list:out} }
  function breakPieces(list){ if(!S) return {ok:false,why:'nogame'}; const R=breakCalc(list); if(!R.list.length) return {ok:false,why:'none'};
    for(const x of R.list){ const c=gearCopies(x.s); if(x.k==='extra') c[x.r]-=x.n; else { c[x.r]=0; if(S.gearNv&&S.gearNv[x.s]) S.gearNv[x.s][x.r]=0; } }
    S.chatarra=(S.chatarra||0)+R.scrap; S.mineral=(S.mineral||0)+R.mineral; statsDirty(); track('break',{n:R.copies,scrap:R.scrap,mineral:R.mineral}); save(); emit('change'); return {ok:true,...R} }
  // --- Forja: 1 copia de la pieza que elijas, hasta la rareza máxima de la caja gratis del modo ---
  const forgeMax=()=>boxT().top.r;
  const forgeCost=r=>{ const F=CFG.forge; return {scrap:F.cost[r]||0, gold:Math.max(20,farmRate(Math.max(1,S.best)).g*60*(F.goldMin[r]||0))} };
  function forgeInfo(){ if(!S||!CFG.forge) return null; return {max:forgeMax(),slots:SLOTS.filter(slotOpen),scrap:S.chatarra||0,gold:S.gold,
    costs:CFG.rar.slice(0,forgeMax()+1).map((x,r)=>({r,id:x.id,name:x.name,...forgeCost(r)}))} }
  function forgeCraft(s,r){ if(!S||!CFG.forge) return {ok:false,why:'nogame'}; if(!SLOTS.includes(s)||!slotOpen(s)) return {ok:false,why:'closed'}; r=r|0; if(r<0||r>forgeMax()) return {ok:false,why:'rar'};
    const k=forgeCost(r); if((S.chatarra||0)<k.scrap) return {ok:false,why:'scrap'}; if(S.gold<k.gold) return {ok:false,why:'gold'};
    S.chatarra-=k.scrap; S.gold-=k.gold; const res=addCopy(s,r); track('forge',{slot:s,r:res.id}); save(); emit('forge',res); emit('change'); return {ok:true,res} }
  // --- mineral: por minuto de combate en la campaña (también sin conexión) × el modo ---
  const mineMult=m=>{ const M=CFG.mineral; if(!M) return 0; const a=M.mode; return a[Math.min(m==null?(S.mode||0):m,a.length-1)]||1 };
  function mineAdd(min){ if(!S||!CFG.mineral||!(min>0)) return 0; S.minF=(S.minF||0)+min*CFG.mineral.perMin*mineMult()*(1+clanBonus('mineral')); const n=Math.floor(S.minF); if(n>0){ S.minF-=n; S.mineral=(S.mineral||0)+n; } return n }   // (con el bonus de clan)
  // botín de un élite/JEFE ya vencido (al farmear su fase o en la Sala de jefes): siempre algo de mineral; con su probabilidad, pieza (gearDrop), ticket de
  // invocación, chatarra y Esencia
  function bossLoot(f,m){ if(!S) return null; m=m==null?(S.mode||0):m; const k=f%30===0?'jefe':'elite', M=CFG.mineral, L=CFG.repLoot, o={f,mode:m,mineral:0,tickets:0,scrap:0,ess:0,piece:null};
    if(M){ o.mineral=Math.round((M.rep[k]||0)*mineMult(m)); S.mineral=(S.mineral||0)+o.mineral; }
    o.piece=gearDrop(f,m);
    if(L){ if(rand()<(L.ticket[k]||0)){ o.tickets=1; S.boxT=(S.boxT||0)+1; }
      const sc=L.scrap[k]; if(sc&&rand()<sc[0]){ o.scrap=sc[1]; S.chatarra=(S.chatarra||0)+sc[1]; }
      if(rand()<(L.ess[k]||0)) o.ess=essAdd(1); }
    emit('bossLoot',o); return o }
  /* ---------- enemigos: vida, ataque y oleadas ---------- */
  // Modos (Normal, Pesadilla, Infierno): la fase f de un modo usa los enemigos de la fase f+off
  const MODES=()=>CFG.modes||[{name:'Normal',off:0,gold:1}];
  const modeCfg=()=>MODES()[S?S.mode||0:0];
  const CAP=()=>CFG.phaseCap||Infinity;                   // tope de fases de cada modo
  const effF=f=>f+(modeCfg().off||0);
  const top=()=>Math.min(S.best+1,CAP());                 // la fase más alta a la que se puede ir
  // Enemigos a partir del héroe de referencia: lo que tiene un jugador típico al llegar a la fase f del modo m (modes[m].ref, simulado).
  // Su defensa = enemy.dfK × su daño; su vida = lo que le quita cada golpe de ese héroe × golpes (modes[m].golpes); y su ataque, el que le
  // quita la vida en modes[m].aguante golpes (según la fase) con su defensa. Así las tres crecen a su ritmo y el ritmo de la campaña no cambia.
  // valor en la fase f de una tabla [[fase, …], …] (columna j), en línea recta entre puntos (log: en escala log). Antes del primero y
  // después del último punto se queda en su valor.
  function lerpP(P,f,j,log){ if(P.length===1||f<=P[0][0]) return P[0][j]; if(f>=P[P.length-1][0]) return P[P.length-1][j];
    let i=1; while(f>P[i][0]) i++; const a=P[i-1], b=P[i], t=(f-a[0])/(b[0]-a[0]);
    return log?Math.exp(Math.log(a[j])+(Math.log(b[j])-Math.log(a[j]))*t):a[j]+(b[j]-a[j])*t }
  // héroe de referencia en la fase f del modo m: [mejoras, nivel, +daño del arma]; su evolución, la del modo (Normal 0, Pesadilla 1, Infierno 2)
  function refHero(m,f){ const P=MODES()[m].ref, u=lerpP(P,f,1), lvl=lerpP(P,f,2), wd=lerpP(P,f,3), U=CFG.upgrades, cls=Object.keys(CFG.classes)[0], c=CFG.classes[cls];   // (las 5 clases tienen los mismos números)
    const lg=lvlGain(lvl,m,cls), e=k=>evoBonus(k,m);
    return {atk:(c.atk+c.gatk*lg)*Math.pow(U.atk.mult,u)*(1+wd)*e('atk'), hp:(c.hp+c.ghp*lg)*Math.pow(U.hp.mult,u)*e('hp'), df:(c.df+c.gdf*lg)*Math.pow(U.df.mult,u)*e('df')} }
  function modeCurve(m,f){ const M=MODES()[m], R=refHero(m,f), df=CFG.enemy.dfK*R.atk;
    return {hp:dmgF(R.atk,df)*lerpP(M.golpes,f,1,true), atk:atkFor(R.hp/lerpP(M.aguante,f,1),R.df), df} }
  function enemyStats(f,w,boss,mode){
    const md=mode==null?(S?S.mode||0:0):mode, E=CFG.enemy, mc=modeCurve(md,f);
    let hp=mc.hp*(1+E.waveHp*(w-1)), atk=mc.atk, df=mc.df;
    { const k=earlyK(md,f); if(k<1){ hp*=k; atk*=k; } }   // inicio suave (primeras fases de Normal)
    // Jefes: su vida se mide en "oleadas" (la vida de toda la oleada de su fase) y su ataque en enemigos (×1 = un enemigo normal)
    if(!boss&&WV()){ const V=WV(); hp*=perOld(f)/perWave(f)*(V.hpMul||1); atk*=Math.pow(V.atkG||1,groupAt(f)-1); }
    if(boss){ const per=perOld(f);
      const bb=bossBand(f), J=E.jefe, m=f%30!==0?bb:{hp:bb.hp*J.hp,atk:bb.atk*J.atk}; hp*=per*m.hp; atk*=m.atk; }   // JEFE (fases 30, 60…) = el élite de su tramo × enemy.jefe
    return {hp,atk,df};
  }
  // inicio suave (enemy.early): en las primeras fases de Normal los enemigos (también élites y JEFES) tienen menos vida y ataque: × k en la fase 1,
  // subiendo en línea recta hasta ×1 en la fase «to». Así la primera media hora va rápida y casi sin derrotas; desde ahí, todo igual
  function earlyK(m,f){ const Q=CFG.enemy.early; if(!Q||m!==0||f>=Q.to) return 1; return Q.k+(1-Q.k)*Math.max(0,f-1)/(Q.to-1) }
  // jefe normal según el tramo de fases: bossBands=[[desde, vida, ataque], ...] (en oleadas)
  function bossBand(f){ const E=CFG.enemy; let m={hp:E.bossHp,atk:E.bossAtk}; for(const [a,hp,atk] of (E.bossBands||[])) if(f>=a) m={hp,atk}; return m }
  // Daño de un golpe (fórmula del TFG, igual para héroes y enemigos): si la defensa no pasa del ataque, resta la mitad de su valor
  // (a − d/2); si lo pasa, divide (a² / 2d). Con las dos iguales, la mitad; nunca llega a 0. Con tu defensa por encima de su
  // ataque, +1 % de defensa vale lo mismo que +1 % de vida (y nunca más).
  const dmgF=(a,d)=>a<=0?0:d<=a?a-d/2:a*a/(2*d);
  // el ataque que hace `want` de daño contra esa defensa (lo contrario de dmgF)
  const atkFor=(want,d)=>want>=d/2?want+d/2:Math.sqrt(2*d*want);
  // Oleadas progresivas (enemy.waves): según sube la fase hay más enemigos por oleada, salen varios a la vez y andan y pegan
  // más rápido. La vida de la oleada entera no cambia (cada enemigo tiene su parte): perOld es el reparto antiguo (3-5).
  const perOld=f=>3+Math.floor((f-1)/CFG.enemy.extraEvery);
  const WV=()=>CFG.enemy.waves;
  const perWave=f=>{ const V=WV(); return V?Math.min(V.nMax,V.n0+Math.floor((f-1)/V.nEvery)):perOld(f) };
  const groupAt=f=>{ const V=WV(); return V?Math.min(V.gMax,V.g0+Math.floor((f-1)/V.gEvery)):1 };   // cuántos salen a la vez
  const eSpd=f=>{ const V=WV(); return V?1+V.spd*Math.min(1,(effF(f)-1)/149):1 };                    // velocidad (andar y pegar)
  /* ---------- experiencia y nivel ---------- */
  // experiencia para pasar del nivel l al l+1; xpBands cambia el crecimiento a partir de ciertos niveles
  const XPC=[0];
  function xpReq(l){ l=Math.max(1,l|0); while(XPC.length<=l){ const L=XPC.length; if(L===1){XPC.push(CFG.econ.xpReq);continue}
      let g=CFG.econ.xpReqG; for(const [a,gg,step] of (CFG.econ.xpBands||[])){ if(L>=a) g=gg; if(L===a&&step) g*=step; } XPC.push(XPC[L-1]*g); } return XPC[l] } // [desde, crecimiento, salto opcional al entrar]
  // mientras quede una evolución pendiente, el nivel no pasa de evo.lvl (la barra se queda llena)
  const evoTiers=()=>(CFG.evo&&CFG.evo.tiers)||[];
  const nextEvo=()=>evoTiers()[S.evo]||null;              // la próxima evolución (o null si ya no quedan)
  const lvlCap=()=>{ const t=nextEvo(); return t?t.lvl:Infinity };
  function addXp(x){ const l0=S.lvl, cap=lvlCap(); S.xp+=x; while(S.lvl<cap&&S.xp>=xpReq(S.lvl)){S.xp-=xpReq(S.lvl);S.lvl++}
    if(S.lvl>=cap) S.xp=Math.min(S.xp,xpReq(S.lvl)); if(S.lvl>l0){statsDirty();emit('level',S.lvl)} return S.lvl-l0 }
  /* ---------- kit del héroe: pasiva y habilidades de su etapa (CFG.kit) ---------- */
  // Etapas: base (sin evolucionar) · A1/B1 (1.ª evolución, según el camino) · A2/B2 (2.ª, sigue el camino de la 1.ª).
  // La pasiva base de la clase es un rasgo que se queda siempre (CFG.classes[cls].trait); la de la etapa es la que cambia.
  // CT: reloj de combate (no se guarda). CD[slot]: cuándo vuelve a estar lista. BUF: efectos de habilidades que duran unos segundos.
  let CT=0, GCD=0; const CD={}; const BUF={list:[]};   // GCD: hasta cuándo hay que esperar para lanzar la siguiente habilidad
  function buffMul(k){ BUF.list=BUF.list.filter(b=>b.until>CT); let m=1;
    for(const b of BUF.list){ if(k==='atk') m*=1+(b.atk||0); else if(k==='taken') m*=b.taken||1; else if(k==='spd') m*=b.spd||1; else if(k==='thorns') m*=b.thorns||1; else if(k==='df') m*=b.df||1; } return m }
  function buffAdd(k){ let a=0; for(const b of BUF.list) if(b.until>CT) a+=b[k]||0; return a }
  const kitStage=()=>!S.evo?'base':(S.path==='B'?'B':'A')+Math.min(2,S.evo);
  const kitOf=(cls,st)=>((CFG.kit||{})[cls]||{})[st]||null;
  const kitNow=()=>kitOf(S.cls,kitStage());
  const heroPassive=()=>towerOn()?null:(kitNow()||{}).passive||null;   // la Torre usa su propio héroe, sin kit
  // las 3 habilidades del kit (s1, s2, s3); recarga según su hueco (CFG.skillCd), un 10 % menos con Canalizar (Mago)
  const SLOTS0=['s1','s2','s3'], TSL=['t1','t2','t3','t4','t5','t6','t7','t8'];
  let SKk='', SKv=null;
  function kitSkills(){ const k=S.cls+kitStage(); if(SKk===k) return SKv; const K=kitNow(), cdr=(CFG.classes[S.cls]||{}).cdr||0;
    SKv=((K&&K.skills)||[]).map((d,i)=>({...d,cd:(d.cd||CFG.skillCd[i])*(1-cdr)})); SKk=k; return SKv }
  function skillDef(k){
    if(k[0]==='t'){ if(!towerOn()) return null; const t=towerSkills()[+k.slice(1)-1]; return t?{...CFG.tower.cards[t.id],id:t.id}:null }   // Torre: las cartas de habilidad
    if(towerOn()) return null;   // Torre: solo los hechizos que consigues en la partida
    const i=SLOTS0.indexOf(k); return i<0?null:kitSkills()[i]||null }
  const SLOTS_=()=>towerOn()?TSL.slice(0,towerSkills().length):SLOTS0;
  const skillSlots=()=>SLOTS_().filter(skillDef);
  // estado para la pantalla: nombre, recarga y si está lista. Las bloqueadas dicen cómo se consiguen.
  function skills(){ return SLOTS_().map((k,i)=>{ const d=skillDef(k); return d?{slot:k,id:d.id,look:d.look,name:d.name,desc:d.desc,cd:d.cd,left:Math.max(0,(CD[k]||0)-CT),ready:CT>=(CD[k]||0)}
    :{slot:k,locked:true,name:'Evolución '+i,desc:'Se desbloquea en la '+i+'.ª evolución'} }) }
  function useSkill(k){ const d=skillDef(k); if(!d) return {ok:false,why:'locked'}; if(!B||B.over) return {ok:false,why:'nofight'}; if(autoOnly()) return {ok:false,why:'auto'};
    if(CT<(CD[k]||0)) return {ok:false,why:'cd',left:CD[k]-CT};
    if(CT<GCD) return {ok:false,why:'gap',left:GCD-CT};   // aún no ha pasado la espera desde la anterior
    if(heroNoSkills()) return {ok:false,why:'stun'};      // aturdido o silenciado (enemigos de zona)
    GCD=CT+(CFG.skillGap||0); CD[k]=CT+d.cd*cdMul(); (B.cast=B.cast||[]).push(k); track('skill',{slot:k,ev:!!B.event}); emit('skill',{slot:k,name:d.name,auto:false}); return {ok:true} }
  // por defecto se lanzan solas en todos los modos; en los eventos se pueden poner a mano (opt.evAuto=false) y en la campaña también (opt.autoSkills=false)
  // en PvP, la Torre y la Mazmorra, siempre solas (sin botones)
  const autoOnly=()=>!!(B&&(B.kind==='pvp'||B.kind==='tower'||(B.event&&!B.kind)));
  const autoOpt=()=>autoOnly()?true:B&&B.event?!(S.opt&&S.opt.evAuto===false):!(S.opt&&S.opt.autoSkills===false);
  const skillsAuto=autoOpt;
  const manualSkills=()=>!!(B&&B.event&&!autoOpt());
  /* ---------- qué cuenta en el combate actual: cartas y grimorios de la Torre, pasivas, efectos de arma ---------- */
  // Torre: las mejoras elegidas en la partida se suman a lo tuyo solo mientras luchas en la Torre
  const towerOn=()=>!!(B&&B.kind==='tower');
  const pvpOn=()=>!!(B&&B.kind==='pvp');
  // run.boons: {t:'c',id} cartas (CFG.tower.cards) y {t:'g',id} grimorios (CFG.tower.grims)
  const tBoons=()=>towerOn()&&S.tower&&S.tower.run?S.tower.run.boons:[];
  const boonDef=b=>b&&(b.t==='c'?CFG.tower.cards[b.id]:b.t==='g'?CFG.tower.grims[b.id]:null);
  const towerSkills=()=>tBoons().filter(b=>b.t==='c'&&CFG.tower.cards[b.id]&&CFG.tower.cards[b.id].type==='skill');
  const tcN=id=>tBoons().filter(b=>b.t==='c'&&b.id===id).length;   // cuántas copias de esta carta
  const tgH=id=>tBoons().some(b=>b.t==='g'&&b.id===id)?1:0;       // ¿tienes este grimorio?
  const tcurse=id=>towerOn()&&S.tower&&S.tower.run?(S.tower.run.curses||[]).filter(c=>c===id).length:0;   // maldiciones de la partida
  /* ---------- sorpresas en la campaña y racha ---------- */
  const STK={n:0}, SUR={next:null,kind:null,until:0};
  const streakMul=()=>1+Math.min(CFG.streak.max,Math.floor(STK.n/CFG.streak.per)*CFG.streak.pct);
  const hordeOn=()=>SUR.kind==='horde'&&CT<SUR.until;
  function pickSurprise(){ const C=CFG.surprise;
    const w=C.weights||{horde:1,wander:1}, keys=Object.keys(w).filter(k=>C[k]), tot=keys.reduce((a,k)=>a+w[k],0); let r=rand()*tot;
    for(const k of keys){ if((r-=w[k])<0) return k } return keys[0] }
  function surpriseTick(){ const C=CFG.surprise; if(!C||!B||B.event) return;
    const every=C.every, jit=C.jitter;
    if(SUR.next===null) SUR.next=CT+every+(rand()*2-1)*jit;
    if(SUR.kind&&CT>=SUR.until){ const k=SUR.kind; SUR.kind=null;
      if(k==='wander'){ const w=B.enemies.find(e=>e.wander&&!e.dead); if(w){ w.dead=true; w.fled=true; emit('surprise',{k:k+'Fled'}); } }
      else emit('surprise',{k:'hordeEnd'}); }
    if(SUR.kind||B.boss||CT<SUR.next) return;
    SUR.next=CT+every+(rand()*2-1)*jit;
    const k=pickSurprise();
    if(k==='horde'){ SUR.kind='horde'; SUR.until=CT+C.horde.dur; emit('surprise',{k:'horde',dur:C.horde.dur}); return }
    const W=C[k], e=enemyStats(S.fase%30===0?S.fase-1:S.fase,S.wave,true), hp=e.hp*(W.hp||1);   // errante = un élite de su fase
    B.enemies.push({hp,max:hp,atk:e.atk*(W.atk||1),df:e.df,spawn:B.t,walk:walkT(),arrive:B.t+walkT(),next:B.t+walkT(),first:false,dead:false,wander:true,sk:k,spd:1});
    zoneSetup(B.enemies[B.enemies.length-1],S.fase,S.mode,rand()<0.5?'e1':'e2',{noEscort:true});   // errante: uno de los 2 élites de su zona
    SUR.kind=k; SUR.until=CT+W.dur; emit('surprise',{k,dur:W.dur}); }
  const surpriseState=()=>SUR.kind&&CT<SUR.until?{k:SUR.kind,left:SUR.until-CT}:null;
  /* ---------- combate ---------- */
  function startWave(){
    if(B&&B.event) return; // el evento en curso no se interrumpe
    // jefe: en la oleada 10 de las fases múltiplo de 10, al empujarla y también al farmearla una vez vencido
    const boss=(S.wave===10 && S.fase%10===0 && S.fase<=S.best+1);   // fase 10 y 20 de cada zona: élite · 30: JEFE (también al farmear su fase: puede soltar una pieza)
    const rep=boss&&S.fase<=S.best&&S.fase<CAP();   // repetido: da lo de una oleada normal (el de la 150, como siempre)
    const h=heroStats();
    B={intro:boss?CFG.encounter.intro:0,t:0,boss,rep,elite:boss&&S.fase%30===0,count:boss?1:perWave(S.fase)*(hordeOn()?CFG.surprise.horde.count:1),spawned:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0};
    const g=boss?1:Math.min(B.count,groupAt(S.fase)); for(let i=0;i<g;i++) spawnEnemy(i*((WV()||{}).gap||0)); emit('wave',B);
  }
  // Embestida: los de cuerpo a cuerpo saltan al enemigo, así que esperan menos a que llegue (× enemy.dash)
  const walkT=()=>CFG.enemy.walk/eSpd(S.fase)*(heroStats().ranged?1:(CFG.enemy.dash||1));
  function spawnEnemy(late){   // late: sale un poco después (los del mismo grupo llegan escalonados)
    const e=enemyStats(S.fase,S.wave,B.boss), W=walkT()+(late||0); // (enemyStats ya aplica el modo)
    B.enemies.push({hp:e.hp,max:e.hp,atk:e.atk,df:e.df,spawn:B.t,walk:W,arrive:B.t+W,next:B.t+W,first:true,dead:false,spd:B.boss?1:eSpd(S.fase)});
    if(B.boss){ const o=B.enemies[B.enemies.length-1]; zoneSetup(o,S.fase,S.mode,bossRole(S.fase),{muro:true});   // élite o JEFE de su zona (con su fuerza de muro de la campaña)
      if(B.rep){ const k=CFG.encounter.repHp||1; o.hp*=k; o.max*=k; } }   // ya vencido: vuelve con menos vida
    B.spawned++;
  }
  function endWave(delay){ B.over=true; B.wait=delay }
  // Avanza el combate dt segundos de juego.
  function step(dt){ if(B&&B.kind==='pvp'&&GH) return duelStep(dt); if(B&&B.event&&!B.kind) return labStep(dt); stepCore(dt) }
  // Mazmorra: B.rt cuenta el tiempo real (límite maxDur); desde speedFrom s se acelera: ×(1 + speedUp·(rt − speedFrom))
  const labSpeed=()=>{ const V=CFG.event, rt=(B&&B.rt)||0; return 1+(V.speedUp||0)*Math.max(0,rt-(V.speedFrom||0)) };
  // (si la Mazmorra acaba a mitad de paso, el tiempo que sobra se descarta: no lo juega la campaña)
  function labStep(dt){ while(dt>1e-9&&B&&B.event&&!B.kind){ const sp=labSpeed(), r=Math.min(dt,0.05/sp); dt-=r; B.rt=(B.rt||0)+r; stepCore(r*sp); } }
  function stepCore(dt){
    if(!S||!B) return;
    if(!B.event) mineAdd(dt/60);   // mineral: por minuto de combate en la campaña
    if(B.over){ B.wait-=dt; if(B.wait<=0) startWave(); return }
    if(B.intro>0){ B.intro-=dt; return }   // entrada: el combate no empieza hasta que se va el cartel (élite, JEFE, Torre)
    if(B.rew&&!B.rewDone) return;   // Torre: el combate se queda parado mientras eliges la recompensa
    const h0=heroStats(), AF=B.event&&!B.kind&&B.aff;
    const h=AF&&(AF.cr||AF.ls||AF.noHeal)?{...h0,cr:Math.min(CFG.caps.cr,h0.cr+(AF.cr||0)),ls:Math.min(CFG.caps.ls,h0.ls+(AF.ls||0)),noHealAll:!!AF.noHeal}:h0;   // Mazmorra: modificador del día
    const P=heroPassive(), TW=towerOn(), TC=CFG.tower.cards, TG=CFG.tower.grims, F=h.fx;   // F: efecto del arma Épica o Legendaria (combate/arma-efecto.js)
    B.t+=dt; CT+=dt; grimXp(dt);
    // Grimorio del Tiempo: guarda la vida de hace unos segundos (muestra cada 0,5 s)
    if(B.event&&B.kind==='boss'){ if(B.t>=CFG.wboss.dur||(B.clan?S.clanRun&&S.clanRun.week<weekKey():S.wbRun&&S.wbRun.week<weekKey()&&!evPaused())){ endEvent(); return } wbUpdate(); if(B.hp<=0){ endEvent(); return } }   // (un intento de la semana pasada se cierra)
    if(!B.event){ if(B.boss&&CFG.encounter.bossTime&&B.t>=CFG.encounter.bossTime){ lose(true); return } surpriseTick(); }   // élite y JEFE de la campaña: si no cae a tiempo, cuenta como derrota
    else if(!B.kind){ if((CFG.event.dur&&B.t>=CFG.event.dur)||(B.rt||0)>=(CFG.event.maxDur||1e9)||(S.evRun&&S.evRun.day<dayKey()&&!evPaused())){ endEvent(); return } evSpawn(); } // solo la Mazmorra (no tiene kind): un intento de ayer se cierra al acabar la pausa
    // curación (ls: viene del robo de vida)
    // (zonas: infección, sin curar, pudrición… · PvP: × pvp.heal)
    const heal=(x,ls)=>{ if(h.noHealAll) return; x=zoneHeal(x,h); if(B.kind==='pvp') x*=CFG.pvp.heal==null?1:CFG.pvp.heal; const b=B.hp; B.hp=Math.max(b,Math.min(heroCap(h),B.hp+x)); const got=B.hp-b;
      if(ls&&TW&&x>got&&tgH('sangreHirviente')) addShield(x-got); };   // Torre · Sangre hirviente: el robo de vida que sobra es escudo
    // Torre: multiplicador de daño de las cartas y grimorios (golpes y habilidades)
    const tMul=tg=>{ if(!TW) return 1; let m=1; const ne=tcN('ejecutor'); if(ne&&tg.hp<TC.ejecutor.below*tg.max) m*=1+TC.ejecutor.mult*ne;
      if(tgH('demonio')) m*=1+TG.demonio.per*B.t; if(tgH('furiaSangre')) m*=1+TG.furiaSangre.per*Math.max(0,1-B.hp/h.hp);
      return m*(1+(B.heart||0))*(1+(B.shur||0)) };
    // Torre: ganar escudo (Juggernaut: golpe a un enemigo al azar, como mucho cada 0,5 s)
    const addShield=x=>{ if(!(x>0)) return; x=zoneShield(x,h); BUF.shield=Math.min((BUF.shield||0)+x,TW?h.hp*CFG.tower.shieldMax:Infinity);   // Torre: el escudo no pasa de tu vida máxima
      if(TW&&tgH('juggernaut')&&CT>=(B.jugAt||0)){ const os=B.enemies.filter(e=>!e.dead&&e.arrive<=B.t+0.5), o=os[Math.floor(rand()*os.length)]; if(o){ B.jugAt=CT+0.5; zap(o,dmgF(h.atk,o.df)*TG.juggernaut.mult*tMul(o),{jug:true}); } } };
    // Torre: perder vida (por golpes o por tus cartas): Corazón de sangre, Arcilla viva y Último aliento
    const onLoss=x=>{ if(!TW||!(x>0)) return; if(tgH('corazon')) B.heart=(B.heart||0)+TG.corazon.per; if(tgH('arcilla')) addShield(TG.arcilla.pct*x);
      const nu=tcN('ultimo'); if(nu&&!B.lastUsed&&B.hp>0&&B.hp<TC.ultimo.below*h.hp){ B.lastUsed=true; heal(TC.ultimo.heal*nu*h.hp); emit('fx',{k:'ultimo'}); } };
    const loseHp=x=>{ const l=Math.max(0,Math.min(B.hp-1,x)); B.hp-=l; onLoss(l); return l };
    if(h.regen) heal(h.regen*h.hp*dt);
    const kill=e=>{ if(e.dead) return; if(e.inf){ e.hp=e.max; return } if((B.kind==='tower'||B.mechOn)&&towerGuard(e)) return; e.dead=true; e.deadAt=B.t; zoneOnDeath(e);
      if(TW&&!e.inf){ const ne=tcN('ejecutor'); if(ne&&TC.ejecutor.killHeal) heal(TC.ejecutor.killHeal*ne*h.hp); }   // Ejecutor: al matar, te curas un poco
      if(TW&&tgH('explosion')&&!e.inf){ const x=e.max*TG.explosion.pct; for(const o of B.enemies){ if(o.dead||o===e||o.arrive>B.t+0.5) continue; zap(o,x,{burst:true}); } }   // Torre: Explosión
      if(B.event){ B.kills++; if(S.evRun) S.evRun.kills=B.kills; return }
      if(e.wander){ const sk=e.sk||'wander', rw=(CFG.surprise[sk]||CFG.surprise.wander).reward; giveBundle(rw); SUR.kind=null; emit('surprise',{k:sk+'Win',reward:rw}); }
      onKill(e); if(e.first&&B.spawned<B.count){e.first=false;spawnEnemy()} };
    // daño que no es un golpe normal (habilidades, espinas, efectos): Torre · Segador también cura con él · Inquebrantable: los golpes pequeños le hacen menos
    const zap=(e,d,o)=>{ if(e.dead) return; if(e.smallRes&&d<e.smallRes.small*e.max) d*=1-e.smallRes.dr; if(!(o&&o.thorns)) e.hitN=(e.hitN||0)+1; e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); emit('hit',{e,d,crit:false,...(o||{})}); if(TW&&!(o&&o.thorns)&&tgH('segador')) heal(d*h.ls,true); if(e.hp<=0) kill(e); };
    const X={h,zap,heal,kill,addShield};   // lo que usa el kit (combate/kit.js)
    kitTick(P,dt,X);                       // quemaduras, veneno, sangrado, Sombras, cuchillas, Terremoto y lo que llega más tarde
    if(F) wfxTick(F,P,dt,X);               // arma: Orbe y Halcón
    for(const e of B.enemies){ if(e.dead||!(e.dot>B.t)) continue;                   // daño con el tiempo: veneno, sangrado, fuego
      const d=e.dotDps*dt; e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); if(e.hp<=0) kill(e); }
    const hitOnce=(tg,extra)=>{   // extra: golpe de más (Golpe doble, Tormenta, Lluvia): no vuelve a repetir
      if(tg.thorns) tg.thN=(tg.thN||0)+1;   // Torre: élite con Espinas (te devuelve parte de cada golpe)
      const atkE=h.atk, dfE=tg.df;
      let d=dmgF(atkE,dfE)*(B.boss?1+h.bd:1)*kitMul(P,tg), crit=false;     // kit: Furia, Concentración, Destrozar…
      d*=buffMul('atk')*heroAtkMul();                                           // habilidades: +daño · Burla: −ataque
      const rh=P&&P.id==='ritmo'?rhythm(P,tg):null; if(rh) d*=rh.m;            // Ritmo: el disparo que llega al tope pega más
      if(TW){ d*=tMul(tg); if(tgH('coloso')) d+=TG.coloso.pct*(BUF.shield||0);   // Torre: cartas y grimorios · Coloso: el escudo suma daño
        if(!B.firstHit){ B.firstHit=true; if(tgH('primerGolpe')) d*=1+TG.primerGolpe.mult; }
        if(BUF.sang>0){ BUF.sang--; d*=1+BUF.sangMult; } }   // Sangría
      { const a1=buffAdd('atk1'); if(a1&&(B.boss||B.kind==='boss')) d*=1+a1; }   // +daño solo contra jefes
      const forced=BUF.crits>0&&CT<BUF.critsUntil; if(forced) BUF.crits--;
      if(forced||(rh&&rh.crit)||rand()<h.cr){ d*=1+h.cd; crit=true; if(tg.critRes) d*=1-tg.critRes; }   // Cabeza dura
      if(tg.smallRes&&d<tg.smallRes.small*tg.max) d*=1-tg.smallRes.dr; tg.hitN=(tg.hitN||0)+1;   // Inquebrantable
      tg.hp-=d; B.mD+=d; heal(d*(h.ls+buffAdd('ls')+kitLs(P)),true); if(B.kind==='boss') addDmg(d);   // robo de vida
      emit('hit',{e:tg,d,crit,ranged:h.ranged});
      kitOnHit(P,tg,d,crit,X);                                                  // kit: quemaduras, esquirlas, veneno, Sombras, cuchillas
      if(TW&&tgH('shuriken')&&(B.shN=(B.shN||0)+1)%TG.shuriken.every===0) B.shur=(B.shur||0)+TG.shuriken.atk;   // Shuriken
      if(tg.hp<=0) kill(tg);
      if(TW&&crit&&!extra&&tgH('tormenta')) for(let i=0;i<TG.tormenta.n;i++){ const os=B.enemies.filter(e=>!e.dead&&e!==tg&&e.arrive<=B.t+0.5), o=os.length?os[Math.floor(rand()*os.length)]:!tg.dead?tg:null; if(o) hitOnce(o,true); }   // Tormenta de acero
    };
    const canHit=e=>canTarget(e)&&((h.ranged&&!B.event)||e.arrive<=B.t);   // (zonas: ni caídos, ni invisibles, ni encantadores) // en el evento nadie dispara antes de que llegue (igual para todas las clases)
    // habilidades: las pedidas a mano (B.cast) y, en automático, las que estén listas (aturdido o silenciado: ninguna)
    if(skillsAuto()&&B.enemies.some(e=>!e.dead&&e.arrive<=B.t+0.3))
      for(const k of heroNoSkills()?[]:skillSlots()){ if(CT<GCD) break; const sk=skillDef(k); if(!(CT>=(CD[k]||0))) continue;   // entre una habilidad y la siguiente, una pequeña espera (CFG.skillGap)
        if((sk.id==='tSed'||sk.id==='tSangria')&&B.hp<0.35*h.hp) continue;         // no gastar vida si va mal
        if(!kitReady(sk)&&CT<(CD[k]||0)+3) continue;                               // las que gastan cargas esperan a tenerlas (hasta 3 s)
        CD[k]=CT+sk.cd*cdMul(); GCD=CT+(CFG.skillGap||0); (B.cast=B.cast||[]).push(k); emit('skill',{slot:k,name:sk.name,auto:true}); }   // (Estática: recargas más lentas)
    if(B.cast&&B.cast.length){ const list=B.cast; B.cast=[];
      const alive=()=>B.enemies.filter(e=>!e.dead).sort((a,b)=>a.arrive-b.arrive), base=e=>dmgF(h.atk,e.df)*(B.boss?1+h.bd:1)*buffMul('atk')*tMul(e);
      const hurt=(e,d,k)=>{ zap(e,d,{skill:k}); return e.dead };
      for(const k of (TW&&tgH('eco')?list.flatMap(k=>k[0]==='t'?[k,k]:[k]):list)){ const sk=skillDef(k); if(!sk) continue;   // Eco: las habilidades de la Torre se lanzan dos veces
        B.lastSkMult=Math.min(10,(sk.mult||2)*(sk.hits||1));   // lo que repite Imitar
        switch(sk.id){
          // Torre
          case 'tGolpe': { const e=alive()[0]; if(e) hurt(e,base(e)*sk.mult,k); break; }
          case 'tMuro': addShield(sk.shield*h.hp); break;
          case 'tSangria': loseHp(sk.cost*h.hp); BUF.sang=sk.hits; BUF.sangMult=sk.mult; break;
          case 'tTorbellino': for(const e of alive()) hurt(e,base(e)*sk.mult,k); break;
          case 'tBaluarte': BUF.list.push({until:CT+sk.dur,df:sk.df,reflect:sk.reflect}); break;
          case 'tSed': { const l=loseHp(sk.cost*h.hp); addShield(sk.shield*l); BUF.list.push({until:CT+sk.dur,ls:sk.ls}); break; }
          case 'tLluvia': for(let i=0;i<sk.hits;i++){ const e=alive().find(x=>x.arrive<=B.t+0.5); if(e) hitOnce(e,true); } break;
          case 'tFestin': { const e=alive()[0]; if(e&&hurt(e,base(e)*sk.mult,k)&&!e.minion){ const run=S.tower.run; run.hpBonus=(run.hpBonus||0)+sk.maxHp; statsDirty(); } break; }
          default: if(kitCast(sk,k,X)&&F) wfxSkill(F,P,sk,k,X);   // las del kit del héroe (combate/kit.js) · arma Legendaria: el efecto también sale
        }
        emit('fx',{k:'skill',slot:k,id:sk.look||sk.id,sid:sk.id,name:sk.name}); } }
    if(BUF.lightBack&&BUF.lightBack.length){ const back=BUF.lightBack.filter(x=>CT>=x.at); if(back.length){ BUF.lightBack=BUF.lightBack.filter(x=>CT<x.at); for(const x of back) heal(x.heal*h.hp); emit('fx',{k:'luzVuelve',n:back.length}); } }
    if(BUF.aura&&CT<BUF.aura.until){ heal(BUF.aura.heal*h.hp*dt);                              // Consagrar: cura y quema a los cercanos
      for(const e of upTo(nearE(),BUF.aura.n)){ const d=kitBase(P,h,e)*BUF.aura.dps*dt; e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); if(e.hp<=0) kill(e); } }
    if(B.stun>B.t) B.th=Math.max(B.th==null?B.t:B.th,B.stun);   // PvP: congelado por el rival
    if(B.enemies.some(canHit)){
      if(B.th===null) B.th=B.t;
      while(B.t>=B.th){
        const cand=B.enemies.filter(canHit);
        if(!cand.length){B.th=null;break}
        const tg=zoneTarget(cand)||cand.reduce((a,b)=>a.arrive<=b.arrive?a:b);   // Locura: a uno al azar
        B.mB+=dmgF(h.atk,tg.df)*(B.boss?1+h.bd:1)*(1+h.cr*h.cd);   // lo que diría la fórmula por ataque (para medir el DPS real)
        hitOnce(tg); if(F) wfxHit(F,P,tg,X);   // arma: cuenta los golpes (Tajo partido, Llamarada, Reflejo) y el clon copia este
        if(TW&&h.dbl) for(let c=h.dbl;c>0;c--) if(rand()<c){ const t2=tg.dead?B.enemies.filter(canHit)[0]:tg; if(t2) hitOnce(t2,true); }   // Torre · Golpe doble (más del 100 %: golpes seguros)
        if(P&&P.id==='doble'&&rand()<P.chance){ const n=P.triple&&(B.conc||0)>=P.max?2:1, os=B.enemies.filter(e=>canHit(e)&&e!==tg);   // Doble: flechas de más a otros enemigos
          for(let i=0;i<n;i++){ const t2=os[i]||(tg.dead?B.enemies.filter(canHit)[0]:tg); if(t2) hitOnce(t2,true); } B.conc=Math.min(P.max,(B.conc||0)+1); }
        B.th+=1/(h.spd*buffMul('spd')*heroSpdMul());
      }
    } else if(B.event||(B.th!==null&&B.th<=B.t)) B.th=null;   // en campaña, sin objetivo, el siguiente golpe respeta la cadencia (cuerpo a cuerpo: no es instantáneo al llegar)
    // (élite y JEFE: sus mecánicas van en towerTick, igual que en la Torre)
    // recibir un golpe: dfn da el daño tras tu defensa
    const takeHit=(e,dfn)=>{ let d=dfn()*h.dmgTaken*buffMul('taken')*kitTaken(P); const d0=d;
          if(BUF.shield>0){ const a=Math.min(BUF.shield,d); BUF.shield-=a; d-=a; }      // escudo de habilidad (y de la Torre)
          if(BUF.gshield>0){ const a=Math.min(BUF.gshield,d); BUF.gshield-=a; d-=a; }    // escudo del Grimorio de la Luz
          B.hp-=d; emit('heroHit',{d}); zoneOnHurt(e,d); if(!B.event&&STK.n){ STK.n=0; emit('streak',{n:0}); } if(!(B.hp>0)){ B.hp=0; return } onLoss(d);   // si caes, ya no devuelves daño
          { const rf=buffAdd('reflect')+(TW?h.refl:0); if(rf>0) zap(e,(TW&&tgH('corazaPuas')?d0:d)*rf,{thorns:true}); }   // Baluarte y Púas: devuelven daño (Coraza de púas: también lo que para el escudo)
          { const ne=TW?tcN('erizo'):0; if(ne) for(const o of B.enemies) if(!o.dead&&o.arrive<=B.t+0.5) zap(o,dmgF(h.atk,o.df)*TC.erizo.pct*ne*tMul(o),{thorns:true}); }   // Erizo
          kitOnHurt(P,e,d0,X); };   // kit: Guardia y espinas, Furia, Luz
    // PvP: daño del otro héroe (ya con tu defensa base; aquí se añaden tus mejoras de defensa, escudos…)
    if(B.kind==='pvp'&&B.inc&&B.inc.length){ const e=B.enemies[0], inc=B.inc; B.inc=[]; for(const x of inc) takeHit(e,()=>x.d*dmgF(x.a,h.df*buffMul('df'))/dmgF(x.a,h.df)); if(B.hp<=0) return; }
    for(const e of B.enemies){
      if(!e.dead&&e.frozen>B.t&&!e.noCC){ if(e.arrive>B.t){ e.spawn+=dt; e.arrive+=dt; } e.next=Math.max(e.next,e.frozen); continue; }   // congelado
      if(e.dead||e.down||(e.arrive>B.t&&!e.ranged)) continue;   // (Fuego infernal: ataca antes de llegar)
      if(e.boxIn||e.windU>B.t||e.batU>B.t||B.noHurt){ e.next=Math.max(e.next,B.t); continue; }   // escondido, cargando el golpe o en murciélagos (noHurt: Jefe semanal, no pegan)
      while(B.t>=e.next){
        takeHit(e,()=>{ let d=dmgF(e.atk*(e.am||1),h.df*buffMul('df')*heroDfMul())*zoneAtkMul(e); if(e.cr&&rand()<e.cr) d*=1+e.cd; return d });
        if(B.hp>0&&B.mechOn) zoneAfterAttack(e);   // zonas: veneno, infección, burla, locura…
        e.next+=1/(CFG.enemy.spd*(e.spd||1)*(e.sm||1)*(B.eslow>B.t&&!e.noCC?B.eslowM:1));   // Terremoto: pegan más lento
        if(e.first){e.first=false;if(B.spawned<B.count)spawnEnemy()}
        if(B.hp<=0){ if(B.event) endEvent(); else lose(); return }
        if(e.dead) break;
      }
    }
    const Y={h,kill,hit:(e,m)=>B.noHurt?false:takeHit(e,()=>m*dmgF(e.atk*(e.am||1),h.df*buffMul('df')*heroDfMul()))};   // golpes de las habilidades de los enemigos
    if(B.mechOn&&B.kind!=='tower'){ towerTick(h,dt); if(zoneTick(h,dt,Y)){ B.hp=0; if(B.event) endEvent(); else lose(); return } }   // élites y JEFES de zona: pasivas y habilidades
    if(B.kind==='tower'){
      if(towerTick(h,dt)||(B.mechOn&&zoneTick(h,dt,Y))){ endEvent(); return }   // rasgos de los élites, mecánicas de los jefes y lo de su zona
      if(!tgH('barricada')&&BUF.shield>0) BUF.shield*=Math.exp(-CFG.tower.shieldDecay*dt);   // el escudo se gasta con el tiempo
      { const n=tcN('escudoReg'); if(n&&CT>=B.regAt){ B.regAt=CT+TC.escudoReg.every; addShield(TC.escudoReg.shield*n*h.hp); } }   // Escudo regenerable
      if(B.enemies.every(e=>e.dead)){ if(B.endAt==null) B.endAt=B.t+(CFG.tower.endDelay||0);   // al matar a todos, una pausa antes de salir
        if(B.t>=B.endAt){ if(towerRewardNow()) return; endEvent(); return } } }
    if(B.kind==='hall'){ if(B.enemies.every(e=>e.dead)){ endEvent(); return }   // Sala de jefes: gana al matarlo; sin tiempo límite
      const R=CFG.hall.rage, n=B.t>=R.from?1+Math.floor((B.t-R.from)/R.every):0;   // furia: cada 10 s desde el 60, más rápido y más fuerte
      if(n>(B.hallRage||0)){ for(const e of B.enemies) if(!e.dead){ const k=n-(B.hallRage||0); e.spd=(e.spd||1)*Math.pow(R.spd,k); e.atk*=Math.pow(R.atk,k); } B.hallRage=n; emit('bossPhase',{k:'rage'}); } }   // (hallRage: aparte de la Furia del Berserker, B.rage)
    if(B.event){ if(B.enemies.length>40) B.enemies=B.enemies.filter(e=>!e.dead); return }
    if(B.spawned>=B.count && B.enemies.every(e=>e.dead)) waveClear();
  }
  /* ---------- kit en combate: pasivas, cargas y habilidades del héroe (CFG.kit) ---------- */
  // X: lo que da cada paso del combate ({h, zap, heal, kill, addShield}). Las cargas del héroe viven en B y vuelven a 0 en cada
  // oleada (B.guard Guardia, B.rage Furia, B.conc Concentración, B.luz Luz, B.blades Cuchillas). Las de los enemigos, en cada uno:
  // e.burn quemaduras, e.poison veneno, e.bleed sangrado, e.shadow Sombras ({until, dps}), e.shards esquirlas y e.rhy Ritmo.
  const aliveE=()=>B.enemies.filter(canTarget).sort((a,b)=>a.arrive-b.arrive);   // (zonas: ni caídos ni invisibles)
  const nearE=()=>aliveE().filter(e=>e.arrive<=B.t+0.5);   // los cercanos (ya han llegado o están a punto)
  // tope de enemigos de un golpe de área: los n primeros en llegar (targets de cada habilidad o pasiva: 3 si es fuerte, 4 medio, 5 flojo o continuo)
  const upTo=(a,n)=>n?a.slice(0,n):a;
  // los n primeros cercanos sin ordenar toda la lista (salen en orden de llegada): para lo que salta en cada golpe recibido
  const nearN=n=>{ const o=[]; for(const e of B.enemies){ if(canTarget(e)&&e.arrive<=B.t+0.5){ o.push(e); if(o.length>=n) break; } } return o };
  const stk=(e,k)=>(e[k]=(e[k]||[]).filter(x=>x.until>B.t));   // cargas vivas de un enemigo
  function addStack(e,k,dps,dur,max){ const a=stk(e,k); a.push({until:B.t+dur,dps}); while(a.length>max) a.shift(); return a.length }
  const bossM=h=>B.boss?1+h.bd:1;
  // multiplicador del kit contra tg: Furia/Frenesí (y +daño a jefes), Concentración y Destrozar (congelados)
  function kitMul(P,tg){ if(!P) return 1; let m=1;
    if(P.id==='furia'){ m*=1+P.per*Math.min(P.max,B.rage||0); if(B.boss) m*=1+P.boss; }
    else if(P.id==='doble') m*=1+P.per*Math.min(P.max,B.conc||0);
    else if(P.id==='esquirlas'&&P.frozenTaken&&tg&&tg.frozen>B.t) m*=1+P.frozenTaken;
    return m }
  const kitTaken=P=>P&&P.id==='guardia'?1-P.per*Math.min(P.max,B.guard||0):1;   // Guardia: menos daño recibido
  const kitLs=P=>P&&P.id==='furia'&&P.ls&&(B.rage||0)>=P.max?P.ls:0;            // Frenesí: robo de vida con la Furia llena
  // daño de un golpe normal contra e, con todo lo que lo sube (es la base de las habilidades: mult 4 = 400 %)
  const kitBase=(P,h,e)=>dmgF(h.atk,e.df)*bossM(h)*buffMul('atk')*kitMul(P,e)*heroAtkMul();
  // Ignición: quemaduras; con «spread» o más, cada quemadura nueva las contagia (hasta «spread») al siguiente enemigo que tenga menos
  function addBurn(P,e,n,X){ if(e.dead) return; let c=stk(e,'burn').length;
    for(let i=0;i<n;i++) c=addStack(e,'burn',P.pct*dmgF(X.h.atk,e.df),P.dur,P.max);
    if(c>=P.spread){ const o=aliveE().find(x=>x!==e&&stk(x,'burn').length<P.spread);
      if(o){ while(stk(o,'burn').length<P.spread) addStack(o,'burn',P.pct*dmgF(X.h.atk,o.df),P.dur,P.max); emit('fx',{k:'contagio',e:o}); } } }
  // Esquirlas: con «need», estallido que congela (ignora parte de la defensa)
  function addShards(P,e,n,X){ if(e.dead) return; e.shards=(e.shards||0)+n; if(e.shards<P.need) return; e.shards=0; const h=X.h;
    const x=dmgF(h.atk,e.df*(1-P.ignoreDf))*P.mult*bossM(h)*buffMul('atk')*kitMul(P,e)*heroAtkMul(); if(!e.noCC) e.frozen=Math.max(e.frozen||0,B.t+P.freeze);
    X.zap(e,x,{frost:true}); emit('fx',{k:'congelar',e}); }
  function addBlades(P,n){ B.blades=(B.blades||[]).filter(u=>u>B.t); for(let i=0;i<n;i++) B.blades.push(B.t+P.dur); B.blades.sort((a,b)=>b-a); B.blades.length=Math.min(B.blades.length,P.max) }
  // PvP: las espinas y la Onda de escudo hacen menos (× pvp.reflect); si no, el Guerrero A gana casi siempre
  const pvpRefl=()=>B.kind==='pvp'?(CFG.pvp.reflect==null?1:CFG.pvp.reflect):1;
  // Guardia: con Represalia, al llenarse lanza la Onda de escudo (P.wave × su daño), como mucho una vez cada cd s
  // (mientras espera, la Guardia se queda llena)
  function addGuard(P,n,X){ B.guard=Math.min(P.max,(B.guard||0)+n); if(!P.wave||B.guard<P.max||B.t<(B.ondaAt||0)) return; B.guard=0; B.ondaAt=B.t+(P.cd||0); const h=X.h;
    for(const o of upTo(nearE(),P.targets)) X.zap(o,kitBase(P,h,o)*P.wave*pvpRefl(),{burst:true}); emit('fx',{k:'onda'}); }
  // Gracia: al llenarse la Luz se cura (heal: % de su vida) y hace P.hit × su daño a todos los cercanos (según su ataque, no su vida); después, cd s sin cargar
  function addLuz(P,n,X){ if(B.t<(B.luzAt||0)) return; B.luz=(B.luz||0)+n; if(B.luz<P.max) return; B.luz=0; B.luzAt=B.t+(P.cd||0); const h=X.h; X.heal(P.heal*h.hp);   // (cd: como mucho una vez cada cd s)
    for(const o of upTo(nearE(),P.targets)) X.zap(o,kitBase(P,h,o)*P.hit,{burst:true}); emit('fx',{k:'gracia'}); }
  // Ritmo: cada disparo al mismo enemigo suma; el que llega al tope pega más (Letal: también crítico) y vuelve a 0
  function rhythm(P,e){ e.rhy=(e.rhy||0)+1; if(e.rhy<P.max) return null; e.rhy=0; return {m:P.mul,crit:!!P.crit} }
  // después de un golpe normal que ha hecho d
  function kitOnHit(P,tg,d,crit,X){ if(!P) return;
    if(P.id==='ignicion') addBurn(P,tg,1,X);
    else if(P.id==='esquirlas') addShards(P,tg,1,X);
    else if(P.id==='veneno'&&!tg.dead) addStack(tg,'poison',P.pct*d,P.dur,P.max);
    else if(P.id==='corrupcion'&&!tg.dead) addStack(tg,'shadow',P.pct*d,P.dur,P.max);
    else if(P.id==='cuchillas'&&crit) addBlades(P,1); }
  // después de recibir un golpe (d0: el daño antes de los escudos)
  function kitOnHurt(P,e,d0,X){ if(!P) return;
    if(P.id==='guardia'){ if(d0>0){ const os=nearN(5); for(const o of os) X.zap(o,d0*P.thorns/os.length*pvpRefl(),{thorns:true}); } addGuard(P,1,X); }   // espinas repartidas entre los 5 primeros
    else if(P.id==='furia') B.rage=Math.min(P.max,(B.rage||0)+1);
    else if(P.id==='gracia') addLuz(P,1,X); }
  // cada paso: quemaduras, veneno, sangrado y Sombras (que curan), cuchillas, Terremoto y lo que llega más tarde (B.kq)
  function kitTick(P,dt,X){ const h=X.h, cm=wfxDot();   // cm: el clon del Reflejo (arma) copia el veneno, el sangrado y las cuchillas
    for(const e of B.enemies){ if(e.dead) continue; let d=0, sh=0;
      for(const k of ['burn','poison','bleed','shadow']){ if(!e[k]||!e[k].length) continue; const s=stk(e,k).reduce((a,x)=>a+x.dps,0)*dt*(k==='poison'||k==='bleed'?cm:1); d+=s; if(k==='shadow') sh+=s; if(k==='burn') B.burnDmg=(B.burnDmg||0)+s; }
      if(d>0){ e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); if(sh) X.heal(sh*((P&&P.healK)||1)); if(e.hp<=0) X.kill(e); } }   // Sombras: curan como robo de vida (healK)
    const area=(per,tag,n)=>{ for(const e of upTo(nearE(),n)){ const d=kitBase(P,h,e)*per*dt; e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); B[tag]=(B[tag]||0)+d; if(e.hp<=0) X.kill(e); } };
    if(P&&P.id==='cuchillas'&&B.blades&&B.blades.length){ B.blades=B.blades.filter(u=>u>B.t); if(B.blades.length) area(B.blades.length*P.pct*cm,'bladeDmg',P.targets); }
    if(B.quake&&B.t<B.quake.until) area(B.quake.dps,'quakeDmg',B.quake.n);
    if(B.kq&&B.kq.length){ const now=B.kq.filter(q=>q.at<=B.t); if(now.length){ B.kq=B.kq.filter(q=>q.at>B.t); for(const q of now) q.f(); } } }
  // las que gastan cargas esperan a tenerlas (como mucho 3 s más; si no, se lanzan igual)
  function kitReady(sk){ const P=heroPassive(), f=aliveE()[0]; if(!f) return true;
    switch(sk.id){
      case 'remate': return (f.rhy||0)>=2;
      case 'envenenar': return !!P&&stk(f,'poison').length>=P.max;
      case 'estallido': case 'devorar': return !!P&&stk(f,'shadow').length>=P.max;
      case 'triple': return !!P&&(B.rage||0)>=P.max;
      case 'ejecutar': return aliveE().some(e=>e.hp<sk.low*e.max);
    } return true }
  // lanza una habilidad del kit (k: su hueco). false si no es del kit (las de la Torre van aparte)
  function kitCast(sk,k,X){ const h=X.h, P=heroPassive(), A=()=>upTo(aliveE(),sk.targets), first=()=>aliveE()[0];   // A: los que alcanza (todos, o hasta sk.targets)
    const skm=1+(h.sk||0), pk=(B.kind==='pvp'?((CFG.pvp.skill||{})[S.cls]||{})[kitStage()]||1:1)*(B.wcopy||1)*skm;   // PvP: daño de las habilidades × pvp.skill[clase][etapa] · clon del Reflejo: × su copia · Amuleto: × (1 + sk)
    const base=e=>kitBase(P,h,e)*pk, hit=(e,m)=>{ if(e&&!e.dead) X.zap(e,base(e)*m,{skill:k}); return !e||e.dead };   // hit: true si ya no queda (o acaba de morir)
    const later=(s,f)=>{ if(s<=0) f(); else (B.kq=B.kq||[]).push({at:B.t+s,f}) };
    const bleed=e=>addStack(e,'bleed',CFG.bleed.pct*base(e),CFG.bleed.dur,CFG.bleed.max);
    const poison=e=>{ if(P&&P.id==='veneno') addStack(e,'poison',P.pct*base(e),P.dur,P.max) };
    const shadow=e=>{ if(P&&P.id==='corrupcion') addStack(e,'shadow',P.pct*base(e),P.dur,P.max) };
    switch(sk.id){
      // un objetivo, sin más
      case 'tajo': case 'disparo': case 'punalada': hit(first(),sk.mult); break;
      // Guerrero
      case 'escudazo': { hit(first(),sk.mult); let n=0; for(const e of A()){ hit(e,sk.area); n++; }   // mult al primero y area (con su daño, como todas) a los de alrededor
        if(sk.guard&&P&&P.id==='guardia'&&n) addGuard(P,sk.guard*n,X); break; }
      case 'provocar': for(const e of A()) hit(e,sk.mult); if(sk.taken) BUF.list.push({until:CT+sk.dur,taken:sk.taken}); if(sk.shield) X.addShield(sk.shield*h.hp); break;
      case 'terremoto': for(const e of A()) hit(e,sk.mult); B.quake={until:B.t+sk.dur,dps:sk.dot*skm,n:sk.targets}; B.eslow=B.t+sk.dur; B.eslowM=sk.slow; break;
      case 'desgarro': { const e=first(); if(!e) break; const m=sk.mult*(sk.low&&e.hp<sk.low*e.max?sk.lowMul:1); if(!hit(e,m)) for(let i=0;i<sk.bleed;i++) bleed(e); break; }
      case 'triple': { const r=B.rage||0; B.rage=0; for(let i=0;i<sk.hits;i++){ const e=first(); if(!e) break; if(!hit(e,sk.mult+sk.perRage*r)&&sk.bleed) bleed(e); } break; }
      case 'ejecutar': { const os=A(), low=os.find(e=>e.hp<sk.low*e.max), e=low||os[0]; if(e) hit(e,low?sk.lowMult:sk.mult); break; }
      // Mago (las quemaduras y esquirlas solo si su pasiva es la de ese camino)
      case 'misil': for(let i=0;i<sk.hits;i++) hit(first(),sk.mult); break;
      case 'llama': case 'explosion': for(const e of A()){ const nb=stk(e,'burn').length; if(!hit(e,sk.mult+(sk.perBurn||0)*nb)&&P&&P.id==='ignicion') addBurn(P,e,sk.burn,X); } break;
      case 'meteoros': for(let i=0;i<sk.n;i++) later(i*sk.over/Math.max(1,sk.n-1),()=>{ for(const e of A()) hit(e,sk.mult+(sk.perBurn||0)*stk(e,'burn').length) }); break;
      case 'escarcha': { const e=first(); if(!e||hit(e,sk.mult)) break; if(!e.noCC) e.frozen=Math.max(e.frozen||0,B.t+sk.freeze); emit('fx',{k:'congelar',e}); if(sk.shards&&P&&P.id==='esquirlas') addShards(P,e,sk.shards,X); break; }
      case 'lanza': case 'cometa': { const e=first(); if(e) hit(e,sk.mult*(e.frozen>B.t?sk.frozenMul:1)); break; }
      // Arquero
      case 'multidisparo': for(let r=0;r<(sk.times||1);r++) later(r*0.3,()=>{ for(const e of A()) hit(e,sk.mult) }); break;
      case 'lluvia': { const n=sk.waves+(sk.perConc&&P&&P.id==='doble'?sk.perConc*Math.min(P.max,B.conc||0):0); for(let i=0;i<n;i++) later(i*sk.over/Math.max(1,n-1),()=>{ for(const e of A()) hit(e,sk.mult) }); break; }
      case 'perforar': for(const e of A()) hit(e,sk.mult); break;
      case 'apuntar': later(sk.charge,()=>hit(first(),sk.mult)); break;
      case 'rafaga': for(let i=0;i<sk.hits;i++){ const e=first(); if(!e) break; const r=sk.rhythm&&P&&P.id==='ritmo'?rhythm(P,e):null; hit(e,sk.mult*(r?r.m*(r.crit?1+h.cd:1):1)); } break;
      case 'remate': { const e=first(); if(!e) break; const n=e.rhy||0; e.rhy=0; hit(e,sk.mult+sk.perStack*n); break; }
      // Asesino
      case 'giro': for(const e of nearE().slice(0,sk.targets)) hit(e,sk.mult); if(sk.blades&&P&&P.id==='cuchillas') addBlades(P,sk.blades); break;
      case 'abanico': for(const e of A()) hit(e,sk.mult); if(sk.fill&&P&&P.id==='cuchillas') addBlades(P,P.max); break;
      case 'torbellino': for(let t=0;t<sk.dur-1e-9;t+=sk.every) later(t,()=>{ for(const e of A()) hit(e,sk.mult) }); break;
      case 'mutilar': for(let i=0;i<sk.hits;i++){ const e=first(); if(!e) break; if(!hit(e,sk.mult+(sk.perStack||0)*stk(e,'poison').length)) poison(e); } break;
      case 'envenenar': { const e=first(); if(!e) break; const n=stk(e,'poison').length; e.poison=[]; hit(e,sk.mult+sk.perStack*n); break; }
      case 'milcortes': for(let i=0;i<sk.hits;i++){ const e=first(); if(!e) break; if(!hit(e,sk.mult)) poison(e); } break;
      // Clérigo
      case 'luz': { for(let i=0;i<sk.hits;i++) hit(first(),sk.mult);   // golpes encadenados al mismo objetivo (si muere, siguen con el siguiente)
        BUF.lightBack=(BUF.lightBack||[]).concat([...Array(sk.hits)].map((_,i)=>({at:CT+sk.back+i*0.15,heal:sk.heal}))); break; }   // vuelven y curan
      case 'cadena': for(let i=0;i<sk.jumps;i++){ const os=A(); if(!os.length) break; hit(os[i%os.length],sk.mult); X.heal(sk.heal*h.hp);   // salta de uno a otro
        if(sk.luzEvery&&(i+1)%sk.luzEvery===0&&P&&P.id==='gracia') addLuz(P,1,X); } break;
      case 'consagrar': BUF.aura={until:CT+sk.dur,heal:sk.heal,dps:sk.dps*skm,n:sk.targets}; break;
      case 'juicio': { let n=0; for(const e of A()){ hit(e,sk.mult); n++; } X.heal(sk.healPer*n*h.hp); break; }
      case 'sombra': { const e=first(); if(!e) break; if(!hit(e,sk.mult+(sk.perStack||0)*stk(e,'shadow').length)) for(let i=0;i<sk.stacks;i++) shadow(e); break; }
      case 'estallido': { const e=first(); if(e) hit(e,sk.mult+sk.perStack*stk(e,'shadow').length); break; }
      case 'devorar': { let any=false; for(const e of A()){ const n=stk(e,'shadow').length; if(!n) continue; any=true; e.shadow=[]; const d=base(e)*sk.perStack*n; X.zap(e,d,{skill:k}); X.heal(d*((P&&P.healK)||1));
          if(!e.dead) for(let i=0;i<sk.reapply;i++) shadow(e); }
        if(!any){ const e=first(); if(e) for(let i=0;i<sk.reapply;i++) shadow(e); } break; }
      default: return false;
    } return true }
  /* ---------- efecto del arma Épica o Legendaria (CFG.weapon.fx): Tajo partido, Orbe arcano, Halcón, Reflejo y Llamarada solar ----------
     F = heroStats().fx (o null; sus números ya son los de tu camino). Sirve en los dos caminos: cada vez que sale da cargas de la pasiva de tu camino (wfxCharge; F.ch, si no 1) y los que dan a
     varios hacen × F.solo si solo hay un enemigo. WFX sigue de una oleada a la siguiente (si no, con oleadas cortas no saldría nunca): n golpes contados,
     t segundos, clone hasta cuándo (reloj de combate CT) dura el clon. B.wcopy: mientras el clon repite una habilidad, su daño × eso (kitCast). */
  const WFX={n:0,t:0,clone:0};
  const WFX_HERO=['guardia','furia','doble','gracia','cuchillas'];   // pasivas con la carga en el héroe (el resto, en el enemigo)
  // (n: cuántas cargas, F.ch[camino] o 1 · el veneno y la Sombra, como los de un golpe normal: ni más flojos (echarían a los fuertes) ni más)
  const wfxN=F=>F.ch==null?1:F.ch;   // (ya del camino: heroe/equipo.js)
  function wfxCharge(P,e,X,n){ if(!P||!n) return; const st=()=>P.pct*kitBase(P,X.h,e), stack=k=>{ if(e&&!e.dead) for(let i=0;i<n;i++) addStack(e,k,st(),P.dur,P.max) };
    switch(P.id){
      case 'guardia': addGuard(P,n,X); break;
      case 'furia': B.rage=Math.min(P.max,(B.rage||0)+n); break;
      case 'doble': B.conc=Math.min(P.max,(B.conc||0)+n); break;
      case 'gracia': addLuz(P,n,X); break;
      case 'cuchillas': addBlades(P,n); break;
      case 'ignicion': if(e) addBurn(P,e,n,X); break;
      case 'esquirlas': if(e) addShards(P,e,n,X); break;
      case 'ritmo': if(e) e.rhy=Math.min(P.max,(e.rhy||0)+n); break;   // con el tope, el siguiente disparo a ese enemigo es el que llega
      case 'veneno': stack('poison'); break;
      case 'corrupcion': stack('shadow'); break;
    } }
  // golpe del efecto a varios (Tajo partido, Llamarada; los n primeros en pantalla, también los que aún no han llegado): × solo si solo hay uno; la carga del héroe una vez, la del enemigo en cada uno
  function wfxArea(F,P,X){ const os=upTo(aliveE(),F.n); if(!os.length) return false; const m=F.mult*(os.length===1?F.solo||1:1), heroK=P&&WFX_HERO.includes(P.id);
    for(const e of os){ X.zap(e,kitBase(P,X.h,e)*m,{wfx:F.id}); if(!heroK) wfxCharge(P,e,X,wfxN(F)); }
    if(heroK) wfxCharge(P,null,X,wfxN(F)); emit('fx',{k:'wfx',id:F.id}); return true }
  // un golpe del efecto a uno (Orbe, Halcón)
  function wfxOne(F,P,X,e){ if(!e||e.dead) return; X.zap(e,kitBase(P,X.h,e)*F.mult,{wfx:F.id}); wfxCharge(P,e,X,wfxN(F)); emit('fx',{k:'wfx',id:F.id,e}); }
  const wfxLow=()=>{ const os=aliveE(); return os.length?os.reduce((a,b)=>b.hp<a.hp?b:a):null };   // Halcón: el que tiene menos vida
  function wfxFire(F,P,X,n){ if(F.id==='orbe'){ const os=aliveE(); for(let i=0;i<(n||1)&&os.length;i++) wfxOne(F,P,X,os[i%os.length]); }
    else if(F.id==='halcon') wfxOne(F,P,X,wfxLow());
    else wfxArea(F,P,X); }
  // el clon del Reflejo copia un golpe normal (con su crítico; sus críticos dan cuchillas y sus golpes envenenan como los tuyos: lo de la pasiva al golpear, con tu daño)
  function wfxCloneHit(F,P,tg,X){ const h=X.h; if(!tg||tg.dead) tg=aliveE()[0]; if(!tg) return; let d=kitBase(P,h,tg)*F.copy, crit=false;
    if(rand()<h.cr){ d*=1+h.cd; crit=true; } X.zap(tg,d,{clone:true}); kitOnHit(P,tg,d/F.copy,crit,X); }
  // Reflejo: mientras está el clon, también copia lo que hacen tu veneno, sangrado y cuchillas (× 1 + copy; lo usa kitTick)
  const wfxDot=()=>{ const F=B&&heroStats().fx; return F&&F.id==='reflejo'&&CT<WFX.clone?1+F.copy:1 };
  // después de cada golpe normal (no los de más: Doble, Golpe doble…)
  function wfxHit(F,P,tg,X){
    if(F.id==='reflejo'){ if(CT<WFX.clone){ wfxCloneHit(F,P,tg,X); return } if(++WFX.n>=F.every){ WFX.n=0; WFX.clone=CT+F.dur; emit('fx',{k:'wfx',id:'reflejo',dur:F.dur}); } return }
    if(F.id==='tajo'||F.id==='llama'){ if(++WFX.n>=F.every&&wfxArea(F,P,X)) WFX.n=0; } }   // (si ese golpe mató al último, sale en el siguiente)
  // cada paso: el Orbe y el Halcón salen cada F.every s (con algún enemigo en pantalla: llegan lejos, como los disparos)
  function wfxTick(F,P,dt,X){ if((F.id!=='orbe'&&F.id!=='halcon')||!aliveE().length) return;
    WFX.t+=dt; while(WFX.t>=F.every){ WFX.t-=F.every; wfxFire(F,P,X,1); } }
  // después de lanzar una habilidad del kit (Legendaria): el efecto también sale (Orbe: onSkill rayos) o el clon la repite
  function wfxSkill(F,P,sk,k,X){
    if(F.id==='reflejo'){ if(!F.skills||!(CT<WFX.clone)) return; B.wcopy=F.copy; kitCast(sk,k,X); B.wcopy=0; emit('fx',{k:'wfx',id:'reflejoSkill'}); return }
    if(F.onSkill) wfxFire(F,P,X,F.onSkill); }
  /* ---------- fases de la campaña: oro y experiencia, ganar y perder ---------- */
  const goldPer=f=>CFG.econ.gold*Math.pow(CFG.econ.goldG,10*Math.floor((f-1)/10));
  const goldAt=f=>goldPer(effF(f))*(modeCfg().gold||1), xpAt=f=>xpPer(effF(f)); // oro y experiencia de la fase f del modo actual
  const xpPer=f=>CFG.econ.xp*Math.pow(CFG.econ.xpG,f-1);
  function onKill(e){
    if(!S.daily||S.daily.d!==dayKey()) daily(); S.kills++;   // el día de las misiones empieza con el primer enemigo
    const m=e&&e.minion?3/perWave(S.fase):B.boss&&!B.rep?CFG.econ.bossGold:B.boss?3:3/B.count; // el oro por oleada no sube con más enemigos (los invocados dan como uno normal; un élite/JEFE repetido, como una oleada)
    STK.n++; if(STK.n%CFG.streak.per===0) emit('streak',{n:STK.n});
    const g=goldAt(S.fase)*m*goldMul()*streakMul()*(hordeOn()?CFG.surprise.horde.gold:1); S.gold+=g; addGoldH(g); // el oro entra directo (la bolsa solo guarda materiales)
    addXp(xpAt(S.fase)*m*heroStats().xpMult);
  }
  // DPS medido: en oleadas normales (sin jefe ni evento) se compara el daño real (golpes, quemaduras, aura…) con el de la
  // fórmula. La proporción (media móvil) se usa en el cálculo sin conexión (hasta tenerla, 1).
  function measureWave(){ if(B&&B.rep&&!B.event){ const tf=waveTimeF(S.fase,10,heroStats()); if(tf>0){ const T=S.wtB=S.wtB||{r:0,f:0}; T.r=T.r*0.9+B.t; T.f=T.f*0.9+tf; } return }   // élite/JEFE repetido: lo que tarda frente a una oleada (wtB)
    if(!B||B.boss||B.event||!(B.mB>0)) return; const M=S.dpsM=S.dpsM||{d:0,b:0}, k=0.98;
    M.d=M.d*k+B.mD; M.b=M.b*k+B.mB;
    if(!hordeOn()&&!B.enemies.some(e=>e.wander)){ const tf=waveTimeF(S.fase,S.wave,heroStats()); if(tf>0){ const T=S.wtS=S.wtS||{r:0,f:0}; T.r=T.r*0.97+B.t; T.f=T.f*0.97+tf; S.wtM=Math.min(3,T.r/T.f); } } }   // lo que tardan de verdad / lo que dice la fórmula (sumando oleadas)
  const dpsK=h=>{ const M=S.dpsM; return M&&M.b>=CFG.offlineMinMeasure*heroStats().atk?Math.max(0.5,Math.min(3,M.d/M.b)):1 };
  function waveClear(){ measureWave(); if(!B.event) addXp(xpAt(S.fase)*(CFG.econ.waveXp||0)*heroStats().xpMult);   // experiencia por oleada ganada
    if(S.wave<10){S.wave++;endWave(CFG.delays.wave);return} faseClear() }
  function faseClear(){
    const f=S.fase; S.wave=1;
    if(f===S.best+1){
      S.best=f;
      if(f%10===0){   // (los jefes ya no dan tokens: los tokens son dinero)
        const k=f%30===0?'jefe':'elite', K=CFG.box.firstKill||{}, tix=K[k]||0; S.boxT=(S.boxT||0)+tix;   // tickets de invocación la primera vez
        const mat=essAdd((CFG.essFirst||{})[k]||0);   // y Esencia segura (élite 1, JEFE 3)
        emit('boss',{f,elite:f%50===0,mat,mode:S.mode,tix}); }
      gearOpenCheck();   // (la Armadura, el Anillo y el Amuleto se abren en su fase de Normal)
      S.fase=S.push&&!S.repF?Math.min(f+1,CAP()):f; if(f>=CAP()||S.repF) S.push=false;   // repitiendo fase: se queda en la que acaba de vencer
    } else {
      if(f===CAP()&&B&&B.boss) emit('bossFarm',{f,mode:S.mode});   // JEFE de la 150 repetido (lo cuentan las herramientas de ritmo)
      if(f%10===0&&B&&B.boss) bossLoot(f);   // élite o JEFE repetido: siempre algo (mineral) y, con suerte, pieza, ticket, chatarra o esencia
      S.farmClears++;
      if(S.repF){ if(S.farmClears%3===0&&S.fase<S.repF){ S.fase=S.repF; S.push=S.repF>S.best; } }   // repitiendo fase: si perdiste y bajaste, vuelve a ella
      else if(S.autoPush && S.farmClears%3===0 && top()>S.best){S.push=true;S.fase=top()}
      else if(S.autoPush && S.farmClears%3===0 && S.best>=CAP() && S.fase<CAP()) S.fase=CAP(); // vuelve a intentar el jefe de la 150
    }
    emit('fase',f); emit('change'); endWave(CFG.delays.fase);
  }
  function lose(time){   // time: se acabó el tiempo contra el élite/JEFE
    let msg;
    if(S.fase===S.best+1){S.push=false;S.fase=Math.max(1,S.best);msg='farm'} else {S.fase=Math.max(1,S.fase-1);msg='retreat'}
    S.wave=1; emit('defeat',{fase:S.fase,kind:msg,time:!!time}); endWave(CFG.delays.defeat);
  }
  function setAuto(v){ S.autoPush=v; if(B&&B.event){ emit('change'); return } if(v&&S.fase!==top()){S.push=top()>S.best;S.fase=top();S.wave=1;startWave()} emit('change') }
  // botón «Repetir fase»: on → se queda en la fase de ahora (S.repF) sin subir (si aún no la ha vencido, la intenta hasta vencerla); off → vuelve a subir
  function setRepeat(on){ if(!S) return;
    if(on){ S.repF=Math.max(1,Math.min(top(),S.fase)); S.autoPush=false; if(S.repF<=S.best) S.push=false; save(); emit('change'); return }
    S.repF=null; setAuto(true); save() }
  function goFase(f){ if(B&&B.event) return; f=Math.max(1,Math.min(top(),f|0)); if(f===S.best+1) S.push=true; else S.push=false; S.fase=f;S.wave=1;startWave(); emit('change') }
  /* ---------- evolución ---------- */
  // extra de estadísticas de las evoluciones hechas (multiplicativo): tier.bonus={hp,atk,df} · evo: las de otro héroe (si no, las tuyas)
  function evoBonus(k,evo){ evo=evo==null?S&&S.evo:evo; let m=1; if(evo) for(const t of evoTiers().slice(0,evo)) m*=1+((t.bonus||{})[k]||0); return m }
  // lo que ve la pantalla de una etapa del kit: nombre, pasiva (texto) y habilidades
  const stageInfo=st=>{ const K=kitOf(S.cls,st); return K?{stage:st,name:K.name,pname:K.passive&&K.passive.name,pdesc:K.passive&&K.passive.desc,passive:K.passive?K.passive.name+': '+K.passive.desc:'',skills:K.skills||[]}:null };
  // la etapa actual (null si aún no ha evolucionado)
  const evoP=()=>S.evo?stageInfo(kitStage()):null;
  // los 2 caminos de la 1.ª evolución y la próxima evolución de tu camino (en la 1.ª se elige)
  const evoPaths=()=>({A:stageInfo('A1'),B:stageInfo('B1')});
  const nextEvoInfo=()=>{ const t=nextEvo(); return t&&S.evo>0?stageInfo((S.path==='B'?'B':'A')+(S.evo+1)):null };
  // Coste de la próxima evolución: Esencia y oro (y emblemas o tokens si la configuración los pide)
  function evoCost(){ const t=nextEvo(); if(!t||!t.cost) return null; return {ess:t.cost.ess||0,gold:t.cost.gold||0,tokens:t.cost.tokens||0,ev:t.cost.ev||0} }
  function evoMissing(){ const c=evoCost(); if(!c) return {}; const o={};
    if(essN()<c.ess) o.ess=c.ess-essN(); if(S.gold<c.gold) o.gold=c.gold-S.gold; if(tokens()<c.tokens) o.tokens=c.tokens-tokens(); if(S.evm<c.ev) o.ev=c.ev-S.evm; return o }
  const evoLvlOk=()=>{ const t=nextEvo(); return !!t&&!t.pending&&S.lvl>=t.lvl };
  const evoKeyOk=()=>S.evo>0||grimDone();                                  // la 1.ª evolución pide el grimorio en el nivel 5
  const canEvolve=()=>evoLvlOk()&&evoKeyOk()&&Object.keys(evoMissing()).length===0;
  function evolve(path){
    if(!canEvolve()||inEvent()) return {ok:false};
    if(S.evo===0){ if(path!=='A'&&path!=='B') path='A'; S.path=path; }     // 1.ª evolución: se elige camino
    const c=evoCost(); if(c){ if(c.ess) S.mats[0]=essN()-c.ess; S.gold-=c.gold; spend(c.tokens); S.evm-=c.ev; }
    S.evo++; S.dpsM=null; statsDirty(); save();                 // con el kit nuevo se vuelve a medir el DPS
    emit('evolve',{evo:S.evo,name:evoP().name}); emit('change'); return {ok:true};
  }
  // cambiar de camino (tras evolucionar): cuesta tokens
  function pathSwitch(){ if(!(S.evo>=1)) return {ok:false,why:'evo'}; if(inEvent()) return {ok:false,why:'event'}; if(!spend(CFG.grimoire.switchCost)) return {ok:false,why:'tokens'};
    S.path=S.path==='B'?'A':'B'; S.dpsM=null; statsDirty(); track('path',{path:S.path}); save(); emit('change'); return {ok:true,path:S.path} }
  /* ---------- modos ---------- */
  // Esencia: una sola para los 3 modos (S.mats[0]). Segura la primera vez que vences a cada élite y JEFE (CFG.essFirst); con suerte en el botín
  function essN(){ return S&&S.mats?(S.mats[0]||0):0 }
  function essAdd(n){ if(!S||!(n>0)) return 0; S.mats[0]=(S.mats[0]||0)+n; return n }
  // Bolsa de botín de partidas antiguas (S.loot): se recoge todo de una vez y entra como Esencia
  function claimLoot(){ const L=S&&S.loot; if(!L) return null; S.tokens+=L.t||0; // (L.t: partidas antiguas)
    for(const m in L.mats) essAdd(L.mats[m]); S.loot=null; emit('change'); return L }
  // Para pasar al siguiente modo: que no esté bloqueado, haber vencido la fase 150 del actual y tener hecha su evolución
  const modeLocked=m=>!!(MODES()[m]&&MODES()[m].locked);         // modo bloqueado ("Próximamente")
  const canAdvanceMode=()=>S.best>=CAP()&&S.mode<MODES().length-1&&!modeLocked(S.mode+1)&&S.evo>=S.mode+1;
  function advanceMode(){ if(!canAdvanceMode()||(B&&B.event)) return false; S.mode++; S.best=0; S.fase=1; S.wave=1; S.push=true; S.farmClears=0; S.repF=null; S.autoPush=true;
    gearOpenCheck(); statsDirty(); startWave(); emit('mode',{mode:S.mode,name:modeCfg().name}); emit('change'); return true }
  /* ---------- Mazmorra (evento diario) ---------- */
  // Mazmorra infinita: monstruos sin parar hasta morir. Empieza event.back fases por debajo de tu récord en tu modo y cada grupo es una fase más
  // (sigue en el modo siguiente): los monstruos van a tu altura, así cuenta matar rápido (y en área), no solo aguantar.
  // Salen en grupos de 'group' monstruos (con groupHp × su vida): un grupo cada spawnEvery segundos, o al momento si no
  // queda ninguno vivo. El grupo n es el enemigo de la fase n. Puntúa por muertes (cada monstruo cuenta 1). 1 entrada gratis al día; las demás, 1 ticket.
  // Mazmorra infinita: cada ramp.every segundos los grupos son más grandes, salen antes, andan y pegan más rápido
  function evRamp(){ const V=CFG.event, R=V.ramp, r=R?Math.floor(B.t/R.every):0;
    if(!R) return {group:V.group||1,every:V.spawnEvery,walk:V.walk,spd:1,r:0};
    return {group:Math.min(R.groupMax||99,Math.floor((V.group||1)+r*R.group)), every:Math.max(R.spawnMin,V.spawnEvery*Math.pow(R.spawn,r)),
      walk:Math.max(R.walkMin,V.walk*Math.pow(R.walk,r)), spd:1+r*R.spd, r}; }
  // modificador del día de la Mazmorra (rota cada día, igual para todos)
  const evAffix=d=>{ const L=CFG.event.affixes||[]; if(!L.length) return null; const k=d==null?evShownDay():d; return L[((k%L.length)+L.length)%L.length] };
  function evSpawn(){ const V=CFG.event, alive=B.enemies.some(e=>!e.dead), A=B.aff||{};
    if(alive&&B.t<B.nextSpawn) return;
    if(V.maxAlive&&B.enemies.reduce((n,e)=>n+(e.dead?0:1),0)>=V.maxAlive) return;   // como mucho maxAlive vivos a la vez: el siguiente grupo espera
    // el grupo n es una fase más que el anterior, empezando unas fases (event.back) por debajo de tu récord en tu modo: monstruos a tu altura
    // (su vida, de esa fase; su ataque, de event.atkBack fases antes: aguantas, y lo que cuenta es limpiar a tiempo)
    const at=i=>{ i=Math.max(0,i); const m=Math.min(MODES().length-1,Math.floor(i/CAP())); return modeCurve(m,i-m*CAP()+1) };
    const n=B.groups=(B.groups||0)+1, i=(B.start||0)+n-1, c=at(i), ca=at(i-(V.atkBack||0)), hp=c.hp*(V.groupHp||1)*(A.hp||1), R=evRamp();
    const grp=Math.max(1,R.group+(A.group||0)), walk=R.walk*(A.walk||1);
    for(let i=0;i<grp;i++){ const at=B.t+walk+i*(V.groupGap||0);  // llegan escalonados
      B.enemies.push({hp,max:hp,atk:ca.atk*(V.groupAtk||1)*(A.atk||1),df:c.df,spawn:B.t,walk,arrive:at,next:at,first:false,dead:false,f:n,spd:R.spd*(A.spd||1)}); B.spawned++; }
    B.nextSpawn=B.t+R.every; }
  const evPhase=()=>B&&B.event?B.groups||0:0; // fase del último grupo que ha salido
  const inEvent=()=>!!(B&&B.event);
  // Pausa diaria de 00:00 a 01:00 UTC: no se puede entrar, los intentos empezados antes pueden terminar y a la 01:00 se reparten los premios
  function msOfDay(){ const raw=nowFn()+(S&&CFG.devTools?S.devDays||0:0)*864e5, d=Math.floor(raw/864e5); return d<dayKey()?864e5-1:raw-d*864e5 } // con el reloj atrasado cuenta como final del día
  const evPaused=()=>msOfDay()<(CFG.event.pauseH||0)*3600e3;
  const evPauseLeft=()=>evPaused()?(CFG.event.pauseH||0)*3600e3-msOfDay():0;
  const evShownDay=()=>evPaused()?dayKey()-1:dayKey();        // durante la pausa se sigue viendo el ranking de ayer, que se está cerrando
  // Entrada gratis: 1 al día (evFree guarda el día en que se usó). Las demás, con ticket (se compra con tokens).
  const evFreeLeft=()=>S.evFree!==dayKey()?1:0;
  // dónde empieza la Mazmorra: event.back fases por debajo de tu récord en tu modo (fase 1 de Normal al principio)
  const evStart=()=>S.mode*CAP()+Math.max(0,(S.best||0)-(CFG.event.back==null?30:CFG.event.back));
  function startEvent(){
    if(!S||inEvent()||!modeOpen('lab')||(retoN()<1&&!evFreeLeft())||evPaused()) return false;
    if(evPending()) claimEvent();                         // cobra antes el premio de un día anterior
    if(evFreeLeft()) S.evFree=dayKey(); else retoUse(); const h=heroStats();   // sin entrada gratis, un Ticket de reto
    S.evRun={day:dayKey(),kills:0};                       // el intento se guarda: si se cierra la app, cuenta lo que llevaba
    B={event:true,t:0,boss:false,count:0,spawned:0,kills:0,nextSpawn:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0,aff:evAffix(dayKey()),start:evStart()};
    save(); emit('eventStart',B); emit('change'); return true;
  }
  // Apunta las muertes de un intento en el día en que EMPEZÓ (un intento puede acabar pasada la medianoche)
  function finishRun(k,died){
    const d=S.evRun?S.evRun.day:dayKey(); S.evRun=null;
    if(!S.evLog||S.evLog.day!==d){ if(S.evLog&&S.evLog.day<d&&evPending()) claimEvent(); S.evLog={day:d,best:0,claimed:false}; }
    const before=S.evLog.best; S.evLog.best+=k; S.evLog.runs=(S.evLog.runs||0)+1;   // varios intentos en el mismo día: las muertes se suman
    // premios personales: cada 'every' muertes del día, oro (minutos de farmeo); cada 'big', otro más (se dan al momento)
    const M=CFG.event.milestones, got={}; if(M){ let g=0; const a=Math.floor(before/M.every), b=Math.floor(S.evLog.best/M.every); if(b>a) g+=(b-a)*M.gold;
      if(M.big){ const a2=Math.floor(before/M.big), b2=Math.floor(S.evLog.best/M.big); if(b2>a2) g+=(b2-a2)*M.bigGold; }
      if(g){ got.gold=g; giveBundle({gold:g}); } }
    return {kills:k,best:S.evLog.best,runs:S.evLog.runs,pos:evRank(d,S.evLog.best),died,day:d,got};
  }
  function endEvent(){
    if(!B||!B.event) return null;
    if(B.kind==='tower') return towerEnd(B.hp>0);
    if(B.kind==='hall') return hallEnd();
    if(B.kind==='pvp') return pvpFightEnd();
    const res=B.kind==='boss'?(B.clan?clanFinish(B.dmg):wbFinish(B.dmg,B.hp<=0)):finishRun(B.kills,B.hp<=0);
    B=null; misBump('event',1); save(); emit('eventEnd',res); startWave(); emit('change'); return res;
  }
  /* ---------- rivales simulados y premios del ranking de la Mazmorra ---------- */
  // Ranking con rivales simulados (hasta que haya servidor): su puntuación sigue la curva de un jugador medio con tus días de juego
  const RIV={};
  function evSim(d){ const key=d+'|'+S.startDay; if(RIV.k===key) return RIV.v; RIV.k=key; RIV.v=makeRivals(CFG.event,d*7919,d-(S.startDay==null?d:S.startDay)+1,(evAffix(d)||{}).score||1); return RIV.v }
  const evRivals=d=>mixRivals(evSim(d),realOf('lab',d));
  // Rankings reales (el servidor guarda la puntuación de cada jugador; rankTop da los 100 mejores de un día/semana): S.rk[kind] = {p: día/semana, list}.
  // Con n jugadores reales, el ranking son ellos y (rivales − n) simulados repartidos por toda la tabla; sin servidor, solo simulados (como antes).
  function setRealRank(kind,period,list){ if(!S||!Array.isArray(list)||!(kind==='lab'||kind==='wb')) return false; S.rk=S.rk||{};
    S.rk[kind]={p:period|0,list:list.filter(x=>x&&!x.me&&+x.score>0).slice(0,100).map(x=>({name:String(x.name||'?').slice(0,16),score:+x.score,real:true}))}; emit('change'); return true }
  const realOf=(kind,p)=>{ const R=S&&S.rk&&S.rk[kind]; return R&&R.p===p?R.list:[] };
  function mixRivals(sim,real){ const N=sim.length, n=Math.min(real.length,N); if(!n) return sim; const keep=N-n, out=real.slice(0,N);
    for(let i=0;i<keep;i++) out.push(sim[Math.floor((i+0.5)*N/keep)]); return out.sort((a,b)=>b.score-a.score) }
  function makeRivals(V,seed,age,mul=1){
    const r=mulberry32(seed+(S.startDay||0)*104729), c=V.curve;
    const seg=c.findIndex((p,i)=>i>0&&age<p[0]), i=seg<0?c.length-1:seg, [a,x]=c[i-1], [b,y]=c[i], base=(x+(y-x)*(Math.max(1,age)-a)/(b-a))*(V.rivalBase||1)*mul; // interpola (y extrapola tras el último punto)
    const syl=['ka','ro','mi','zu','the','lan','dor','vi','sha','gar','nel','to','ria','bel','xo','ur','fen','ly','ash','mor'];
    const out=[]; for(let i=0;i<V.rivals;i++){ const g=Math.sqrt(-2*Math.log(r()+1e-9))*Math.cos(2*Math.PI*r());
      let nm=''; const n=2+Math.floor(r()*2); for(let j=0;j<n;j++) nm+=syl[Math.floor(r()*syl.length)]; nm=nm[0].toUpperCase()+nm.slice(1)+(r()<0.4?Math.floor(r()*99):'');
      const runs=1+(r()<V.rivalExtra[0]?1:0)+(r()<V.rivalExtra[1]?1:0);   // algunos rivales también hacen intentos extra
      out.push({name:nm,score:Math.max(1,Math.round(base*Math.exp(V.spread*g)*(1+(runs-1)*0.85)))}); }
    return out.sort((a,b)=>b.score-a.score);
  }
  const evRank=(d,score)=>1+evRivals(d).filter(x=>x.score>score).length;
  function evReward(pos){ for(const r of CFG.event.rewards) if(pos<=r.to) return r; return null }
  // Premio pendiente: el de tu total de un día que ya terminó
  function evPending(){ const L=S.evLog; if(!L||L.claimed||L.day>=dayKey()||!L.best) return null;
    if(L.day===dayKey()-1&&evPaused()) return null;               // los premios de ayer se reparten a la 01:00
    if(S.evRun&&S.evRun.day===L.day) return null;                   // aún hay un intento de ese día sin terminar
    const pos=evRank(L.day,L.best); return {day:L.day,best:L.best,pos,rew:evReward(pos)} }
  function claimEvent(){ const p=evPending(); if(!p) return null; S.evLog.claimed=true; const r=p.rew;
    if(r){ S.evm+=r.em||0; if(r.gold) giveBundle({gold:r.gold}); }
    emit('change'); return p; }
  const evToday=()=>{ const d=evShownDay(); return S.evLog&&S.evLog.day===d?S.evLog.best:0 };
  /* ---------- PvP: combate contra el fantasma de otro jugador ----------
     El fantasma es una copia de su partida (héroe, mejoras, evolución, grimorio y habilidades al 100 %) que maneja la
     IA en otro motor en paralelo (GH). Cada uno golpea a un "doble" del otro: el daño que le hace se le pasa al otro héroe
     por sus defensas (esquiva, escudos, espinas…). Elo pensado para pocos jugadores (K alto al principio).
     Sin servidor (o sin rivales reales) se lucha contra bots: tu misma partida con otra clase. */
  const PSYL=['ka','ro','mi','zu','the','lan','dor','vi','sha','gar','nel','to','ria','bel','xo','ur','fen','ly','ash','mor'];
  const pvpName=r=>{ let nm=''; const n=2+Math.floor(r()*2); for(let j=0;j<n;j++) nm+=PSYL[Math.floor(r()*PSYL.length)]; return nm[0].toUpperCase()+nm.slice(1)+(r()<0.4?Math.floor(r()*99):'') };
  let GH=null;   // motor del fantasma durante el duelo
  function pvpState(){ const d=dayKey(); S.pvp=S.pvp&&S.pvp.rating!=null?S.pvp:{rating:CFG.pvp.start,games:0,wins:0,d,used:0,hist:[],rival:null}; const P=S.pvp;
    if(P.d!==d){ P.d=d; P.used=0; } return P }
  // 3 duelos gratis al día; después, los combates que queden de un Ticket de reto (cada uno da CFG.reto.pvp) o un Ticket de reto nuevo
  const pvpFreeLeft=()=>Math.max(0,CFG.pvp.free-pvpState().used);
  const pvpCanFight=()=>pvpFreeLeft()>0||(S.pvpTickets||0)>0||retoN()>0;
  const pvpExtra=()=>(S.pvpTickets||0)+retoN()*((CFG.reto||{}).pvp||3);   // combates extra que puedes hacer hoy (además de los gratis)
  function pvpReward(pos){ for(const r of CFG.pvp.rewards) if(pos<=r.to) return r; return null }
  const pvpLeague=pts=>{ let L=CFG.pvp.leagues[0]; for(const x of CFG.pvp.leagues) if(pts>=x[0]) L=x; return {name:L[1],color:L[2]} };   // insignia
  const pvpK=g=>g<CFG.pvp.newGames?CFG.pvp.kNew:CFG.pvp.k;
  const pvpExp=(a,b)=>1/(1+Math.pow(10,(b-a)/400));   // probabilidad esperada de ganar
  // bot: tu partida (misma progresión) con otra clase, otro camino y otro nombre
  function pvpBot(){ const P=pvpState(), cls=Object.keys(CFG.classes).filter(c=>c!==S.cls), c=cls[Math.floor(rand()*cls.length)], me=JSON.parse(JSON.stringify(packed()));
    const name=pvpName(rand);
    const save={...me,cls:c,name,path:S.evo>=1?(rand()<0.5?'A':'B'):S.path,pvp:null,tower:null,opt:{evAuto:true,pvpAuto:true}};
    P.rival={bot:true,name,cls:c,lvl:S.lvl,evo:S.evo,path:save.path,rating:Math.max(0,Math.round(P.rating+(rand()*2-1)*CFG.pvp.botSpread)),save}; save_(); emit('change'); return P.rival }
  const save_=()=>save();
  // rival real que manda el servidor: {id, name, cls, lvl, evo, path, rating, save, match}
  function pvpSetRival(r){ const P=pvpState(); if(inEvent()||!r||!r.save||!CFG.classes[r.save.cls]) return false; P.rival={...r,bot:false}; save(); emit('change'); return true }
  // el servidor manda tus puntos (manda sobre los del móvil)
  function pvpSync(o){ const P=pvpState(); if(!o) return; for(const k of ['rating','games','wins']) if(typeof o[k]==='number') P[k]=o[k]; save(); emit('change') }
  function ghostOf(save){ const mem={get:()=>JSON.stringify(save),set(){},del(){}}, g=createGame({cfg:CFG,seed:Math.floor(rand()*1e9),now:nowFn,storage:mem});
    if(!g.load()) return null; g.S.opt={...(g.S.opt||{}),evAuto:true,pvpAuto:true}; return g }
  // el "doble" del otro héroe (no ataca: su daño llega aparte)
  const pvpDouble=(o,name,cls)=>({hp:o.hp,max:o.hp,atk:0,df:o.df,spawn:0,walk:0.8,arrive:0.8,next:Infinity,first:false,dead:false,spd:1,rival:true,name,cls});
  // hpM: vida × este valor en el duelo (igual para los dos): los héroes pegan mucho para su vida (los monstruos tienen mucha)
  function duelEnter(o,hpM){ for(const k of skillSlots()) CD[k]=CT; BUF.list=[]; for(const k of Object.keys(BUF)) if(k!=='list') delete BUF[k];   // los dos empiezan igual: habilidades listas y sin efectos
    B={event:true,kind:'pvp',hpM,t:0,boss:false,count:0,spawned:0,kills:0,enemies:[pvpDouble(o,o.name,o.cls)],hp:0,th:null,over:false,wait:0,mD:0,mB:0,inc:[]};
    statsDirty(); B.hp=heroStats().hp; return heroStats() }
  function pvpFight(){ const P=pvpState(), r=P.rival; if(!r||inEvent()||!modeOpen('pvp')||!pvpCanFight()) return false;
    const g=ghostOf(r.save); if(!g) return false; if(pvpFreeLeft()>0) P.used++; else if((S.pvpTickets||0)>0) S.pvpTickets--; else if(retoUse()) S.pvpTickets=((CFG.reto||{}).pvp||3)-1;
    P.fight={name:r.name,cls:r.cls,bot:r.bot,rating:r.rating,id:r.id,match:r.match};   // si se cierra la app a mitad, cuenta como derrota
    const a=heroStats(), b=g.heroStats(), dps=(x,y)=>dmgF(x.atk,y.df)*x.spd*(1+x.cr*x.cd), M=CFG.pvp.hpMul?CFG.pvp.hpMul:pvpTtk(S.evo,g.S.evo)*(dps(a,b)*pvpK2(S,g.S)+dps(b,a)*pvpK2(g.S,S))/(a.hp+b.hp);   // (con la fuerza de cada clase: todos los duelos duran parecido)   // vida en PvP: × hpMul (igual para los dos)
    const gs=g.duelEnter({...a,name:S.name,cls:S.cls},M), ms=duelEnter({...b,name:r.name,cls:r.cls},M); GH=g;
    const F=CFG.pvp.forma||0; B.forma=1+(rand()*2-1)*F; g.B.forma=1+(rand()*2-1)*F;   // «el día» de cada uno: su daño en este duelo × 1 ± forma (que un 5 % de ventaja no gane siempre)
    Object.assign(B.enemies[0],{hp:gs.hp,max:gs.hp}); Object.assign(g.B.enemies[0],{hp:ms.hp,max:ms.hp});
    save(); emit('eventStart',B); emit('change'); return true }
  // fuerza en PvP (multiplica el daño que hace): CFG.pvp.cls[clase] = número, o por etapa del kit {base, A1, B1, A2, B2}
  const pvpStage=st=>!(st.evo>=1)?'base':(st.path==='B'?'B':'A')+Math.min(2,st.evo);
  const pvpClsK=st=>{ const v=(CFG.pvp.cls||{})[st.cls]; return typeof v==='number'?v:v?v[pvpStage(st)]||1:1 };
  // ajuste por pareja (pvp.vs, calculado con simulaciones): 'Clase·etapa|Clase·etapa' (en orden alfabético) = cuánto más daño hace el
  // primero contra el segundo (el segundo, 1/eso). Con el mismo equipo cada pareja queda cerca del 50 %: sin contras, decide el equipo
  const pvpPair=(a,b)=>{ const ka=a.cls+'·'+pvpStage(a), kb=b.cls+'·'+pvpStage(b); if(ka===kb) return 1; const V=CFG.pvp.vs||{};
    return ka<kb?(V[ka+'|'+kb]||1):1/(V[kb+'|'+ka]||1) };
  const pvpK2=(a,b)=>pvpClsK(a)*pvpPair(a,b);   // fuerza de a contra b
  // duración buscada (ttk): un número, o una por evolución [sin evolucionar, 1.ª, 2.ª] (media de los dos)
  const pvpTtk=(ea,eb)=>{ const T=CFG.pvp.ttk; if(typeof T==='number') return T; const f=e=>T[Math.max(0,Math.min(T.length-1,e||0))]; return (f(ea)+f(eb))/2 };
  // el duelo se acelera: a los rt segundos reales el juego va a ×(1 + speedUp·rt); B.rt cuenta el tiempo real (límite maxT)
  const duelSpeed=()=>1+(CFG.pvp.speedUp||0)*((B&&B.rt)||0);
  function duelStep(dt){ const V=CFG.pvp;
    while(dt>1e-9&&B&&B.kind==='pvp'&&GH){ const sp=duelSpeed(), r=Math.min(dt,0.05/sp), s=r*sp; dt-=r; B.rt=(B.rt||0)+r;
      const gb=GH.B, me=B.enemies[0], them=gb.enemies[0], m0=me.hp, t0=them.hp;
      stepCore(s); GH.step(s);
      const out=Math.max(0,m0-me.hp), back=Math.max(0,t0-them.hp), gh=GH.heroStats(), h=heroStats();
      if(out>0) gb.inc.push({d:out*pvpK2(S,GH.S)*(B.forma||1),a:h.atk}); if(back>0) B.inc.push({d:back*pvpK2(GH.S,S)*(gb.forma||1),a:gh.atk});   // fuerza de cada clase y camino en PvP (solo el daño que hace)   // se aplica en el siguiente paso, con sus defensas
      // congelar = no puede atacar (en PvP dura × pvp.freeze; si no, el que congela primero encadena y el equipo no cuenta)
      const fz=CFG.pvp.freeze==null?1:CFG.pvp.freeze;
      // (una vez por congelado, y también para los bonus contra congelados: Lanza, Cometa, Destrozar)
      if(me.frozen>B.t&&me.frozen!==me.fz0){ me.frozen=B.t+(me.frozen-B.t)*fz; me.fz0=me.frozen; gb.stun=Math.max(gb.stun||0,gb.t+(me.frozen-B.t)); }
      if(them.frozen>gb.t&&them.frozen!==them.fz0){ them.frozen=gb.t+(them.frozen-gb.t)*fz; them.fz0=them.frozen; B.stun=Math.max(B.stun||0,B.t+(them.frozen-gb.t)); }
      Object.assign(me,{hp:gb.hp,max:gh.hp,df:gh.df,dead:false}); Object.assign(them,{hp:B.hp,max:h.hp,df:h.df,dead:false});
      if(B.hp<=0||gb.hp<=0||B.rt>=V.maxT){ pvpFightEnd(); return } } }
  function pvpFightEnd(){ const P=S.pvp, r=P.rival, h=heroStats(), gh=GH?GH.heroStats():null, gb=GH?GH.B:null;
    const me=B.hp/h.hp, them=gb?gb.hp/gh.hp:1, win=B.hp>0&&(!gb||gb.hp<=0), draw=B.hp>0&&!win, t=B.rt||0;   // solo se gana por K.O.; si nadie cae, empate
    B=null; GH=null; BUF.list=[]; BUF.shield=0; BUF.gshield=0; statsDirty(); P.fight=null;
    const res={...pvpResult(r,win,draw),me:Math.max(0,me),them:Math.max(0,them),t};
    P.rival=null; misBump('pvp',1); save(); emit('pvpEnd',res); startWave(); emit('change'); return res }
  // puntos Elo e historial de un duelo terminado
  function pvpResult(r,win,draw){ const P=S.pvp, k=pvpK(P.games), d=Math.round(k*((draw?0.5:win?1:0)-pvpExp(P.rating,r.rating)));   // empate: medio punto (Elo)
    P.rating=Math.max(0,P.rating+d); P.games++; if(win) P.wins++;
    P.hist.unshift({name:r.name,cls:r.cls,bot:r.bot,win,draw:!!draw,d,rating:r.rating}); P.hist=P.hist.slice(0,10);
    return {win,draw:!!draw,d,rating:P.rating,rival:{name:r.name,cls:r.cls,bot:r.bot,id:r.id,match:r.match}} }
  const pvpLoss=r=>({...pvpResult(r,false),quit:true});
  /* ---------- rasgos de élite y mecánicas de JEFE de la Torre; defensa de los enemigos con mecánicas ---------- */
  // (los élites y JEFES de zona, con su pasiva y sus habilidades, van en enemigos/zonas.js)
  function traitApply(e,TR){ for(const t of e.traits){
      if(t==='rapido') e.spd*=TR.rapido.spd; if(t==='gigante'){ e.hp*=TR.gigante.hp; e.max=e.hp; e.spd*=TR.gigante.spd; }
      if(t==='regenera') e.regen=TR.regenera.regen; if(t==='espinas') e.thorns=TR.espinas.reflect; if(t==='furioso') e.fur=true; }
    if(e.traits.includes('escudo')) e.sh=TR.escudo.shield*e.max; }
  // guarda de los enemigos con mecánicas (Torre y zonas): invulnerable o caído, reducción de daño (e.dm), escudos y muertes
  // especiales (Rearmarse, Reencarnación, Desmembrarse) — devuelve true si el enemigo no muere
  function towerGuard(e){ const seen=e.hpSeen==null?e.max:e.hpSeen, dealt=seen-e.hp; if(!(dealt>0)) return e.hp>0;
    if(e.inv>B.t||e.down||e.batU>B.t){ e.hp=seen; return true }
    let x=dealt*(e.dm==null?1:e.dm); e.hp=seen-x;
    if(e.sh>0){ const a=Math.min(e.sh,x); e.sh-=a; e.hp+=a; }
    if(!(e.hp>0)&&zoneLethal(e)) return true;
    e.hpSeen=e.hp; return e.hp>0 }
  // Torre, cada paso: rasgos de élite y mecánicas de jefe. Devuelve true si el héroe cae (Espinas)
  function towerTick(h,dt){ const T=CFG.tower, TR=T.traits, M=T.bossMech, TW=B.kind==='tower';
    for(const e of B.enemies.slice()){ if(e.dead||e.arrive>B.t) { if(!e.dead) e.hpSeen=e.hp; continue; }
      if(e.inf){ e.hp=e.max; if(B.t>=(e.rageAt||0)){ if(e.rageAt) e.atk*=T.final.rage; e.rageAt=B.t+T.final.every; } e.hpSeen=e.hp; continue; }   // jefe final: vida infinita y cada vez pega más
      if(TW&&B.t>=T.enrage.after&&B.t>=(e.enrAt||0)){ if(e.enrAt) e.atk*=T.enrage.mult; e.enrAt=B.t+T.enrage.every; }   // combates muy largos: los enemigos se enfurecen (no hay empates)
      towerGuard(e);
      if(e.regen&&e.hp<e.max) e.hp=Math.min(e.max,e.hp+e.regen*e.max*dt);
      if(e.fur&&!e.furOn&&e.hp<TR.furioso.below*e.max){ e.furOn=true; e.atk*=TR.furioso.atk; emit('fx',{k:'furia',e}); }
      if(e.thN&&B.noHurt) e.thN=0;
      if(e.thN){ const d=e.thN*e.thorns*dmgF(e.atk,h.df*buffMul('df'))*h.dmgTaken; e.thN=0; B.hp-=d; emit('heroHit',{d}); if(B.hp<=0) return true; }
      if(e.mech==='enfurecido'&&!e.rage&&e.hp<M.enfurecido.below*e.max){ e.rage=true; e.atk*=M.enfurecido.atk; e.spd=(e.spd||1)*M.enfurecido.spd; emit('bossPhase',{k:'rage'}); }
      if(e.mech==='fases'&&e.phases&&e.phases.length&&e.hp<e.phases[0]*e.max){ e.phases.shift(); e.inv=B.t+M.fases.inv; e.hp=Math.min(e.max,e.hp+M.fases.heal*e.max); emit('bossPhase',{k:'shield'}); }
      if(e.mech==='invocador'&&B.t>=(e.sumAt||0)){ e.sumAt=B.t+M.invocador.every; const m=B.minion;
        for(let i=0;i<M.invocador.n;i++){ const at=B.t+0.4+i*0.3; B.enemies.push({hp:m.hp,max:m.hp,atk:m.atk,df:m.df,spawn:B.t,walk:0.4+i*0.3,arrive:at,next:at,first:false,dead:false,minion:true,spd:m.spd}); }
        if(B.t>0.5) emit('bossPhase',{k:'summon'}); }
      e.hpSeen=e.hp; }
    return false }
  /* ---------- zonas: élites y JEFES con su pasiva y sus habilidades (CFG.zones) ---------- */
  // Fase f de un modo → zona floor((f-1)/30). Fase 10 de la zona: élite 1 · 20: élite 2 · 30: JEFE (30, 60, 90, 120 y 150).
  // Cada élite/JEFE lleva: e.zone (su zona), e.role ('e1', 'e2' o 'jefe'), e.zp (pasiva), e.zs (habilidades con su próxima vez),
  // e.am (multiplica su ataque), e.dm (multiplica el daño que recibe), e.sm (multiplica su velocidad) y e.amK (extra que se queda).
  // Estados en el héroe: B.hs (cargas de veneno/sangrado/quemadura, infección, pudrición, burla, locura, defensa rota, sin curar…).
  const ZL=()=>(CFG.zones&&CFG.zones.list)||[];
  const zoneIdx=f=>Math.max(0,Math.min(4,Math.floor((Math.max(1,f)-1)/30)));
  const zoneAt=(m,f)=>{ const L=ZL(), M=L[Math.max(0,Math.min(L.length-1,m||0))]; return M&&M[zoneIdx(f)]||null };
  const bossRole=f=>{ const r=f%30; return r===10?'e1':r===20?'e2':r===0?'jefe':null };   // qué sale en una fase múltiplo de 10
  const zoneFoe=(Z,role)=>Z&&Z[role]?{name:Z[role].name,title:Z[role].title||'',p:Z[role].p,zone:Z.id,role}:null;   // para la pantalla
  const hsOf=()=>B.hs||(B.hs={dots:[],inf:0,rot:0,burla:0,mad:0,def:[]});
  const zAlive=id=>!!B&&B.enemies.some(e=>!e.dead&&!e.down&&e.zp&&e.zp.id===id);
  const eFrac=e=>e.immortal?Math.max(0,1-B.t/CFG.wboss.dur):e.hp/e.max;   // Jefe semanal: el minuto cuenta como su vida
  const EM=e=>e.immortal?(e.refMax||1):e.max;   // vida de referencia (el Jefe semanal no tiene)
  const canTarget=e=>!e.dead&&!e.down&&!(e.untarget>B.t);
  // ---- lo que cambia en el héroe (lo usa el bucle del combate) ----
  const heroDfMul=()=>{ if(!B||!B.hs) return 1; const D=B.hs.def=B.hs.def.filter(x=>x.until>B.t); return Math.max(0.1,1-D.reduce((a,x)=>a+x.pct,0)) };
  const heroAtkMul=()=>B&&B.hs&&B.hs.burla?1-B.hs.burla*B.hs.burlaPer:1;                     // Burla: te roba ataque
  const heroSpdMul=()=>B&&B.dream&&B.dream.k==='lento'&&B.dream.until>B.t?B.dream.slow:1;      // Cambio de sueño: atacas más lento
  const heroNoSkills=()=>!!B&&(B.stun>B.t||!!(B.hs&&B.hs.noSkill>B.t));                       // aturdido o silenciado
  const cdMul=()=>B&&zAlive('estatica')?1+zPass('estatica').cd:1;                              // Estática: recargas más lentas
  const zPass=id=>{ const e=B.enemies.find(x=>!x.dead&&x.zp&&x.zp.id===id); return e?e.zp:{} };
  const heroCap=h=>B&&B.hs&&B.hs.rot?h.hp*(1-B.hs.rot*B.hs.rotPer):h.hp;                      // Pudrición: menos vida máxima
  // Hambre de luz: el Devorador se come parte de lo que te curas o de tu escudo, y se cura lo mismo
  function zEat(x,h){ const dv=B.mechOn&&B.enemies.find(e=>!e.dead&&!e.down&&e.zp&&e.zp.id==='hambreLuz'); if(!dv||!(x>0)) return x;
    const s=x*dv.zp.pct; dv.hp=Math.min(dv.max,dv.hp+s/h.hp*dv.max); dv.hpSeen=dv.hp; return x-s }
  // curación que de verdad llega (sin curar, infección, Hambre de luz) y escudo que de verdad llega
  function zoneHeal(x,h){ if(!B) return x; const H=B.hs; if(H){ if(H.noHeal>B.t) return 0; if(H.inf) x*=1-H.inf*H.infPer; } return zEat(x,h) }
  const zoneShield=(x,h)=>B?zEat(x,h):x;
  // Locura: atacas a uno al azar
  const zoneTarget=cand=>B.hs&&B.hs.madU>B.t&&cand.length>1?cand[Math.floor(rand()*cand.length)]:null;
  function addHeroDot(k,n,o){ if(B&&B.noHurt) return; const H=hsOf(), D=(CFG.heroDot||{})[k]||{pct:0.01,dur:6,max:3}; o=o||{};
    for(let i=0;i<n;i++){ H.dots.push({k,until:B.t+(o.dur||D.dur),pct:o.pct||D.pct}); const mine=H.dots.filter(x=>x.k===k&&x.until>B.t); if(mine.length>(D.max||3)) H.dots.splice(H.dots.indexOf(mine[0]),1); }
    emit('fx',{k:'heroDot',dot:k}) }
  const addMad=(n,P)=>{ const H=hsOf(); H.mad+=n; if(H.mad>=(P.max||3)){ H.mad=0; H.madU=B.t+(P.dur||2); emit('fx',{k:'locura'}); } };
  // ---- preparar un élite o JEFE de zona ----
  // o: {zone (zona fija), keepMinion (no cambia B.minion), hpM/atkM (copias), noEscort}
  function zoneSetup(e,f,mode,role,o){ o=o||{}; const Z=o.zone||zoneAt(mode,f), D=Z&&Z[role]; if(!D) return null; B.mechOn=true;
    if(!o.keepMinion){ const m=enemyStats(f,1,false,mode); B.minion={hp:m.hp,atk:m.atk,df:m.df,spd:eSpd(f)}; }
    const K=D.k||{}, W=o.muro&&D.muro||1; let kh=(K.hp||1)*W;   // k: ajuste propio de vida y ataque (equilibrio) · muro: × vida y ataque solo en la campaña (o.muro)
    if(D.def&&e.df>0){ const a=towerOn()?CFG.tower.hero.atk:refHero(mode,f).atk; kh*=dmgF(a,e.df*D.def)/dmgF(a,e.df); e.df*=D.def; e.acor=D.def; }   // acorazado: ×def de defensa y, para que al héroe típico le cueste lo mismo, menos vida
    if(kh!==1&&!e.immortal&&!o.keepHp){ e.hp*=kh; e.max*=kh; } e.atkK=(K.atk||1)*W; e.atk*=e.atkK;
    Object.assign(e,{zone:Z,role,name:D.name,title:D.title||'',zp:D.p,am:1,dm:1,sm:1,amK:1,hpSeen:e.hp,df0:e.df,hitN:0});
    const first=(e.arrive||0)+((CFG.zones||{}).first||3);
    e.zs=(role==='jefe'?[D.own,D.s1,D.s2]:[D.s]).filter(s=>s&&s.cd).map((s,i)=>({...s,next:first+i*1.7}));
    e.zsAll=(role==='jefe'?[D.own,D.s1,D.s2]:[D.s]).filter(Boolean);
    const P=D.p;
    if(P.id==='inquebrantable'){ e.noCC=true; e.spd=(e.spd||1)*P.spd; e.amK*=P.atk; e.smallRes=P; }
    if(P.id==='cabezaDura') e.critRes=P.crit;
    if(P.id==='dotGolpe'&&P.ranged){ e.ranged=true; e.next=Math.min(e.next,(e.spawn||0)+0.6); }   // ataca antes de llegar
    if(P.id==='armaduraHueso'){ e.sh=P.sh*EM(e); e.shAt=B.t+P.every; }
    if(P.id==='caja') e.boxAt=first+P.every*0.5;
    if(P.id==='division') e.divLeft=P.at.slice();
    if(P.id==='formas') e.form=1;
    if(P.id==='totem'&&!o.noEscort) zSpawn(1,{hp:P.hp*EM(e),atk:0,x:{totem:true,next:Infinity,heals:P.heal}});
    if(D.escort&&!o.noEscort) zSpawn(D.escort,{walk:(e.walk||1)*0.8,x:{escort:true}});
    return e }
  // sacar monstruos normales de la zona (o lo que diga o): esbirros del jefe
  // (los que llaman los jefes, sin vida o ataque propios: un poco más flojos que un monstruo normal, zones.minion)
  function zSpawn(n,o){ o=o||{}; const m=B.minion||{hp:1,atk:0,df:0,spd:1}, K=(CFG.zones||{}).minion||{}, out=[];
    for(let i=0;i<n;i++){ const w=(o.walk!=null?o.walk:0.6)+i*0.3, at=B.t+w, hp=o.hp!=null?o.hp:m.hp*(K.hp||1);
      const x={hp,max:hp,atk:o.atk!=null?o.atk:m.atk*(K.atk||1),df:o.df!=null?o.df:m.df,spawn:B.t,walk:w,arrive:at,next:at,first:false,dead:false,minion:true,spd:o.spd||m.spd||1,...(o.x||{})};
      B.enemies.push(x); out.push(x); }
    return out }
  // un élite de otra zona (Tu peor miedo, copias del Cambio de sueño): con su pasiva y su habilidad
  function zSpawnElite(Z,role,hp,atk){ const x=zSpawn(1,{hp,atk})[0]; x.minion=false; x.summoned=true; zoneSetup(x,1,0,role,{zone:Z,keepMinion:true,noEscort:true,keepHp:true}); return x }   // keepHp: ya trae su vida (no se vuelve a ajustar)
  // ---- golpes del enemigo al héroe ----
  // multiplicador del golpe normal (Acecho: el primero) y lo que pasa después de un golpe normal
  function zoneAtkMul(e){ const P=e.zp; if(P&&P.id==='acecho'&&!e.ambushed){ e.ambushed=true; e.ambushNow=true; return P.mult } return 1 }
  function zoneAfterAttack(e){ const P=e.zp, H=hsOf();
    if(e.ambushNow){ e.ambushNow=false; B.stun=Math.max(B.stun||0,B.t+P.stun); emit('fx',{k:'aturdido'}); }
    const rotP=e.rotBy||(P&&P.id==='pudricion'?P:null); if(rotP){ H.rotPer=rotP.per; H.rot=Math.min(rotP.max,H.rot+1); }   // Pudrición real (también sus zombis)
    if(!P) return;
    switch(P.id){
      case 'dotGolpe': addHeroDot(P.dot,1); break;
      case 'infecta': H.infPer=P.per; H.inf=Math.min(P.max,H.inf+1); break;
      case 'burla': H.burlaPer=P.per; H.burla=Math.min(P.max,H.burla+1); break;
      case 'locura': addMad(1,P); break;
      case 'ansia': e.ansia=Math.min(P.max,(e.ansia||0)+1); break;
      case 'beso': { const h=heroStats(), x=P.pct*h.hp; if(!B.noHurt){ B.hp=Math.max(0,B.hp-x); emit('heroHit',{d:x}); } e.hp=Math.min(e.max,e.hp+P.pct*e.max); e.hpSeen=e.hp; break; }
    } }
  // después de cualquier daño al héroe (golpes y habilidades): robo de vida de los enemigos y Festín de dolor
  function zoneOnHurt(e,d){ if(!B.mechOn||!(d>0)) return; const h=heroStats(), fr=d/h.hp;
    if(e&&e.zp){ const P=e.zp; let st=e.skillHeal||0;
      if(P.id==='robaVida'||P.id==='senorSangre') st+=P.pct;
      if(P.id==='formas'&&e.form===3) st+=P.steal;
      if(B.dream&&B.dream.k==='roban'&&B.dream.until>B.t) st+=B.dream.steal;
      if(st>0&&!e.immortal){ const x=Math.min(e.max-e.hp,st*fr*e.max); e.hp+=x; e.hpSeen=e.hp; if(P.id==='senorSangre') e.sang=(e.sang||0)+x/e.max; } }
    zFeast(fr) }
  function zFeast(fr){ for(const v of B.enemies) if(!v.dead&&!v.down&&v.zp&&v.zp.id==='festinDolor'){ v.hp=Math.min(v.max,v.hp+v.zp.pct*fr*v.max); v.hpSeen=v.hp; } }   // Festín de dolor
  // ---- muertes especiales: Rearmarse, Reencarnación y Desmembrarse (devuelve true si aún no muere) ----
  function zoneLethal(e){ const P=e.zp, own=e.role==='jefe'&&e.zsAll&&e.zsAll[0];
    const down=(t,hp)=>{ e.down=B.t+t; e.upHp=hp; e.hp=e.hpSeen=e.max*1e-6; emit('fx',{k:'caido',e}); return true };
    if(P&&P.id==='rearmarse'&&!e.rearmed){ e.rearmed=true; return down(P.after,P.hp) }
    if(e.rearm&&!e.rearmed){ e.rearmed=true; return down(e.rearm.after,e.rearm.hp) }                                       // esqueletos del Ejército eterno
    if(own&&own.id==='reencarnacion'&&!e.reinc){ e.reinc=true; B.reincU=B.t+own.after; for(const m of B.enemies) if(m.minion&&!m.dead){ m.amK=(m.amK||1)*(1+own.buff); m.reincBuff=true; } return down(own.after,own.hp) }   // (solo los que hay ahora: al acabar se les quita a ellos)
    if(P&&P.id==='desmembrarse'&&!e.dism){ e.dism=true; const ps=zSpawn(P.n,{hp:EM(e)*0.15,atk:e.atk*0.3,walk:0.2}); for(const x of ps) x.pieceOf=e;
      e.reAt=B.t+P.after; down(Infinity,P.hp); return true }
    return false }
  // al morir (de verdad): Hermandad, ¡Waaagh!, Puerta cerrada, Gases (revienta)
  function zoneOnDeath(e){ if(!B||!B.mechOn) return; const P=e.zp;
    if(P&&P.id==='hermandad'&&!e.brother){ const x=zSpawnElite(e.zone,e.role,P.hp*EM(e),e.atk); x.brother=true; emit('fx',{k:'hermandad',e:x}); }
    if(P&&P.id==='gases') (B.zq=B.zq||[]).push({at:B.t,boom:P.boom,src:e});
    if(e.minion||e.escort) for(const o of B.enemies){ if(o.dead||o.down||!o.zp) continue;
      if(o.zp.id==='waaagh'&&(o.waaagh||0)<o.zp.max){ o.waaagh=(o.waaagh||0)+1; o.amK*=1+o.zp.per; const k=1+o.zp.per; o.max*=k; o.hp*=k; o.hpSeen=o.hp; }
      if(o.zp.id==='puerta'&&(o.door||0)<o.zp.max){ o.door=(o.door||0)+1; o.df=o.df0*(1+o.zp.per*o.door); } } }
  // ---- habilidades de los enemigos ----
  function zCast(e,s,Y){ const H=hsOf(), h=Y.h;
    e.skillHeal=s.heal||0;
    const hit=m=>{ if(m>0) Y.hit(e,m*(s.low&&B.hp<s.low.below*h.hp?s.low.mul:1)) };
    switch(s.id){
      case 'llamar': { const xs=zSpawn(s.n,{}); const P=e.zp; for(const x of xs){ if(P.id==='pudricion') x.rotBy=P; if(P.id==='festin') x.eatAt=B.t+P.eat; } emit('bossPhase',{k:'summon'}); break; }
      case 'clon': zSpawn(1,{hp:s.pct*EM(e)*0.25,atk:e.atk*s.pct*1.5,x:{heroClone:true}}); emit('bossPhase',{k:'summon'}); break;
      case 'peorMiedo': { const L=ZL()[1]||[], Z=L[Math.floor(rand()*L.length)], r=rand()<0.5?'e1':'e2'; if(Z) zSpawnElite(Z,r,s.hp*EM(e)/2,e.atk*0.5); emit('bossPhase',{k:'summon'}); break; }
      case 'encierro': B.stun=Math.max(B.stun||0,B.t+s.dur); H.cage={until:B.t+s.dur,pct:s.pct}; emit('fx',{k:'encierro'}); break;
      case 'murcielagos': e.batU=B.t+s.dur; for(let t=0;t<s.dur-1e-9;t+=s.every) (e.pend=e.pend||[]).push({at:B.t+t,mult:s.mult,heal:1}); break;
      case 'imitar': hit((B.lastSkMult||3)*s.mul); break;
      default:
        if(s.dur&&s.every){ for(let t=0;t<s.dur-1e-9;t+=s.every) (e.pend=e.pend||[]).push({at:B.t+t,mult:s.mult,heal:s.heal}); break; }   // golpes seguidos (Rabieta, Giro brutal)
        if(s.windup){ (e.pend=e.pend||[]).push({at:B.t+s.windup,mult:s.mult}); e.windU=B.t+s.windup; emit('fx',{k:'cargando',e}); break; }   // Golpe partecielos
        if(s.hits) for(let i=0;i<s.hits;i++) hit(s.mult);
        else hit((s.mult||0)+(s.perStitch||0)*(e.stitch||0));
    }
    e.skillHeal=0;
    if(s.stun){ B.stun=Math.max(B.stun||0,B.t+s.stun); emit('fx',{k:'aturdido'}); }
    if(s.noAttack){ B.stun=Math.max(B.stun||0,B.t+s.noAttack); emit('fx',{k:'hipnosis'}); }
    if(s.noSkills){ H.noSkill=Math.max(H.noSkill||0,B.t+s.noSkills); emit('fx',{k:'desarmado'}); }
    if(s.noHeal) H.noHeal=Math.max(H.noHeal||0,B.t+s.noHeal);
    if(s.charm) e.untarget=B.t+s.charm;
    if(s.dot) addHeroDot(s.dot.k,s.dot.n,s.dot);
    if(s.dotX) H.dotX={until:B.t+s.dotX.dur,mul:s.dotX.mul};
    if(s.defDown) H.def.push({until:B.t+s.defDown.dur,pct:s.defDown.pct});
    if(s.madness) addMad(s.madness,(e.zp&&e.zp.id==='locura'?e.zp:{max:3,dur:2}));
    if(s.shieldBreak){ BUF.shield=0; BUF.gshield=0; }
    if(s.acecho){ Y.hit(e,(e.zone&&e.zone.e2&&e.zone.e2.p.mult)||3); B.stun=Math.max(B.stun||0,B.t+1); }
    emit('fx',{k:'eskill',e,name:s.name}) }
  // ---- cada paso: pasivas, habilidades y estados del héroe. Devuelve true si el héroe cae ----
  function zoneTick(h,dt,Y){ const H=B.hs, cap=heroCap(h);
    if(B.hp>cap) B.hp=cap;
    // estados del héroe: cargas (veneno, sangrado, quemadura), encierro, Ardiente, Lago de lava, Cambio de sueño y Tres formas
    let loss=0;
    if(H){ H.dots=H.dots.filter(x=>x.until>B.t); for(const x of H.dots) loss+=x.pct*(x.k==='veneno'&&H.dotX&&H.dotX.until>B.t?H.dotX.mul:1);
      if(H.cage&&H.cage.until>B.t) loss+=H.cage.pct; }
    for(const e of B.enemies){ if(e.dead||e.down||!e.zp||e.arrive>B.t) continue; const P=e.zp;
      if(P.id==='ardiente') loss+=P.pct; if(P.id==='lago') loss+=P.per*(e.lago||0); if(P.id==='formas'&&e.form===2) loss+=P.burn; }
    if(B.dream&&B.dream.k==='arde'&&B.dream.until>B.t) loss+=B.dream.burn;
    if(loss>0&&!B.noHurt){ const x=loss*h.hp*dt; B.hp-=x; zFeast(x/h.hp); if(B.hp<=0) return true; }
    // cola: lo que revienta al morir (Gases)
    if(B.zq&&B.zq.length){ const q=B.zq; B.zq=[]; for(const x of q) Y.hit(x.src,x.boom); if(B.hp<=0) return true; }
    for(const e of B.enemies.slice()){
      if(e.dead) continue;
      if(e.reAt){ const ps=B.enemies.filter(x=>x.pieceOf===e&&!x.dead);   // Desmembrarse: si matas los trozos, muere; si no, a los 8 s se vuelve a montar
        if(!ps.length){ e.reAt=0; e.down=0; e.hp=e.hpSeen=0; Y.kill(e); continue; }
        if(B.t>=e.reAt){ e.reAt=0; for(const x of ps){ x.dead=true; x.deadAt=B.t; x.eaten=true; } e.down=B.t; } }
      if(e.down){ if(B.t>=e.down){ e.down=0; e.hp=e.hpSeen=e.upHp*e.max; emit('fx',{k:'levanta',e}); } else continue; }   // se levanta
      if(e.totem&&e.arrive<=B.t){ for(const o of B.enemies) if(!o.dead&&!o.down&&o!==e&&!o.totem){ o.hp=Math.min(o.max,o.hp+e.heals*o.max*dt); o.hpSeen=o.hp; } continue; }   // Tótem: cura a los goblins
      if(e.eatAt&&B.t>=e.eatAt){ e.eatAt=0; const w=B.enemies.find(o=>!o.dead&&!o.down&&o.zp&&o.zp.id==='festin');   // Festín de guerra: se come a los que sigan vivos
        if(w&&(w.eaten||0)<w.zp.eatMax){ w.eaten=(w.eaten||0)+1; const k=1+w.zp.eatPer; w.max*=k; w.hp=Math.min(w.max,w.hp*k+e.hp); w.hpSeen=w.hp; w.amK*=k; e.dead=true; e.deadAt=B.t; e.eaten=true; emit('fx',{k:'devora',e:w}); continue; } }
      if(!e.zp||e.arrive>B.t) continue;
      const P=e.zp, fr=eFrac(e); let am=e.amK||1, dm=1, sm=1;
      switch(P.id){
        case 'dividirse': if(!e.split&&fr<P.at){ e.split=true; zSpawn(P.n,{hp:P.hp*EM(e),atk:e.atk*0.5,walk:0.3}); emit('bossPhase',{k:'summon'}); } break;
        case 'division': { const own=e.zsAll[0]; while(e.divLeft.length&&fr<e.divLeft[0]){ e.divLeft.shift(); const xs=zSpawn(P.n,{hp:P.hp*EM(e),atk:e.atk*0.3,walk:0.3}); for(const x of xs){ x.absorbAt=B.t+own.after; x.absorbBy=e; } emit('bossPhase',{k:'summon'}); }
          for(const x of B.enemies) if(x.absorbBy===e&&!x.dead&&B.t>=x.absorbAt){ x.dead=true; x.deadAt=B.t; x.eaten=true; e.max+=x.hp; e.hp+=x.hp; e.hpSeen=e.hp; e.atk+=x.atk; e.grow=(e.grow||1)+own.grow; emit('fx',{k:'devora',e}); } break; }   // Absorber
        case 'alfa': if(B.t>=(e.callAt||(e.callAt=B.t+P.every))){ e.callAt=B.t+P.every; zSpawn(P.n,{}); emit('bossPhase',{k:'summon'}); }
          am*=1+P.per*Math.min(P.max,B.enemies.filter(x=>x.minion&&!x.dead).length); break;
        case 'llamada': if(B.t>=(e.callAt||(e.callAt=B.t+P.every))){ e.callAt=B.t+P.every; zSpawn(P.n,{}); emit('bossPhase',{k:'summon'}); }
          dm*=1-P.dr*Math.min(P.max,B.enemies.filter(x=>x.minion&&!x.dead).length); break;
        case 'armaduraHueso': if(B.t>=e.shAt){ e.sh=P.sh*EM(e); e.shAt=B.t+P.every; } break;
        case 'ejercito': if(B.t>=(e.callAt||(e.callAt=B.t+P.every))){ e.callAt=B.t+P.every; for(const x of zSpawn(P.n,{})) x.rearm={after:3,hp:0.5}; emit('bossPhase',{k:'summon'}); } break;
        case 'ansia': sm*=1+P.per*(e.ansia||0); break;
        case 'festin': am*=1+Math.min(P.max,Math.floor((e.hitN||0)/P.hits)*P.per);
          if(B.t>=(e.callAt||(e.callAt=B.t+P.every))){ e.callAt=B.t+P.every; for(const x of zSpawn(P.n,{})) x.eatAt=B.t+P.eat; emit('bossPhase',{k:'summon'}); } break;
        case 'gases': if(e.hpSeenG!=null&&e.hp<e.hpSeenG&&B.t>=(e.gasAt||0)){ e.gasAt=B.t+1; const H2=hsOf(); H2.infPer=P.per; H2.inf=Math.min(P.max,H2.inf+1); } e.hpSeenG=e.hp; break;
        case 'caja': if(!e.boxIn&&B.t>=e.boxAt){ e.boxIn=true; e.boxOut=B.t+P.hide; emit('fx',{k:'caja',e}); }
          else if(e.boxIn&&B.t>=e.boxOut){ e.boxIn=false; e.boxAt=B.t+P.every; const s=e.zsAll.find(x=>x.id==='sorpresa'); if(s) zCast(e,s,Y); }
          if(e.boxIn) dm*=1-P.dr; break;
        case 'hilos': if(B.t>=(e.callAt||(e.callAt=B.t+1))){ e.callAt=B.t+P.every; zSpawn(P.n,{x:{puppet:true}}); emit('bossPhase',{k:'summon'}); }
          if(B.enemies.some(x=>x.puppet&&!x.dead)) dm*=1-P.dr; break;
        case 'descosido': { const n=Math.min(P.max,Math.floor((1-fr)/P.step)); while((e.stitch||0)<n){ e.stitch=(e.stitch||0)+1; zSpawn(1,{hp:EM(e)*0.06,atk:e.atk*0.4,walk:0.2}); emit('bossPhase',{k:'summon'}); }
          am*=1+P.dmg*(e.stitch||0); break; }
        case 'sed': if(B.hp<P.below*h.hp) sm*=P.spd; break;
        case 'senorSangre': am*=1+P.per*Math.min(P.max,Math.floor((e.sang||0)/P.step)); break;
        case 'sueno': if(B.t>=(e.dreamAt||(e.dreamAt=B.t+P.every))){ e.dreamAt=B.t+P.every; const K=['arde','lento','roban','copias'], k=K[Math.floor(rand()*K.length)];
            B.dream={k,until:B.t+P.dur,burn:P.burn,slow:P.slow,steal:P.steal}; emit('fx',{k:'sueno',rule:k});
            if(k==='copias'){ const L=ZL()[1]||[], Z=L[Math.floor(rand()*L.length)], r=rand()<0.5?'e1':'e2'; if(Z) for(let i=0;i<P.copies;i++) zSpawnElite(Z,r,EM(e)*0.1,e.atk*0.4); } } break;
        case 'invisible': if(B.t>=(e.invAt||(e.invAt=B.t+P.every))){ e.invAt=B.t+P.every; e.untarget=B.t+P.dur; emit('fx',{k:'invisible',e}); } break;
        case 'puerta': if(B.t>=(e.callAt||(e.callAt=B.t+P.every))){ e.callAt=B.t+P.every; zSpawn(P.n,{}); emit('bossPhase',{k:'summon'}); } break;
        case 'armaduraInf': e.df=e.df0*(1+P.per*Math.min(P.max,Math.floor((e.hitN||0)/P.hits))); break;   // +per de defensa cada hits golpes
        case 'festinDolor': if(B.hp<P.below*h.hp) am*=1+P.dmg; break;
        case 'montura': if(!e.dismount&&fr<P.at){ e.dismount=true; zSpawn(1,{hp:P.hp*EM(e),atk:e.atk*0.6,walk:0.2,x:{beast:true}}); emit('bossPhase',{k:'summon'}); } break;
        case 'forja': if(B.t>=(e.forjaAt||(e.forjaAt=B.t+P.every))){ e.forjaAt=B.t+P.every; e.forja=Math.min(P.max,(e.forja||0)+1); } am*=1+P.per*(e.forja||0); break;
        case 'lago': if(B.t>=(e.lagoAt||(e.lagoAt=B.t+P.every))){ e.lagoAt=B.t+P.every; e.lago=Math.min(P.max,(e.lago||0)+1); } break;
        case 'escudoLuz': if(B.t>=(e.shAt||(e.shAt=B.t+P.every))){ e.shAt=B.t+P.every; for(const o of B.enemies) if(!o.dead&&!o.down) o.sh=(o.sh||0)+P.sh*EM(o); emit('fx',{k:'escudoLuz'}); } break;
        case 'formas': { const f2=fr<P.at[1]?3:fr<P.at[0]?2:1; if(f2!==e.form){ e.form=f2; e.inv=B.t+P.inv; e.grow=1+0.15*(f2-1); emit('bossPhase',{k:'shield'}); }
          if(e.form===1) dm*=1-P.dr; if(e.form===2) sm*=P.spd; if(e.form===3) am*=1+P.dmg; break; }
      }
      const own=e.role==='jefe'&&e.zsAll[0];
      if(own&&own.id==='lunaLlena'&&!e.moon&&fr<own.at){ e.moon=true; e.hp=Math.min(e.max,e.hp+own.heal*e.max); e.hpSeen=e.hp; e.amK*=1+own.dmg; am*=1+own.dmg; e.grow=(e.grow||1)+own.grow; emit('bossPhase',{k:'rage'}); }
      if(e.batU>B.t) dm=0;   // Forma de murciélagos: no recibe daño
      e.am=am; e.dm=dm; e.sm=sm;
      if(e.windU>B.t||e.boxIn) continue;   // cargando el golpe o escondido: no lanza nada más
      // golpes pendientes (Rabieta, Giro brutal, Golpe partecielos, murciélagos)
      if(e.pend&&e.pend.length){ const now=e.pend.filter(q=>q.at<=B.t); if(now.length){ e.pend=e.pend.filter(q=>q.at>B.t); for(const q of now){ e.skillHeal=q.heal||0; Y.hit(e,q.mult); e.skillHeal=0; } if(B.hp<=0) return true; } }
      // habilidades con recarga (× cdK)
      for(const s of e.zs){ if(B.t<s.next) continue; s.next=B.t+s.cd*((CFG.zones||{}).cdK||1); zCast(e,s,Y); if(B.hp<=0) return true; break; }
    }
    // los esbirros del Rey Esqueleto pegan +50 % mientras se levanta; al terminar, vuelven a lo normal
    if(B.reincU&&B.t>=B.reincU){ B.reincU=0; const own=B.enemies.find(x=>x.role==='jefe'&&x.zsAll&&x.zsAll[0].id==='reencarnacion'); for(const m of B.enemies) if(m.reincBuff){ m.reincBuff=false; m.amK=(m.amK||1)/(1+((own&&own.zsAll[0].buff)||0.5)); } }
    for(const m of B.enemies) if(m.minion&&m.amK&&!m.zp) m.am=m.amK;
    return B.hp<=0 }
  // estados del héroe para los iconos de la pantalla: {k, n, max} (cargas) o {k, left} (segundos)
  function heroDebuffs(){ if(!B) return []; const H=B.hs||{}, o=[], left=u=>u>B.t?u-B.t:0, D=CFG.heroDot||{};
    for(const k of ['veneno','sangrado','quemadura']){ const n=(H.dots||[]).filter(x=>x.k===k&&x.until>B.t).length; if(n) o.push({k:'h_'+k,n,max:(D[k]||{}).max||3}); }
    if(left(B.stun)) o.push({k:'h_stun',left:left(B.stun)}); if(left(H.noSkill)) o.push({k:'h_noskill',left:left(H.noSkill)}); if(left(H.noHeal)) o.push({k:'h_noheal',left:left(H.noHeal)});
    if(H.inf) o.push({k:'h_inf',n:H.inf,max:3}); if(H.rot) o.push({k:'h_rot',n:H.rot,max:5}); if(H.burla) o.push({k:'h_burla',n:H.burla,max:3});
    if(left(H.madU)) o.push({k:'h_locura',left:left(H.madU)}); else if(H.mad) o.push({k:'h_mad',n:H.mad,max:3});
    const dd=(H.def||[]).filter(x=>x.until>B.t); if(dd.length) o.push({k:'h_def',left:Math.max(...dd.map(x=>x.until))-B.t});
    if(B.dream&&left(B.dream.until)) o.push({k:'h_sueno_'+B.dream.k,left:left(B.dream.until)});
    return o }

  /* ---------- Torre (roguelike) ---------- */
  function towerState(){ const T=S.tower=S.tower||{best:0,run:null,got:0};
    if(T.run&&(T.run.boons||[]).some(b=>b.t!=='c'&&b.t!=='g')) T.run=null;   // partida de la Torre antigua (otras mejoras): se cierra
    if(T.reach==null) T.reach=T.best?Math.min(CFG.tower.maxFloor,T.best+1):0;
    return T }
  // run.hp: fracción de vida que te queda en la partida (no se cura entre combates; al perder una vida vuelves con la vida llena)
  function towerStart(){ if(inEvent()||!modeOpen('tower')) return false; const T=towerState(), map=[];
    T.run={seed:Math.floor(rand()*1e6),floor:1,lives:CFG.tower.lives,hp:1,boons:[],map,from:null,pick:null,souls:0,curses:[],ev:null,unk:null}; towerMapFill(T.run);   // el mapa entero de los pisos 1-10
    T.run.nodes=map[0].n; save(); emit('change'); return true }
  function towerAbandon(){ const T=towerState(); if(inEvent()) return false; T.run=null; save(); emit('change'); return true }
  // elegir camino: combate (normal/élite/jefe), cofre (1 grimorio al azar), tienda, evento, altar u hoguera
  function towerGo(i){ const T=towerState(), run=T.run; if(!run||run.pick||run.shop||run.ev||inEvent()||run.lives<=0) return false; const k=run.nodes[i]; if(!k||!towerCanGo(i)) return false;
    { const m=towerMap()[0]; run.from=m&&m.n===run.nodes?m.c[i]:null; if(m&&m.n===run.nodes) run.trail=(run.trail||[]).filter(t=>t.f<run.floor).concat([{f:run.floor,row:m,i}]).slice(-40); }   // camino recorrido (para el mapa)
    if(k==='shop'){ const SH=CFG.tower.shop, c=towerOffer(SH.cards,'shop',['c']), g=towerOffer(SH.grims,'shop',['g']); run.shop={items:c.concat(g),bought:[],removed:false}; save(); emit('change'); return {k} }
    if(k==='treasure'){ const b=towerOffer(1,'chest',['g'])[0]; if(b){ towerGain(run,b); emit('towerGot',b); } towerNext(); return {k,got:b||null} }   // al azar: la pantalla enseña «Obtenido»
    if(k==='event'){ // «?» como en StS: puede ser combate, tienda, cofre o evento; lo que no sale gana probabilidad y lo que sale vuelve a su base
      const U=CFG.tower.route.unk, u=run.unk=run.unk||{m:U.m[0],s:U.s[0],t:U.t[0]}, r=rand(); let got='event';
      if(r<u.m) got='fight'; else if(r<u.m+u.s) got='shop'; else if(r<u.m+u.s+u.t) got='treasure';
      u.m=got==='fight'?U.m[0]:u.m+U.m[1]; u.s=got==='shop'?U.s[0]:u.s+U.s[1]; u.t=got==='treasure'?U.t[0]:u.t+U.t[1];
      if(got==='event'){ const E=Object.keys(CFG.tower.events); run.ev={id:E[Math.floor(rand()*E.length)]}; save(); emit('change'); return {k,ev:run.ev.id} }
      if(got==='shop'){ const SH=CFG.tower.shop, c=towerOffer(SH.cards,'shop',['c']), g=towerOffer(SH.grims,'shop',['g']); run.shop={items:c.concat(g),bought:[],removed:false}; save(); emit('change'); return {k,unk:'shop'} }
      if(got==='treasure'){ const b=towerOffer(1,'chest',['g'])[0]; if(b){ towerGain(run,b); emit('towerGot',b); } towerNext(); return {k,unk:'treasure',got:b||null} }
      towerFight('fight'); return {k,unk:'fight'} }
    if(k==='altar'){ run.ev={id:'altar'}; save(); emit('change'); return {k,ev:'altar'} }
    // hoguera: vida al máximo (si ya estaba llena, solo te ahorras el combate)
    if(k==='rest'){ const full=!(run.hp<1); run.hp=1; towerNext(); save(); emit('change'); return {k,full} }
    towerFight(k); return {k} }
  // revivir con anuncio (una vez por partida): vuelves al mismo piso con revHp de vida
  function towerRevive(){ const run=S.tower&&S.tower.run; if(!run||run.lives>0||run.adRev) return false; run.adRev=true; run.lives=1; run.hp=CFG.tower.revHp; save(); emit('change'); return true }
  // siguiente piso. El piso final (maxFloor) no se supera: su jefe tiene vida infinita
  function towerNext(){ const T=towerState(), run=T.run; run.floor++; const f=run.floor-1;
    if(run.floor>(T.reach||0)) T.reach=run.floor;   // piso más alto al que has llegado (ranking)
    let got=null; if(f>T.best){ T.best=f; for(const r of CFG.tower.rewards) if(f%r.every===0){ got=r.b; giveBundle(r.b); break } }
    const map=run.map=run.map||[]; map.shift(); towerMapFill(run); run.nodes=map[0].n;   // (no towerMap(): ya con el piso nuevo, rellenaría antes de quitar el de atrás)   // tras el jefe (piso 10, 20…) el mapa se queda vacío y se hace el del tramo nuevo
    save(); if(got) emit('towerReward',{floor:f,b:got}); emit('change') }
  function towerBuyLife(){ const run=S.tower&&S.tower.run; if(!run) return false; const c=CFG.tower.lifeCost; if(!spend(c)) return false; run.lives++; save(); emit('change'); return true }
  /* ---------- Torre: mapa de 3 caminos ---------- */
  // Mapa en 3 caminos (route.lanes) con las reglas de Slay the Spire, por tramos de 10 pisos (como un acto):
  //  · cada camino sigue recto; en los pisos de cruce (route.fork: 3, 6 y 9 del tramo) se puede pasar al camino de al lado
  //  · fijos: piso 1 del tramo, combates; piso 6, cofres; piso 9, hoguera (para todos); piso 10, jefe
  //  · el resto sale de una «bolsa» con los % de StS (route.pct: combate 53, ? 22, hoguera 12, élite 8 ×1,6, tienda 5)
  //  · sin élites ni hogueras en los 3 primeros pisos del tramo, ni hoguera en el piso 8 (justo antes de la del jefe)
  //  · en la misma ruta no se repiten seguidos élite, tienda, hoguera ni cofre; tras un cruce, las dos rutas son distintas
  //  · desde el piso 15, a veces las rutas se juntan en un élite obligatorio y justo antes hay tienda en una y hoguera en la otra
  const towerMerge=f=>{ const T=CFG.tower, R=T.route, run=S.tower&&S.tower.run, sd=(run&&run.seed)||0, m=f%T.boss.every; if(f<R.mergeFrom||m===0||m===T.boss.every-1||m===R.treasureAt||m===1) return false;
    if(m===R.mergeAt) return true; const x=Math.sin(f*12.9898+sd*78.233)*43758.5453; return x-Math.floor(x)<R.merge };   // fijo para cada partida (se puede ver por adelantado)
  function towerTramo(t){ const T=CFG.tower, R=T.route, E=T.boss.every, rows=[], N=R.lanes||2, shuf=a=>{ for(let i=a.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a };
    for(let m=1;m<=E;m++){ const f=t*E+m;
      rows.push(m===E?['boss']:m===E-1?['rest']:towerMerge(f)?['elite']:towerMerge(f+1)?shuf(['shop','rest','event'].slice(0,N)):m===1?Array(N).fill('fight'):m===R.treasureAt?Array(N).fill('treasure'):null); }
    // bolsa con los % de StS para las casillas libres
    const free=rows.reduce((a,r)=>a+(r?0:N),0), bag=[], P=R.pct;
    for(const k in P){ if(k==='fight') continue; const n=Math.round(free*P[k]/100); for(let i=0;i<n;i++) bag.push(k); }
    while(bag.length<free) bag.push('fight');
    for(let i=bag.length-1;i>0;i--){ const j=Math.floor(rand()*(i+1)); [bag[i],bag[j]]=[bag[j],bag[i]]; }
    const NOREP=new Set(['elite','shop','rest','treasure']);
    for(let m=1;m<=E;m++){ if(rows[m-1]) continue; const prev=m>1?rows[m-2]:null, out=[];
      for(let side=0;side<N;side++){ const par=prev?(prev.length===1?prev[0]:prev[side]):null;
        const ok=k=>!((k==='elite'||k==='rest')&&m<=R.calm)&&!(k==='rest'&&m===E-2)&&!(NOREP.has(k)&&k===par)&&!(prev&&prev.length===1&&out.includes(k));
        const i=bag.findIndex(ok); out.push(i>=0?bag.splice(i,1)[0]:'fight'); }
      rows[m-1]=out; }
    return rows }
  function towerNodes(f){ const run=S.tower&&S.tower.run, E=CFG.tower.boss.every, t=Math.floor((f-1)/E); if(!run) return f%E===0?['boss']:['fight','fight'];
    const L=run.layout=run.layout||{}; if(!L[t]) L[t]=towerTramo(t); return L[t][(f-1)%E].slice() }
  // mapa estilo Slay the Spire: cada piso tiene caminos en 3 columnas (0-2); desde una columna solo puedes ir a la misma o a las vecinas
  function towerRow(f){ const n=towerNodes(f), c=n.length>=3?[0,1,2]:n.length===2?[0,2]:[1]; return {n,c} }   // 3 caminos en las columnas 0-2 (partidas antiguas: 2, en la 0 y la 2); una casilla sola, en el centro
  // caminos de la fila A (piso f) a la B (piso f+1): con 3 caminos, recto salvo en los pisos de cruce (vecinos); si no, vecinos (y si no hay, todos)
  function towerLinks(A,B,f){ const fk=CFG.tower.route.fork||1, E=CFG.tower.boss.every, fork=!(A.c.length===3&&B.c.length===3)||(f%E)%fk===0, L=[];
    A.c.forEach((ca,i)=>{ let t=B.c.map((cb,j)=>(fork?Math.abs(ca-cb)<=1:ca===cb)?j:-1).filter(j=>j>=0); if(!t.length) t=B.c.map((_,j)=>j); t.forEach(j=>L.push([i,j])) }); return L }
  // mapa: los pisos que se ven (el primero es el actual, el último el jefe del tramo), cada uno {n: tipos, c: columnas}
  // último piso del mapa (tramo de 10) en el que está el piso f: el del jefe
  const towerMapEnd=f=>{ const E=CFG.tower.boss.every; return Math.min(CFG.tower.maxFloor,Math.ceil(f/E)*E) };
  // mapa: del piso actual hasta el jefe de su tramo (como en StS, el mapa de los 10 pisos se ve entero; al vencer al jefe, mapa nuevo)
  function towerMapFill(run){ const map=run.map; while(run.floor+map.length<=towerMapEnd(run.floor)) map.push(towerRow(run.floor+map.length)); return map }
  function towerMap(){ const run=S.tower&&S.tower.run; if(!run) return []; if(!run.map||!run.map[0]||!run.map[0].n) run.map=[{n:run.nodes,c:run.nodes.map((_,i)=>run.nodes.length===1?1:i)}];
    if(run.map[0].n!==run.nodes&&JSON.stringify(run.map[0].n)===JSON.stringify(run.nodes)) run.nodes=run.map[0].n;   // al cargar la partida (JSON) se vuelve a enlazar
    return towerMapFill(run) }   // (partidas guardadas con el mapa de 3 pisos: se completa)
  // ¿se puede ir al camino i del piso actual? (unido a la casilla de la que vienes, según towerLinks)
  function towerCanGo(i){ const run=S.tower&&S.tower.run; if(!run) return false; const m=towerMap()[0]; if(!m||m.n!==run.nodes||run.from==null) return true;
    const p=(run.trail||[]).find(t=>t.f===run.floor-1); if(!p) return true; return towerLinks(p.row,m,p.f).some(([a,b])=>a===p.i&&b===i) }
  /* ---------- Torre: cartas y grimorios ---------- */
  // Cartas y grimorios que pueden salir: las habilidades (hasta maxSkills) y los grimorios, solo 1 de cada
  const RNAME={C:'Común',R:'Rara',E:'Épica',L:'Legendaria'};
  const boonKey=b=>b.t+':'+b.id, boonRar=b=>(boonDef(b)||{}).r||'C';
  const rCount=(run,t,id)=>run.boons.filter(b=>b.t===t&&b.id===id).length;   // copias en la partida (también fuera del combate)
  function boonPool(kinds){ const T=CFG.tower, run=S.tower.run, have=new Set(run.boons.map(boonKey)), out=[];
    const nSk=run.boons.filter(b=>b.t==='c'&&(T.cards[b.id]||{}).type==='skill').length;
    if(kinds.includes('c')) for(const id in T.cards){ const d=T.cards[id]; if(d.type==='skill'&&(have.has('c:'+id)||nSk>=T.maxSkills)) continue; out.push({t:'c',id}); }
    if(kinds.includes('g')) for(const id in T.grims) if(!have.has('g:'+id)) out.push({t:'g',id});
    return out }
  const TYPEN={stat:'Estadística',skill:'Habilidad',fx:'Efecto',pas:'Pasiva'}, FAMN={f:'Fuerza y Crítico',e:'Escudo y Espinas',s:'Sangre'};
  function boonInfo(b){ const d=boonDef(b); if(!d) return {kind:'',name:'?',desc:'',r:'C'};
    return {kind:(b.t==='g'?'Grimorio':'Carta')+' · '+TYPEN[d.type]+' · '+RNAME[d.r],name:d.name,desc:d.desc,r:d.r,fam:d.fam,famName:FAMN[d.fam]||'',type:d.type,grim:b.t==='g'} }
  // n distintas; q = pesos por calidad (CFG.tower.rarity[q] o un objeto); kinds: ['c'] cartas, ['g'] grimorios o los dos
  function towerOffer(n,q,kinds){ let pool=boonPool(kinds||['c','g']);
    const P=typeof q==='string'?CFG.tower.rarity[q]:q, K=Object.keys(P).filter(k=>pool.some(b=>boonRar(b)===k)), o=[];
    while(o.length<n&&pool.length&&K.length){ let r=rand()*K.reduce((a,k)=>a+P[k],0), want=K[K.length-1]; for(const k of K){ r-=P[k]; if(r<0){ want=k; break } }
      let cand=pool.filter(b=>boonRar(b)===want); if(!cand.length) cand=pool.filter(b=>P[boonRar(b)]); if(!cand.length) break; const b=cand[Math.floor(rand()*cand.length)];
      o.push(b); pool=pool.filter(x=>boonKey(x)!==boonKey(b)); } return o }
  // n solo de una calidad (Épica en la fuente, Rara en el mercader, Legendaria en jefes y altar)
  function towerOfferR(n,r,kinds){ let pool=boonPool(kinds||['c','g']).filter(b=>boonRar(b)===r); const o=[];
    while(o.length<n&&pool.length){ const b=pool[Math.floor(rand()*pool.length)]; o.push(b); pool=pool.filter(x=>boonKey(x)!==boonKey(b)); } return o }
  // vida máxima de la partida (para curar la parte nueva al ganar vida máxima)
  const runHpMul=run=>Math.max(0.2,1+run.boons.reduce((a,b)=>a+((boonDef(b)||{}).type==='stat'?(boonDef(b).hp||0):0),0)+(run.hpBonus||0)+CFG.tower.curses.fragil.hp*(run.curses||[]).filter(c=>c==='fragil').length);
  // conseguir una carta o grimorio (elegido, comprado o al azar)
  function towerGain(run,b){ const m0=runHpMul(run); run.boons.push(b); const m1=runHpMul(run);
    if(m1>m0) run.hp=Math.min(1,((run.hp==null?1:run.hp)*m0+(m1-m0))/m1);   // más vida máxima: se cura la parte nueva
    if(b.t==='g'&&b.id==='lagarto') run.rev=(run.rev||0)+1; }               // Cola de lagarto: revives una vez
  // quitar una carta o grimorio (tienda): la vida que tienes no sube
  function towerLose(run,i){ const b=run.boons[i]; if(!b) return null; const m0=runHpMul(run); run.boons.splice(i,1); const m1=runHpMul(run);
    if(m1<m0) run.hp=Math.min(1,(run.hp==null?1:run.hp)*m0/m1);
    if(b.t==='g'&&b.id==='lagarto'&&run.rev>0) run.rev--; return b }
  // elegir 1 de las que se ofrecen (o seguir si no quedan); después, al siguiente piso
  function towerPick(i){ const run=S.tower&&S.tower.run; if(!run||!run.pick) return false; const b=run.pick[i]; if(b) towerGain(run,b);
    const inFight=towerRewardPending(); run.pick=null; if(inFight){ B.rewDone=true; endEvent(); return true }   // elegida en la pelea: ahora sí termina el combate
    towerNext(); return true }
  /* ---------- Torre: eventos ? y altar ---------- */
  const addCurse=run=>{ const K=Object.keys(CFG.tower.curses), c=K[Math.floor(rand()*K.length)]; (run.curses=run.curses||[]).push(c); return c };
  // eventos ? y altar: c = 'si' (aceptar/abrir/comprar/curar), 'quitar' (santuario: quita una maldición) o 'no' (irse)
  function towerEvent(c){ const run=S.tower&&S.tower.run; if(!run||!run.ev||inEvent()) return false; const id=run.ev.id, E=CFG.tower.events; let res={id,c};
    const hp=()=>run.hp==null?1:run.hp, pick=o=>{ run.pick=o; run.ev=null; if(!o.length){ run.pick=null; towerNext(); } };
    if(c==='no'){ run.ev=null; towerNext(); save(); emit('change'); return res }
    if(id==='fuente'){ if(hp()<=E.fuente.hp) return false; run.hp=hp()-E.fuente.hp; pick(towerOfferR(3,'E')); }
    else if(id==='mercader'){ if((run.souls||0)<E.mercader.cost) return false; run.souls-=E.mercader.cost; pick(towerOfferR(3,'R')); }
    else if(id==='trampa'){ if(rand()<E.trampa.good){ res.good=true; pick(towerOffer(3,'trap')); } else { res.good=false; run.hp=Math.max(0.01,hp()-E.trampa.hp); run.ev=null; towerNext(); } }
    else if(id==='santuario'){ if((run.souls||0)<E.santuario.cost) return false;
      if(c==='quitar'){ if(!(run.curses||[]).length) return false; run.curses.pop(); } else run.hp=Math.min(1,hp()+E.santuario.heal);
      run.souls-=E.santuario.cost; run.ev=null; towerNext(); }
    else if(id==='altar'){ res.curse=addCurse(run); const b=towerOfferR(1,'L',['g'])[0]; if(b){ res.got=b; towerGain(run,b); emit('towerGot',b); } run.ev=null; towerNext(); }   // 1 grimorio legendario al azar + 1 maldición
    save(); emit('change'); return res }
  /* ---------- Torre: tienda ---------- */
  // tienda: compra lo que quieras si tienes almas, y puedes quitar 1 cosa que tengas (no maldiciones); al salir, al siguiente piso
  const towerPrice=b=>CFG.tower.shop.price[b.t][boonRar(b)];
  const towerRemoveCost=()=>{ const run=S.tower&&S.tower.run, SH=CFG.tower.shop; return SH.remove+SH.removeUp*((run&&run.removes)||0) };
  function towerShopBuy(i){ const run=S.tower&&S.tower.run, sh=run&&run.shop; if(!sh||sh.bought.includes(i)) return false; const b=sh.items[i]; if(!b) return false;
    if(boonPool([b.t]).every(x=>boonKey(x)!==boonKey(b))) return false;   // ya no se puede (habilidad repetida, grimorio que ya tienes o huecos llenos)
    const c=towerPrice(b); if((run.souls||0)<c) return false; run.souls-=c; sh.bought.push(i); towerGain(run,b); save(); emit('change'); return true }
  function towerShopRemove(i){ const run=S.tower&&S.tower.run, sh=run&&run.shop; if(!sh||sh.removed||!run.boons[i]) return false; const c=towerRemoveCost();
    if((run.souls||0)<c) return false; run.souls-=c; run.removes=(run.removes||0)+1; sh.removed=true; const b=towerLose(run,i); save(); emit('change'); return b }
  function towerShopLeave(){ const run=S.tower&&S.tower.run; if(!run||!run.shop) return false; run.shop=null; towerNext(); save(); emit('change'); return true }
  /* ---------- Torre: combates (enemigos, premios, fin y revivir) ---------- */
  // curva por tramos de la Torre (multiplicador de vida y ataque del piso f)
  function towerCurve(f){ let hp=1, atk=1; const C=CFG.tower.curve; for(let i=0;i<C.length;i++){ const [a,gh,ga]=C[i], nx=C[i+1]?C[i+1][0]:Infinity, n=Math.max(0,Math.min(f,nx)-a); hp*=Math.pow(gh,n); atk*=Math.pow(ga,n); } return {hp,atk} }
  // enemigo base de la Torre: fijo, a la medida del héroe único (no depende de tu cuenta ni de tus mejoras)
  function towerFoe(){ const T=CFG.tower, H=T.hero, df=T.foeDf, hit=dmgF(H.atk,df)*(1+H.cr*H.cd)*H.spd, want=T.hitPct*H.hp, d=H.df;
    return {hp:hit*T.tKill, atk:atkFor(want,d), df} }
  // zona de Normal según el piso (20 pisos cada una): slimes, lobos, goblins, no muertos y orcos
  // los élites y JEFES de zona en la Torre: su propio ajuste de vida y ataque (tower.zoneK), porque sus habilidades ya pegan
  function towerZoneK(e,k){ const K=(CFG.tower.zoneK||{})[k]||{}; if(K.hp){ e.hp*=K.hp; e.max*=K.hp; } if(K.atk) e.atk*=K.atk; e.hpSeen=e.hp }
  const towerZone=f=>(ZL()[0]||[])[Math.min(4,Math.floor(f/20))]||null;
  function towerFight(k){ const T=CFG.tower, run=S.tower.run, f=run.floor, c=towerFoe();
    const Hd=T.hard||{}, jump=Hd.jumpEvery?Math.pow(Hd.jump,Math.floor(f/Hd.jumpEvery)):1, eUp=(k==='elite'||(k==='boss'&&Hd.bossUp))&&Hd.eliteFrom&&f>=Hd.eliteFrom?Math.pow(k==='boss'?Hd.bossUp:Hd.eliteUp,1+Math.floor((f-Hd.eliteFrom)/Hd.eliteEvery)):1;
    const cv=towerCurve(f), hm=T.hp0*cv.hp*jump*eUp*(1+T.curses.vida.hp*(run.curses||[]).filter(x=>x==='vida').length), am=T.atk0*cv.atk*jump*Math.sqrt(eUp), h=heroStats();   // saltos: cada 25 pisos y élites reforzados (hard)
    B={intro:k==='elite'||k==='boss'?CFG.encounter.intro:CFG.encounter.towerIntro,event:true,kind:'tower',node:k,t:0,boss:k==='boss',count:0,spawned:0,kills:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0};
    const nF=Math.min(T.countMax,T.count0+Math.floor(f/T.countEvery));   // enemigos de un combate normal de este piso
    const add=(n,hpM,atkM,boss)=>{ for(let i=0;i<n;i++){ const at=CFG.enemy.walk*0.6+Math.floor(i/T.group)*1.2+(i%T.group)*0.35, hp=c.hp*hm*hpM;
      B.enemies.push({hp,max:hp,atk:c.atk*am*atkM,df:c.df,spawn:B.t,walk:at,arrive:at,next:at,first:false,dead:false,spd:boss?1:1+Math.min(0.3,f*0.01)}); } };
    B.minion={hp:c.hp*hm/(eUp||1),atk:c.atk*am/Math.sqrt(eUp||1),df:c.df,spd:1+Math.min(0.3,f*0.01)};   // esbirros del jefe invocador (como un enemigo normal del piso)
    if(k==='boss'&&f>=T.maxFloor){ add(1,1,T.boss.atk*T.final.atk,true); const e=B.enemies[0]; e.inf=true; e.hp=e.max=1e30; e.hpSeen=e.hp; B.final=true; B.mech='final'; }   // jefe final: vida infinita
    else if(k==='boss'){ add(1,T.boss.hp*nF,T.boss.atk,true); const e=B.enemies[0];   // el JEFE de la zona de Normal de su piso, con su mecánica de zona
      zoneSetup(e,1,0,'jefe',{zone:towerZone(f),keepMinion:true,noEscort:true}); towerZoneK(e,'boss'); }
    else if(k==='elite'){ add(T.elite.n,T.elite.hp*nF/T.elite.n,T.elite.atk); const TR=T.traits, K=Object.keys(TR), extra=(run.curses||[]).filter(x=>x==='rasgo').length;   // vida total del grupo = elite.hp × la de un combate normal
      for(const e of B.enemies){ const n=Math.min(K.length,1+(rand()<0.5?1:0)+extra), pool=K.slice(); e.traits=[];
        for(let i=0;i<n;i++) e.traits.push(pool.splice(Math.floor(rand()*pool.length),1)[0]);
        traitApply(e,TR); e.hpSeen=e.hp; }
      zoneSetup(B.enemies[0],1,0,rand()<0.5?'e1':'e2',{zone:towerZone(f),keepMinion:true,noEscort:true}); towerZoneK(B.enemies[0],'elite'); }   // el primero es un élite de su zona (con sus rasgos)
    else add(nF,1,1);
    statsDirty(); HS=null; const H=heroStats(), G=T.grims; B.hp=H.hp*Math.max(0.01,run.hp==null?1:run.hp);
    BUF.shield=run.shield||0; run.shield=0; BUF.sang=0; B.regAt=CT+T.cards.escudoReg.every;   // Barricada: el escudo que traías
    if(tgH('vial')) B.hp=Math.min(H.hp,B.hp+G.vial.heal*H.hp);   // Vial de sangre
    if(tgH('ancla')) BUF.shield+=G.ancla.shield*H.hp;             // Ancla
    run.fight={k}; save(); emit('eventStart',B); emit('change') }
  // élite o jefe ganado: la recompensa se elige en la misma pelea (el combate espera hasta que eliges). Devuelve true si hay que esperar
  function towerRewardNow(){ if(B.rewDone||B.final||(B.node!=='elite'&&B.node!=='boss')) return false; const run=S.tower.run;
    if(!B.rew){ B.rew=true; run.pick=B.node==='boss'?towerOfferR(3,'L',['g']):towerOffer(3,'elite'); if(!run.pick.length){ run.pick=null; B.rewDone=true; return false }
      run.fight.rew=true; save(); emit('towerPickNow',{k:B.node}); emit('change'); }
    return true }
  const towerRewardPending=()=>!!(B&&B.kind==='tower'&&B.rew&&!B.rewDone&&S.tower.run&&S.tower.run.pick);
  function towerEnd(won){ const T=CFG.tower, run=S.tower.run, k=B.node, chosen=!!B.rewDone, H=heroStats(), frac=Math.max(0,B.hp/H.hp), fin=!!B.final, dmg=B.mD, bar=tgH('barricada');
    run.shield=bar?Math.min(BUF.shield||0,T.grims.barricada.cap*H.hp):0; BUF.shield=0; BUF.sang=0;   // Barricada: el escudo pasa al siguiente combate
    B=null; BUF.crits=0; statsDirty(); run.fight=null; let res;
    if(fin){ const TS=towerState(); run.finalDmg=(run.finalDmg||0)+dmg; if(run.finalDmg>(TS.bossDmg||0)) TS.bossDmg=run.finalDmg; }   // jefe final: el daño (sumando los intentos) va al ranking
    if(won){ run.hp=Math.min(1,frac+T.cards.aliento.heal*rCount(run,'c','aliento')); const so=Math.round((T.souls[k]||0)*(1+(rCount(run,'g','saco')?T.grims.saco.souls:0))); run.souls=(run.souls||0)+so;
      res={won:true,floor:run.floor,k,hp:run.hp,souls:so};
      if(k==='fight'){ res.pick=false; towerNext(); save(); emit('towerEnd',res); startWave(); emit('change'); return res }   // combate normal: solo almas (se avanza ANTES de avisar a la pantalla)
      if(chosen){ res.pick=false; towerNext(); }   // ya elegida en la pelea
      else { run.pick=k==='boss'?towerOfferR(3,'L',['g']):towerOffer(3,'elite'); res.pick=true;   // élite: 1 de 3 (cartas y grimorios, hasta Épica) · jefe: 1 de 3 grimorios legendarios
        if(!run.pick.length){ run.pick=null; res.pick=false; towerNext(); } } }
    else if(run.rev>0){ run.rev--; run.hp=T.grims.lagarto.hp; res={won:false,floor:run.floor,lives:run.lives,crown:true,final:fin,dmg:run.finalDmg} }   // Cola de lagarto: revives una vez
    else { run.lives--; run.hp=0; res={won:false,floor:run.floor,lives:run.lives,canRevive:!run.adRev,final:fin,dmg:run.finalDmg} }
    save(); emit('towerEnd',res); startWave(); emit('change'); return res }
  /* ---------- Sala de jefes ---------- */
  // Cada JEFE de campaña vencido (fases 30, 60, 90, 120 y 150 de cada modo) entra en la sala. 3 intentos al día para todos. 3 estrellas por jefe.
  const hallId=(m,f)=>m*1000+f;
  function hallState(){ const d=dayKey(); S.hall=S.hall&&S.hall.clr?S.hall:{d,used:0,clr:{}}; if(S.hall.d!==d){ S.hall.d=d; S.hall.used=0; } return S.hall }
  const hallTriesLeft=()=>Math.max(0,CFG.hall.tries-hallState().used);
  function hallBosses(){ const out=[], C=hallState().clr; for(let m=0;m<MODES().length;m++){ if(MODES()[m].locked) break;
      for(let f=CFG.hall.every;f<=CAP();f+=CFG.hall.every){ const beaten=S.mode>m||(S.mode===m&&S.best>=f); out.push({id:hallId(m,f),m,f,elite:f%30===0,beaten,stars:C[hallId(m,f)]||0,foe:zoneFoe(zoneAt(m,f),'jefe')}) } } return out }
  function hallReward(b,star,first){ const H=CFG.hall; if(first) return {...H.first[star-1]};
    return {...H.repeat[star-1]} }   // repetir: oro y Sellos
  function hallStart(id,star){ const b=hallBosses().find(x=>x.id===id); if(!S||inEvent()||!modeOpen('hall')||!b||!b.beaten||!(star>=1&&star<=3)||star>b.stars+1||!hallTriesLeft()) return false;
    hallState().used++; const h=heroStats(), M=CFG.hall.stars[star-1], e=enemyStats(b.f,10,true,b.m), W=CFG.event.walk;
    B={intro:CFG.encounter.intro,event:true,kind:'hall',t:0,boss:true,elite:b.elite,count:1,spawned:1,kills:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0,groups:b.f,hall:{id,m:b.m,f:b.f,star}};
    B.enemies.push({hp:e.hp*M.hp,max:e.hp*M.hp,atk:e.atk*M.atk,df:e.df,spawn:0,walk:W,arrive:W,next:W,first:true,dead:false,f:b.f,spd:1});
    zoneSetup(B.enemies[0],b.f,b.m,'jefe'); track('hall',{id,star}); save(); emit('eventStart',B); emit('change'); return true }
  function hallEnd(){ const X=B.hall, won=B.hp>0&&B.enemies.every(e=>e.dead), C=hallState().clr, b={...X,elite:X.f%30===0}, first=won&&X.star>(C[X.id]||0);
    let rw=null; if(won){ rw=hallReward(b,X.star,first); if(first) C[X.id]=X.star; giveBundle(rw); bossLoot(X.f,X.m); }   // (y el botín de un JEFE repetido: mineral y, con suerte, pieza, ticket, chatarra o esencia)
    const res={kind:'hall',won,first,star:X.star,f:X.f,m:X.m,rw,t:B.t}; B=null; save(); emit('hallEnd',res); startWave(); emit('change'); return res }
  /* ---------- jefe semanal ---------- */
  // Pelea de 1 minuto contra un jefe inmortal que pega cada vez más fuerte (golpea como el jefe de la fase n, y n sube de 1
  // hasta rampTo durante el minuto: 1-150 Normal, 151-300 Pesadilla…). Igual para todos. El ranking es SEMANAL y suma el daño
  // de todos tus intentos de la semana. 1 entrada gratis por semana; las demás, 1 Ticket Jefe (tienda). Premios el lunes a la 01:00 UTC.
  const weekKey=()=>Math.floor((dayKey()+3)/7);                 // semanas de lunes a domingo (el día 0 de 1970 fue jueves)
  const wbShownWeek=()=>evPaused()&&(dayKey()+3)%7===0?weekKey()-1:weekKey(); // el lunes de 00 a 01 aún se ve la semana que se cierra
  const weekLeft=()=>((weekKey()+1)*7-3-dayKey())*864e5-msOfDay()+(CFG.event.pauseH||0)*3600e3; // hasta el reparto (lunes 01:00)
  function wbPhase(t){ const W=CFG.wboss; return 1+(W.rampTo-1)*Math.min(1,t/W.dur) }
  function wbStats(n){ n=Math.max(1,Math.round(n)); const m=Math.min(MODES().length-1,Math.floor((n-1)/CAP())), c=modeCurve(m,n-m*CAP());
    return {atk:c.atk*CFG.wboss.atkMult, df:c.df, hp:c.hp} }
  // jefe de la semana: rota cada semana entre los 5 JEFES de tu modo (igual para todos los de tu modo)
  const wbBoss=w=>{ const L=ZL()[Math.min(ZL().length-1,S?S.mode||0:0)]||[]; if(!L.length) return null; const k=w==null?wbShownWeek():w, Z=L[((k%L.length)+L.length)%L.length], J=Z.jefe;
    return {id:Z.id,name:J.title?J.name+', '+J.title:J.name,desc:J.p.name+': '+J.p.desc,zone:Z,score:CFG.wboss.score||1} };
  // cada paso: pega como el jefe de ese momento; sus esbirros, como los de entonces
  function wbUpdate(){ const e=B.enemies[0]; if(!e) return; const s=wbStats(wbPhase(B.t)), M=CFG.wboss.minion||{hp:0.6,atk:0.4}; e.atk=s.atk*(e.atkK||1); e.df=s.df; e.refMax=s.hp*10;
    B.minion={hp:s.hp*M.hp,atk:s.atk*M.atk,df:s.df,spd:1}; }
  // daño al jefe (también al JEFE de clan, con su bonus de daño)
  function addDmg(d){ if(B.clan){ B.dmg+=d*(1+clanBonus('boss')); if(S.clanRun) S.clanRun.dmg=B.dmg; return } B.dmg+=d; if(S.wbRun) S.wbRun.dmg=B.dmg; }
  // Entrada gratis: 1 a la semana (wbFree guarda la semana en que se usó). Las demás, con Ticket Jefe.
  const wbFreeLeft=()=>S.wbFree!==weekKey()?1:0;
  function wbStart(){
    if(!S||inEvent()||!modeOpen('boss')||(retoN()<1&&!wbFreeLeft())||evPaused()) return false;
    if(wbPending()) wbClaim();
    if(wbFreeLeft()) S.wbFree=weekKey(); else retoUse();   // sin entrada gratis, un Ticket de reto
    S.wbRun={week:weekKey(),dmg:0}; wbFight(wbBoss(weekKey()));
    save(); emit('eventStart',B); emit('change'); return true;
  }
  // la pelea de 1 minuto contra un jefe inmortal (Jefe semanal y JEFE de clan: o = {clan:true})
  function wbFight(J,o){ const h=heroStats(), s=wbStats(1), V=CFG.event;
    B={intro:CFG.encounter.intro,event:true,kind:'boss',t:0,boss:true,elite:true,count:0,spawned:1,kills:0,dmg:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0,wb:J,noHurt:!!CFG.wboss.noHurt,...(o||{})};   // noHurt: no te pega (reto de daño)
    B.enemies.push({hp:Infinity,max:Infinity,atk:s.atk,df:s.df,spawn:0,walk:V.walk,arrive:V.walk,next:V.walk,first:false,dead:false,immortal:true});
    wbUpdate(); if(B.wb) zoneSetup(B.enemies[0],1,S.mode,'jefe',{zone:B.wb.zone,keepMinion:true,noEscort:true});   // con su pasiva y sus habilidades
  }
  function wbFinish(dmg,died){
    const w=S.wbRun?S.wbRun.week:weekKey(); S.wbRun=null; dmg=Math.round(dmg||0);
    if(!S.wbLog||S.wbLog.week!==w){ if(S.wbLog&&S.wbLog.week<w&&wbPending()) wbClaim(); S.wbLog={week:w,dmg:0,runs:0,claimed:false}; }
    S.wbLog.dmg+=dmg; S.wbLog.runs++;
    return {kind:'boss',dmg,best:S.wbLog.dmg,runs:S.wbLog.runs,pos:wbRank(w,S.wbLog.dmg),died,week:w};
  }
  const RIVW={};
  const wbRivals=w=>mixRivals(wbSim(w),realOf('wb',w));   // (con los jugadores reales de esa semana, si los hay: rivales.js)
  function wbSim(w){ const key=w+'|'+S.startDay; if(RIVW.k===key) return RIVW.v; RIVW.k=key;
    const end=w*7, age=end-(S.startDay==null?end:S.startDay)+1;           // días de juego a mitad de esa semana (jueves)
    RIVW.v=makeRivals(CFG.wboss,w*104723+17,Math.max(1,age),(wbBoss(w)||{}).score||1); return RIVW.v }
  const wbRank=(w,dmg)=>1+wbRivals(w).filter(x=>x.score>dmg).length;
  function wbReward(pos){ for(const r of CFG.wboss.rewards) if(pos<=r.to) return r; return null }
  function wbPending(){ const L=S.wbLog; if(!L||L.claimed||!L.dmg||L.week>=weekKey()) return null;
    if(L.week===weekKey()-1&&wbShownWeek()!==weekKey()) return null; // el lunes de 00 a 01 aún no
    if(S.wbRun&&S.wbRun.week===L.week) return null;
    const pos=wbRank(L.week,L.dmg); return {week:L.week,dmg:L.dmg,pos,rew:wbReward(pos)} }
  function wbClaim(){ const p=wbPending(); if(!p) return null; S.wbLog.claimed=true; const r=p.rew;
    if(r){ S.evm+=r.em||0; if(r.gold) giveBundle({gold:r.gold}); }
    emit('change'); return p; }
  const wbWeekDmg=()=>{ const w=wbShownWeek(); return S.wbLog&&S.wbLog.week===w?S.wbLog.dmg:0 };
  /* ---------- Clanes ---------- */
  // El clan vive en el servidor (acciones clan…: supabase/functions/track/clanes.js). La pantalla le pregunta y pasa al motor lo que
  // responde (clanSync). El motor guarda lo justo para jugar sin conexión (S.clan: id, nombre, rol y nivel de cada bonus) y lleva el JEFE de
  // clan: la pelea (la del Jefe semanal, con B.clan), los intentos de hoy (S.clanHits) y los intentos acabados que faltan por enviar (S.clanQ).
  // Los premios del lunes llegan como premios del servidor (clan_boss = nivel, clan_goal = tramo, clan_rank = puesto).
  const clanIn=()=>!!(S&&S.clan&&S.clan.id);
  // bonus de clan (oro, experiencia, mineral, daño al JEFE de clan): nivel × lo que da cada nivel
  function clanBonus(k){ if(!clanIn()) return 0; const C=CFG.clan.bonus, lv=Math.max(0,Math.min(C.max,Math.floor(Number((S.clan.bonus||{})[k])||0))); return lv*(C.per[k]||0) }
  // (al cargar una partida: solo lo que tiene sentido)
  function clanClean(st){ const c=st.clan, C=CFG.clan;
    if(c&&typeof c==='object'&&Number(c.id)>0){ const b={}; for(const k of C.bonus.keys){ const v=Math.floor(Number((c.bonus||{})[k])||0); if(v>0) b[k]=Math.min(v,C.bonus.max); }
      st.clan={id:Math.floor(Number(c.id)),name:String(c.name||'').slice(0,C.nameMax),role:['leader','officer','member'].includes(c.role)?c.role:'member',bonus:b}; }
    else st.clan=null;
    st.clanQ=Array.isArray(st.clanQ)?st.clanQ.filter(x=>x&&x.w>0&&x.dmg>=0).slice(-6):[];
    if(!(st.clanHits&&st.clanHits.d>0)) st.clanHits=null; }
  // intentos de hoy contra el JEFE de clan (se gastan al empezar)
  function clanHitsState(){ const d=dayKey(); if(!S.clanHits||S.clanHits.d!==d) S.clanHits={d,n:0}; return S.clanHits }
  const clanHitsLeft=()=>S?Math.max(0,CFG.clan.boss.tries-clanHitsState().n):0;
  const clanQToday=()=>(S.clanQ||[]).filter(x=>x.d===dayKey()).length;
  // lo que responde el servidor: {ok, clan: null | {id, name, bonus:{k:{lvl}}…}, me:{role, hitsLeft…}}
  function clanSync(j){ if(!S||!j||!j.ok||!('clan' in j)) return false; const C=CFG.clan;
    if(!j.clan){ if(S.clan){ S.clan=null; S.clanQ=[]; statsDirty(); save(); emit('change'); } return true }
    const b={}; for(const k of C.bonus.keys){ const v=Math.floor(Number(((j.clan.bonus||{})[k]||{}).lvl)||0); if(v>0) b[k]=Math.min(v,C.bonus.max); }
    const old=JSON.stringify(S.clan&&S.clan.bonus||{});
    S.clan={id:j.clan.id,name:String(j.clan.name||''),role:j.me&&j.me.role||'member',bonus:b};
    if(j.me&&typeof j.me.hitsLeft==='number'){ const H=clanHitsState(); H.n=Math.max(H.n,C.boss.tries-j.me.hitsLeft+clanQToday()); }   // (los de otro móvil también cuentan)
    if(JSON.stringify(b)!==old) statsDirty();
    save(); emit('change'); return true }
  // JEFE de clan: otro JEFE de tu modo que el del Jefe semanal (rota igual, cada semana)
  const clanBoss=w=>wbBoss((w==null?weekKey():w)+CFG.clan.boss.pick);
  const clanCanFight=()=>clanIn()&&modeOpen('clan')&&!inEvent()&&clanHitsLeft()>0;
  function clanStart(){ if(!clanCanFight()) return false; clanHitsState().n++;
    S.clanRun={week:weekKey(),dmg:0}; wbFight(clanBoss(),{clan:true});
    save(); emit('eventStart',B); emit('change'); return true }
  // fin del intento: el daño se apunta para enviarlo (la pantalla lo envía con clanHit y lo quita con clanHitDone)
  function clanFinish(dmg){ const w=S.clanRun?S.clanRun.week:weekKey(); S.clanRun=null; dmg=Math.round(dmg||0);
    if(w===weekKey()&&clanIn()&&dmg>0){ S.clanQ=S.clanQ||[]; S.clanQ.push({id:nowFn()+Math.floor(rand()*1000),w,d:dayKey(),dmg}); }
    return {kind:'boss',clan:true,dmg,week:w} }
  const clanQueue=()=>S?(S.clanQ||[]).filter(x=>x.w===weekKey()):[];
  // el servidor ya respondió a ese intento (aceptado o no): fuera de la lista. Los de semanas pasadas ya no valen.
  function clanHitDone(id,j){ if(!S) return; S.clanQ=(S.clanQ||[]).filter(x=>x.id!==id&&x.w===weekKey()); if(j&&j.ok) clanSync(j); else save() }
  // objetivo semanal: misiones hechas hoy y esta semana (el servidor solo suma lo nuevo)
  const clanReport=()=>S?{d:dayKey(),dn:missions().filter(m=>m.done).length,w:weekKey(),wn:weekMissions().filter(m=>m.done).length}:null;
  // aportar al bonus: minutos de farmeo de tu récord (lo que da una misión de «oro de X min»)
  const clanGoldOf=min=>goldOfMin(min);
  const clanCanGive=min=>!!S&&min>0&&S.gold>=goldOfMin(min);
  function clanPay(min){ if(!S||!(min>0)) return 0; const g=Math.min(S.gold,goldOfMin(min)); S.gold-=g; track('clanGive',{min,gold:Math.round(g)}); save(); emit('change'); return g }
  // crear un clan: se pagan los tokens cuando el servidor lo confirma
  const clanCanCreate=()=>!!S&&tokens()>=CFG.clan.cost;
  function clanPayCreate(){ if(!spend(CFG.clan.cost)) return false; track('clanCreate',{tokens:CFG.clan.cost}); save(); emit('change'); return true }
  // premios del lunes (los manda el servidor): JEFE por nivel, objetivo por tramo y ranking por puesto
  function clanRew(kind,n){ const C=CFG.clan; n=Math.floor(n);
    if(kind==='clan_boss'){ const R=C.boss.rew, L=Math.max(0,n-1), ev=Math.min(R.evMax,R.ev*L), k=Math.min(R.max,Math.floor(L/R.every)), b={};
      if(ev) b.ev=ev; if(k){ b.box=k; b.ess=k; } return Object.keys(b).length?b:null }
    if(kind==='clan_goal') return n>0?C.goal.rew[Math.min(C.goal.rew.length,n)-1]:null;
    if(kind==='clan_rank'){ for(const r of C.rank) if(n<=r.to){ const b={}; for(const k of ['ev','box','ess']) if(r[k]) b[k]=r[k]; return b } return null }
    return null }
  /* ---------- mejoras ---------- */
  const upCost=k=>{const u=CFG.upgrades[k];return u.base*Math.pow(u.g,S.up[k])};
  function buyUpgrade(k){ const c=upCost(k); if(S.gold<c) return false; S.gold-=c; S.up[k]++; statsDirty(); track('upgrade',{k,n:1,gold:c}); emit('change'); return true }
  function buyMax(k){ let n=0, g=0; while(S.gold>=upCost(k)){g+=upCost(k);S.gold-=upCost(k);S.up[k]++;n++} if(n){statsDirty();track('upgrade',{k,n,gold:g});emit('change')} return n }
  function upgradeGain(k){ const g0=computeStats(); S.up[k]++; const g1=computeStats(); S.up[k]--; return g1[k]-g0[k] }
  /* ---------- tokens: gastar, comprar y retirar ---------- */
  // Tokens = dinero (100 tokens = 1 $). S.tokens: comprados (no se retiran). S.won: ganados en los pools (se pueden retirar).
  // Al gastar se usan primero los comprados.
  const tokens=()=>(S.tokens||0)+(S.won||0);
  function spend(n){ if(!(n>0)) return true; if(tokens()<n) return false;
    const a=Math.min(S.tokens,n); S.tokens-=a; S.won-=n-a; addSpent(n); emit('spend',n); return true }
  // Comprar un paquete de tokens con dinero (simulado)
  // Compra y retiro de PRUEBA: solo con las herramientas de prueba (en local). En la versión publicada, hasta tener pagos reales, no se puede.
  function buyTokens(n){ if(!CFG.devTools||!CFG.tokens.packs.includes(n)) return false; n+=(CFG.tokens.bonus||{})[n]||0; S.tokens+=n; S.stats.deposited+=n; track('deposit',{tokens:n,usd:n/CFG.tokens.perUsd}); save(); emit('change'); return true }
  // Retirar tokens ganados: comisión y mínimo (simulado: no mueve dinero real)
  function withdraw(n){ const W=CFG.tokens.withdraw; n=Math.floor(n); if(!CFG.devTools) return {ok:false,why:'off'};
    if(!(n>=W.min)||n>S.won) return {ok:false,why:n>S.won?'won':'min'};
    const fee=Math.ceil(n*W.fee); S.won-=n; S.withdrawn=(S.withdrawn||0)+n; S.stats.withdrawNet+=(n-fee)/CFG.tokens.perUsd;
    track('withdraw',{tokens:n,fee,usd:(n-fee)/CFG.tokens.perUsd}); save(); emit('change');
    return {ok:true,n,fee,usd:(n-fee)/CFG.tokens.perUsd} }
  /* ---------- liga mensual (simulada) ---------- */
  // Puntos del mes: tokens gastados, anuncios vistos y horas de oro generado. El bote (70 % de lo gastado por todos)
  // se reparte el día 1 a la 01:00 UTC entre todos según sus puntos, en tokens ganados.
  const LG=()=>CFG.league;
  const monthOf=d=>{ const t=new Date(d*864e5); return t.getUTCFullYear()*12+t.getUTCMonth() };
  const monthKey=()=>monthOf(dayKey());
  const monthDays=m=>new Date(Date.UTC(Math.floor(m/12),m%12+1,0)).getUTCDate();
  const monthName=m=>['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][m%12];
  function league(){ const m=monthKey(); let L=S.league;
    if(!L||L.m!==m){ if(L&&L.m<m&&!(S.leagueLast&&S.leagueLast.m>=L.m)) S.leagueLast={...L,claimed:false}; L=S.league={m,spent:0,ads:0,goldH:0}; }
    return L }
  const leaguePts=L=>L?L.spent*LG().ptsToken+L.ads*LG().ptsAd+L.goldH*LG().ptsGoldHour:0;
  const leaguePool=L=>Math.floor(LG().share*(LG().rivals*LG().rivalSpend*monthDays(L.m)+L.spent));
  const leagueTotal=L=>LG().rivals*(LG().rivalSpend*LG().ptsToken+LG().rivalPlay)*monthDays(L.m)+leaguePts(L);
  const leaguePrize=L=>{ const p=leaguePts(L); return p>0?Math.floor(leaguePool(L)*p/leagueTotal(L)):0 };
  // oro generado → horas de farmeo de tu récord (el ritmo se guarda en caché por récord y nivel)
  let GR={k:'',g:1};
  function addGoldH(g){ if(!(g>0)||!CFG.league) return; const k=S.best+'|'+S.lvl+'|'+S.mode;
    if(GR.k!==k){ GR.k=k; GR.g=Math.max(1e-9,farmRate(Math.max(1,S.best)).g*3600); } league().goldH+=g/GR.g; }
  function addSpent(n){ if(CFG.league) league().spent+=n }
  function addAd(){ if(CFG.league) league().ads++; misBump('ad',1) }   // cada anuncio visto cuenta para las misiones
  // Premio del mes anterior: pendiente desde el día 1 a la 01:00 UTC
  function leaguePending(){ league(); const P=S.leagueLast; if(!P||P.claimed) return null;
    if(P.m===monthKey()-1&&new Date(dayKey()*864e5).getUTCDate()===1&&evPaused()) return null;
    return {m:P.m,name:monthName(P.m),pts:leaguePts(P),pool:leaguePool(P),tok:leaguePrize(P)} }
  function leagueClaim(){ const p=leaguePending(); if(!p) return null; S.leagueLast.claimed=true;
    if(p.tok>0){ S.won+=p.tok; track('league',{month:p.m,pts:Math.round(p.pts),tokens:p.tok}); } save(); emit('change'); return p }
  function leagueNow(){ const L=league(), d=new Date(dayKey()*864e5).getUTCDate();
    return {name:monthName(L.m),spent:L.spent,ads:L.ads,goldH:L.goldH,pts:leaguePts(L),pool:leaguePool(L),tok:leaguePrize(L),daysLeft:monthDays(L.m)-d+1,
      share:leaguePts(L)/leagueTotal(L)} }
  /* ---------- tienda: materiales y tickets ---------- */
  // (los cofres y las armas se quitaron del juego: se recrean aparte)
  const shopPrice=k=>({ess:(CFG.matShop||{}).ess, reto:(CFG.reto||{}).price, card:CFG.cardPrice, vip:CFG.vipPrice})[k];   // (los Sellos no se venden: solo se ganan jugando)
  function buy(k,n){
    n=n|0; if(n<1) return false; const unit=shopPrice(k); if(unit==null) return false;
    if((k==='card'||k==='vip')&&n!==1) return false;
    if(!spend(unit*n)) return false;
    if(k==='reto') retoAdd(n);                                   // Ticket de reto
    else if(k==='ess') essAdd(n);                                // Esencia
    else if(k==='card') S.cardUntil=Math.max(S.cardUntil,dayKey())+30;
    else if(k==='vip') S.vipUntil=Math.max(S.vipUntil,dayKey())+30;
    track('buy',{item:k,n,tokens:unit*n}); save(); emit('change'); return true;
  }
  /* ---------- Ticket de reto y Mercado ---------- */
  // Ticket de reto (S.reto): sustituye a los tickets de Mazmorra, Jefe y PvP. Vale 1 entrada extra a la Mazmorra o al Jefe semanal,
  // o CFG.reto.pvp combates de PvP (los que sobran se guardan en S.pvpTickets).
  function retoN(){ return S&&S.reto||0 }
  function retoAdd(n){ if(!S||!(n>0)) return 0; S.reto=(S.reto||0)+n; return n }
  function retoUse(){ if(retoN()<1) return false; S.reto--; return true }
  // Mercado: se paga con Sellos (S.evm). La lista es siempre la misma y cada cosa tiene un límite a la semana (se renueva el lunes)
  function mktState(){ const w=weekKey(); if(!S.mkt||S.mkt.w!==w) S.mkt={w,b:{}}; return S.mkt }
  const mktDef=k=>CFG.market&&CFG.market.list.find(x=>x.k===k);
  // piezas: de Rara a la rareza máxima de la caja gratis de tu modo (las que tienen precio)
  const mktRars=()=>{ const d=mktDef('piece'); if(!d) return []; const o=[]; for(let r=0;r<=forgeMax();r++) if(d.price[r]!=null) o.push({r,name:CFG.rar[r].name,price:d.price[r]}); return o };
  const mktN=x=>x.k==='mineral'?Math.round(x.n*mineMult()):x.n||1;
  function mktInfo(){ if(!S||!CFG.market) return null; const st=mktState(), daysLeft=7-((dayKey()+3)%7);
    return {sellos:S.evm||0, daysLeft, items:CFG.market.list.map(x=>{ const bought=st.b[x.k]||0, left=Math.max(0,x.lim-bought), rars=x.k==='piece'?mktRars():null;
      const price=x.k==='piece'?(rars.length?rars[0].price:null):x.price;
      return {k:x.k,n:x.k==='piece'?1:mktN(x),price,lim:x.lim,bought,left,rars,slots:x.k==='piece'?SLOTS.filter(slotOpen):null,
        can:left>0&&price!=null&&(S.evm||0)>=price} })} }
  // comprar: o = {s, r} para la pieza (hueco y rareza)
  function mktBuy(k,o){ if(!S) return {ok:false,why:'nogame'}; const d=mktDef(k); if(!d) return {ok:false,why:'no'}; const st=mktState();
    if((st.b[k]||0)>=d.lim) return {ok:false,why:'limit'};
    let price=d.price, res=null;
    if(k==='piece'){ o=o||{}; const s=o.s, r=o.r|0; if(!SLOTS.includes(s)||!slotOpen(s)) return {ok:false,why:'closed'}; const R=mktRars().find(x=>x.r===r); if(!R) return {ok:false,why:'rar'}; price=R.price;
      if((S.evm||0)<price) return {ok:false,why:'sellos'}; S.evm-=price; res=addCopy(s,r); }
    else { if((S.evm||0)<price) return {ok:false,why:'sellos'}; S.evm-=price; const n=mktN(d);
      if(k==='box') S.boxT=(S.boxT||0)+n; else if(k==='reto') retoAdd(n); else if(k==='ess') essAdd(n);
      else if(k==='mineral') S.mineral=(S.mineral||0)+n; else if(k==='scrap') S.chatarra=(S.chatarra||0)+n; res={n}; }
    st.b[k]=(st.b[k]||0)+1; track('market',{k,price}); save(); emit('market',{k,res}); emit('change'); return {ok:true,res,price} }
  /* ---------- potenciadores por anuncios ---------- */
  function adsState(){ if(!S.ads||S.ads.day!==dayKey()) S.ads={day:dayKey(),p:{},n:{}}; return S.ads }
  const boostLeft=()=>S.boostMs||0;                                    // ms que le quedan al ×2 (solo se gastan jugando)
  function tickBoost(ms){ if(S&&S.boostMs>0) S.boostMs=Math.max(0,S.boostMs-ms) } // la interfaz lo llama con el tiempo real jugado
  const speedMult=()=>(hasVip()?CFG.vipSpeed:1)*(boostLeft()>0?CFG.boosts.speed.mult:1); // velocidad del combate
  const boostUsesLeft=k=>CFG.boosts[k].perDay-(adsState().n[k]||0);
  const goldBoostHours=()=>{const b=CFG.boosts.gold;return effF(Math.max(1,S.best))<(b.earlyUntil||0)?b.earlyHours:b.hours};
  const goldBoostValue=()=>Math.max(20,farmRate(Math.max(1,S.best)).g*3600*goldBoostHours());
  // Cuenta un anuncio visto para el potenciador k; al llegar a los necesarios lo aplica.
  function watchAd(k){
    const b=CFG.boosts[k]; if(!b) return {ok:false};
    if(boostUsesLeft(k)<=0) return {ok:false,why:'limit'};
    const a=adsState(); a.p[k]=(a.p[k]||0)+1; S.stats.ads++; addAd();
    const res={ok:true,p:a.p[k],need:b.ads,applied:false};
    if(a.p[k]>=b.ads){ a.p[k]=0; a.n[k]=(a.n[k]||0)+1; res.applied=true;
      if(k==='speed') S.boostMs=(S.boostMs||0)+b.min*60000;
      if(k==='gold'){ res.gold=goldBoostValue(); S.gold+=res.gold; S.stats.adGold+=res.gold; addGoldH(res.gold); }
      track('ad',{boost:k,gold:res.gold||0}); }
    emit('change'); return res;
  }
  /* ---------- sin conexión ---------- */
  // Ganancia por segundo farmeando una fase, calculada solo con fórmulas (la usará también el servidor).
  // tiempo de una oleada según la fórmula (sin la pausa entre oleadas)
  function waveTimeF(f,w,h){ const per=perWave(f), grp=groupAt(f), sp=eSpd(f), e=enemyStats(f,w,false);
    // golpes para matar a cada uno (con el extra medido: quemaduras, área…) + lo que se pierde de media al rematar (0,6 golpes)
    const hit=dmgF(h.atk,e.df)*(1+h.cr*h.cd)*dpsK(h), K=Math.max(1,e.hp/hit+0.6)/h.spd, W=CFG.enemy.walk/sp*(h.ranged?1:(CFG.enemy.dash||1));
    // a distancia se dispara mientras se acercan; cuerpo a cuerpo cada enemigo sale cuando el anterior llega y hay que esperarlo (menos si salen varios a la vez)
    return h.ranged?per*K:W+K+(per-1)*Math.max(W/grp,K) }
  // un élite/JEFE repetido (al farmear su fase) tarda bossK oleadas: lo medido (wtB) o, hasta tenerlo, CFG.offlineBossK
  const bossK=()=>{ const T=S.wtB; return T&&T.f>0?Math.max(1,T.r/T.f):CFG.offlineBossK||4 };
  function farmRate(f){
    const h=computeStats(), slow=Math.max(1,S.wtM||1), rep=f%10===0&&f<CAP();   // si las oleadas de verdad tardan más que la fórmula (wtM medido), el cálculo se ajusta: nunca da más que jugando
    let t=0; for(let w=1;w<=10;w++) t+=waveTimeF(f,w,h)*(rep&&w===10?Math.max(slow,bossK()):slow)+CFG.delays.wave+(rep&&w===10?CFG.encounter.intro:0);
    return {g:goldAt(f)*3*10*goldMul()/t, x:xpAt(f)*(3+(CFG.econ.waveXp||0))*10*h.xpMult/t};
  }
  // Farmeo sin conexión: hasta offlineCapH horas (offlineVipH con VIP). Si se llenó el tope, queda un extra
  // de oro (offlineAdMult) que se cobra viendo un anuncio con claimOfflineBonus().
  const offlineCap=()=>(hasVip()?CFG.offlineVipH:CFG.offlineCapH)*3600;
  function applyOffline(){
    const now=nowFn(), raw=Math.max(0,(now-S.lastSeen)/1000), cap=offlineCap(), el=Math.min(raw,cap);
    S.lastSeen=Math.max(S.lastSeen,now); S.offBonus=null;
    if(inEvent()) return null;                                 // durante el evento el tiempo está en pausa: no se farmea a la vez
    if(!(el>60&&(S.best>0||S.mode>0))) return null;
    const f=Math.max(1,Math.min(S.fase,S.best)), r=farmRate(f), l0=S.lvl;
    const g=r.g*el, x=r.x*el; S.gold+=g; addGoldH(g); addXp(x); grimXp(el); const mn=mineAdd(el/60);   // el grimorio y el mineral también cuentan el tiempo sin conexión
    S.stats.offGold+=g; track('offline',{secs:Math.round(el),gold:g});
    const capped=raw>=cap; if(capped&&offlineAdLeft()>0) S.offBonus=g*(CFG.offlineAdMult-1);
    emit('change');
    return {secs:el,fase:f,gold:g,xp:x,mineral:mn,lvlFrom:l0,lvlTo:S.lvl,capped,bonus:S.offBonus||0};
  }
  // usos que quedan hoy del extra con anuncio (se renuevan con el cambio de día)
  const offlineAdLeft=()=>CFG.offlineAdPerDay-(adsState().n.off||0);
  function claimOfflineBonus(){ const b=S.offBonus; if(!b) return 0; S.gold+=b; S.offBonus=null; const a=adsState(); a.n.off=(a.n.off||0)+1;
    S.stats.ads++; addAd(); S.stats.adGold+=b; addGoldH(b); track('ad',{boost:'offline',gold:b}); emit('change'); return b }
  /* ---------- grimorio (llave de la 1.ª evolución) ---------- */
  // Uno por clase. Se consigue cerrado (nivel 1) y se sube hasta el 5: cada subida pide tiempo luchando (xp en segundos,
  // también sin conexión) y recursos. En el 5 abre la evolución, donde se elige camino (A o B).
  const GC=()=>CFG.grimoire;
  const grimState=()=>S.grim=S.grim||{lvl:0,xp:0};
  const grimOwned=()=>grimState().lvl>0;
  const grimLevel=()=>grimState().lvl;
  const grimDone=()=>grimLevel()>=GC().levels;
  const grimName=()=>GC().names[S.cls];
  const goldH=h=>Math.round(h*3600*farmRate(Math.max(1,S.best)).g);
  function grimCost(){ const c=GC().cost; return {gold:goldH(c.goldH),ess:c.ess||0,ev:c.ev||0} }
  const grimPack=()=>GC().pack;
  const missOf=c=>{ const o={}; if(S.gold<c.gold) o.gold=c.gold-S.gold; if(essN()<c.ess) o.ess=c.ess-essN(); if(c.ev&&S.evm<c.ev) o.ev=c.ev-S.evm; return o };
  const payOf=c=>{ S.gold-=c.gold; S.mats[0]=essN()-c.ess; S.evm-=c.ev||0 };
  const grimMissing=()=>missOf(grimCost());
  function grimGet(how){ grimState().lvl=1; grimState().xp=0; track('grimoire',{how}); save(); emit('change'); return {ok:true} }
  function grimUnlock(){ if(grimOwned()) return {ok:false,why:'owned'}; if(Object.keys(grimMissing()).length) return {ok:false,why:'cost'};
    payOf(grimCost()); return grimGet('recursos') }
  function grimBuy(){ if(grimOwned()) return {ok:false,why:'owned'}; if(!spend(grimPack())) return {ok:false,why:'tokens'}; return grimGet('tokens') }
  // siguiente subida: tiempo que falta y recursos
  function grimUpInfo(){ const G=grimState(); if(!G.lvl||grimDone()) return null; const u=GC().up[G.lvl-1];
    const cost={gold:goldH(u.goldH),ess:u.ess||0,ev:u.ev||0}; return {to:G.lvl+1,xp:G.xp,need:u.secs,ready:G.xp>=u.secs,cost,missing:missOf(cost)} }
  function grimXp(secs){ const G=S&&S.grim; if(!G||!G.lvl||G.lvl>=GC().levels) return; const u=GC().up[G.lvl-1]; G.xp=Math.min(u.secs,G.xp+secs) }
  function grimUp(){ const u=grimUpInfo(); if(!u) return {ok:false,why:'max'}; if(!u.ready) return {ok:false,why:'xp'}; if(Object.keys(u.missing).length) return {ok:false,why:'cost'};
    payOf(u.cost); const G=grimState(); G.lvl++; G.xp=0; track('grimoire',{how:'nivel',lvl:G.lvl}); save(); emit('change'); return {ok:true,lvl:G.lvl} }
  /* ---------- talentos (dentro del Grimorio) ---------- */
  // Se abren con la 1.ª evolución y no tienen tope: subir un talento al nivel n cuesta n × cost esencias (10 niveles = 55).
  // Cada nivel da su v (CFG.talents.list): daño, vida, defensa, daño a élites y JEFES, oro o experiencia. Se guardan en S.tal.
  function TL(){ return CFG.talents }
  function talState(){ return S.tal=S.tal||{} }
  function talOpen(){ return !!TL()&&!!S&&(S.evo||0)>=TL().from }
  function talLv(k){ return (S&&S.tal&&S.tal[k])||0 }
  function talDef(k){ return TL()&&TL().list.find(t=>t.k===k) }
  function talCost(k){ return (talLv(k)+1)*(TL().cost||1) }
  // lo que suma un talento (0 si no hay talentos en la configuración); sirve también para el fantasma del PvP (su propia S)
  function talBonus(k){ const d=talDef(k); return d?talLv(k)*d.v:0 }
  function talInfo(){ return TL()?TL().list.map(t=>({k:t.k,name:t.name,desc:t.desc,v:t.v,lvl:talLv(t.k),bonus:talLv(t.k)*t.v,cost:talCost(t.k),can:talOpen()&&essN()>=talCost(t.k)})):[] }
  function talUp(k){ if(!talOpen()) return {ok:false,why:'evo'}; if(!talDef(k)) return {ok:false,why:'no'};
    const c=talCost(k); if(essN()<c) return {ok:false,why:'ess'};
    S.mats[0]=essN()-c; talState()[k]=talLv(k)+1; statsDirty(); track('talent',{k,lvl:S.tal[k]}); save(); emit('change'); return {ok:true,lvl:S.tal[k],cost:c} }
  /* ---------- premios del servidor (referidos) ---------- */
  // El servidor manda premios pendientes: 'silver' = premio de amigos (5 min de oro por unidad), 'won' = tokens ganados (retirables)
  function applyRewards(list){ const out=[]; if(!S||!Array.isArray(list)) return out;
    for(const r of list){ const n=Math.floor(+r.amount); if(!(n>0)) continue;
      if(r.kind==='silver') giveBundle({gold:5*Math.min(n,100)}); else if(r.kind==='won') S.won+=n; else if(r.kind==='box') S.boxT=(S.boxT||0)+Math.min(n,100);   // box: tickets de invocación (premio por invitar)   // (el servidor aún habla de «plata»: ahora es oro de 5 min de farmeo cada una)
      else if(r.kind==='tokens'){ S.tokens+=n; S.stats.deposited+=n; track('deposit',{tokens:n,stars:n*CFG.stars.perToken}); }   // compra con Stars
      else if(r.kind==='first'){ const F=CFG.stars.first; if(S.firstBuy) continue; S.firstBuy=true; S.tokens+=F.tokens; S.stats.deposited+=F.tokens; giveBundle({gold:F.gold}); }
      else if(r.kind==='pass'){ S.passPrem=Math.max(S.passPrem||0,n); }   // pase de pago de la temporada n
      else if(r.kind==='pvp'){ const w=pvpReward(n); if(w){ S.evm+=w.em||0; if(w.gold) giveBundle({gold:w.gold}); } }   // ranking semanal PvP (amount = puesto)
      else if(/^offer_evo$/.test(r.kind)){ giveBundle(CFG.offers[r.kind.slice(6)].b); }
      else if(/^clan_(boss|goal|rank)$/.test(r.kind)){ const b=clanRew(r.kind,n); if(!b) continue; giveBundle(b); }   // premios del lunes del clan
      else continue;
      out.push({kind:r.kind,amount:n,reason:r.reason}); }
    if(out.length){ track('reward',{list:out}); save(); emit('change'); } return out }
  /* ---------- misiones diarias y semanales ---------- */
  // Premios: {gold: minutos de farmeo de tu récord, silver, wood, mode, ess, ev, ticket, bossTicket}
  const goldOfMin=m=>Math.max(20,farmRate(Math.max(1,S.best)).g*60*m);   // oro de m minutos de farmeo en tu fase récord
  function giveBundle(b){ if(!b) return; if(b.gold) S.gold+=goldOfMin(b.gold);
    if(b.ess) essAdd(b.ess); if(b.ev) S.evm+=b.ev; if(b.reto) retoAdd(b.reto); if(b.ticket) retoAdd(b.ticket); if(b.bossTicket) retoAdd(b.bossTicket);   // ev: Sellos · (los tickets de modo de antes son Tickets de reto)
    if(b.tok) S.tokens+=b.tok; if(b.box) S.boxT=(S.boxT||0)+b.box; }   // tok: tokens (como comprados) · box: tickets de invocación
  // misiones del día: progreso guardado en S.daily (se renueva cada día; los enemigos se cuentan desde el inicio del día)
  function daily(){ const d=dayKey(); if(!S.daily||S.daily.d!==d) S.daily={d,k0:S.kills||0,p:{},c:{}}; return S.daily }
  function misBump(k,n){ if(!S) return; const D=daily(); D.p[k]=(D.p[k]||0)+n; const W=weekly(); W.p[k]=(W.p[k]||0)+n }
  // misiones de la semana (lunes a domingo): mismo sistema que las diarias
  function weekly(){ const w=weekKey(); if(!S.weekly||S.weekly.w!==w) S.weekly={w,k0:S.kills||0,p:{},c:{}}; return S.weekly }
  function weekMissions(){ const W=weekly(), L=(CFG.missions.weekly||{}).list||[]; return L.filter(misOpen).map(m=>{ const v=m.k==='kills'?(S.kills||0)-W.k0:(W.p[m.k]||0);
    return {...m,prog:Math.min(m.n,v),done:v>=m.n,claimed:!!W.c[m.k]} }) }
  function claimWeekly(k){ const m=weekMissions().find(x=>x.k===k); if(!m||!m.done||m.claimed) return null; const M=CFG.missions.weekly;
    const xp=m.xp||M.xp; weekly().c[k]=true; giveBundle(m.rew||{}); passAddXp(xp); track('weekly',{k}); save(); emit('change'); return {...(m.rew||{}),xp} }
  // bonus por completar todas: diarias (missions.bonus) y semanales (missions.weekly.bonus); una vez por día / semana
  const bonusState=kind=>{ const box=kind==='week'?weekly():daily(), L=kind==='week'?weekMissions():missions(); return {can:L.every(m=>m.claimed)&&!box.bonus,got:!!box.bonus,b:kind==='week'?CFG.missions.weekly.bonus:CFG.missions.bonus} };
  function claimBonus(kind){ const st=bonusState(kind); if(!st.can) return null; (kind==='week'?weekly():daily()).bonus=true; giveBundle(st.b); track('misBonus',{kind}); save(); emit('change'); return st.b }
  const weeklyReady=()=>weekMissions().filter(m=>m.done&&!m.claimed).length+(bonusState('week').can?1:0);
  function misHook(type,d){ if(!S) return; if(type==='upgrade') misBump('upgrade',d.n||1) }
  // misiones de modos aún cerrados: no salen (así se puede completar «todas las diarias»)
  const misOpen=m=>m.k==='pvp'?modeOpen('pvp'):m.k==='event'?modeOpen('lab')||modeOpen('boss'):true;
  function missions(){ const D=daily(); return CFG.missions.list.filter(misOpen).map(m=>{ const v=m.k==='kills'?(S.kills||0)-D.k0:(D.p[m.k]||0);
    return {...m,prog:Math.min(m.n,v),done:v>=m.n,claimed:!!D.c[m.k]} }) }
  function claimMission(k){ const m=missions().find(x=>x.k===k); if(!m||!m.done||m.claimed) return null; const M=CFG.missions;
    daily().c[k]=true; if(missions().every(x=>x.claimed)){ const W=weekly(); W.p.alldays=(W.p.alldays||0)+1; } giveBundle(m.rew||{}); passAddXp(m.xp||M.xp); track('mission',{k}); save(); emit('change'); return {...(m.rew||{}),xp:m.xp||M.xp} }
  const missionsReady=()=>missions().filter(m=>m.done&&!m.claimed).length+(bonusState('day').can?1:0);
  /* ---------- premios diarios: ruleta y calendario de 7 días ---------- */
  // ruleta diaria: 1 tirada gratis + 1 con anuncio por día
  function wheelState(){ const d=dayKey(); if(!S.wheel||S.wheel.d!==d) S.wheel={d,free:false,ad:false}; return {free:!S.wheel.free,ad:CFG.wheelAd!==false&&!S.wheel.ad,list:CFG.wheel} }
  // rodillo de la suerte (CFG.slot): una tirada por anuncio, hasta perDay al día; el premio se reparte al momento
  const slotDay=()=>{ const d=dayKey(); if(!S.slot||S.slot.d!==d) S.slot={d,n:0}; return S.slot };
  const slotMin=min=>Math.round(min*((CFG.mineral&&CFG.mineral.perMin)||1)*mineMult());
  function slotState(){ const C=CFG.slot; if(!S||!C) return null; const tot=C.list.reduce((a,x)=>a+x.w,0);
    return {left:Math.max(0,C.perDay-slotDay().n),perDay:C.perDay,list:C.list.map((x,i)=>({...x,i,pct:x.w/tot*100,gold:x.k==='gold'?Math.max(20,farmRate(Math.max(1,S.best)).g*60*x.min):0,mineral:x.k==='mineral'?slotMin(x.min):0,maxR:CFG.rar[boxT().top.r].name}))} }
  function slotSpin(){ const C=CFG.slot, st=slotState(); if(!st||st.left<1) return null; slotDay().n++; S.stats.ads++; addAd();   // (cuenta como anuncio visto: misiones y estadísticas)
   
    const tot=C.list.reduce((a,x)=>a+x.w,0); let r=rand()*tot, i=0; for(;i<C.list.length-1;i++){ r-=C.list[i].w; if(r<0) break; }
    const x=C.list[i], out={i,k:x.k};
    if(x.k==='gold'){ out.gold=st.list[i].gold; S.gold+=out.gold; addGoldH(out.gold); }
    else if(x.k==='mineral'){ out.mineral=st.list[i].mineral; S.mineral=(S.mineral||0)+out.mineral; }
    else if(x.k==='scrap'){ out.scrap=x.n; S.chatarra=(S.chatarra||0)+x.n; }
    else if(x.k==='ticket'){ out.tickets=x.n; S.boxT=(S.boxT||0)+x.n; }
    else if(x.k==='ess'){ out.ess=essAdd(x.n); }
    else if(x.k==='piece'){ out.piece=gearPiece(); }
    else if(x.k==='jackpot'){ out.tickets=x.tickets; S.boxT=(S.boxT||0)+x.tickets; out.piece=gearPiece(null,true); }
    track('slot',{k:x.k}); save(); emit('change'); return out }
  function spinWheel(viaAd){ const st=wheelState(); if(viaAd?!st.ad:!st.free) return null; if(viaAd){ S.wheel.ad=true; addAd(); } else S.wheel.free=true;
    const L=CFG.wheel, tot=L.reduce((a,x)=>a+x.w,0); let r=rand()*tot, i=0; for(;i<L.length-1;i++){ r-=L[i].w; if(r<0) break; }
    giveBundle(L[i].b); track('wheel',{i,ad:!!viaAd}); save(); emit('change'); return {i,b:L[i].b} }
  // calendario: un premio por día que entras (no hace falta seguidos)
  function calState(){ const c=S.cal||{n:0,last:null}, L=CFG.calendar; return {day:c.n%L.length+1,can:c.last!==dayKey(),list:L} }
  function claimCal(){ const st=calState(); if(!st.can) return null; const b=CFG.calendar[st.day-1]; S.cal={n:(S.cal?S.cal.n:0)+1,last:dayKey()};
    giveBundle(b); track('calendar',{day:st.day}); save(); emit('change'); return b }
  /* ---------- pase de temporada ---------- */
  // pase: temporadas de 30 días (las mismas para todos: día UTC / 30). Nivel = XP / 100. Premios gratis y de pago por nivel.
  const passSeason=()=>Math.floor(dayKey()/CFG.pass.days);
  function passS(){ const s=passSeason(); if(!S.pass||S.pass.s!==s) S.pass={s,xp:0,cf:{},cp:{}}; return S.pass }
  function passAddXp(n){ passS().xp+=n }
  function passReward(L,prem){ const top=CFG.pass.levels;
    const C=CFG.pass, tk=C.tok&&L%C.tok.every===0?{tok:C.tok.n}:{};
    // (oro = minutos de farmeo de tu récord; los cofres y el arma del último nivel se quitaron con los objetos: se recrean aparte)
    if(!prem) return L===top?{gold:40}:L%10===0?{gold:20}:L%5===0?{gold:10}:L%2===0?{gold:6}:{gold:30};
    return L===top?{gold:60,ess:10,ev:100,...tk}:L%10===0?{gold:40,ess:2,...tk}:L%5===0?{reto:2,ev:30}:L%2===0?{gold:10,ev:10}:{gold:8} }   // ev: Sellos · reto: Ticket de reto
  function passState(){ const P=passS(), C=CFG.pass, lvl=Math.min(C.levels,Math.floor(P.xp/C.xp));
    return {season:P.s,xp:P.xp,lvl,into:P.xp-lvl*C.xp,need:C.xp,prem:(S.passPrem||0)===P.s,daysLeft:C.days-dayKey()%C.days,cf:P.cf,cp:P.cp} }
  function claimPass(L,prem){ const st=passState(); if(!(L>=1&&L<=st.lvl)) return null; if(prem&&!st.prem) return null;
    const box=prem?passS().cp:passS().cf; if(box[L]) return null; box[L]=1; const b=passReward(L,prem); giveBundle(b); track('pass',{L,prem:!!prem}); save(); emit('change'); return b }
  function claimPassAll(){ const st=passState(); let n=0; for(let L=1;L<=st.lvl;L++){ if(claimPass(L,false)) n++; if(st.prem&&claimPass(L,true)) n++; } return n }
  const passReady=()=>{ const st=passState(); let n=0; for(let L=1;L<=st.lvl;L++){ if(!st.cf[L]) n++; if(st.prem&&!st.cp[L]) n++; } return n };
  /* ---------- desbloqueo de modos ---------- */
  // Desbloqueo de pestañas (Misiones, Inventario, Modos, Tienda) y modos (Mazmorra, Sala de jefes, Jefe semanal, PvP, Torre): por fase récord o por días de juego
  const daysPlayed=()=>dayKey()-(S.startDay==null?dayKey():S.startDay)+1;
  function modeReq(k){ const U=(CFG.unlock||{})[k]; if(!U||!S) return null; if(U.fase&&!(S.mode>0)&&S.best<U.fase) return {fase:U.fase}; if(U.day&&daysPlayed()<U.day) return {day:U.day,left:U.day-daysPlayed()}; return null }
  const modeOpen=k=>!modeReq(k);
  // modos que se acaban de abrir (para el aviso); la 1.ª vez en una partida antigua se apuntan sin aviso
  function unlockNew(){ if(!S) return []; const K=Object.keys(CFG.unlock||{}), open=K.filter(modeOpen);
    if(!Array.isArray(S.unl)){ S.unl=S.startDay!=null&&daysPlayed()>1?open:[]; if(S.unl.length) return [] }
    const nw=open.filter(k=>!S.unl.includes(k)); if(nw.length){ S.unl.push(...nw); save(); } return nw }
  /* ---------- ofertas en el momento justo ---------- */
  // offerCheck(): mira si toca una oferta nueva (la activa 24 h) y la devuelve para que la pantalla la enseñe
  function offerCheck(){ if(!S||(B&&B.event)) return null; const O=CFG.offers, t=nowFn(); S.offers=S.offers||{};
    const want={ evo:evoLvlOk()&&!canEvolve() };   // (la oferta «Rompe el muro» y la de inventario se quitaron con los objetos)
    for(const k in want){ const o=S.offers[k]||{}; if(want[k]&&!(o.until>t)&&!(o.next>t)){ S.offers[k]={until:t+O.dur*3600e3,next:t+O.cool*3600e3}; save(); track('offer',{k}); return k } }
    return null }
  const activeOffers=()=>{ const t=nowFn(); return Object.entries(S&&S.offers||{}).filter(([k,o])=>o.until>t).map(([k,o])=>({k,left:o.until-t,...CFG.offers[k]})) };
  /* ---------- ajustes y pruebas ---------- */
  function setOpt(k,v){ S.opt=S.opt||{}; S.opt[k]=v; emit('change') }
  function dev(k){
    if(!CFG.devTools) return;
    if(k==='gold') S.gold+=Math.max(100,farmRate(Math.max(1,S.best)).g*3600);
    if(k==='tok') S.tokens+=100; if(k==='ticket'||k==='bossTicket'||k==='reto') retoAdd(1); if(k==='day') S.devDays=(S.devDays||0)+1;
    emit('change');
  }

  return {
    // estado
    get S(){return S}, get B(){return B}, CFG, CLASSES, on, save, load, reset, packed, newGame, setName, validName, cleanName, startWave, dayKey, rand,
    // fórmulas
    heroShield:()=>B?(BUF.shield||0)+(BUF.gshield||0):0,   // escudo del héroe ahora (para la barra azul)
    // efectos activos sobre el héroe ahora (para los iconos bajo su barra): {k, left} en segundos (null = mientras dure)
    heroBuffs:()=>{ if(!B) return []; const o=[]; for(const b of BUF.list) if(b.until>CT){ const k=b.reflect||b.df?'baluarte':b.atk1?'atk1':b.atk?'atk':b.spd?'spd':b.ls?'ls':b.taken?'taken':null; if(k&&!o.some(x=>x.k===k)) o.push({k,left:b.until-CT}); }
      if(BUF.sang>0) o.push({k:'sang',n:BUF.sang}); if(BUF.aura&&CT<BUF.aura.until) o.push({k:'aura',left:BUF.aura.until-CT});
      const P=heroPassive(), ch={guardia:'guard',furia:'rage',doble:'conc',gracia:'luz'}[P&&P.id];   // cargas del kit: n de max
      if(ch&&B[ch]>0) o.push({k:ch,n:Math.min(P.max,B[ch]),max:P.max}); if(P&&P.id==='cuchillas'&&B.blades){ const n=B.blades.filter(u=>u>B.t).length; if(n) o.push({k:'blades',n,max:P.max}); }
      return o },
    heroDebuffs, zoneAt, zoneIdx, bossRole, zoneFoe,
    hasCard, hasVip, heroStats, dpsK, computeStats, statsDirty, enemyStats, modeCurve, refHero, xpReq, upCost, upgradeGain, farmRate,
    // combate
    step, setAuto, setRepeat, goFase,
    // mejoras
    buyUpgrade, buyMax,
    // evento
    claimLoot, autoLoot:()=>{const a=autoLoot;autoLoot=null;return a}, autoEvent:()=>{const a=autoEvent;autoEvent=null;return a}, autoQuit:()=>{const a=autoQuit;autoQuit=null;return a}, inEvent, evPhase, evRamp:()=>B&&B.event&&B.kind!=='boss'?evRamp():null, evPaused, evPauseLeft, evShownDay, startEvent, evFreeLeft, wbStart, wbFreeLeft, wbRivals, wbRank, wbReward, wbPending, wbClaim, wbWeekDmg, wbShownWeek, weekKey, weekLeft, wbPhase, endEvent, evRivals, evRank, evReward, evPending, claimEvent, evToday,
    // evolución
    evAffix, wbBoss, hallBosses, hallStart, hallTriesLeft, hallReward, modeReq, modeOpen, unlockNew, daysPlayed, canAdvanceMode, advanceMode, modeLocked, modeCfg, top, goldAt, missions, claimMission, missionsReady, weekMissions, claimWeekly, weeklyReady, pvpState, pvpReward, pvpLeague, pvpFreeLeft, pvpCanFight, pvpBot, pvpSetRival, pvpSync, pvpFight, duelEnter, duelSpeed, labSpeed, autoOnly, pvpOn, ghost:()=>GH, towerState, towerStart, towerAbandon, towerGo, towerPick, towerBuyLife, towerEvent, towerRevive, towerMap, towerCanGo, towerLinks, towerShopBuy, towerShopLeave, towerShopRemove, towerRewardPending, towerRemoveCost, towerPrice, boonInfo, boonDef, towerOn, wheelState, spinWheel, surpriseState, streak:()=>({n:STK.n,mul:streakMul()}), bonusState, claimBonus, grimDone, grimName, grimUpInfo, grimUp, grimXp, evoPaths, pathSwitch, evoKeyOk, skills, useSkill, manualSkills, skillDef, offerCheck, activeOffers, calState, claimCal, passState, passReward, claimPass, claimPassAll, passReady,
    clanIn, clanBonus, clanSync, clanStart, clanCanFight, clanHitsLeft, clanBoss, clanQueue, clanHitDone, clanReport, clanGoldOf, clanCanGive, clanPay, clanCanCreate, clanPayCreate, clanRew,
    canEvolve, evolve, essN, essAdd, retoN, retoAdd, mktInfo, mktBuy, pvpExtra, talInfo, talUp, talOpen, talBonus, talCost, evoCost, evoMissing, evoLvlOk, evoP, nextEvo, nextEvoInfo, kitStage, heroPassive, lvlCap,
    // objetos: solo el arma Común de regalo (los demás se recrean aparte)
    weapon, weaponBonus, weaponExtra, weaponPower, boxInfo, pull, gear, gearSlots, gearPower, setInfo, gearOpenCheck, gearDrop, dropP, equipPiece, equipBest, slotState, slotSpin, gearPiece, setRealRank, seenNew, nvUp, nvCost, breakCalc, breakPieces, forgeInfo, forgeCraft, bossLoot, mineAdd,
    // tienda
    buy, shopPrice, tokens, leagueNow, leaguePending, leagueClaim, monthKey, spend, buyTokens, withdraw,
    // otros
    applyOffline, claimOfflineBonus, offlineCap, offlineAdLeft, setOpt, dev, applyRewards,
    // grimorios
    grimOwned, grimLevel, grimCost, grimPack, grimMissing, grimUnlock, grimBuy,
    // anuncios
    adsState, watchAd, boostLeft, tickBoost, speedMult, boostUsesLeft, goldBoostHours, goldBoostValue,
  };
}

root.createGame=createGame;
if(typeof module!=='undefined'&&module.exports) module.exports={createGame};
})(typeof window!=='undefined'?window:globalThis);
