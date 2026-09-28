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
  const track=(type,data)=>emit('track',{type,...(data||{})});

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
      lastSeen:nowFn(),devDays:0,speed:1,kills:0,boostMs:0,ads:null,evo:0,absorb:{},mode:0,mats:{},tickets:0,evm:0,evLog:null,loot:null,evRun:null,maxDay:0,refPend:null,silverDay:null,bossTickets:0,wbLog:null,wbRun:null,evFree:null,wbFree:null,league:null,leagueLast:null,grim:{owned:{},active:null},
      stats:{deposited:0,withdrawNet:0,adGold:0,ads:0,offGold:0}}; // registro para la base de datos: tokens comprados, $ retirados (neto), oro de anuncios, anuncios vistos, oro sin conexión
  }
  function migrate(st){ // pone al día partidas guardadas con versiones anteriores (rellena todo campo que falte y limpia números rotos)
    if(!st||!CFG.classes[st.cls]) return null;
    const d=newState(st.cls);
    for(const k in d) if(st[k]===undefined) st[k]=d[k];
    st.up={...d.up,...(st.up||{})}; st.stats={...d.stats,...(st.stats||{})}; for(const k in st.up) if(!Number.isFinite(st.up[k])) st.up[k]=0;
    for(const k of ['gold','tokens','won','withdrawn','scrap','xp','lvl','best','fase','wave','tickets','bossTickets','evm','kills','boostMs','evo','mode','nextId','cardUntil','vipUntil'])
      if(!Number.isFinite(st[k])) st[k]=d[k];
    st.lvl=Math.max(1,st.lvl|0); st.fase=Math.max(1,st.fase|0); st.wave=Math.min(10,Math.max(1,st.wave|0));
    st.chestInv=st.chestInv||{}; st.opt=st.opt||{}; st.items=Array.isArray(st.items)?st.items.map(unpackItem).filter(Boolean):[]; st.mats=st.mats||{};
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
  const heroStats=()=>HS||(HS=computeStats());
  function computeStats(){
    const c=CFG.classes[S.cls], L=S.lvl-1, u=S.up, U=CFG.upgrades, w=equipped(), ps={...(c.p||{}),...evoBase()}, A=S.absorb||{};
    const sec={hpp:0,dfp:0,cr:0,cd:0,ls:0,bd:0}; let wd=0,ws=0;
    if(w){const m=weaponMain(w);wd=m.d;ws=m.s;for(const s of w.sec) sec[s.k]+=s.v/100;}
    return {
      // hpK/dfK: cuánto más pequeñas son la vida y la defensa que con el crecimiento antiguo (ref). El robo de vida,
      // el Aura del Santo y el daño por defensa del Titán se escalan con ellas para que sigan valiendo lo mismo.
      hpK:Math.pow(U.hp.mult/(U.hp.ref||U.hp.mult),u.hp), dfK:Math.pow(U.df.mult/(U.df.ref||U.df.mult),u.df),
      hp:(c.hp+(A.hp||0)+c.ghp*L)*Math.pow(U.hp.mult,u.hp)*(1+sec.hpp)*evoBonus('hp'),
      atk:(c.atk+(A.atk||0)+c.gatk*L)*Math.pow(U.atk.mult,u.atk)*(1+wd)*evoBonus('atk'),
      df:(c.df+(A.df||0)+c.gdf*L)*Math.pow(U.df.mult,u.df)*(1+sec.dfp),
      spd:c.spd*(ps.spd||1)*Math.pow(U.spd.mult,u.spd)*(1+ws),
      cr:Math.min(CFG.caps.cr,c.cr+(ps.cr||0)+sec.cr), cd:c.cd+(ps.cd||0)+sec.cd, ev:c.ev,
      ls:Math.min(CFG.caps.ls,sec.ls), bd:sec.bd, ranged:c.ranged,
      regen:ps.regen||0, dmgTaken:ps.dmgTaken||1, xpMult:ps.xp||1,
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
    if(boss){ const per=perWave(f), M=modeCfg();
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
  const perWave=f=>3+Math.floor((f-1)/CFG.enemy.extraEvery);
  // mientras quede una evolución pendiente, el nivel no pasa de evo.lvl (la barra se queda llena)
  const evoTiers=()=>(CFG.evo&&CFG.evo.tiers)||[];
  const nextEvo=()=>evoTiers()[S.evo]||null;              // la próxima evolución (o null si ya no quedan)
  const lvlCap=()=>{ const t=nextEvo(); return t?t.lvl:Infinity };
  function addXp(x){ const l0=S.lvl, cap=lvlCap(); S.xp+=x; while(S.lvl<cap&&S.xp>=xpReq(S.lvl)){S.xp-=xpReq(S.lvl);S.lvl++}
    if(S.lvl>=cap) S.xp=Math.min(S.xp,xpReq(S.lvl)); if(S.lvl>l0){statsDirty();emit('level',S.lvl)} return S.lvl-l0 }

  /* ---------- combate ---------- */
  function startWave(){
    if(B&&B.event) return; // el evento en curso no se interrumpe
    // jefe: al empujar una fase múltiplo de 10; y el de la fase 150 se puede repetir (farmear) una vez vencido
    const boss=(S.wave===10 && S.fase%10===0 && (S.fase===S.best+1 || (S.fase===CAP() && S.best>=CAP())));
    const h=heroStats();
    B={t:0,boss,elite:boss&&S.fase%50===0,count:boss?1:perWave(S.fase),spawned:0,enemies:[],hp:h.hp,th:null,over:false,wait:0,mD:0,mB:0};
    spawnEnemy(); emit('wave',B);
  }
  function spawnEnemy(){
    const e=enemyStats(S.fase,S.wave,B.boss), W=CFG.enemy.walk; // (enemyStats ya aplica el modo)
    B.enemies.push({hp:e.hp,max:e.hp,atk:e.atk,df:e.df,spawn:B.t,arrive:B.t+W,next:B.t+W,first:true,dead:false});
    B.spawned++;
  }
  function endWave(delay){ B.over=true; B.wait=delay }
  // Avanza el combate dt segundos de juego.
  function step(dt){
    if(!S||!B) return;
    if(B.over){ B.wait-=dt; if(B.wait<=0) startWave(); return }
    const h=heroStats(), P=evoP();
    B.t+=dt;
    if(B.event&&B.kind==='boss'){ if(B.t>=CFG.wboss.dur||(S.wbRun&&S.wbRun.week<weekKey()&&!evPaused())){ endEvent(); return } wbUpdate(); }
    else if(B.event){ if(B.t>=CFG.event.dur||(S.evRun&&S.evRun.day<dayKey()&&!evPaused())){ endEvent(); return } evSpawn(); } // un intento de ayer se cierra al acabar la pausa
    // curación: lo que de verdad se recupera (Santo: cada curación se convierte en daño en área durante unos segundos)
    // solo la regeneración (Fe) alimenta el aura; lo curado se pasa a la escala antigua (÷ hpK) para que el aura siga pegando igual
    const heal=(x,aura)=>{ const b=B.hp; B.hp=Math.min(h.hp,B.hp+x); const got=B.hp-b; if(aura&&got>0&&P&&P.aura) B.auraPool=(B.auraPool||0)+got*P.aura/h.hpK; };
    if(h.regen){ const lit=P&&P.lightMult&&B.t<(B.lightUntil||0); heal(h.regen*(lit?P.lightMult:1)*h.hp*dt,true); }
    const kill=e=>{ if(e.dead) return; e.dead=true;
      if(B.event){ B.kills++; if(S.evRun) S.evRun.kills=B.kills; return } onKill(); if(e.first&&B.spawned<B.count){e.first=false;spawnEnemy()} };
    if(B.auraPool>0){ const d=B.auraPool*Math.min(1,dt/P.auraDur); B.auraPool-=d;                    // Santo: aura sagrada (en área)
      for(const e of B.enemies){ if(e.dead||e.arrive>B.t) continue; const dd=d*(B.boss?1+h.bd:1); e.hp-=dd; B.auraDmg=(B.auraDmg||0)+dd; B.mD+=dd; if(B.kind==='boss') addDmg(dd); if(e.hp<=0) kill(e); } }
    if(P&&P.burnPct) for(const e of B.enemies){ // Archimago: quemaduras (cada acumulación hace burnPct del daño por segundo)
      if(e.dead||!e.burn) continue; e.burn=e.burn.filter(u=>u>B.t); if(!e.burn.length) continue;
      const d=e.burn.length*P.burnPct*h.atk*dt; e.hp-=d; B.burnDmg=(B.burnDmg||0)+d; B.mD+=d; if(B.kind==='boss') addDmg(d); if(e.hp<=0) kill(e); }
    const hitOnce=tg=>{
      let d=dmgF(h.atk+(P&&P.defDmg?P.defDmg*h.df/h.dfK:0),tg.df)*(B.boss?1+h.bd:1), crit=false; // Titán: daño extra según su defensa (en la escala antigua)
      if(P&&P.rage) d*=1+Math.min(P.rageCap,(B.rage||0)*P.rage);        // Berserker: furia por golpes recibidos
      if(P&&P.dblBuff&&B.dblSt){ B.dblSt=B.dblSt.filter(u=>u>B.t); d*=1+P.dblBuff*B.dblSt.length; } // Ojo de Halcón: racha tras disparo doble
      if(B.critBuff){ d*=1+P.critNext; B.critBuff=false; }                // Sombra: golpe potenciado tras un crítico
      if(rand()<h.cr+(B.critAcc||0)){ d*=1+h.cd; crit=true; B.critAcc=0; if(P&&P.critNext) B.critBuff=true; }
      else if(P&&P.critStack) B.critAcc=Math.min(P.critStackMax||1,(B.critAcc||0)+P.critStack); // Segador: cada golpe sin crítico suma probabilidad de crítico
      tg.hp-=d; B.mD+=d; heal(d*h.ls*h.hpK); if(B.kind==='boss') addDmg(d);   // robo de vida: cura la misma parte de tu vida máxima que antes
      if(P&&P.burnPct){ tg.burn=tg.burn||[]; if(tg.burn.length>=P.burnMax) tg.burn.shift(); tg.burn.push(B.t+P.burnDur); }
      emit('hit',{e:tg,d,crit,ranged:h.ranged});
      if(tg.hp<=0) kill(tg);
    };
    const canHit=e=>!e.dead&&((h.ranged&&!B.event)||e.arrive<=B.t); // en el evento nadie dispara antes de que llegue (igual para todas las clases)
    if(B.enemies.some(canHit)){
      if(B.th===null) B.th=B.t;
      while(B.t>=B.th){
        const cand=B.enemies.filter(canHit);
        if(!cand.length){B.th=null;break}
        const tg=cand.reduce((a,b)=>a.arrive<=b.arrive?a:b);
        B.mB+=dmgF(h.atk,tg.df)*(B.boss?1+h.bd:1)*(1+h.cr*h.cd);   // lo que diría la fórmula por ataque (para medir el DPS real)
        hitOnce(tg);
        if(P&&P.double&&!tg.dead&&rand()<P.double){ hitOnce(tg); if(P.dblBuff){ B.dblSt=(B.dblSt||[]).filter(u=>u>B.t); if(B.dblSt.length<P.dblMax) B.dblSt.push(B.t+P.dblDur); } } // Tirador: disparo doble
        B.th+=1/h.spd;
      }
    } else B.th=null;
    for(const e of B.enemies){
      if(e.dead||e.arrive>B.t) continue;
      while(B.t>=e.next){
        if(rand()>=h.ev){ const d=dmgF(e.atk,h.df)*h.dmgTaken; B.hp-=d; emit('heroHit',{d});
          if(P&&P.rage) B.rage=(B.rage||0)+1;
          if(P&&P.lightMult&&!B.lightUsed&&B.hp>0&&B.hp<P.lightHp*h.hp){ B.lightUsed=true; B.lightUntil=B.t+P.lightDur; } } // Oráculo: luz interior
        else emit('dodge');
        e.next+=1/CFG.enemy.spd;
        if(e.first){e.first=false;if(B.spawned<B.count)spawnEnemy()}
        if(B.hp<=0){ if(B.event) endEvent(); else lose(); return }
      }
    }
    if(B.event){ if(B.enemies.length>40) B.enemies=B.enemies.filter(e=>!e.dead); return }
    if(B.spawned>=B.count && B.enemies.every(e=>e.dead)) waveClear();
  }
  function onKill(){
    S.kills++;
    const m=B.boss?CFG.econ.bossGold:3/B.count; // el oro por oleada no sube con más enemigos
    const g=goldAt(S.fase)*m*(hasCard()?1+CFG.cardGold:1); S.gold+=g; addGoldH(g); // el oro entra directo (la bolsa solo guarda materiales y cofres)
    addXp(xpAt(S.fase)*m*heroStats().xpMult);
  }
  // DPS medido: en oleadas normales (sin jefe ni evento) se compara el daño real (golpes, quemaduras, aura…) con el de la
  // fórmula. La proporción (media móvil) se usa en el cálculo sin conexión y sustituye a la aproximación evoDps.
  function measureWave(){ if(!B||B.boss||B.event||!(B.mB>0)) return; const M=S.dpsM=S.dpsM||{d:0,b:0}, k=0.98;
    M.d=M.d*k+B.mD; M.b=M.b*k+B.mB; }
  const dpsK=h=>{ const M=S.dpsM; return M&&M.b>=CFG.offlineMinMeasure*heroStats().atk?Math.max(0.5,Math.min(3,M.d/M.b)):evoDps(h) };
  function waveClear(){ measureWave(); if(S.wave<10){S.wave++;endWave(CFG.delays.wave);return} faseClear() }
  function faseClear(){
    const f=S.fase; S.wave=1;
    if(f===S.best+1){
      S.best=f;
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
  function goFase(f){ if(B&&B.event) return; f=Math.max(1,Math.min(top(),f|0)); if(f===S.best+1) S.push=true; else {S.push=false;S.autoPush=false} S.fase=f;S.wave=1;startWave(); emit('change') }

  /* ---------- evolución ---------- */
  // pasiva de la clase evolucionada (null si aún no ha evolucionado)
  // extra de estadísticas de las evoluciones hechas (multiplicativo): tier.bonus={hp,atk}
  // la pasiva de clase mejorada por las evoluciones hechas (p. ej. Piel dura 5 % → 7,5 %)
  function evoBase(){ const o={}; if(S&&S.evo) for(const t of evoTiers().slice(0,S.evo)) Object.assign(o,(t.classes[S.cls]||{}).base||{}); return o }
  function evoBonus(k){ let m=1; if(S&&S.evo) for(const t of evoTiers().slice(0,S.evo)) m*=1+((t.bonus||{})[k]||0); return m }
  // pasivas acumuladas de las evoluciones hechas (la última da el nombre)
  let EP=null, EPk=''; // caché de la pasiva (se llama en cada paso del combate)
  function evoP(){ if(!S.evo) return null; const k=S.cls+S.evo; if(EPk===k) return EP; const o={}; for(const t of evoTiers().slice(0,S.evo)) Object.assign(o,t.classes[S.cls]); EP=o; EPk=k; return o }
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
  const canEvolve=()=>evoLvlOk()&&Object.keys(evoMissing()).length===0;
  function evolve(){
    if(!canEvolve()||inEvent()) return {ok:false};
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
  // 3 minutos de monstruos sin parar: el monstruo n es el de la fase n (1-150 de Normal, luego sigue con Pesadilla e Infierno).
  // Iguales para todos los jugadores: no dependen de tu modo ni de tu récord.
  // Salen en grupos de 'group' monstruos (con groupHp × su vida): un grupo cada spawnEvery segundos, o al momento si no
  // queda ninguno vivo. El grupo n es el enemigo de la fase n. Puntúa por muertes (cada monstruo cuenta 1). 1 entrada gratis al día; las demás, 1 ticket.
  function evSpawn(){ const V=CFG.event, alive=B.enemies.some(e=>!e.dead);
    if(alive&&B.t<B.nextSpawn) return;
    const n=B.groups=(B.groups||0)+1, m=Math.min(MODES().length-1,Math.floor((n-1)/CAP())), c=modeCurve(m,n-m*CAP()), hp=c.hp*(V.groupHp||1);
    for(let i=0;i<(V.group||1);i++){ const at=B.t+V.walk+i*(V.groupGap||0);  // llegan escalonados
      B.enemies.push({hp,max:hp,atk:c.atk*(V.groupAtk||1),df:c.df,spawn:B.t,walk:V.walk,arrive:at,next:at,first:false,dead:false,f:n}); B.spawned++; }
    B.nextSpawn=B.t+V.spawnEvery; }
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
    const res=B.kind==='boss'?wbFinish(B.dmg,B.hp<=0):finishRun(B.kills,B.hp<=0);
    B=null; save(); emit('eventEnd',res); startWave(); emit('change'); return res;
  }
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
    if(S.opt&&S.opt.autoDis&&r==='C'&&cls!==S.cls){ const v=CFG.weapon.scrapDis.C; S.scrap+=v; return {cls,r,lvl:1,sec:[],auto:v}; }
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
  const byRarity=(r,mine)=>S.items.filter(x=>x.r===r&&(!mine||x.cls===S.cls)&&x.id!==S.equippedId&&!x.fav);
  function dismantleRarity(r,mine){ return dismantle(byRarity(r,mine).map(x=>x.id)) }
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
  function openChest(type){ const r=pick(chestProbs(type)); const cls=CLASSES[Math.floor(rand()*CLASSES.length)]; return newItem(cls,r) }
  // Inventario: como mucho weapon.invMax armas (la equipada NO cuenta: va en el Equipo). Para abrir X cofres hacen falta X huecos libres.
  const invMax=()=>CFG.weapon.invMax||Infinity;
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
  function addAd(){ if(CFG.league) league().ads++ }
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
  function buyTokens(n){ if(!CFG.devTools||!CFG.tokens.packs.includes(n)) return false; S.tokens+=n; S.stats.deposited+=n; track('deposit',{tokens:n,usd:n/CFG.tokens.perUsd}); save(); emit('change'); return true }
  // Retirar tokens ganados: comisión y mínimo (simulado: no mueve dinero real)
  function withdraw(n){ const W=CFG.tokens.withdraw; n=Math.floor(n); if(!CFG.devTools) return {ok:false,why:'off'};
    if(!(n>=W.min)||n>S.won) return {ok:false,why:n>S.won?'won':'min'};
    const fee=Math.ceil(n*W.fee); S.won-=n; S.withdrawn=(S.withdrawn||0)+n; S.stats.withdrawNet+=(n-fee)/CFG.tokens.perUsd;
    track('withdraw',{tokens:n,fee,usd:(n-fee)/CFG.tokens.perUsd}); save(); emit('change');
    return {ok:true,n,fee,usd:(n-fee)/CFG.tokens.perUsd} }
  // Cofre de plata: se paga con ORO (el de goldMin minutos farmeando tu récord) y hay un máximo al día
  const silverPrice=()=>Math.max(10,Math.round(farmRate(Math.max(1,S.best)).g*60*CFG.chests.silver.goldMin));
  const silverLeft=()=>CFG.chests.silver.perDay-(S.silverDay&&S.silverDay.d===dayKey()?S.silverDay.n:0);
  function buySilver(n){ n=n|0; if(n<1||n>silverLeft()) return false; const c=silverPrice()*n; if(S.gold<c) return false;
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
    const h=computeStats(), per=perWave(f);
    let t=0; for(let w=1;w<=10;w++){ const e=enemyStats(f,w,false);
      const hit=dmgF(h.atk,e.df)*(1+h.cr*h.cd)*dpsK(h), K=Math.max(1,Math.ceil(e.hp/hit))/h.spd, W=CFG.enemy.walk;
      // a distancia se dispara mientras se acercan; cuerpo a cuerpo cada enemigo sale cuando el anterior llega y hay que esperarlo
      t+=(h.ranged?per*K:W+K+(per-1)*Math.max(W,K)) + CFG.delays.wave; }
    return {g:goldAt(f)*3*10*(hasCard()?1+CFG.cardGold:1)/t, x:xpAt(f)*3*10*h.xpMult/t};
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
    const g=r.g*el, x=r.x*el; S.gold+=g; addGoldH(g); addXp(x); S.stats.offGold+=g; track('offline',{secs:Math.round(el),gold:g});
    const capped=raw>=cap; if(capped&&offlineAdLeft()>0) S.offBonus=g*(CFG.offlineAdMult-1);
    emit('change');
    return {secs:el,fase:f,gold:g,xp:x,lvlFrom:l0,lvlTo:S.lvl,capped,bonus:S.offBonus||0};
  }
  // usos que quedan hoy del extra con anuncio (se renuevan con el cambio de día)
  const offlineAdLeft=()=>CFG.offlineAdPerDay-(adsState().n.off||0);
  function claimOfflineBonus(){ const b=S.offBonus; if(!b) return 0; S.gold+=b; S.offBonus=null; const a=adsState(); a.n.off=(a.n.off||0)+1;
    S.stats.ads++; addAd(); S.stats.adGold+=b; addGoldH(b); track('ad',{boost:'offline',gold:b}); emit('change'); return b }

  /* ---------- grimorios ---------- */
  // 2 por clase. Se desbloquean donando oro + esencias + emblemas (o con tokens); el 2.º cuesta el doble. Suben con tu
  // nivel (nivel 1 al desbloquearlo). Por ahora SIN EFECTO en combate: solo existen. Solo uno activo; cambiarlo cuesta tokens.
  const GC=()=>CFG.grimoire;
  const grimList=()=>(GC()&&GC().classes[S.cls])||[];
  const grimState=()=>S.grim=S.grim||{owned:{},active:null};
  const grimOwned=id=>grimState().owned[id]!=null;
  const grimLevel=id=>grimOwned(id)?Math.max(1,S.lvl-grimState().owned[id]+1):0;
  const grimSkill=id=>grimLevel(id)>=GC().skillLvl;
  const grimTier=()=>Math.min(Object.keys(grimState().owned).length,GC().cost.length-1);
  function grimCost(){ const c=GC().cost[grimTier()]; return {gold:Math.round(c.goldH*3600*farmRate(Math.max(1,S.best)).g),ess:c.ess,ev:c.ev} }
  const grimPack=()=>GC().pack[grimTier()];
  function grimMissing(){ const c=grimCost(), o={}; if(S.gold<c.gold) o.gold=c.gold-S.gold; if((S.mats[0]||0)<c.ess) o.ess=c.ess-(S.mats[0]||0); if(S.evm<c.ev) o.ev=c.ev-S.evm; return o }
  function grimGet(id,how){ const G=grimState(); G.owned[id]=S.lvl; if(!G.active) G.active=id; track('grimoire',{id,how}); save(); emit('change'); return {ok:true} }
  function grimUnlock(id){ if(!grimList().some(g=>g.id===id)||grimOwned(id)) return {ok:false,why:'id'};
    if(Object.keys(grimMissing()).length) return {ok:false,why:'cost'}; const c=grimCost();
    S.gold-=c.gold; S.mats[0]-=c.ess; S.evm-=c.ev; return grimGet(id,'recursos') }
  function grimBuy(id){ if(!grimList().some(g=>g.id===id)||grimOwned(id)) return {ok:false,why:'id'}; const p=grimPack();
    if(!spend(p)) return {ok:false,why:'tokens'}; return grimGet(id,'tokens') }
  function grimSet(id){ const G=grimState(); if(!grimOwned(id)||G.active===id) return {ok:false}; if(inEvent()) return {ok:false,why:'event'};
    if(!spend(GC().switchCost)) return {ok:false,why:'tokens'}; G.active=id; track('grimoire',{id,how:'cambio'}); save(); emit('change'); return {ok:true} }

  /* ---------- premios del servidor (referidos) ---------- */
  // El servidor manda premios pendientes: 'silver' = cofres de plata, 'won' = tokens ganados (retirables)
  function applyRewards(list){ const out=[]; if(!S||!Array.isArray(list)) return out;
    for(const r of list){ const n=Math.floor(+r.amount); if(!(n>0)) continue;
      if(r.kind==='silver') addChest('silver',Math.min(n,100)); else if(r.kind==='won') S.won+=n; else continue;
      out.push({kind:r.kind,amount:n,reason:r.reason}); }
    if(out.length){ track('reward',{list:out}); save(); emit('change'); } return out }

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
    claimLoot, bossScrap, autoLoot:()=>{const a=autoLoot;autoLoot=null;return a}, autoEvent:()=>{const a=autoEvent;autoEvent=null;return a}, inEvent, evPhase, evPaused, evPauseLeft, evShownDay, startEvent, evFreeLeft, wbStart, wbFreeLeft, wbRivals, wbRank, wbReward, wbPending, wbClaim, wbWeekDmg, wbShownWeek, weekKey, weekLeft, wbPhase, endEvent, evRivals, evRank, evReward, evPending, claimEvent, evToday,
    // evolución
    canAdvanceMode, advanceMode, modeLocked, modeCfg, top, goldAt,
    canEvolve, evolve, rollMat, matOdds, evoCost, evoMissing, evoLvlOk, evoP, nextEvo, lvlCap,
    // armas
    findItem, equip, toggleFav, levelUp, dismantle, disValue, fodderFor, lvlCostItems, lvlCostScrap, reforge, reforgeCost, reforgePrice, maxLocks, improveStat, improveOdds, applyReforge, secQuality,
    // cofres y tienda
    chestProbs, addChest, chestCount, openChests, invFree, invMax, invCount, byRarity, dismantleRarity, buy, shopPrice, silverPrice, silverLeft, tokens, leagueNow, leaguePending, leagueClaim, monthKey, spend, buyTokens, withdraw,
    // otros
    applyOffline, claimOfflineBonus, offlineCap, offlineAdLeft, setOpt, dev, applyRewards,
    // grimorios
    grimList, grimOwned, grimLevel, grimSkill, grimCost, grimPack, grimMissing, grimUnlock, grimBuy, grimSet,
    // anuncios
    adsState, watchAd, boostLeft, tickBoost, speedMult, boostUsesLeft, goldBoostHours, goldBoostValue,
  };
}

root.createGame=createGame;
if(typeof module!=='undefined'&&module.exports) module.exports={createGame};
})(typeof window!=='undefined'?window:globalThis);
