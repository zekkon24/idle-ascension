/* Idle Ascension · MOTOR DEL JUEGO
   Toda la lógica: estado, fórmulas, combate, economía, armas, cofres, eventos y tienda.
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
  const R=CFG.rar, CLASSES=Object.keys(CFG.classes);

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
  const pick=probs=>{const tot=probs.reduce((a,b)=>a+b,0);let x=rand()*tot;for(let i=0;i<probs.length;i++){x-=probs[i];if(x<0)return R[i]}return R[0]};
  const rnd=(a,b)=>a+rand()*(b-a);

  function newState(cls,name){
    return {v:3,cls,name:cleanName(name),lvl:1,xp:0,gold:0,tokens:0,won:0,withdrawn:0,scrap:0,up:{atk:0,hp:0,df:0,spd:0},
      best:0,fase:1,wave:1,push:true,autoPush:true,farmClears:0,
      items:[],nextId:1,equippedId:null,chestInv:{},opt:{},
      startDay:null,cardUntil:0,vipUntil:0,          // startDay: día en que empezó la partida (para los rivales simulados)
      lastSeen:nowFn(),devDays:0,speed:1,kills:0,boostMs:0,ads:null,evo:0,absorb:{},mode:0,mats:{},tickets:0,evm:0,evLog:null,loot:null,evRun:null,maxDay:0,refPend:null,silverDay:null,bossTickets:0,wbLog:null,wbRun:null,evFree:null,wbFree:null,league:null,leagueLast:null,grim:{lvl:0,xp:0},
      stats:{deposited:0,withdrawNet:0,adGold:0,ads:0,offGold:0}}; // registro para la base de datos: tokens comprados, $ retirados (neto), oro de anuncios, anuncios vistos, oro sin conexión
  }
  function migrate(st){ // pone al día partidas guardadas con versiones anteriores (rellena todo campo que falte y limpia números rotos)
    if(!st||!CFG.classes[st.cls]) return null;
    { const G=st.grim; if(G&&G.owned){ const had=Object.keys(G.owned).length>0; st.grim={lvl:had?((st.evo||0)>=1?5:1):0,xp:0}; } }   // grimorios antiguos → la llave
    st.autoPush=true;   // siempre intenta subir de fase (ya no hay botón Auto Sí/No)
    if((st.evo||0)>=1&&!st.path) st.path='A';                                                                              // evolución antigua = camino A
    const d=newState(st.cls);
    for(const k in d) if(st[k]===undefined) st[k]=d[k];
    st.up={...d.up,...(st.up||{})}; st.stats={...d.stats,...(st.stats||{})}; for(const k in st.up) if(!Number.isFinite(st.up[k])) st.up[k]=0;
    for(const k of ['gold','tokens','won','withdrawn','scrap','xp','lvl','best','fase','wave','tickets','bossTickets','evm','kills','boostMs','evo','mode','nextId','cardUntil','vipUntil'])
      if(!Number.isFinite(st[k])) st[k]=d[k];
    st.lvl=Math.max(1,st.lvl|0); st.fase=Math.max(1,st.fase|0); st.wave=Math.min(10,Math.max(1,st.wave|0));
    st.chestInv=st.chestInv||{}; st.opt=st.opt||{}; st.items=Array.isArray(st.items)?st.items.map(unpackItem).filter(Boolean):[]; st.mats=st.mats||{};
    { const other=st.items.filter(x=>x.cls!==st.cls&&x.id!==st.equippedId);   // armas de otras clases (ya no salen de los cofres): pasan a chatarra
      if(other.length){ st.scrap=(st.scrap||0)+other.reduce((a,x)=>a+(CFG.weapon.scrapDis[x.r]||1)*(x.lvl||1),0); st.items=st.items.filter(x=>!other.includes(x)); } }
    for(const it of st.items){ it.lvl=Math.max(1,it.lvl|0); it.sec=Array.isArray(it.sec)?it.sec:[]; it.refN=it.refN|0; it.invested=Number.isFinite(it.invested)?it.invested:0; it.fav=!!it.fav; }
    st.nextId=Math.max(st.nextId|0, 1+st.items.reduce((a,x)=>Math.max(a,x.id|0),0));
    for(const k of ['gold','diamond']) if(st.chestInv[k]){ st.chestInv.mode=(st.chestInv.mode||0)+st.chestInv[k]; delete st.chestInv[k]; }
    for(const k of Object.keys(st.chestInv)) if(k.includes('|')){ const t=k.split('|')[0]; st.chestInv[t]=(st.chestInv[t]||0)+st.chestInv[k]; delete st.chestInv[k]; } // cofres: ya no guardan su calidad
    if(st.boostUntil!=null){ st.boostMs=Math.max(0,st.boostUntil-nowFn()); delete st.boostUntil; } st.boostMs=st.boostMs||0; st.evo=st.evo||0; st.absorb=st.absorb||{}; st.mode=st.mode||0; delete st.rare;
    delete st.pity; delete st.firstDone; delete st.gps; delete st.xps; delete st.calLast; delete st.mis; delete st.week; // (calendario y misiones ya no existen)
    if(st.calStart!=null&&st.startDay==null) st.startDay=st.calStart; delete st.calStart;
    st.v=3; return st;
  }
  // lastSeen nunca retrocede: atrasar y adelantar el reloj no regala tiempo sin conexión
  // Armas en formato compacto al guardar (≈5 veces menos): "id|clase|rareza|nivel|reforjas|invertido|favorita|stat:valor,…"
  function packItem(it){ return [it.id,it.cls,it.r,it.lvl,it.refN||0,it.invested||0,it.fav?1:0,it.sec.map(x=>x.k+':'+x.v).join(',')].join('|') }
  function unpackItem(x){ if(typeof x!=='string') return x&&typeof x==='object'?x:null;       // (partidas antiguas: objetos)
    const [id,cls,r,lvl,refN,invested,fav,sec]=x.split('|'); if(!CFG.classes[cls]||!R.includes(r)) return null;
    return {id:+id,cls,r,lvl:+lvl,sec:sec?sec.split(',').map(p=>{ const [k,v]=p.split(':'); return {k,v:+v} }):[],refN:+refN,invested:+invested,fav:fav==='1'} }
  const packed=()=>S?{...S,items:S.items.map(packItem)}:null;       // la partida tal como se guarda (también en el servidor)
  function save(){ if(!S||!storage) return; S.lastSeen=Math.max(S.lastSeen||0,nowFn()); try{storage.set(SAVE_KEY,JSON.stringify(packed()))}catch(e){} }
  let autoLoot=null; // botín de jefes que quedó sin recoger al cerrar: al volver a entrar va directo al inventario
  let autoEvent=null; // intento del evento que quedó a medias al cerrar: se cuenta con las muertes que llevaba
  function load(){ if(!storage) return null; try{const t=storage.get(SAVE_KEY); S=t?migrate(JSON.parse(t)):null}catch(e){S=null} HS=null; B=null;
    autoLoot=S&&S.loot?claimLoot():null; autoEvent=S&&S.evRun?finishRun(S.evRun.kills,false):S&&S.wbRun?wbFinish(S.wbRun.dmg,false):null; if(S) S.refPend=null; return S }
  function reset(){ S=null; B=null; HS=null; if(storage) try{storage.del(SAVE_KEY)}catch(e){} }
  // Nombre del jugador: 3-16 caracteres (letras, números, espacio, _ y -)
  function cleanName(n){ return String(n||'').replace(/[^\p{L}\p{N} _-]/gu,'').replace(/\s+/g,' ').trim().slice(0,16) }
  const validName=n=>cleanName(n).length>=3;
  // El nombre es permanente: solo se puede poner si la partida aún no tiene (partidas antiguas)
  function setName(n){ const c=cleanName(n); if(c.length<3||S.name) return false; S.name=c; save(); emit('change'); return true }
  function newGame(cls,name){ S=newState(cls,name); HS=null; S.equippedId=newItem(cls,CFG.startWeapon||'C').id; S.startDay=dayKey(); startWave(); track('start',{cls,name:S.name}); emit('change'); return S }

  /* ---------- fórmulas ---------- */
  const hasCard=()=>dayKey()<S.cardUntil, hasVip=()=>dayKey()<S.vipUntil;
  const equipped=()=>S.items.find(i=>i.id===S.equippedId)||null;
  function weaponMain(w){const b=CFG.weapon[w.r];const m=1+CFG.weapon.lvlPct*(w.lvl-1);return {d:b[0]*m,s:b[1]*m}}
  const statsDirty=()=>{HS=null};
  // efecto del arma equipada si es Legendaria o Mítica (el de su clase)
  function legendFx(){ const w=S&&equipped(); return w&&CFG.weapon.legend&&R.indexOf(w.r)>=R.indexOf('L')?CFG.weapon.legend[w.cls]||null:null }
  const heroStats=()=>HS||(HS=computeStats());
  function computeStats(){
    const c=CFG.classes[S.cls], L=S.lvl-1, u=S.up, U=CFG.upgrades, w=equipped(), ps={...(c.p||{}),...evoBase(),...towerBase()}, A=S.absorb||{}, EV=S.evo?evoP():null;
    const sec={hpp:0,dfp:0,cr:0,cd:0,ls:0,bd:0}, TF=CFG.tower.fx; let wd=0,ws=0;
    const gs=grimSet(), GFX=towerOn()?grimFxT():CFG.grimoire.fx;                               // camino B (y Torre): defensa (Guardián) o daño a jefes (Cazador)
    if(gs.has('fortaleza')){ sec.dfp+=GFX.fortaleza.df; sec.bd+=GFX.fortaleza.boss||0; } if(gs.has('cazador')) sec.bd+=GFX.cazador.boss;
    if(w){const m=weaponMain(w);wd=m.d;ws=m.s;for(const s of w.sec) sec[s.k]+=s.v/100;}
    return {
      // hpK/dfK: cuánto más pequeñas son la vida y la defensa que con el crecimiento antiguo (ref). El robo de vida,
      // el Aura del Santo y el daño por defensa del Titán se escalan con ellas para que sigan valiendo lo mismo.
      hpK:Math.pow(U.hp.mult/(U.hp.ref||U.hp.mult),u.hp), dfK:Math.pow(U.df.mult/(U.df.ref||U.df.mult),u.df),
      hp:(c.hp+(A.hp||0)+c.ghp*L)*Math.pow(U.hp.mult,u.hp)*(1+sec.hpp)*evoBonus('hp')*Math.max(0.2,1+TF.aguante.hp*tfx('aguante')+TF.cristal.hp*tfx('cristal')),
      atk:(c.atk+(A.atk||0)+c.gatk*L)*Math.pow(U.atk.mult,u.atk)*(1+wd)*evoBonus('atk')*(1+TF.fuerza.atk*tfx('fuerza')+TF.cristal.atk*tfx('cristal')),
      df:(c.df+(A.df||0)+c.gdf*L)*Math.pow(U.df.mult,u.df)*(1+sec.dfp),
      spd:c.spd*(ps.spd||1)*Math.pow(U.spd.mult,u.spd)*(1+ws)*(1+TF.rapidez.spd*tfx('rapidez')),
      cr:Math.min(CFG.caps.cr,c.cr+(ps.cr||0)+sec.cr+TF.precision.cr*tfx('precision')), cd:c.cd+(ps.cd||0)+sec.cd, ev:c.ev,
      ls:Math.min(CFG.caps.ls,sec.ls+TF.vampiro.ls*tfx('vampiro')), bd:sec.bd, ranged:c.ranged,
      regen:EV&&EV.noHeal?0:ps.regen||c.regen||0, dmgTaken:ps.dmgTaken||c.dmgTaken||1, xpMult:ps.xp||1, noHeal:!!(EV&&EV.noHeal),
    };
  }
  // Modos (Normal, Pesadilla, Infierno): la fase f de un modo usa los enemigos de la fase f+off
  const MODES=()=>CFG.modes||[{name:'Normal',off:0,gold:1}];
  const modeCfg=()=>MODES()[S?S.mode||0:0];
  const CAP=()=>CFG.phaseCap||Infinity;                   // tope de fases de cada modo
  const effF=f=>f+(modeCfg().off||0);
  const top=()=>Math.min(S.best+1,CAP());                 // la fase más alta a la que se puede ir
  // Curva de enemigos del modo Normal. Crecimiento por tramos: hasta earlyTo usa hpG0/atkG0, luego hpG/atkG y después hpBands=[[desde, hpG, atkG], ...]
  function normalCurve(f){ const E=CFG.enemy;
    const seg=[[1,E.hpG0||E.hpG,E.atkG0||E.atkG],[E.earlyTo||1,E.hpG,E.atkG],...(E.hpBands||[])];
    let hp=E.hp, atk=E.atk, df=E.df*Math.pow(E.dfG,f-1);
    for(let i=0;i<seg.length;i++){ const [a,gh,ga]=seg[i], nx=seg[i+1]?seg[i+1][0]:Infinity, n=Math.max(0,Math.min(f,nx)-a); hp*=Math.pow(gh,n); atk*=Math.pow(ga,n); }
    return {hp,atk:atk*atkShrink(f),df} }
  // Números pequeños: el ataque enemigo se reduce igual que la vida/defensa del héroe con el nivel medio de mejoras de esa fase
  function atkShrink(f){ const P=CFG.enemy.atkShrink, U=CFG.upgrades.hp; if(!P||!U.ref) return 1;
    let u=P[P.length-1][1]; for(let i=1;i<P.length;i++) if(f<=P[i][0]){ const [a,x]=P[i-1], [b,y]=P[i]; u=x+(y-x)*Math.max(0,f-a)/(b-a); break; }
    return Math.pow(U.mult/U.ref,u) }
  // Cada modo empieza en el enemigo de la fase 150 del modo anterior × start y crece a su propio ritmo (hpG/atkG)
  function modeCurve(m,f){ if(!m) return normalCurve(f); const M=MODES()[m], b=modeCurve(m-1,CAP());
    const k=CFG.upgrades.hp.ref?Math.pow(CFG.upgrades.hp.mult/CFG.upgrades.hp.ref,(M.upPer||0)*(f-1)):1;   // números pequeños (ver atkShrink)
    return {hp:b.hp*M.hpStart*Math.pow(M.hpG,f-1), atk:b.atk*M.atkStart*Math.pow(M.atkG,f-1)*k, df:b.df*Math.pow(CFG.enemy.dfG,f-1)} }
  function enemyStats(f,w,boss){
    const E=CFG.enemy, mc=modeCurve(S?S.mode||0:0,f);
    let hp=mc.hp*(1+E.waveHp*(w-1)), atk=mc.atk, df=mc.df;
    // Jefes: su vida se mide en "oleadas" (la vida de toda la oleada de su fase) y su ataque en enemigos (×1 = un enemigo normal)
    if(!boss&&WV()){ const V=WV(); hp*=perOld(f)/perWave(f)*(V.hpMul||1); atk*=Math.pow(V.atkG||1,groupAt(f)-1); }
    if(boss){ const per=perOld(f), M=modeCfg();
      const m=f%50===0?(M.off?((M.walls&&M.walls[f])||{hp:E.eliteHp,atk:E.eliteAtk}):eliteMult(f)):bossBand(f); hp*=per*m.hp; atk*=m.atk; }
    return {hp,atk,df};
  }
  // jefe de élite: su valor propio (walls) o, si no tiene, el del último élite definido por debajo (p. ej. la 250 usa la 200)
  function eliteMult(f){ const E=CFG.enemy, w=E.walls||{}; const k=Object.keys(w).map(Number).filter(x=>x<=f).sort((a,b)=>b-a)[0]; return k?w[k]:{hp:E.eliteHp,atk:E.eliteAtk} }
  // jefe normal según el tramo de fases: bossBands=[[desde, vida, ataque], ...] (en oleadas)
  function bossBand(f){ const E=CFG.enemy; let m={hp:E.bossHp,atk:E.bossAtk}; for(const [a,hp,atk] of (E.bossBands||[])) if(f>=a) m={hp,atk}; return m }
  const dmgF=(a,d)=>a*a/(a+d);
  const goldPer=f=>CFG.econ.gold*Math.pow(CFG.econ.goldG,10*Math.floor((f-1)/10));
  const goldAt=f=>goldPer(effF(f))*(modeCfg().gold||1), xpAt=f=>xpPer(effF(f)); // oro y experiencia de la fase f del modo actual
  const xpPer=f=>CFG.econ.xp*Math.pow(CFG.econ.xpG,f-1);
  // experiencia para pasar del nivel l al l+1; xpBands cambia el crecimiento a partir de ciertos niveles
  const XPC=[0];
  function xpReq(l){ l=Math.max(1,l|0); while(XPC.length<=l){ const L=XPC.length; if(L===1){XPC.push(CFG.econ.xpReq);continue}
      let g=CFG.econ.xpReqG; for(const [a,gg,step] of (CFG.econ.xpBands||[])){ if(L>=a) g=gg; if(L===a&&step) g*=step; } XPC.push(XPC[L-1]*g); } return XPC[l] } // [desde, crecimiento, salto opcional al entrar]
  const upCost=k=>{const u=CFG.upgrades[k];return u.base*Math.pow(u.g,S.up[k])};
  // Oleadas progresivas (enemy.waves): según sube la fase hay más enemigos por oleada, salen varios a la vez y andan y pegan
  // más rápido. La vida de la oleada entera no cambia (cada enemigo tiene su parte): perOld es el reparto antiguo (3-5).
  const perOld=f=>3+Math.floor((f-1)/CFG.enemy.extraEvery);
  const WV=()=>CFG.enemy.waves;
  const perWave=f=>{ const V=WV(); return V?Math.min(V.nMax,V.n0+Math.floor((f-1)/V.nEvery)):perOld(f) };
  const groupAt=f=>{ const V=WV(); return V?Math.min(V.gMax,V.g0+Math.floor((f-1)/V.gEvery)):1 };   // cuántos salen a la vez
  const eSpd=f=>{ const V=WV(); return V?1+V.spd*Math.min(1,(effF(f)-1)/149):1 };                    // velocidad (andar y pegar)
  // mientras quede una evolución pendiente, el nivel no pasa de evo.lvl (la barra se queda llena)
  const evoTiers=()=>(CFG.evo&&CFG.evo.tiers)||[];
  const nextEvo=()=>evoTiers()[S.evo]||null;              // la próxima evolución (o null si ya no quedan)
  const lvlCap=()=>{ const t=nextEvo(); return t?t.lvl:Infinity };
  function addXp(x){ const l0=S.lvl, cap=lvlCap(); S.xp+=x; while(S.lvl<cap&&S.xp>=xpReq(S.lvl)){S.xp-=xpReq(S.lvl);S.lvl++}
    if(S.lvl>=cap) S.xp=Math.min(S.xp,xpReq(S.lvl)); if(S.lvl>l0){statsDirty();emit('level',S.lvl)} return S.lvl-l0 }

  /* ---------- habilidades activas ---------- */
  // CT: reloj de combate (no se guarda). CD[slot]: cuándo vuelve a estar lista. BUF: efectos de habilidades que duran unos segundos.
  let CT=0; const CD={}; const BUF={list:[]};
  function buffMul(k){ BUF.list=BUF.list.filter(b=>b.until>CT); let m=1;
    for(const b of BUF.list){ if(k==='atk') m*=1+(b.atk||0); else if(k==='taken') m*=b.taken||1; else if(k==='spd') m*=b.spd||1; else if(k==='thorns') m*=b.thorns||1; else if(k==='df') m*=b.df||1; } return m }
  function buffAdd(k){ let a=0; for(const b of BUF.list) if(b.until>CT) a+=b[k]||0; return a }
  function skillDef(k){ const K=CFG.skills;
    if(k==='cls') return K.cls[S.cls]||null;
    if(k==='evo') return S.evo>=1?(S.path==='B'?(K.evoB||{})[S.cls]:K.evo[S.cls])||null:null;
    if(k[0]==='t'&&towerOn()){ const t=towerSkills()[+k.slice(1)-1]; return t?K[t.src][t.cls]:null } return null }
  const SLOTS0=['cls','evo'], TSL=['t1','t2'];
  const SLOTS_=()=>towerOn()?SLOTS0.concat(TSL.slice(0,towerSkills().length)):SLOTS0;
  const skillSlots=()=>SLOTS_().filter(skillDef);
  // estado para la pantalla: nombre, recarga y si está lista. Las bloqueadas dicen cómo se consiguen.
  function skills(){ return SLOTS_().map(k=>{ const d=skillDef(k); return d?{slot:k,id:d.id,name:d.name,desc:d.desc,cd:d.cd,left:Math.max(0,(CD[k]||0)-CT),ready:CT>=(CD[k]||0)}
    :{slot:k,locked:true,name:S.evo>=1?'Por decidir':'Evolución',desc:S.evo>=1?'Habilidad de este camino: aún por decidir':'Se desbloquea al evolucionar'} }) }
  function useSkill(k){ const d=skillDef(k); if(!d) return {ok:false,why:'locked'}; if(!B||B.over) return {ok:false,why:'nofight'};
    if(CT<(CD[k]||0)) return {ok:false,why:'cd',left:CD[k]-CT};
    CD[k]=CT+d.cd*cdMul(); (B.cast=B.cast||[]).push(k); track('skill',{slot:k,ev:!!B.event}); emit('skill',{slot:k,name:d.name,auto:false}); return {ok:true} }
  // en los eventos se usan a mano, salvo que el jugador ponga «Auto» (opt.evAuto); en la campaña, solas (opt.autoSkills)
  const skillsAuto=()=>B&&B.event?!!(S.opt&&S.opt.evAuto):!(S.opt&&S.opt.autoSkills===false);
  const manualSkills=()=>!!(B&&B.event&&!(S.opt&&S.opt.evAuto));

  /* ---------- combate ---------- */
  /* ---------- sorpresas en la campaña y racha ---------- */
  const STK={n:0}, SUR={next:null,kind:null,until:0};
  const streakMul=()=>1+Math.min(CFG.streak.max,Math.floor(STK.n/CFG.streak.per)*CFG.streak.pct);
  const hordeOn=()=>SUR.kind==='horde'&&CT<SUR.until;
  function surpriseTick(){ const C=CFG.surprise; if(!C||!B||B.event) return;
    if(SUR.next===null) SUR.next=CT+C.every+(rand()*2-1)*C.jitter;
    if(SUR.kind&&CT>=SUR.until){ const k=SUR.kind; SUR.kind=null;
      if(k==='wander'){ const w=B.enemies.find(e=>e.wander&&!e.dead); if(w){ w.dead=true; w.fled=true; emit('surprise',{k:'wanderFled'}); } }
      else emit('surprise',{k:'hordeEnd'}); }
    if(SUR.kind||B.boss||CT<SUR.next) return;
    SUR.next=CT+C.every+(rand()*2-1)*C.jitter;
    if(rand()<0.5){ SUR.kind='horde'; SUR.until=CT+C.horde.dur; emit('surprise',{k:'horde',dur:C.horde.dur}); }
    else { const W=C.wander, e=enemyStats(S.fase,S.wave,false), hp=e.hp*perWave(S.fase)*W.hp;
      B.enemies.push({hp,max:hp,atk:e.atk*W.atk,df:e.df,spawn:B.t,walk:walkT(),arrive:B.t+walkT(),next:B.t+walkT(),first:false,dead:false,wander:true,spd:1});
      SUR.kind='wander'; SUR.until=CT+W.dur; emit('surprise',{k:'wander',dur:W.dur}); } }
  const surpriseState=()=>SUR.kind&&CT<SUR.until?{k:SUR.kind,left:SUR.until-CT}:null;
  function startWave(){
    if(B&&B.event) return; // el evento en curso no se interrumpe
    // jefe: al empujar una fase múltiplo de 10; y el de la fase 150 se puede repetir (farmear) una vez vencido
    const boss=(S.wave===10 && S.fase%10===0 && (S.fase===S.best+1 || (S.fase===CAP() && S.best>=CAP())));
    const h=heroStats();
    B={t:0,boss,elite:boss&&S.fase%50===0,count:boss?1:perWave(S.fase)*(hordeOn()?CFG.surprise.horde.count:1),spawned:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0};
    const g=boss?1:Math.min(B.count,groupAt(S.fase)); for(let i=0;i<g;i++) spawnEnemy(i*((WV()||{}).gap||0)); emit('wave',B);
  }
  // Embestida: los de cuerpo a cuerpo saltan al enemigo, así que esperan menos a que llegue (× enemy.dash)
  const walkT=()=>CFG.enemy.walk/eSpd(S.fase)*(heroStats().ranged?1:(CFG.enemy.dash||1));
  function spawnEnemy(late){   // late: sale un poco después (los del mismo grupo llegan escalonados)
    const e=enemyStats(S.fase,S.wave,B.boss), W=walkT()+(late||0); // (enemyStats ya aplica el modo)
    B.enemies.push({hp:e.hp,max:e.hp,atk:e.atk,df:e.df,spawn:B.t,walk:W,arrive:B.t+W,next:B.t+W,first:true,dead:false,spd:B.boss?1:eSpd(S.fase)});
    B.spawned++;
  }
  function endWave(delay){ B.over=true; B.wait=delay }
  // Avanza el combate dt segundos de juego.
  function step(dt){
    if(!S||!B) return;
    if(B.over){ B.wait-=dt; if(B.wait<=0) startWave(); return }
    const h=heroStats(), P=stepP(), GS=grimSet(), FX=towerOn()?grimFxT():CFG.grimoire.fx, LS=legendSet();
    B.t+=dt; CT+=dt; grimXp(dt);
    // Grimorio del Tiempo: guarda la vida de hace unos segundos (muestra cada 0,5 s)
    if(B.event&&B.kind==='boss'){ if(B.t>=CFG.wboss.dur||(S.wbRun&&S.wbRun.week<weekKey()&&!evPaused())){ endEvent(); return } wbUpdate(); }
    if(!B.event) surpriseTick();
    else if(B.event&&B.kind!=='tower'){ if((CFG.event.dur&&B.t>=CFG.event.dur)||B.t>=(CFG.event.maxDur||1e9)||(S.evRun&&S.evRun.day<dayKey()&&!evPaused())){ endEvent(); return } evSpawn(); } // un intento de ayer se cierra al acabar la pausa
    // curación: lo que de verdad se recupera (Santo: cada curación se convierte en daño en área durante unos segundos)
    // solo la regeneración (Fe) alimenta el aura; lo curado se pasa a la escala antigua (÷ hpK) para que el aura siga pegando igual
    // curación (el Oscuro solo se cura robando vida: ls)
    const heal=(x,aura,ls)=>{ if(h.noHeal&&!ls) return; const b=B.hp; B.hp=Math.min(h.hp,B.hp+x); const got=B.hp-b; if(aura&&got>0&&P&&P.aura) B.auraPool=(B.auraPool||0)+got*P.aura/h.hpK; };
    if(h.regen){ const lit=P&&P.lightMult&&B.t<(B.lightUntil||0); heal(h.regen*(lit?P.lightMult:1)*h.hp*dt,true); }
    const kill=e=>{ if(e.dead) return; e.dead=true; e.deadAt=B.t;
      if(towerOn()&&tfx('explosion')){ const x=e.max*CFG.tower.fx.explosion.pct; for(const o of B.enemies){ if(o.dead||o===e||o.arrive>B.t+0.5) continue; o.hp-=x; B.mD+=x; emit('hit',{e:o,d:x,crit:false,burst:true}); if(o.hp<=0) kill(o); } }   // Torre: Explosión
      if(CT<(BUF.combust||0)&&e.burn&&e.burn.some(u=>u>B.t)){ const nx=B.enemies.find(x=>!x.dead); if(nx){ nx.burn=(nx.burn||[]).concat(e.burn.filter(u=>u>B.t)).slice(-(P&&P.burnMax||5)); emit('fx',{k:'combustion',e:nx}); } }
      if(B.event){ B.kills++; if(S.evRun) S.evRun.kills=B.kills; return }
      if(e.wander){ giveBundle(CFG.surprise.wander.reward); SUR.kind=null; emit('surprise',{k:'wanderWin',reward:CFG.surprise.wander.reward}); }
      onKill(e); if(e.first&&B.spawned<B.count){e.first=false;spawnEnemy()} };
    if(B.auraPool>0){ const d=B.auraPool*Math.min(1,dt/P.auraDur); B.auraPool-=d;                    // Santo: aura sagrada (en área)
      for(const e of B.enemies){ if(e.dead||e.arrive>B.t) continue; const dd=d*(B.boss?1+h.bd:1); e.hp-=dd; B.auraDmg=(B.auraDmg||0)+dd; B.mD+=dd; if(B.kind==='boss') addDmg(dd); if(e.hp<=0) kill(e); } }
    if(P&&P.burnPct) for(const e of B.enemies){ // Archimago: quemaduras (cada acumulación hace burnPct del daño por segundo)
      if(e.dead||!e.burn) continue; e.burn=e.burn.filter(u=>u>B.t); if(!e.burn.length) continue;
      const d=e.burn.length*P.burnPct*h.atk*dt*(CT<(BUF.combust||0)?1+(BUF.burnUp||0):1); e.hp-=d; B.burnDmg=(B.burnDmg||0)+d; B.mD+=d; if(B.kind==='boss') addDmg(d); if(e.hp<=0) kill(e); }
    for(const e of B.enemies){ if(e.dead||!(e.dot>B.t)) continue;                   // daño con el tiempo: veneno, sangrado, fuego
      const d=e.dotDps*dt; e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); if(e.hp<=0) kill(e); }
    for(const e of B.enemies){ if(e.dead||!e.poison||!e.poison.length) continue; e.poison=e.poison.filter(x=>x.until>B.t); // Veneno: acumulaciones
      const d=e.poison.reduce((a,x)=>a+x.dps,0)*dt; if(!d) continue; e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); if(e.hp<=0) kill(e); }
    const hitOnce=tg=>{
      const atkE=h.atk+(P&&P.defDmg?P.defDmg*h.df/h.dfK:0), dfE=tg.df*(LS.vacio?1-LS.vacio.ignoreDf:1);   // Titán: daño extra según su defensa · Vacío: ignora defensa
      let d=dmgF(atkE,dfE)*(B.boss?1+h.bd:1), crit=false;
      if(P&&P.rage) d*=1+Math.min(P.rageCap,(B.rage||0)*P.rage);        // Berserker: furia por golpes recibidos
      if(P&&P.dblBuff&&B.dblSt){ B.dblSt=B.dblSt.filter(u=>u>B.t); d*=1+P.dblBuff*B.dblSt.length; } // Ojo de Halcón: racha tras disparo doble
      if(B.critBuff){ d*=1+P.critNext; B.critBuff=false; }                // Sombra: golpe potenciado tras un crítico
      d*=buffMul('atk');                                                        // habilidades: +daño
      if(towerOn()){ const TX=CFG.tower.fx; if(tfx('ejecutor')&&tg.hp<TX.ejecutor.below*tg.max) d*=1+TX.ejecutor.mult*tfx('ejecutor'); if(tfx('furia')) d*=1+TX.furia.per*tfx('furia')*Math.max(0,1-B.hp/h.hp); }   // Torre: Ejecutor y Furia
      { const a1=buffAdd('atk1'); if(a1&&(B.boss||B.kind==='boss')) d*=1+a1; }   // +daño solo contra jefes
      if(tg.mark>B.t) d*=1+tg.markMult;                                         // Marca del cazador
      if(GS.has('sacrificio')&&B.hp>1){ const GF=FX.sacrificio; B.hp=Math.max(1,B.hp-GF.cost*h.hp); if(!GF.single||B.boss||B.kind==='boss') d*=1+GF.atk; }   // Oscuro: el extra solo contra jefes   // Sacrificio: vida por daño
      const forced=BUF.crits>0&&CT<BUF.critsUntil; if(forced) BUF.crits--;
      if(forced||rand()<h.cr+(B.critAcc||0)){ d*=1+h.cd; crit=true; if(LS.filoVacio) d*=atkE/dmgF(atkE,dfE);   // Filo del vacío: el crítico ignora la defensa
        B.critAcc=0; if(P&&P.critNext) B.critBuff=true; }
      else if(P&&P.critStack) B.critAcc=Math.min(P.critStackMax||1,(B.critAcc||0)+P.critStack); // Segador: cada golpe sin crítico suma probabilidad de crítico
      tg.hp-=d; B.mD+=d; heal(d*(h.ls+buffAdd('ls')+(GS.has('sacrificio')?FX.sacrificio.lsMax*Math.max(0,1-B.hp/h.hp):0))*h.hpK,false,true); if(B.kind==='boss') addDmg(d);   // (Oscuro: roba más cuanta menos vida)   // robo de vida: cura la misma parte de tu vida máxima que antes
      if(P&&P.burnPct){ tg.burn=tg.burn||[]; if(tg.burn.length>=P.burnMax) tg.burn.shift(); tg.burn.push(B.t+P.burnDur); }
      emit('hit',{e:tg,d,crit,ranged:h.ranged});
      if(BUF.clone&&CT<BUF.clone.until&&!tg.dead){ const c=d*BUF.clone.mult; tg.hp-=c; B.mD+=c; if(B.kind==='boss') addDmg(c); emit('hit',{e:tg,d:c,crit,clone:true}); }   // Clon de sombra
      if(GS.has('escarcha')&&!tg.dead&&(tg.shards=(tg.shards||0)+1)>=FX.escarcha.need){ const GF=FX.escarcha; tg.shards=0; const x=dmgF(h.atk,tg.df*(1-GF.ignoreDf))*GF.mult*(B.boss?1+h.bd:1)*buffMul('atk'); tg.hp-=x; B.mD+=x; if(B.kind==='boss') addDmg(x);   // Escarcha: 3 esquirlas → daño y congela
        tg.frozen=B.t+FX.escarcha.freeze; emit('hit',{e:tg,d:x,crit:false,frost:true}); emit('fx',{k:'congelar',e:tg}); }
      if(LS.llamarada&&(B.flare=(B.flare||0)+1)%LS.llamarada.every===0) for(const e of B.enemies){ if(e.dead) continue; e.dot=B.t+LS.llamarada.dur; e.dotDps=LS.llamarada.pct*d; e.dotKind='fuego'; }   // Llamarada solar
      if(GS.has('veneno')){ const GF=FX.veneno; tg.poison=(tg.poison||[]).filter(x=>x.until>B.t); tg.poison.push({until:B.t+GF.dur,dps:GF.pct*d}); if(tg.poison.length>GF.max) tg.poison.shift(); }
      if(tg.hp<=0) kill(tg);
      // Tajo partido (después de matar: también alcanza al que acaba de salir)
      if(LS.tajo){ const o=B.enemies.find(e=>!e.dead&&e!==tg&&e.arrive<=B.t+0.5); if(o){ const x=d*LS.tajo.mult; o.hp-=x; B.mD+=x; if(B.kind==='boss') addDmg(x); emit('hit',{e:o,d:x,crit:false,cleave:true}); if(o.hp<=0) kill(o); } }
    };
    const canHit=e=>!e.dead&&((h.ranged&&!B.event)||e.arrive<=B.t); // en el evento nadie dispara antes de que llegue (igual para todas las clases)
    // habilidades: las pedidas a mano (B.cast) y, en automático, las que estén listas
    if(skillsAuto()&&B.enemies.some(e=>!e.dead&&e.arrive<=B.t+0.3))
      for(const k of skillSlots()){ const sk=skillDef(k); if(!(CT>=(CD[k]||0))) continue;
        if((sk.id==='sed'||sk.id==='sacrificio')&&B.hp<0.5*h.hp) continue;         // no gastar vida si va mal
        CD[k]=CT+sk.cd*cdMul(); (B.cast=B.cast||[]).push(k); emit('skill',{slot:k,name:sk.name,auto:true}); }
    if(B.cast&&B.cast.length){ const list=B.cast; B.cast=[];
      const alive=()=>B.enemies.filter(e=>!e.dead).sort((a,b)=>a.arrive-b.arrive), base=e=>dmgF(h.atk,e.df)*(B.boss?1+h.bd:1)*buffMul('atk');
      const hurt=(e,d,k)=>{ e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); emit('hit',{e,d,crit:false,skill:k}); if(e.hp<=0) kill(e); return e.dead };
      for(const k of (tfx('eco')?list.flatMap(k=>k[0]==='t'?[k,k]:[k]):list)){ const sk=skillDef(k); if(!sk) continue;
        switch(sk.id){
          case 'muro': BUF.shield=(BUF.shield||0)+sk.shield*h.df;                                   // escudo según la defensa
            for(const e of alive()) hurt(e,dmgF(sk.dmgDef*h.df/h.dfK,e.df)*(B.boss?1+h.bd:1),k); break;   // golpe en área con la defensa (escala antigua)
          case 'bola': for(const e of alive().slice(0,sk.targets)){ hurt(e,base(e)*sk.mult,k); if(!e.dead){ if(GS.has('escarcha')&&!(P&&P.burnPct)) e.shards=(e.shards||0)+1; else { e.dot=B.t+sk.dur; e.dotDps=base(e)*sk.burn; e.dotKind='fuego'; } } } break;
          case 'rapido': BUF.list.push({until:CT+sk.dur,spd:sk.spd}); break;
          case 'ejecutar': { const tg=alive()[0]; if(tg&&hurt(tg,base(tg)*sk.mult,k)) CD[k]=CT+sk.cd*sk.refund*cdMul(); break; }   // si mata, media recarga
          case 'luz': { for(let i=0;i<sk.hits;i++){ const e=alive()[0]; if(e) hurt(e,base(e)*sk.mult,k); }   // golpes encadenados al mismo objetivo (si muere, siguen con el siguiente)
            BUF.lightBack=(BUF.lightBack||[]).concat([...Array(sk.hits)].map((_,i)=>({at:CT+sk.back+i*0.15,heal:sk.heal}))); break; }   // vuelven y curan
          case 'sed': { const lost=Math.min(B.hp-1,sk.cost*h.hp); B.hp-=Math.max(0,lost); BUF.shield=(BUF.shield||0)+sk.shield*Math.max(0,lost); BUF.list.push({until:CT+sk.dur,ls:sk.ls}); break; }
          case 'combustion': BUF.combust=CT+sk.dur; BUF.burnUp=sk.burnUp||0; break;
          case 'perforante': for(const e of alive()) hurt(e,base(e)*sk.mult,k); break;
          case 'clon': BUF.clone={until:CT+sk.dur,mult:sk.mult}; break;
          case 'juicio': BUF.aura={until:CT+sk.dur,heal:sk.heal,dps:sk.dps}; break;
          case 'baluarte': BUF.list.push({until:CT+sk.dur,df:sk.df,reflect:sk.reflect}); break;
          case 'armaduraHielo': { BUF.iceArmor=CT+sk.dur; BUF.iceShards=sk.shards||1; const F=CFG.grimoire.fx.escarcha;
            // al lanzarla: esquirlas a todos
            for(const e of alive()){ hurt(e,dmgF(h.atk,e.df*(1-F.ignoreDf))*F.mult*(sk.burst||1)*(B.boss?1+h.bd:1),k); if(!e.dead) e.frozen=B.t+F.freeze; } break; }
          case 'marca': { const tg=alive()[0]; if(tg){ tg.mark=B.t+sk.dur; tg.markMult=sk.mult; } break; }
          case 'nube': BUF.cloud={until:CT+sk.dur,next:CT,pct:sk.pct,extra:sk.extra}; break;
          case 'sacrificio': { const lost=Math.min(B.hp-1,sk.cost*h.hp); B.hp-=Math.max(0,lost); BUF.list.push({until:CT+sk.dur,atk:sk.single?0:sk.atk,atk1:sk.single?sk.atk:0}); break; }
        }
        emit('fx',{k:'skill',slot:k,id:sk.id,name:sk.name}); } }
    if(BUF.lightBack&&BUF.lightBack.length){ const back=BUF.lightBack.filter(x=>CT>=x.at); if(back.length){ BUF.lightBack=BUF.lightBack.filter(x=>CT<x.at); for(const x of back) heal(x.heal*h.hp); emit('fx',{k:'luzVuelve',n:back.length}); } }
    if(BUF.cloud&&CT<BUF.cloud.until&&CT>=BUF.cloud.next){ BUF.cloud.next+=1; const V=CFG.grimoire.fx.veneno;
      for(const e of B.enemies){ if(e.dead) continue; e.poison=(e.poison||[]).filter(x=>x.until>B.t); e.poison.push({until:B.t+V.dur,dps:(BUF.cloud.pct||V.pct)*dmgF(h.atk,e.df)}); if(e.poison.length>V.max+(BUF.cloud.extra||0)) e.poison.shift(); } }
    if(BUF.aura&&CT<BUF.aura.until){ heal(BUF.aura.heal*h.hp*dt);                              // Luz del juicio: cura y quema a los cercanos
      for(const e of B.enemies){ if(e.dead||e.arrive>B.t+0.5) continue; const d=dmgF(h.atk,e.df)*BUF.aura.dps*dt*(B.boss?1+h.bd:1); e.hp-=d; B.mD+=d; if(B.kind==='boss') addDmg(d); if(e.hp<=0) kill(e); } }
    if(B.enemies.some(canHit)){
      if(B.th===null) B.th=B.t;
      while(B.t>=B.th){
        const cand=B.enemies.filter(canHit);
        if(!cand.length){B.th=null;break}
        const tg=cand.reduce((a,b)=>a.arrive<=b.arrive?a:b);
        B.mB+=dmgF(h.atk,tg.df)*(B.boss?1+h.bd:1)*(1+h.cr*h.cd);   // lo que diría la fórmula por ataque (para medir el DPS real)
        hitOnce(tg);
        if(tfx('cadena')&&(B.chainN=(B.chainN||0)+1)%CFG.tower.fx.cadena.every===0){ const o=B.enemies.find(e=>canHit(e)&&e!==tg); if(o) hitOnce(o); }   // Torre: Cadena
        if(LS.rafaga&&(B.shots=(B.shots||0)+1)%LS.rafaga.every===0) for(let i=1;i<LS.rafaga.arrows;i++){ const t2=tg.dead?B.enemies.filter(canHit)[0]:tg; if(t2) hitOnce(t2); }   // Ráfaga: 3 flechas
        if(P&&P.double&&!tg.dead&&rand()<P.double){ hitOnce(tg); if(P.dblBuff){ B.dblSt=(B.dblSt||[]).filter(u=>u>B.t); if(B.dblSt.length<P.dblMax) B.dblSt.push(B.t+P.dblDur); } } // Tirador: disparo doble
        B.th+=1/(h.spd*buffMul('spd'));
      }
    } else if(B.event||(B.th!==null&&B.th<=B.t)) B.th=null;   // en campaña, sin objetivo, el siguiente golpe respeta la cadencia (cuerpo a cuerpo: no es instantáneo al llegar)
    // jefes con fases: al bajar de la mitad de vida se enfurecen o invocan ayudantes (al azar)
    if(B.boss&&!B.event&&CFG.bossPhase) for(const e of B.enemies){ if(e.dead||e.minion||e.phase||e.hp>CFG.bossPhase.at*e.max) continue;
      const P=CFG.bossPhase; e.phase=rand()<0.5?'rage':'summon';
      if(e.phase==='rage'){ e.atk*=P.rage; e.spd=(e.spd||1)*P.rage; }
      else { const n=P.summon[0]+Math.floor(rand()*(P.summon[1]-P.summon[0]+1)), m=enemyStats(S.fase,1,false), W=walkT();
        for(let i=0;i<n;i++) B.enemies.push({hp:m.hp,max:m.hp,atk:m.atk,df:m.df,spawn:B.t,walk:W+i*0.3,arrive:B.t+W+i*0.3,next:B.t+W+i*0.3,first:false,dead:false,minion:true,spd:eSpd(S.fase)}); }
      emit('bossPhase',{k:e.phase}); }
    for(const e of B.enemies){
      if(!e.dead&&e.frozen>B.t){ if(e.arrive>B.t){ e.spawn+=dt; e.arrive+=dt; } e.next=Math.max(e.next,e.frozen); continue; }   // congelado
      if(e.dead||e.arrive>B.t) continue;
      while(B.t>=e.next){
        if(rand()>=h.ev){ let d=dmgF(e.atk,h.df*buffMul('df'))*h.dmgTaken*buffMul('taken');
          if(BUF.shield>0){ const a=Math.min(BUF.shield,d); BUF.shield-=a; d-=a; }      // escudo de habilidad
          if(BUF.gshield>0){ const a=Math.min(BUF.gshield,d); BUF.gshield-=a; d-=a; }    // escudo del Grimorio de la Luz
          B.hp-=d; emit('heroHit',{d}); if(!B.event&&STK.n){ STK.n=0; emit('streak',{n:0}); }
          { const rf=buffAdd('reflect')+CFG.tower.fx.espinas.reflect*tfx('espinas'); if(rf>0){ const r=d*rf/h.hpK; e.hp-=r; B.mD+=r; if(B.kind==='boss') addDmg(r); emit('hit',{e,d:r,crit:false,thorns:true}); if(e.hp<=0) kill(e); } }   // Baluarte: devuelve daño
          if(CT<(BUF.iceArmor||0)&&!e.dead&&(e.shards=(e.shards||0)+(BUF.iceShards||1))>=CFG.grimoire.fx.escarcha.need){ const F=CFG.grimoire.fx.escarcha; e.shards=0;   // Armadura de hielo: esquirla al que pega
            const x=dmgF(h.atk,e.df*(1-F.ignoreDf))*F.mult*(B.boss?1+h.bd:1); e.hp-=x; B.mD+=x; if(B.kind==='boss') addDmg(x); e.frozen=B.t+F.freeze; emit('hit',{e,d:x,crit:false,frost:true}); if(e.hp<=0) kill(e); }
          if(P&&P.rage) B.rage=(B.rage||0)+1;
          if(P&&P.lightMult&&!B.lightUsed&&B.hp>0&&B.hp<P.lightHp*h.hp){ B.lightUsed=true; B.lightUntil=B.t+P.lightDur; } } // Oráculo: luz interior
        else emit('dodge');
        e.next+=1/(CFG.enemy.spd*(e.spd||1));
        if(e.first){e.first=false;if(B.spawned<B.count)spawnEnemy()}
        if(B.hp<=0){ if(B.event) endEvent(); else lose(); return }
        if(e.dead) break;
      }
    }
    if(B.kind==='tower'&&B.enemies.every(e=>e.dead)){ endEvent(); return }
    if(B.event){ if(B.enemies.length>40) B.enemies=B.enemies.filter(e=>!e.dead); return }
    if(B.spawned>=B.count && B.enemies.every(e=>e.dead)) waveClear();
  }
  function onKill(e){
    if(!S.daily||S.daily.d!==dayKey()) daily(); S.kills++;   // el día de las misiones empieza con el primer enemigo
    const m=e&&e.minion?3/perWave(S.fase):B.boss?CFG.econ.bossGold:3/B.count; // el oro por oleada no sube con más enemigos (los invocados dan como uno normal)
    STK.n++; if(STK.n%CFG.streak.per===0) emit('streak',{n:STK.n});
    const g=goldAt(S.fase)*m*(hasCard()?1+CFG.cardGold:1)*streakMul()*(hordeOn()?CFG.surprise.horde.gold:1); S.gold+=g; addGoldH(g); // el oro entra directo (la bolsa solo guarda materiales y cofres)
    addXp(xpAt(S.fase)*m*heroStats().xpMult);
  }
  // DPS medido: en oleadas normales (sin jefe ni evento) se compara el daño real (golpes, quemaduras, aura…) con el de la
  // fórmula. La proporción (media móvil) se usa en el cálculo sin conexión y sustituye a la aproximación evoDps.
  function measureWave(){ if(!B||B.boss||B.event||!(B.mB>0)) return; const M=S.dpsM=S.dpsM||{d:0,b:0}, k=0.98;
    M.d=M.d*k+B.mD; M.b=M.b*k+B.mB; }
  const dpsK=h=>{ const M=S.dpsM; return M&&M.b>=CFG.offlineMinMeasure*heroStats().atk?Math.max(0.5,Math.min(3,M.d/M.b)):evoDps(h) };
  function waveClear(){ measureWave(); if(!B.event) addXp(xpAt(S.fase)*(CFG.econ.waveXp||0)*heroStats().xpMult);   // experiencia por oleada ganada
    if(S.wave<10){S.wave++;endWave(CFG.delays.wave);return} faseClear() }
  function faseClear(){
    const f=S.fase; S.wave=1;
    if(f===S.best+1){
      S.best=f; S.bestAt=nowFn();   // para la oferta 'rompe el muro'
      if(f%10===0){ addLoot({wood:1,scrap:bossScrap(f,false)});                  // los jefes ya no dan tokens (los tokens son dinero)
        if(!S.mode&&CFG.matDrop&&(CFG.matDrop.sure||[]).includes(f)) addLoot({mat:1}); // élite 50 y 100: 1 esencia segura
        const mat=rollMat(f);
        emit('boss',{f,elite:f%50===0,mat,mode:S.mode}); }
      S.fase=S.push?Math.min(f+1,CAP()):f; if(f>=CAP()) S.push=false;
    } else {
      if(f===CAP()&&B&&B.boss){ addLoot({scrap:bossScrap(f,true)}); const mat=rollMat(f); emit('bossFarm',{f,mat,mode:S.mode}); } // jefe de la 150 repetido
      S.farmClears++;
      if(S.autoPush && S.farmClears%3===0 && top()>S.best){S.push=true;S.fase=top()}
      else if(S.autoPush && S.farmClears%3===0 && S.best>=CAP() && S.fase<CAP()) S.fase=CAP(); // vuelve a intentar el jefe de la 150
    }
    emit('fase',f); emit('change'); endWave(CFG.delays.fase);
  }
  function lose(){
    let msg;
    if(S.fase===S.best+1){S.push=false;S.fase=Math.max(1,S.best);msg='farm'} else {S.fase=Math.max(1,S.fase-1);msg='retreat'}
    S.wave=1; emit('defeat',{fase:S.fase,kind:msg}); endWave(CFG.delays.defeat);
  }
  function setAuto(v){ S.autoPush=v; if(B&&B.event){ emit('change'); return } if(v&&S.fase!==top()){S.push=top()>S.best;S.fase=top();S.wave=1;startWave()} emit('change') }
  function goFase(f){ if(B&&B.event) return; f=Math.max(1,Math.min(top(),f|0)); if(f===S.best+1) S.push=true; else S.push=false; S.fase=f;S.wave=1;startWave(); emit('change') }

  /* ---------- evolución ---------- */
  // pasiva de la clase evolucionada (null si aún no ha evolucionado)
  // extra de estadísticas de las evoluciones hechas (multiplicativo): tier.bonus={hp,atk}
  // la pasiva de clase mejorada por las evoluciones hechas (p. ej. Piel dura 5 % → 7,5 %)
  function evoBase(){ const o={}; if(S&&S.evo) evoTiers().slice(0,S.evo).forEach((t,i)=>Object.assign(o,(tierCls(t,i)||{}).base||{})); return o }
  function evoBonus(k){ let m=1; if(S&&S.evo) for(const t of evoTiers().slice(0,S.evo)) m*=1+((t.bonus||{})[k]||0); return m }
  // pasivas acumuladas de las evoluciones hechas (la última da el nombre)
  let EP=null, EPk=''; // caché de la pasiva (se llama en cada paso del combate)
  const tierCls=(t,i)=>i===0&&S.path==='B'&&t.alt?{...t.alt[S.cls],grim:undefined}:t.classes[S.cls];   // la 1.ª evolución depende del camino
  function evoP(){ if(!S.evo) return null; const k=S.cls+S.evo+(S.path||''); if(EPk===k) return EP; const o={}; evoTiers().slice(0,S.evo).forEach((t,i)=>Object.assign(o,tierCls(t,i))); EP=o; EPk=k; return o }
  // Torre: las mejoras elegidas en la partida se suman a lo tuyo solo mientras luchas en la Torre
  const towerOn=()=>!!(B&&B.kind==='tower');
  const tBoons=()=>towerOn()&&S.tower&&S.tower.run?S.tower.run.boons:[];
  const boonPas=b=>{ const T=evoTiers()[0]; return b.path==='B'?T.alt[b.cls]:T.classes[b.cls] };
  const towerSkills=()=>tBoons().filter(b=>b.t==='sk');
  const tfx=id=>tBoons().filter(b=>b.t==='fx'&&b.id===id).length;   // cuántas veces tienes esta mejora de la Torre
  const cdMul=()=>tfx('recarga')?CFG.tower.fx.recarga.cd:1;
  const MAEK=['rage','rageCap','burnPct','double','critNext','lightMult'];
  function stepP(){ const L=tBoons().filter(b=>b.t==='pas'&&b.path!=='B'); const P=evoP(); if(!L.length) return P;
    const o={...(P||{})}, m=tfx('maestria')?CFG.tower.fx.maestria.mult:1; for(const b of L){ const p={...boonPas(b)}; if(m!==1) for(const k of MAEK) if(typeof p[k]==='number') p[k]*=m; Object.assign(o,p); } return o }
  // efectos de grimorio de la Torre (con Maestría, más fuertes)
  function grimFxT(){ const F=CFG.grimoire.fx; if(!tfx('maestria')) return F; const m=CFG.tower.fx.maestria.mult, o={}; for(const k in F){ o[k]={...F[k]}; for(const q of ['pct','mult','boss','atk','df']) if(typeof o[k][q]==='number') o[k][q]*=m; } return o }
  function towerBase(){ const o={}; for(const b of tBoons()) if(b.t==='pas'&&b.path!=='B') Object.assign(o,boonPas(b).base||{}); return o }
  function grimSet(){ const s=new Set(); const g=grimFx(); if(g) s.add(g); for(const b of tBoons()) if(b.t==='pas'&&b.path==='B') s.add(boonPas(b).grim); return s }
  function legendSet(){ const o={}, L=legendFx(); if(L) o[L.id]=L; for(const b of tBoons()) if(b.t==='leg'){ const d=CFG.weapon.legend[b.cls]; o[d.id]=d; } return o }
  // cuánto sube el daño medio por la pasiva: estimación que solo se usa hasta tener DPS medido (dpsK)
  function evoDps(h){ const P=evoP(); if(!P) return 1; let m=1;
    if(P.double) m*=1+P.double; if(P.critNext) m*=1+h.cr*P.critNext; if(P.rage) m*=1+P.rageCap*0.5;
    if(P.burnPct) m*=1+P.burnPct*Math.min(P.burnMax,h.spd*P.burnDur)/h.spd;
    if(P.dblBuff&&P.double) m*=1+P.dblBuff*Math.min(P.dblMax,P.double*h.spd*P.dblDur); if(P.defDmg) m*=1+P.defDmg*h.df/h.dfK/h.atk;
    if(P.critStack) m*=(1+Math.min(1,h.cr+P.critStack*1.5)*h.cd)/(1+h.cr*h.cd); return m }
  // Coste de la próxima evolución: esencias del modo del tier (evo 1 = Esencia de Normal, evo 2 = de Pesadilla), oro y material del evento
  function evoCost(){ const t=nextEvo(); if(!t||!t.cost) return null; const i=evoTiers().indexOf(t); return {ess:t.cost.ess||0,essMode:i,gold:t.cost.gold||0,tokens:t.cost.tokens||0,ev:t.cost.ev||0} }
  function evoMissing(){ const c=evoCost(); if(!c) return {}; const o={};
    if((S.mats[c.essMode]||0)<c.ess) o.ess=c.ess-(S.mats[c.essMode]||0); if(S.gold<c.gold) o.gold=c.gold-S.gold; if(tokens()<c.tokens) o.tokens=c.tokens-tokens(); if(S.evm<c.ev) o.ev=c.ev-S.evm; return o }
  const evoLvlOk=()=>{ const t=nextEvo(); return !!t&&!t.pending&&S.lvl>=t.lvl };
  const evoKeyOk=()=>S.evo>0||grimDone();                                  // la 1.ª evolución pide el grimorio en el nivel 5
  const canEvolve=()=>evoLvlOk()&&evoKeyOk()&&Object.keys(evoMissing()).length===0;
  function evolve(path){
    if(!canEvolve()||inEvent()) return {ok:false};
    if(S.evo===0){ if(path!=='A'&&path!=='B') path='A'; S.path=path; }     // 1.ª evolución: se elige camino
    const c=evoCost(); if(c){ if(c.ess) S.mats[c.essMode]-=c.ess; S.gold-=c.gold; spend(c.tokens); S.evm-=c.ev; }
    S.evo++; S.dpsM=null; statsDirty(); save();                 // con la nueva pasiva se vuelve a medir el DPS
    emit('evolve',{evo:S.evo,name:evoP().name}); emit('change'); return {ok:true};
  }

  /* ---------- modos ---------- */
  // Esencia del modo: todos los jefes pueden soltarla; la probabilidad y la cantidad máxima suben con la fase
  // (matDrop: fase 'from' → c0 de probabilidad y 1..max0; fase 'to' → c1 y 1..max1; lineal entre medias)
  function matOdds(f){ const d=CFG.matDrop, t=Math.max(0,Math.min(1,(f-d.from)/(d.to-d.from)));
    return {chance:d.c0+(d.c1-d.c0)*t, max:Math.round(d.max0+(d.max1-d.max0)*t)} }
  function rollMat(f){ if(!CFG.matDrop) return 0; const o=matOdds(f); if(rand()>=o.chance) return 0; const n=1+Math.floor(rand()*o.max); addLoot({mat:n}); return n }
  // Botín de jefes: se acumula en una bolsa (icono de cofre) y se recoge todo de una vez
  // chatarra de jefe: base + 1 cada 10 fases (el de la 150 repetido da una cantidad fija), × (modo+1)
  const bossScrap=(f,farm)=>{ const c=CFG.econ.bossScrap; return (farm?c.farm:c.base+Math.floor(f/10)*c.per10)*(S.mode+1) };
  function addLoot(x){ const L=S.loot=S.loot||{wood:0,mats:{},n:0,scrap:0};
    if(x.scrap){ L.scrap=(L.scrap||0)+x.scrap; L.n++; }
    if(x.wood) L.wood+=x.wood; if(x.mat) L.mats[S.mode]=(L.mats[S.mode]||0)+x.mat; }
  function claimLoot(){ const L=S&&S.loot; if(!L) return null; S.tokens+=L.t||0; S.scrap+=L.scrap||0; if(L.wood) addChest('wood',L.wood); // (L.t: partidas antiguas)
    for(const m in L.mats) S.mats[m]=(S.mats[m]||0)+L.mats[m]; S.loot=null; emit('change'); return L }
  // Para pasar al siguiente modo: que no esté bloqueado, haber vencido la fase 150 del actual y tener hecha su evolución
  const modeLocked=m=>!!(MODES()[m]&&MODES()[m].locked);         // modo bloqueado ("Próximamente")
  const canAdvanceMode=()=>S.best>=CAP()&&S.mode<MODES().length-1&&!modeLocked(S.mode+1)&&S.evo>=S.mode+1;
  function advanceMode(){ if(!canAdvanceMode()||(B&&B.event)) return false; S.mode++; S.best=0; S.fase=1; S.wave=1; S.push=true; S.farmClears=0;
    statsDirty(); startWave(); emit('mode',{mode:S.mode,name:modeCfg().name}); emit('change'); return true }

  /* ---------- evento ---------- */
  // Mazmorra infinita: monstruos sin parar hasta morir; el monstruo n es el de la fase n (1-150 de Normal, luego sigue con Pesadilla e Infierno).
  // Iguales para todos los jugadores: no dependen de tu modo ni de tu récord.
  // Salen en grupos de 'group' monstruos (con groupHp × su vida): un grupo cada spawnEvery segundos, o al momento si no
  // queda ninguno vivo. El grupo n es el enemigo de la fase n. Puntúa por muertes (cada monstruo cuenta 1). 1 entrada gratis al día; las demás, 1 ticket.
  // Mazmorra infinita: cada ramp.every segundos los grupos son más grandes, salen antes, andan y pegan más rápido
  function evRamp(){ const V=CFG.event, R=V.ramp, r=R?Math.floor(B.t/R.every):0;
    if(!R) return {group:V.group||1,every:V.spawnEvery,walk:V.walk,spd:1,r:0};
    return {group:Math.min(R.groupMax||99,Math.floor((V.group||1)+r*R.group)), every:Math.max(R.spawnMin,V.spawnEvery*Math.pow(R.spawn,r)),
      walk:Math.max(R.walkMin,V.walk*Math.pow(R.walk,r)), spd:1+r*R.spd, r}; }
  function evSpawn(){ const V=CFG.event, alive=B.enemies.some(e=>!e.dead);
    if(alive&&B.t<B.nextSpawn) return;
    const n=B.groups=(B.groups||0)+1, m=Math.min(MODES().length-1,Math.floor((n-1)/CAP())), c=modeCurve(m,n-m*CAP()), hp=c.hp*(V.groupHp||1), R=evRamp();
    for(let i=0;i<R.group;i++){ const at=B.t+R.walk+i*(V.groupGap||0);  // llegan escalonados
      B.enemies.push({hp,max:hp,atk:c.atk*(V.groupAtk||1),df:c.df,spawn:B.t,walk:R.walk,arrive:at,next:at,first:false,dead:false,f:n,spd:R.spd}); B.spawned++; }
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
  function startEvent(){
    if(!S||inEvent()||(S.tickets<1&&!evFreeLeft())||evPaused()) return false;
    if(evPending()) claimEvent();                         // cobra antes el premio de un día anterior
    if(evFreeLeft()) S.evFree=dayKey(); else S.tickets--; const h=heroStats();
    S.evRun={day:dayKey(),kills:0};                       // el intento se guarda: si se cierra la app, cuenta lo que llevaba
    B={event:true,t:0,boss:false,count:0,spawned:0,kills:0,nextSpawn:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0};
    save(); emit('eventStart',B); emit('change'); return true;
  }
  // Apunta las muertes de un intento en el día en que EMPEZÓ (un intento puede acabar pasada la medianoche)
  function finishRun(k,died){
    const d=S.evRun?S.evRun.day:dayKey(); S.evRun=null;
    if(!S.evLog||S.evLog.day!==d){ if(S.evLog&&S.evLog.day<d&&evPending()) claimEvent(); S.evLog={day:d,best:0,claimed:false}; }
    S.evLog.best+=k; S.evLog.runs=(S.evLog.runs||0)+1;   // varios intentos en el mismo día: las muertes se suman
    return {kills:k,best:S.evLog.best,runs:S.evLog.runs,pos:evRank(d,S.evLog.best),died,day:d};
  }
  function endEvent(){
    if(!B||!B.event) return null;
    if(B.kind==='tower') return towerEnd(B.hp>0);
    const res=B.kind==='boss'?wbFinish(B.dmg,B.hp<=0):finishRun(B.kills,B.hp<=0);
    B=null; misBump('event',1); save(); emit('eventEnd',res); startWave(); emit('change'); return res;
  }
  /* ---------- Torre (roguelike) ---------- */
  // Mejoras posibles: pasivas de los caminos A y B, efectos de armas legendarias y habilidades (de clase y de evolución) de todas las clases
  function boonPool(){ const T=CFG.tower, run=S.tower.run, have=new Set(run.boons.map(boonKey)), out=[];
    const mine=new Set(); if(S.evo>=1) mine.add('pas:'+S.cls+':'+(S.path||'A')); const lg=legendFx(); if(lg) mine.add('leg:'+S.cls); mine.add('sk:cls:'+S.cls); if(S.evo>=1) mine.add('sk:'+(S.path==='B'?'evoB':'evo')+':'+S.cls);
    for(const c of Object.keys(CFG.classes)){ out.push({t:'pas',cls:c,path:'A'},{t:'pas',cls:c,path:'B'},{t:'leg',cls:c}); for(const src of ['cls','evo','evoB']) if(CFG.skills[src][c]) out.push({t:'sk',src,cls:c}); }
    for(const id in T.fx) out.push({t:'fx',id});
    const nSk=run.boons.filter(b=>b.t==='sk').length;
    return out.filter(b=>!(b.t==='fx'&&T.fx[b.id].r==='C')&&have.has(boonKey(b))?false:!mine.has(boonKey(b))&&!(b.t==='sk'&&nSk>=T.maxSkills)&&!(b.t==='fx'&&b.id==='pacto'&&run.lives<=1)) }
  const boonKey=b=>b.t==='fx'?'fx:'+b.id:b.t==='pas'?'pas:'+b.cls+':'+b.path:b.t==='leg'?'leg:'+b.cls:'sk:'+b.src+':'+b.cls;
  function boonInfo(b){ if(b.t==='fx'){ const d=CFG.tower.fx[b.id]; return {kind:{C:'Común',R:'Rara',L:'Legendaria'}[d.r],name:d.name,desc:d.desc,r:d.r} }
    if(b.t==='pas'){ const p=boonPas(b); return {kind:'Pasiva',name:p.name,desc:p.passive,r:'L'} }
    if(b.t==='leg'){ const d=CFG.weapon.legend[b.cls]; return {kind:'Objeto',name:d.name,desc:d.desc,r:'L'} }
    const k=CFG.skills[b.src][b.cls]; return {kind:'Hechizo',name:k.name,desc:k.desc,r:'L'} }
  function towerNodes(f){ const T=CFG.tower; if(f%T.boss.every===0) return ['boss'];
    const types=Object.keys(T.nodes), w=types.map(k=>T.nodes[k]), n=2+(rand()<0.5?1:0), out=[];
    for(let i=0;i<n;i++){ let r=rand()*w.reduce((a,b)=>a+b,0), j=0; for(;j<types.length-1;j++){ r-=w[j]; if(r<0) break; } out.push(types[j]); }
    if(!out.some(t=>t==='fight'||t==='elite')) out[0]='fight'; return out }
  function towerState(){ S.tower=S.tower||{best:0,run:null,got:0}; return S.tower }
  // run.hp: fracción de vida que te queda en la partida (no se cura entre combates; al perder una vida vuelves con la vida llena)
  function towerStart(){ if(inEvent()) return false; const T=towerState(); T.run={floor:1,lives:CFG.tower.lives,hp:1,boons:[],nodes:towerNodes(1),pick:null}; save(); emit('change'); return true }
  function towerAbandon(){ const T=towerState(); if(inEvent()) return false; T.run=null; save(); emit('change'); return true }
  // elegir camino: combate (normal/élite/jefe) o directo a la recompensa (tesoro/descanso)
  function towerGo(i){ const T=towerState(), run=T.run; if(!run||run.pick||inEvent()||run.lives<=0) return false; const k=run.nodes[i]; if(!k) return false;
    if(k==='treasure'){ run.pick=towerOffer(3); run.after='next'; save(); emit('change'); return {k} }
    // descanso: vida al máximo (si ya estaba llena, solo te ahorras el combate)
    if(k==='rest'){ const full=!(run.hp<1); run.hp=1; towerNext(); save(); emit('change'); return {k,full} }
    towerFight(k); return {k} }
  const boonRar=b=>b.t==='fx'?CFG.tower.fx[b.id].r:'L';
  function towerOffer(n,better){ const pool=boonPool(), o=[], P=CFG.tower.rarity[better?'better':'normal'];
    while(o.length<n&&pool.length){ let r=rand()*(P.C+P.R+P.L); const want=r<P.C?'C':r<P.C+P.R?'R':'L';
      let cand=pool.filter(b=>boonRar(b)===want); if(!cand.length) cand=pool; const b=cand[Math.floor(rand()*cand.length)];
      o.push(b); for(let i=pool.length-1;i>=0;i--) if(boonKey(pool[i])===boonKey(b)) pool.splice(i,1); } return o }
  function towerFight(k){ const T=CFG.tower, run=S.tower.run, f=run.floor, c=normalCurve(Math.max(1,Math.min(S.best||1,CAP())));
    const hm=T.hp0*Math.pow(T.hpG,f-1), am=T.atk0*Math.pow(T.atkG,f-1), h=heroStats();
    B={event:true,kind:'tower',node:k,t:0,boss:k==='boss',count:0,spawned:0,kills:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0};
    const add=(n,hpM,atkM,boss)=>{ for(let i=0;i<n;i++){ const at=CFG.enemy.walk*0.6+Math.floor(i/T.group)*1.2+(i%T.group)*0.35, hp=c.hp*hm*hpM;
      B.enemies.push({hp,max:hp,atk:c.atk*am*atkM,df:c.df,spawn:B.t,walk:at,arrive:at,next:at,first:false,dead:false,spd:boss?1:1+Math.min(0.3,f*0.01)}); } };
    if(k==='boss') add(1,T.boss.hp*Math.min(T.countMax,T.count0+Math.floor(f/T.countEvery)),T.boss.atk,true);
    else if(k==='elite') add(T.elite.n,T.elite.hp,T.elite.atk);
    else add(Math.min(T.countMax,T.count0+Math.floor(f/T.countEvery)),1,1);
    statsDirty(); HS=null; B.hp=heroStats().hp*Math.max(0.01,run.hp==null?1:run.hp);
    if(tfx('escudo')) BUF.shield=(BUF.shield||0)+CFG.tower.fx.escudo.shield*tfx('escudo')*heroStats().hp;   // Torre: Escudo inicial
    emit('eventStart',B); emit('change') }
  function towerEnd(won){ const run=S.tower.run, k=B.node, frac=Math.max(0,B.hp/heroStats().hp); B=null; statsDirty(); let res;
    if(won){ run.hp=Math.min(1,frac+CFG.tower.fx.aliento.heal*tfxRun('aliento')); run.pick=towerOffer(3,k==='elite'||k==='boss'); run.after='next'; if(k==='elite') run.extra=1; res={won:true,floor:run.floor,k,hp:run.hp} }
    else { run.lives--; run.hp=1; res={won:false,floor:run.floor,lives:run.lives} }
    save(); emit('towerEnd',res); startWave(); emit('change'); return res }
  // elegir mejora (o saltarla si no quedan); después, al siguiente piso
  const tfxRun=id=>(S.tower&&S.tower.run?S.tower.run.boons:[]).filter(b=>b.t==='fx'&&b.id===id).length;
  function towerPick(i){ const run=S.tower&&S.tower.run; if(!run||!run.pick) return false; const b=run.pick[i]; if(b) run.boons.push(b);
    if(b&&b.t==='fx'&&b.id==='aguante'){ const g=CFG.tower.fx.aguante.hp, m0=1+g*(tfxRun('aguante')-1); run.hp=Math.min(1,((run.hp==null?1:run.hp)*m0+g)/(m0+g)); }   // (se suma: cura la parte nueva)
    if(b&&b.t==='fx'&&b.id==='pacto'&&run.lives>1){ run.lives--; run.extra=(run.extra||0)+2; }
    if(run.extra){ run.extra--; run.pick=towerOffer(3); if(run.pick.length){ save(); emit('change'); return true } }
    run.pick=null; towerNext(); return true }
  function towerNext(){ const T=towerState(), run=T.run; run.floor++; const f=run.floor-1;
    let got=null; if(f>T.best){ T.best=f; for(const r of CFG.tower.rewards) if(f%r.every===0){ got=r.b; giveBundle(r.b); break } }
    run.nodes=towerNodes(run.floor); save(); if(got) emit('towerReward',{floor:f,b:got}); emit('change') }
  function towerBuyLife(){ const run=S.tower&&S.tower.run; if(!run) return false; const c=CFG.tower.lifeCost; if(!spend(c)) return false; run.lives++; save(); emit('change'); return true }
  // Ranking con rivales simulados (hasta que haya servidor): su puntuación sigue la curva de un jugador medio con tus días de juego
  const RIV={};
  function evRivals(d){ const key=d+'|'+S.startDay; if(RIV.k===key) return RIV.v; RIV.k=key; RIV.v=makeRivals(CFG.event,d*7919,d-(S.startDay==null?d:S.startDay)+1); return RIV.v }
  function makeRivals(V,seed,age){
    const r=mulberry32(seed+(S.startDay||0)*104729), c=V.curve;
    const seg=c.findIndex((p,i)=>i>0&&age<p[0]), i=seg<0?c.length-1:seg, [a,x]=c[i-1], [b,y]=c[i], base=(x+(y-x)*(Math.max(1,age)-a)/(b-a))*(V.rivalBase||1); // interpola (y extrapola tras el último punto)
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
    if(r){ S.evm+=r.em||0; if(r.ch) addChest(r.ch,r.n||1); }
    emit('change'); return p; }
  const evToday=()=>{ const d=evShownDay(); return S.evLog&&S.evLog.day===d?S.evLog.best:0 };

  /* ---------- jefe semanal ---------- */
  // Pelea de 1 minuto contra un jefe inmortal que pega cada vez más fuerte (golpea como el jefe de la fase n, y n sube de 1
  // hasta rampTo durante el minuto: 1-150 Normal, 151-300 Pesadilla…). Igual para todos. El ranking es SEMANAL y suma el daño
  // de todos tus intentos de la semana. 1 entrada gratis por semana; las demás, 1 Ticket Jefe (tienda). Premios el lunes a la 01:00 UTC.
  const weekKey=()=>Math.floor((dayKey()+3)/7);                 // semanas de lunes a domingo (el día 0 de 1970 fue jueves)
  const wbShownWeek=()=>evPaused()&&(dayKey()+3)%7===0?weekKey()-1:weekKey(); // el lunes de 00 a 01 aún se ve la semana que se cierra
  const weekLeft=()=>((weekKey()+1)*7-3-dayKey())*864e5-msOfDay()+(CFG.event.pauseH||0)*3600e3; // hasta el reparto (lunes 01:00)
  function wbPhase(t){ const W=CFG.wboss; return 1+(W.rampTo-1)*Math.min(1,t/W.dur) }
  function wbStats(n){ n=Math.max(1,Math.round(n)); const m=Math.min(MODES().length-1,Math.floor((n-1)/CAP())), c=modeCurve(m,n-m*CAP());
    return {atk:c.atk*CFG.wboss.atkMult, df:c.df} }
  function wbUpdate(){ const e=B.enemies[0]; if(!e) return; const s=wbStats(wbPhase(B.t)); e.atk=s.atk; e.df=s.df; }
  function addDmg(d){ B.dmg+=d; if(S.wbRun) S.wbRun.dmg=B.dmg; }
  // Entrada gratis: 1 a la semana (wbFree guarda la semana en que se usó). Las demás, con Ticket Jefe.
  const wbFreeLeft=()=>S.wbFree!==weekKey()?1:0;
  function wbStart(){
    if(!S||inEvent()||(S.bossTickets<1&&!wbFreeLeft())||evPaused()) return false;
    if(wbPending()) wbClaim();
    if(wbFreeLeft()) S.wbFree=weekKey(); else S.bossTickets--; const h=heroStats(), s=wbStats(1), V=CFG.event;
    S.wbRun={week:weekKey(),dmg:0};
    B={event:true,kind:'boss',t:0,boss:true,elite:true,count:0,spawned:1,kills:0,dmg:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0};
    B.enemies.push({hp:Infinity,max:Infinity,atk:s.atk,df:s.df,spawn:0,walk:V.walk,arrive:V.walk,next:V.walk,first:false,dead:false,immortal:true});
    save(); emit('eventStart',B); emit('change'); return true;
  }
  function wbFinish(dmg,died){
    const w=S.wbRun?S.wbRun.week:weekKey(); S.wbRun=null; dmg=Math.round(dmg||0);
    if(!S.wbLog||S.wbLog.week!==w){ if(S.wbLog&&S.wbLog.week<w&&wbPending()) wbClaim(); S.wbLog={week:w,dmg:0,runs:0,claimed:false}; }
    S.wbLog.dmg+=dmg; S.wbLog.runs++;
    return {kind:'boss',dmg,best:S.wbLog.dmg,runs:S.wbLog.runs,pos:wbRank(w,S.wbLog.dmg),died,week:w};
  }
  const RIVW={};
  function wbRivals(w){ const key=w+'|'+S.startDay; if(RIVW.k===key) return RIVW.v; RIVW.k=key;
    const end=w*7, age=end-(S.startDay==null?end:S.startDay)+1;           // días de juego a mitad de esa semana (jueves)
    RIVW.v=makeRivals(CFG.wboss,w*104723+17,Math.max(1,age)); return RIVW.v }
  const wbRank=(w,dmg)=>1+wbRivals(w).filter(x=>x.score>dmg).length;
  function wbReward(pos){ for(const r of CFG.wboss.rewards) if(pos<=r.to) return r; return null }
  function wbPending(){ const L=S.wbLog; if(!L||L.claimed||!L.dmg||L.week>=weekKey()) return null;
    if(L.week===weekKey()-1&&wbShownWeek()!==weekKey()) return null; // el lunes de 00 a 01 aún no
    if(S.wbRun&&S.wbRun.week===L.week) return null;
    const pos=wbRank(L.week,L.dmg); return {week:L.week,dmg:L.dmg,pos,rew:wbReward(pos)} }
  function wbClaim(){ const p=wbPending(); if(!p) return null; S.wbLog.claimed=true; const r=p.rew;
    if(r){ S.evm+=r.em||0; if(r.ch) addChest(r.ch,r.n||1); }
    emit('change'); return p; }
  const wbWeekDmg=()=>{ const w=wbShownWeek(); return S.wbLog&&S.wbLog.week===w?S.wbLog.dmg:0 };

  /* ---------- mejoras ---------- */
  function buyUpgrade(k){ const c=upCost(k); if(S.gold<c) return false; S.gold-=c; S.up[k]++; statsDirty(); track('upgrade',{k,n:1,gold:c}); emit('change'); return true }
  function buyMax(k){ let n=0, g=0; while(S.gold>=upCost(k)){g+=upCost(k);S.gold-=upCost(k);S.up[k]++;n++} if(n){statsDirty();track('upgrade',{k,n,gold:g});emit('change')} return n }
  function upgradeGain(k){ const g0=computeStats(); S.up[k]++; const g1=computeStats(); S.up[k]--; return g1[k]-g0[k] }

  /* ---------- armas ---------- */
  const rollVal=rg=>Math.round(rnd(rg[0],rg[1])*10)/10;
  function rollSecs(r,n,keep=[]){
    const out=[...keep], pool=Object.keys(CFG.sec).filter(k=>!out.some(s=>s.k===k));
    while(out.length<n){const i=Math.floor(rand()*pool.length);const k=pool.splice(i,1)[0];out.push({k,v:rollVal(CFG.sec[k][r])})}
    return out;
  }
  function newItem(cls,r){
    const it={id:S.nextId++,cls,r,lvl:1,sec:rollSecs(r,CFG.weapon[r][2]),refN:0,invested:0,fav:false};
    S.items.push(it); // nunca se equipa sola: lo decide el jugador
    return it;
  }
  function secQuality(list,r){return list.reduce((a,s)=>{const rg=CFG.sec[s.k][r];return a+(s.v-rg[0])/Math.max(0.01,rg[1]-rg[0])},0)}
  function fodderFor(it){ // armas iguales (misma clase y rareza) que se pueden gastar, peores primero; nunca una de más nivel
    return S.items.filter(x=>x.id!==it.id&&x.cls===it.cls&&x.r===it.r&&x.id!==S.equippedId&&!x.fav&&x.lvl<=it.lvl)
      .sort((a,b)=>(a.lvl-b.lvl)||(secQuality(a.sec,a.r)-secQuality(b.sec,b.r)));
  }
  const lvlCostItems=it=>it.lvl, lvlCostScrap=it=>it.lvl*CFG.weapon.scrapLvl[it.r];
  const findItem=id=>S.items.find(x=>x.id===id);
  function equip(id){ const it=findItem(id); if(!it||it.cls!==S.cls) return false; S.equippedId=id; statsDirty(); emit('change'); return true }
  function toggleFav(id){ const it=findItem(id); if(!it) return null; it.fav=!it.fav; emit('change'); return it.fav }
  function levelUp(id){
    const it=findItem(id); if(!it||it.lvl>=CFG.weapon.maxLvl) return {ok:false,why:'max'};
    const f=fodderFor(it), n=lvlCostItems(it), sc=lvlCostScrap(it);
    if(f.length<n) return {ok:false,why:'items',need:n};
    if(S.scrap<sc) return {ok:false,why:'scrap'};
    const used=f.slice(0,n), ids=new Set(used.map(x=>x.id));
    S.items=S.items.filter(x=>!ids.has(x.id));
    S.scrap-=sc; it.invested+=sc+n*CFG.weapon.scrapDis[it.r]+used.reduce((a,x)=>a+x.invested,0); it.lvl++;
    statsDirty(); save(); emit('change'); return {ok:true,lvl:it.lvl};
  }
  const disValue=it=>CFG.weapon.scrapDis[it.r]+Math.floor(CFG.weapon.refund*it.invested);
  // Desmontar por rareza (opcional: solo las de tu clase). Nunca la equipada ni las bloqueadas con ★.
  // cls: nombre de clase para solo esa clase (true = la tuya; vacío = todas)
  const byRarity=(r,cls)=>{ const k=cls===true?S.cls:cls||null; return S.items.filter(x=>x.r===r&&(!k||x.cls===k)&&x.id!==S.equippedId&&!x.fav) };
  function dismantleRarity(r,cls){ return dismantle(byRarity(r,cls).map(x=>x.id)) }
  function dismantle(ids){
    let v=0,n=0; const set=new Set(ids);
    S.items=S.items.filter(x=>{ if(set.has(x.id)&&x.id!==S.equippedId&&!x.fav){v+=disValue(x);n++;return false} return true});
    S.scrap+=v; if(n) save(); emit('change'); return {n,v};
  }
  // coste de reforja: sube un poco con cada reforja y se queda en un tope (base × reforgeCap)
  const reforgeCost=it=>{ const W=CFG.weapon; return Math.round(W.reforge[it.r]*Math.min(W.reforgeCap,1+W.reforgeStep*it.refN)) };
  // Bloqueos acumulables: uno se paga con chatarra (el doble) y otro con 1 token; con un solo bloqueo eliges cómo pagarlo.
  // Siempre queda al menos un stat por cambiar (con un solo stat, el bloqueo mantiene el stat y cambia su valor).
  const maxLocks=it=>{ const n=CFG.weapon[it.r][2]; return n===1?1:Math.min(2,n-1) };
  function reforgePrice(it,nl,pay){ const base=reforgeCost(it);
    if(nl>=2) return {scrap:base*2,tokens:1}; if(nl===1) return pay==='token'?{scrap:base,tokens:1}:{scrap:base*2,tokens:0}; return {scrap:base,tokens:0} }
  // locks: índices de los stats bloqueados (o un número; -1 = ninguno). pay: 'scrap' | 'token'. Devuelve la propuesta: el jugador elige quedársela o no.
  function reforge(id,locks,pay){
    const it=findItem(id); if(!it) return {ok:false};
    if(typeof locks==='number') locks=locks>=0?[locks]:[]; locks=[...new Set(Array.isArray(locks)?locks:[])].filter(i=>Number.isInteger(i)&&i>=0&&i<it.sec.length);
    if(locks.length>maxLocks(it)) return {ok:false,why:'locks'};
    if(pay!=='scrap'&&pay!=='token') return {ok:false,why:'pay'};
    const p=reforgePrice(it,locks.length,pay);
    if(S.scrap<p.scrap) return {ok:false,why:'scrap'};
    if(tokens()<p.tokens) return {ok:false,why:'token'};
    S.scrap-=p.scrap; spend(p.tokens); it.refN++;
    const n=CFG.weapon[it.r][2]; let nw;
    if(locks.length&&n===1){ const s=it.sec[0]; nw=[{k:s.k,v:rollVal(CFG.sec[s.k][it.r])}] }
    else { const kept=rollSecs(it.r,n,locks.map(i=>it.sec[i])); nw=it.sec.map((s,i)=>locks.includes(i)?s:null); // los bloqueados siguen en su sitio
      const fresh=kept.slice(locks.length); for(let i=0;i<n;i++) if(!nw[i]) nw[i]=fresh.shift(); }
    S.refPend={id,sec:nw}; save(); emit('change'); return {ok:true,sec:nw};
  }
  // Mejora automática: reforja solo el VALOR de un stat (no cambia de tipo) hasta que salga más alto.
  // Cada intento cuesta lo que una reforja normal (sin subir el coste de las siguientes). Para al mejorar, al llegar
  // al límite de gasto (maxSpend) o al quedarse sin chatarra.
  function improveOdds(id,idx){ const it=findItem(id); if(!it||!it.sec[idx]) return null; const s=it.sec[idx], rg=CFG.sec[s.k][it.r];
    // los valores se redondean a 0,1: sale más alto si el número sin redondear supera old+0,05
    const p=Math.max(0,Math.min(1,(rg[1]-(s.v+0.05))/(rg[1]-rg[0]))), cost=reforgeCost(it);
    return {p,cost,max:rg[1],v:s.v,exp:p>0?Math.ceil(1/p):Infinity,expSpend:p>0?Math.ceil(1/p)*cost:Infinity} }
  function improveStat(id,idx,maxSpend=Infinity){
    const it=findItem(id); if(!it||!Number.isInteger(idx)||!it.sec[idx]) return {ok:false,why:'item'};
    const s=it.sec[idx], rg=CFG.sec[s.k][it.r], old=s.v; if(old>=rg[1]) return {ok:false,why:'max'};
    const c=reforgeCost(it); let tries=0, spent=0;
    while(S.scrap>=c&&spent+c<=maxSpend){
      S.scrap-=c; spent+=c; tries++;
      const v=rollVal(rg); if(v>old){ s.v=v; statsDirty(); save(); emit('change'); return {ok:true,tries,spent,old,v,k:s.k} } }
    save(); emit('change'); return {ok:false,why:S.scrap<c?'scrap':'limit',tries,spent,old,k:s.k};
  }
  // Solo se puede aplicar la última propuesta de reforja de esa arma (nada de stats inventados)
  function applyReforge(id){ const p=S.refPend, it=findItem(id); if(!p||p.id!==id||!it) return false; it.sec=p.sec; S.refPend=null; statsDirty(); save(); emit('change'); return true }

  /* ---------- cofres ---------- */
  // La calidad de un cofre se decide al ABRIRLO, según tu récord de fase en ese momento
  // % del cofre según el modo actual (y, dentro del modo, el tramo de fase: [desde, %])
  function chestProbs(type,mode=S.mode,best=S.best){ const o=CFG.chests[type].odds, t=o[Math.min(mode,o.length-1)]; let p=t[0][1]; for(const [a,q] of t) if(Math.max(1,best)>=a) p=q; return p }
  function addChest(type,n){ S.chestInv[type]=(S.chestInv[type]||0)+n }
  const chestCount=type=>S.chestInv[type]||0;
  function openChest(type){ const r=pick(chestProbs(type)); return newItem(S.cls,r) }   // los cofres solo dan armas de tu clase
  // Inventario: como mucho weapon.invMax armas (la equipada NO cuenta: va en el Equipo). Para abrir X cofres hacen falta X huecos libres.
  const invMax=()=>(CFG.weapon.invMax||Infinity)+(S&&S.invBonus||0);   // + huecos comprados
  const invCount=()=>S.items.filter(x=>x.id!==S.equippedId).length;
  const invFree=()=>Math.max(0,invMax()-invCount());
  // all: true = todos, false = 1, número = ese número. Si no caben, no se abre ninguno (devuelve [] con .full)
  function openChests(type,all){
    let n=all===true?chestCount(type):typeof all==='number'?Math.min(all|0,chestCount(type)):Math.min(1,chestCount(type));
    const loot=[]; if(n>invFree()){ loot.full={need:n,free:invFree()}; return loot }
    while(n-->0){ S.chestInv[type]--; loot.push(openChest(type)); }
    if(!S.chestInv[type]) delete S.chestInv[type];
    if(loot.length){ const r={}; for(const x of loot) r[x.r]=(r[x.r]||0)+1; track('chests',{chest:type,n:loot.length,rar:r}); }
    save(); emit('change'); return loot;
  }
  /* ---------- tokens y tienda ---------- */
  // Tokens = dinero (100 tokens = 1 $). S.tokens: comprados (no se retiran). S.won: ganados en los pools (se pueden retirar).
  // Al gastar se usan primero los comprados. Todo es SIMULADO hasta que haya servidor y pasarela de pago.
  const tokens=()=>(S.tokens||0)+(S.won||0);
  function spend(n){ if(!(n>0)) return true; if(tokens()<n) return false;
    const a=Math.min(S.tokens,n); S.tokens-=a; S.won-=n-a; addSpent(n); emit('spend',n); return true }
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

  // Comprar un paquete de tokens con dinero (simulado)
  // Compra y retiro de PRUEBA: solo con las herramientas de prueba (en local). En la versión publicada, hasta tener pagos reales, no se puede.
  function buyTokens(n){ if(!CFG.devTools||!CFG.tokens.packs.includes(n)) return false; n+=(CFG.tokens.bonus||{})[n]||0; S.tokens+=n; S.stats.deposited+=n; track('deposit',{tokens:n,usd:n/CFG.tokens.perUsd}); save(); emit('change'); return true }
  // Retirar tokens ganados: comisión y mínimo (simulado: no mueve dinero real)
  function withdraw(n){ const W=CFG.tokens.withdraw; n=Math.floor(n); if(!CFG.devTools) return {ok:false,why:'off'};
    if(!(n>=W.min)||n>S.won) return {ok:false,why:n>S.won?'won':'min'};
    const fee=Math.ceil(n*W.fee); S.won-=n; S.withdrawn=(S.withdrawn||0)+n; S.stats.withdrawNet+=(n-fee)/CFG.tokens.perUsd;
    track('withdraw',{tokens:n,fee,usd:(n-fee)/CFG.tokens.perUsd}); save(); emit('change');
    return {ok:true,n,fee,usd:(n-fee)/CFG.tokens.perUsd} }
  // Cofre de plata: se paga con ORO. Precio base = el oro de goldMin minutos farmeando tu récord; cada compra del día
  // lo sube un step (×(1+step·n), n = comprados hoy) y vuelve al base cada día. perDay: máximo al día (null = sin límite).
  const silverToday=()=>S.silverDay&&S.silverDay.d===dayKey()?S.silverDay.n:0;
  const silverBase=()=>Math.max(10,farmRate(Math.max(1,S.best)).g*60*CFG.chests.silver.goldMin);
  const silverPrice=(k=0)=>Math.round(silverBase()*(1+(CFG.chests.silver.step||0)*(silverToday()+k)));   // precio del siguiente (+k)
  const silverCost=n=>{ let c=0; for(let k=0;k<n;k++) c+=silverPrice(k); return c };
  const silverLeft=()=>CFG.chests.silver.perDay==null?Infinity:CFG.chests.silver.perDay-silverToday();
  const silverMax=()=>{ let n=0, c=0; while(n<silverLeft()&&n<1000){ c+=silverPrice(n); if(c>S.gold) break; n++ } return n };   // cuántos te puedes permitir
  function buySilver(n){ n=n|0; if(n<1||n>silverLeft()) return false; const c=silverCost(n); if(S.gold<c) return false;
    S.gold-=c; if(!S.silverDay||S.silverDay.d!==dayKey()) S.silverDay={d:dayKey(),n:0}; S.silverDay.n+=n; addChest('silver',n); track('buy',{item:'silver',n,gold:c}); save(); emit('change'); return true }
  const shopPrice=k=>({ess:(CFG.matShop||{}).ess, ev:(CFG.matShop||{}).ev, mode:CFG.chests.mode.price, ticket:CFG.event.ticketCost, bossTicket:CFG.wboss.ticketCost, card:CFG.cardPrice, vip:CFG.vipPrice})[k];
  function buy(k,n){
    n=n|0; if(n<1) return false; if(k==='silver') return buySilver(n); const unit=shopPrice(k); if(unit==null) return false;
    if((k==='card'||k==='vip')&&n!==1) return false;
    if(!spend(unit*n)) return false;
    if(k==='mode') addChest('mode',n);
    else if(k==='ticket') S.tickets+=n;
    else if(k==='bossTicket') S.bossTickets+=n;
    else if(k==='ess') S.mats[0]=(S.mats[0]||0)+n;               // esencia (de Normal)
    else if(k==='ev') S.evm+=n;                                   // emblema
    else if(k==='card') S.cardUntil=Math.max(S.cardUntil,dayKey())+30;
    else if(k==='vip') S.vipUntil=Math.max(S.vipUntil,dayKey())+30;
    track('buy',{item:k,n,tokens:unit*n}); save(); emit('change'); return true;
  }

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
  function farmRate(f){
    const h=computeStats(), per=perWave(f), grp=groupAt(f), sp=eSpd(f);
    let t=0; for(let w=1;w<=10;w++){ const e=enemyStats(f,w,false);
      // golpes para matar a cada uno (con el extra medido: quemaduras, área…) + lo que se pierde de media al rematar (0,6 golpes)
      const hit=dmgF(h.atk,e.df)*(1+h.cr*h.cd)*dpsK(h), K=Math.max(1,e.hp/hit+0.6)/h.spd, W=CFG.enemy.walk/sp*(h.ranged?1:(CFG.enemy.dash||1));
      // a distancia se dispara mientras se acercan; cuerpo a cuerpo cada enemigo sale cuando el anterior llega y hay que esperarlo (menos si salen varios a la vez)
      t+=(h.ranged?per*K:W+K+(per-1)*Math.max(W/grp,K)) + CFG.delays.wave; }
    return {g:goldAt(f)*3*10*(hasCard()?1+CFG.cardGold:1)/t, x:xpAt(f)*(3+(CFG.econ.waveXp||0))*10*h.xpMult/t};
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
    const g=r.g*el, x=r.x*el; S.gold+=g; addGoldH(g); addXp(x); grimXp(el);   // el grimorio también gana tiempo sin conexión S.stats.offGold+=g; track('offline',{secs:Math.round(el),gold:g});
    const capped=raw>=cap; if(capped&&offlineAdLeft()>0) S.offBonus=g*(CFG.offlineAdMult-1);
    emit('change');
    return {secs:el,fase:f,gold:g,xp:x,lvlFrom:l0,lvlTo:S.lvl,capped,bonus:S.offBonus||0};
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
  function grimCost(){ const c=GC().cost; return {gold:goldH(c.goldH),ess:c.ess,ev:c.ev} }
  const grimPack=()=>GC().pack;
  const missOf=c=>{ const o={}; if(S.gold<c.gold) o.gold=c.gold-S.gold; if((S.mats[0]||0)<c.ess) o.ess=c.ess-(S.mats[0]||0); if(S.evm<c.ev) o.ev=c.ev-S.evm; return o };
  const grimMissing=()=>missOf(grimCost());
  function grimGet(how){ grimState().lvl=1; grimState().xp=0; track('grimoire',{how}); save(); emit('change'); return {ok:true} }
  function grimUnlock(){ if(grimOwned()) return {ok:false,why:'owned'}; if(Object.keys(grimMissing()).length) return {ok:false,why:'cost'};
    const c=grimCost(); S.gold-=c.gold; S.mats[0]-=c.ess; S.evm-=c.ev; return grimGet('recursos') }
  function grimBuy(){ if(grimOwned()) return {ok:false,why:'owned'}; if(!spend(grimPack())) return {ok:false,why:'tokens'}; return grimGet('tokens') }
  // siguiente subida: tiempo que falta y recursos
  function grimUpInfo(){ const G=grimState(); if(!G.lvl||grimDone()) return null; const u=GC().up[G.lvl-1];
    const cost={gold:goldH(u.goldH),ess:u.ess,ev:u.ev}; return {to:G.lvl+1,xp:G.xp,need:u.secs,ready:G.xp>=u.secs,cost,missing:missOf(cost)} }
  function grimXp(secs){ const G=S&&S.grim; if(!G||!G.lvl||G.lvl>=GC().levels) return; const u=GC().up[G.lvl-1]; G.xp=Math.min(u.secs,G.xp+secs) }
  function grimUp(){ const u=grimUpInfo(); if(!u) return {ok:false,why:'max'}; if(!u.ready) return {ok:false,why:'xp'}; if(Object.keys(u.missing).length) return {ok:false,why:'cost'};
    S.gold-=u.cost.gold; S.mats[0]-=u.cost.ess; S.evm-=u.cost.ev; const G=grimState(); G.lvl++; G.xp=0; track('grimoire',{how:'nivel',lvl:G.lvl}); save(); emit('change'); return {ok:true,lvl:G.lvl} }
  // pasiva de grimorio en combate: la del camino B, si se eligió
  function grimFx(){ if(!S||!(S.evo>=1)||S.path!=='B') return null; const a=(evoTiers()[0].alt||{})[S.cls]; return a&&a.grim||null }
  // los 2 caminos de la 1.ª evolución
  function evoPaths(){ const t=evoTiers()[0]; return {A:t.classes[S.cls],B:(t.alt||{})[S.cls]} }
  // cambiar de camino (tras evolucionar): cuesta tokens
  function pathSwitch(){ if(!(S.evo>=1)) return {ok:false,why:'evo'}; if(inEvent()) return {ok:false,why:'event'}; if(!spend(GC().switchCost)) return {ok:false,why:'tokens'};
    S.path=S.path==='B'?'A':'B'; S.dpsM=null; EPk=''; statsDirty(); track('path',{path:S.path}); save(); emit('change'); return {ok:true,path:S.path} }

  /* ---------- premios del servidor (referidos) ---------- */
  // El servidor manda premios pendientes: 'silver' = cofres de plata, 'won' = tokens ganados (retirables)
  function applyRewards(list){ const out=[]; if(!S||!Array.isArray(list)) return out;
    for(const r of list){ const n=Math.floor(+r.amount); if(!(n>0)) continue;
      if(r.kind==='silver') addChest('silver',Math.min(n,100)); else if(r.kind==='won') S.won+=n;
      else if(r.kind==='tokens'){ S.tokens+=n; S.stats.deposited+=n; track('deposit',{tokens:n,stars:n*CFG.stars.perToken}); }   // compra con Stars
      else if(r.kind==='first'){ const F=CFG.stars.first; if(S.firstBuy) continue; S.firstBuy=true; newItem(S.cls,F.r); S.tokens+=F.tokens; S.stats.deposited+=F.tokens; addChest('silver',F.silver); }
      else if(r.kind==='pass'){ S.passPrem=Math.max(S.passPrem||0,n); }   // pase de pago de la temporada n
      else if(r.kind==='offer_inv'){ S.invBonus=(S.invBonus||0)+CFG.offers.inv.inv; }
      else if(/^offer_(wall|evo)$/.test(r.kind)){ giveBundle(CFG.offers[r.kind.slice(6)].b); }
      else continue;
      out.push({kind:r.kind,amount:n,reason:r.reason}); }
    if(out.length){ track('reward',{list:out}); save(); emit('change'); } return out }

  /* ---------- misiones diarias, calendario de 7 días y pase de temporada ---------- */
  // Premios: {gold: minutos de farmeo de tu récord, silver, wood, mode, ess, ev, ticket, bossTicket}
  function giveBundle(b){ if(!b) return; if(b.gold) S.gold+=Math.max(20,farmRate(Math.max(1,S.best)).g*60*b.gold);
    for(const k of ['silver','wood','mode']) if(b[k]) addChest(k,b[k]);
    if(b.ess) S.mats[0]=(S.mats[0]||0)+b.ess; if(b.ev) S.evm+=b.ev; if(b.ticket) S.tickets+=b.ticket; if(b.bossTicket) S.bossTickets+=b.bossTicket;
    if(b.tok) S.tokens+=b.tok; if(b.item) newItem(S.cls,b.item); }   // tok: tokens (como comprados) · item: arma de tu clase de esa rareza
  // misiones del día: progreso guardado en S.daily (se renueva cada día; los enemigos se cuentan desde el inicio del día)
  function daily(){ const d=dayKey(); if(!S.daily||S.daily.d!==d) S.daily={d,k0:S.kills||0,p:{},c:{}}; return S.daily }
  function misBump(k,n){ if(!S) return; const D=daily(); D.p[k]=(D.p[k]||0)+n; const W=weekly(); W.p[k]=(W.p[k]||0)+n }
  // misiones de la semana (lunes a domingo): mismo sistema que las diarias
  function weekly(){ const w=weekKey(); if(!S.weekly||S.weekly.w!==w) S.weekly={w,k0:S.kills||0,p:{},c:{}}; return S.weekly }
  function weekMissions(){ const W=weekly(), L=(CFG.missions.weekly||{}).list||[]; return L.map(m=>{ const v=m.k==='kills'?(S.kills||0)-W.k0:(W.p[m.k]||0);
    return {...m,prog:Math.min(m.n,v),done:v>=m.n,claimed:!!W.c[m.k]} }) }
  function claimWeekly(k){ const m=weekMissions().find(x=>x.k===k); if(!m||!m.done||m.claimed) return null; const M=CFG.missions.weekly;
    const xp=m.xp||M.xp; weekly().c[k]=true; giveBundle(m.rew||{}); passAddXp(xp); track('weekly',{k}); save(); emit('change'); return {...(m.rew||{}),xp} }
  // bonus por completar todas: diarias (missions.bonus) y semanales (missions.weekly.bonus); una vez por día / semana
  const bonusState=kind=>{ const box=kind==='week'?weekly():daily(), L=kind==='week'?weekMissions():missions(); return {can:L.every(m=>m.claimed)&&!box.bonus,got:!!box.bonus,b:kind==='week'?CFG.missions.weekly.bonus:CFG.missions.bonus} };
  function claimBonus(kind){ const st=bonusState(kind); if(!st.can) return null; (kind==='week'?weekly():daily()).bonus=true; giveBundle(st.b); track('misBonus',{kind}); save(); emit('change'); return st.b }
  // ruleta diaria: 1 tirada gratis + 1 con anuncio por día
  function wheelState(){ const d=dayKey(); if(!S.wheel||S.wheel.d!==d) S.wheel={d,free:false,ad:false}; return {free:!S.wheel.free,ad:!S.wheel.ad,list:CFG.wheel} }
  function spinWheel(viaAd){ const st=wheelState(); if(viaAd?!st.ad:!st.free) return null; if(viaAd){ S.wheel.ad=true; addAd(); } else S.wheel.free=true;
    const L=CFG.wheel, tot=L.reduce((a,x)=>a+x.w,0); let r=rand()*tot, i=0; for(;i<L.length-1;i++){ r-=L[i].w; if(r<0) break; }
    giveBundle(L[i].b); track('wheel',{i,ad:!!viaAd}); save(); emit('change'); return {i,b:L[i].b} }
  const weeklyReady=()=>weekMissions().filter(m=>m.done&&!m.claimed).length+(bonusState('week').can?1:0);
  function misHook(type,d){ if(!S) return; if(type==='upgrade') misBump('upgrade',d.n||1); else if(type==='chests') misBump('chests',d.n||1) }
  function missions(){ const D=daily(); return CFG.missions.list.map(m=>{ const v=m.k==='kills'?(S.kills||0)-D.k0:(D.p[m.k]||0);
    return {...m,prog:Math.min(m.n,v),done:v>=m.n,claimed:!!D.c[m.k]} }) }
  function claimMission(k){ const m=missions().find(x=>x.k===k); if(!m||!m.done||m.claimed) return null; const M=CFG.missions;
    daily().c[k]=true; if(missions().every(x=>x.claimed)){ const W=weekly(); W.p.alldays=(W.p.alldays||0)+1; } giveBundle(m.rew||{}); passAddXp(m.xp||M.xp); track('mission',{k}); save(); emit('change'); return {...(m.rew||{}),xp:m.xp||M.xp} }
  const missionsReady=()=>missions().filter(m=>m.done&&!m.claimed).length+(bonusState('day').can?1:0);
  // calendario: un premio por día que entras (no hace falta seguidos)
  function calState(){ const c=S.cal||{n:0,last:null}, L=CFG.calendar; return {day:c.n%L.length+1,can:c.last!==dayKey(),list:L} }
  function claimCal(){ const st=calState(); if(!st.can) return null; const b=CFG.calendar[st.day-1]; S.cal={n:(S.cal?S.cal.n:0)+1,last:dayKey()};
    giveBundle(b); track('calendar',{day:st.day}); save(); emit('change'); return b }
  // pase: temporadas de 30 días (las mismas para todos: día UTC / 30). Nivel = XP / 100. Premios gratis y de pago por nivel.
  const passSeason=()=>Math.floor(dayKey()/CFG.pass.days);
  function passS(){ const s=passSeason(); if(!S.pass||S.pass.s!==s) S.pass={s,xp:0,cf:{},cp:{}}; return S.pass }
  function passAddXp(n){ passS().xp+=n }
  function passReward(L,prem){ const top=CFG.pass.levels;
    const C=CFG.pass, tk=C.tok&&L%C.tok.every===0?{tok:C.tok.n}:{};
    if(!prem) return L===top?{item:C.item.free,mode:1}:L%10===0?{mode:1}:L%5===0?{silver:2}:L%2===0?{wood:2}:{gold:30};
    return L===top?{item:C.item.prem,mode:3,ess:5,ev:10,...tk}:L%10===0?{mode:2,ess:2,...tk}:L%5===0?{ticket:1,bossTicket:1,ev:3}:L%2===0?{silver:2,ev:1}:{silver:1,wood:1} }
  function passState(){ const P=passS(), C=CFG.pass, lvl=Math.min(C.levels,Math.floor(P.xp/C.xp));
    return {season:P.s,xp:P.xp,lvl,into:P.xp-lvl*C.xp,need:C.xp,prem:(S.passPrem||0)===P.s,daysLeft:C.days-dayKey()%C.days,cf:P.cf,cp:P.cp} }
  function claimPass(L,prem){ const st=passState(); if(!(L>=1&&L<=st.lvl)) return null; if(prem&&!st.prem) return null;
    const box=prem?passS().cp:passS().cf; if(box[L]) return null; box[L]=1; const b=passReward(L,prem); giveBundle(b); track('pass',{L,prem:!!prem}); save(); emit('change'); return b }
  function claimPassAll(){ const st=passState(); let n=0; for(let L=1;L<=st.lvl;L++){ if(claimPass(L,false)) n++; if(st.prem&&claimPass(L,true)) n++; } return n }
  const passReady=()=>{ const st=passState(); let n=0; for(let L=1;L<=st.lvl;L++){ if(!st.cf[L]) n++; if(st.prem&&!st.cp[L]) n++; } return n };

  /* ---------- ofertas en el momento justo ---------- */
  // offerCheck(): mira si toca una oferta nueva (la activa 24 h) y la devuelve para que la pantalla la enseñe
  function offerCheck(){ if(!S||(B&&B.event)) return null; const O=CFG.offers, t=nowFn(); S.offers=S.offers||{}; if(!S.bestAt) S.bestAt=t;
    const want={ wall:t-S.bestAt>O.wall.hours*3600e3, evo:evoLvlOk()&&!canEvolve(), inv:invFree()===0&&(S.invBonus||0)<O.inv.inv*O.inv.max };
    for(const k in want){ const o=S.offers[k]||{}; if(want[k]&&!(o.until>t)&&!(o.next>t)){ S.offers[k]={until:t+O.dur*3600e3,next:t+O.cool*3600e3}; save(); track('offer',{k}); return k } }
    return null }
  const activeOffers=()=>{ const t=nowFn(); return Object.entries(S&&S.offers||{}).filter(([k,o])=>o.until>t).map(([k,o])=>({k,left:o.until-t,...CFG.offers[k]})) };

  /* ---------- ajustes y pruebas ---------- */
  function setOpt(k,v){ S.opt=S.opt||{}; S.opt[k]=v; emit('change') }
  function dev(k){
    if(!CFG.devTools) return;
    if(k==='gold') S.gold+=Math.max(100,farmRate(Math.max(1,S.best)).g*3600);
    if(k==='tok') S.tokens+=100; if(k==='ticket') S.tickets++; if(k==='bossTicket') S.bossTickets++; if(k==='scrap') S.scrap+=100; if(k==='wood') addChest('wood',10); if(k==='day') S.devDays=(S.devDays||0)+1;
    emit('change');
  }

  return {
    // estado
    get S(){return S}, get B(){return B}, CFG, R, CLASSES, on, save, load, reset, packed, newGame, setName, validName, cleanName, startWave, dayKey, rand,
    // fórmulas
    hasCard, hasVip, equipped, weaponMain, heroStats, dpsK, computeStats, statsDirty, enemyStats, xpReq, upCost, upgradeGain, farmRate,
    // combate
    step, setAuto, goFase,
    // mejoras
    buyUpgrade, buyMax,
    // evento
    claimLoot, bossScrap, autoLoot:()=>{const a=autoLoot;autoLoot=null;return a}, autoEvent:()=>{const a=autoEvent;autoEvent=null;return a}, inEvent, evPhase, evRamp:()=>B&&B.event&&B.kind!=='boss'?evRamp():null, evPaused, evPauseLeft, evShownDay, startEvent, evFreeLeft, wbStart, wbFreeLeft, wbRivals, wbRank, wbReward, wbPending, wbClaim, wbWeekDmg, wbShownWeek, weekKey, weekLeft, wbPhase, endEvent, evRivals, evRank, evReward, evPending, claimEvent, evToday,
    // evolución
    canAdvanceMode, advanceMode, modeLocked, modeCfg, top, goldAt, missions, claimMission, missionsReady, weekMissions, claimWeekly, weeklyReady, towerState, towerStart, towerAbandon, towerGo, towerPick, towerBuyLife, boonInfo, towerOn, wheelState, spinWheel, surpriseState, streak:()=>({n:STK.n,mul:streakMul()}), bonusState, claimBonus, legendFx, grimFx, grimDone, grimName, grimUpInfo, grimUp, grimXp, evoPaths, pathSwitch, evoKeyOk, skills, useSkill, manualSkills, skillDef, offerCheck, activeOffers, calState, claimCal, passState, passReward, claimPass, claimPassAll, passReady,
    canEvolve, evolve, rollMat, matOdds, evoCost, evoMissing, evoLvlOk, evoP, nextEvo, lvlCap,
    // armas
    findItem, equip, toggleFav, levelUp, dismantle, disValue, fodderFor, lvlCostItems, lvlCostScrap, reforge, reforgeCost, reforgePrice, maxLocks, improveStat, improveOdds, applyReforge, secQuality,
    // cofres y tienda
    chestProbs, addChest, chestCount, openChests, invFree, invMax, invCount, byRarity, dismantleRarity, buy, shopPrice, silverPrice, silverCost, silverMax, silverLeft, tokens, leagueNow, leaguePending, leagueClaim, monthKey, spend, buyTokens, withdraw,
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
