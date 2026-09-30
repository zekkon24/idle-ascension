/* Idle Ascension · DIBUJOS (héroes y monstruos en vectores, dibujados en el canvas del combate)
   Sin imágenes: todo con formas, así pesa poco y se anima por código. Solo dibuja; no sabe nada de las reglas.
   ART.hero(g, x, y, o)     o = {cls, color, evo, path, flip, walk, atk, hit, t}
     walk: fase de andar (segundos, 0 = quieto) · atk: 0..1 progreso del golpe (0 = sin golpe) · hit: 0..1 recibe golpe
   ART.monster(g, x, y, o)  o = {kind, r, hue, boss, elite, t, walk, atk, hit, die}
     kind: slime, goblin, bat, skeleton, golem, demon · die: 0..1 (animación de muerte)
   ART.kindFor(zone, i)     tipo de monstruo de la zona (0 bosque, 1 cueva, 2 cripta, 3 fortaleza, 4 infierno)
   ART.burst(x, y, color, n) · ART.parts(g, dt)   partículas (golpes y muertes) */
(function(root){
'use strict';
const TAU=Math.PI*2;
// aclara u oscurece un color #rrggbb (f>1 más claro, f<1 más oscuro)
function shade(hex,f){ const n=parseInt(hex.slice(1),16); let r=n>>16&255, gg=n>>8&255, b=n&255;
  const m=v=>Math.max(0,Math.min(255,Math.round(f>1?v+(255-v)*(f-1):v*f)));
  return '#'+((1<<24)+(m(r)<<16)+(m(gg)<<8)+m(b)).toString(16).slice(1) }
const SKIN='#e9c7a0', STEEL='#c9ced8', WOOD='#8a5a34', DARK='#1a1c26';
function rr(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath() }
function shadow(g,w){ g.fillStyle='rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(0,2,w,w*0.28,0,0,TAU); g.fill() }

/* ---------- héroes ---------- */
// arma en la mano, dibujada con el brazo girado 'a' radianes (0 = hacia delante)
function weapon(g,cls,col,trim){
  g.lineCap='round';
  if(cls==='Guerrero'){ g.fillStyle=STEEL; g.fillRect(2,-2.5,24,5); g.fillStyle=shade(STEEL,1.3); g.fillRect(2,-2.5,24,1.6);
    g.fillStyle=trim; g.fillRect(-1,-6,4,12); g.fillStyle=WOOD; g.fillRect(-6,-1.8,6,3.6); }                       // espada
  else if(cls==='Mago'){ g.strokeStyle=WOOD; g.lineWidth=3; g.beginPath(); g.moveTo(-8,0); g.lineTo(24,0); g.stroke();
    g.fillStyle=trim; g.shadowColor=trim; g.shadowBlur=8; g.beginPath(); g.arc(26,0,4.5,0,TAU); g.fill(); g.shadowBlur=0; }   // báculo con orbe
  else if(cls==='Arquero'){ g.strokeStyle=WOOD; g.lineWidth=2.6; g.beginPath(); g.arc(4,0,15,-1.25,1.25); g.stroke();
    g.strokeStyle='#ddd'; g.lineWidth=1; g.beginPath(); g.moveTo(4+15*Math.cos(-1.25),15*Math.sin(-1.25)); g.lineTo(4+15*Math.cos(1.25),15*Math.sin(1.25)); g.stroke(); }   // arco
  else if(cls==='Asesino'){ g.fillStyle=STEEL; g.beginPath(); g.moveTo(2,-2); g.lineTo(17,0); g.lineTo(2,2); g.fill(); g.fillStyle=trim; g.fillRect(-2,-3,4,6); }   // daga
  else { g.strokeStyle=WOOD; g.lineWidth=3; g.beginPath(); g.moveTo(-4,0); g.lineTo(16,0); g.stroke();
    g.fillStyle=trim; g.beginPath(); g.arc(19,0,5.5,0,TAU); g.fill(); g.fillStyle=shade(trim,0.7); for(let i=0;i<4;i++){ const a=i*TAU/4; g.fillRect(19+Math.cos(a)*5-1.5,Math.sin(a)*5-1.5,3,3) } }   // maza
}
function hero(g,x,y,o){
  const cls=o.cls, col=o.color||'#888', evo=o.evo||0, B=o.path==='B';
  const trim=evo?(B?'#b56cff':'#f2c35b'):shade(col,1.35), dark=shade(col,0.62);
  const t=o.t||0, walk=o.walk||0, atk=o.atk||0, hit=o.hit||0;
  const bob=walk?Math.abs(Math.sin(walk*9))*2:Math.sin(t*2.2)*0.8, leg=walk?Math.sin(walk*9)*5:0;
  g.save(); g.translate(x,y); if(o.flip) g.scale(-1,1);
  if(hit) g.translate(-hit*4,0);
  shadow(g,15);
  g.translate(0,-bob);
  // aura de los caminos (evolución)
  if(evo){ g.globalAlpha=0.18+0.08*Math.sin(t*3); g.fillStyle=trim; g.beginPath(); g.ellipse(0,-30,22,34,0,0,TAU); g.fill(); g.globalAlpha=1; }
  // capa (Guerrero, Clérigo, Asesino y todos al evolucionar)
  if(evo||cls==='Asesino'){ g.fillStyle=B||cls==='Asesino'?shade(col,0.4):shade(col,0.75); g.beginPath(); g.moveTo(-8,-40); g.quadraticCurveTo(-18-Math.sin(t*3)*2,-18,-14,-2); g.lineTo(2,-4); g.lineTo(4,-40); g.fill(); }
  // piernas
  g.fillStyle=DARK; g.fillRect(-7+leg*0.5,-18,6,18); g.fillRect(1-leg*0.5,-18,6,18);
  g.fillStyle=shade(col,0.45); g.fillRect(-8+leg*0.5,-3,8,4); g.fillRect(0-leg*0.5,-3,8,4);
  // cuerpo (túnica larga para Mago y Clérigo)
  if(cls==='Mago'||cls==='Clerigo'){ g.fillStyle=col; g.beginPath(); g.moveTo(-10,-40); g.lineTo(10,-40); g.lineTo(13,-8); g.lineTo(-13,-8); g.closePath(); g.fill();
    g.fillStyle=trim; g.fillRect(-13,-10,26,2.5); g.fillRect(-1.5,-40,3,30); }
  else { g.fillStyle=col; rr(g,-10,-41,20,24,5); g.fill(); g.fillStyle=dark; g.fillRect(-10,-22,20,4); g.fillStyle=trim; g.fillRect(-2,-22,4,4); }
  if(cls==='Guerrero'){ g.fillStyle=STEEL; rr(g,-12,-42,9,7,3); g.fill(); rr(g,3,-42,9,7,3); g.fill(); }   // hombreras
  // cabeza
  g.fillStyle=SKIN; g.beginPath(); g.arc(1,-49,8.5,0,TAU); g.fill();
  g.fillStyle=DARK; g.fillRect(4,-51,2.5,2.5);
  // tocado de cada clase
  if(cls==='Guerrero'){ g.fillStyle=STEEL; g.beginPath(); g.arc(1,-50,9.5,Math.PI,0); g.fill(); g.fillRect(-8.5,-51,19,3); g.fillStyle=DARK; g.fillRect(3,-51,7,2);
    if(evo){ g.fillStyle=trim; g.beginPath(); g.moveTo(-2,-59); g.lineTo(1,-68); g.lineTo(4,-59); g.fill(); } }
  else if(cls==='Mago'){ g.fillStyle=dark; g.beginPath(); g.moveTo(-11,-52); g.lineTo(14,-52); g.lineTo(-2,-75-Math.sin(t*2)*1.5); g.closePath(); g.fill(); g.fillStyle=trim; g.fillRect(-11,-54,25,3);
    if(evo){ g.fillStyle=trim; g.beginPath(); g.arc(-1,-66,2,0,TAU); g.fill(); } }
  else if(cls==='Arquero'){ g.fillStyle=dark; g.beginPath(); g.arc(1,-50,10,Math.PI*0.95,Math.PI*2.05); g.lineTo(-9,-42); g.fill(); g.fillStyle=SKIN; g.beginPath(); g.arc(3,-48,6,-1.3,1.3); g.fill(); g.fillStyle=DARK; g.fillRect(4,-51,2.5,2.5);
    g.fillStyle=WOOD; g.fillRect(-13,-44,5,16); g.fillStyle=STEEL; g.fillRect(-12,-48,1.5,5); g.fillRect(-9.5,-47,1.5,4); }   // carcaj
  else if(cls==='Asesino'){ g.fillStyle=shade(col,0.4); g.beginPath(); g.arc(1,-50,10,Math.PI*0.9,Math.PI*2.1); g.lineTo(-9,-42); g.fill(); g.fillStyle=dark; g.fillRect(-4,-49,14,5);
    g.fillStyle=B?'#b56cff':'#e2605a'; g.fillRect(4,-52,3,2); }   // capucha y máscara (ojo que brilla)
  else { g.fillStyle='#f3f0e6'; g.beginPath(); g.moveTo(-7,-54); g.lineTo(9,-54); g.lineTo(5,-68); g.lineTo(1,-63); g.lineTo(-3,-68); g.closePath(); g.fill(); g.fillStyle=trim; g.fillRect(0,-66,2,10); g.fillRect(-3,-62,8,2); }   // mitra
  // brazo con arma: gira durante el golpe (cuerpo a cuerpo) o tensa el arco (a distancia)
  const ranged=cls==='Arquero'||cls==='Mago';
  const swing=atk?(ranged?-0.25*Math.sin(atk*Math.PI):(-1.4+2.3*Math.min(1,atk*1.6))):-0.5+Math.sin(t*2.2)*0.05;
  g.save(); g.translate(8,-34); g.rotate(swing+(ranged?0.1:0));
  g.fillStyle=cls==='Guerrero'?STEEL:col; g.fillRect(0,-3,10,6); g.fillStyle=SKIN; g.beginPath(); g.arc(11,0,3,0,TAU); g.fill();
  g.translate(11,0); weapon(g,cls,col,trim); g.restore();
  if(cls==='Guerrero'){ g.fillStyle=shade(col,0.8); rr(g,-17,-38,10,17,4); g.fill(); g.fillStyle=trim; g.fillRect(-13,-34,2,9); }   // escudo
  if(cls==='Asesino'){ g.save(); g.translate(-8,-30); g.rotate(0.6+(atk?Math.sin(atk*Math.PI)*0.9:0)); weapon(g,cls,col,trim); g.restore(); }   // segunda daga
  if(hit){ g.globalAlpha=hit*0.55; g.fillStyle='#fff'; g.beginPath(); g.ellipse(0,-32,14,30,0,0,TAU); g.fill(); g.globalAlpha=1; }
  g.restore();
}

/* ---------- monstruos ---------- */
const ZONES=[['slime','goblin'],['bat','goblin'],['skeleton','bat'],['golem','skeleton'],['demon','golem']];
const kindFor=(zone,i)=>{ const z=ZONES[Math.max(0,Math.min(ZONES.length-1,zone))]; return z[i%z.length] };
const hsl=(h,s,l)=>`hsl(${h} ${s}% ${l}%)`;
function monster(g,x,y,o){
  const k=o.kind||'slime', r=o.r||13, s=r/13, t=o.t||0, die=o.die||0, hit=o.hit||0, atk=o.atk||0, walk=o.walk||0, hue=o.hue||0;
  g.save(); g.translate(x+(hit?hit*5:0)-(atk?Math.sin(atk*Math.PI)*8:0),y);
  if(die){ g.globalAlpha=1-die; g.translate(0,die*6); }
  shadow(g,12*s);
  g.scale(s,s);
  if(die) g.rotate(die*0.5);
  const eye=(ex,ey,c)=>{ g.fillStyle=c||'#fff'; g.beginPath(); g.arc(ex,ey,2.2,0,TAU); g.fill(); g.fillStyle=DARK; g.beginPath(); g.arc(ex-0.7,ey,1.1,0,TAU); g.fill(); };
  if(k==='slime'){ const sq=1+Math.sin(t*6+(walk||0)*8)*0.08;
    g.fillStyle=hsl((110+hue)%360,55,48); g.beginPath(); g.ellipse(0,-10*sq,14/sq,10*sq,0,Math.PI,0); g.lineTo(14/sq,0); g.lineTo(-14/sq,0); g.fill();
    g.fillStyle='rgba(255,255,255,.25)'; g.beginPath(); g.ellipse(4,-15*sq,4,2.5,-0.4,0,TAU); g.fill(); eye(-5,-9); eye(1,-9); }
  else if(k==='goblin'){ const leg=walk?Math.sin(walk*10)*3:0, c=hsl((95+hue)%360,40,42);
    g.fillStyle=DARK; g.fillRect(-5+leg,-10,4,10); g.fillRect(1-leg,-10,4,10);
    g.fillStyle=hsl((30+hue)%360,35,30); rr(g,-7,-22,14,13,3); g.fill();
    g.fillStyle=c; g.beginPath(); g.arc(-1,-28,7,0,TAU); g.fill(); g.beginPath(); g.moveTo(-6,-31); g.lineTo(-14,-35); g.lineTo(-6,-27); g.fill(); g.beginPath(); g.moveTo(4,-31); g.lineTo(10,-35); g.lineTo(4,-26); g.fill();
    g.fillStyle='#ffd23e'; g.fillRect(-6,-30,2.5,2.5); g.fillRect(-1,-30,2.5,2.5);
    g.save(); g.translate(-7,-18); g.rotate(-0.6-(atk?Math.sin(atk*Math.PI)*1.2:0)); g.fillStyle=WOOD; g.fillRect(-2,-14,4,14); g.beginPath(); g.arc(0,-15,4,0,TAU); g.fill(); g.restore(); }
  else if(k==='bat'){ const f=Math.sin(t*14), yy=-22+Math.sin(t*3)*3;
    g.fillStyle=hsl((270+hue)%360,25,26); g.beginPath(); g.moveTo(0,yy); g.quadraticCurveTo(-12,yy-10-f*6,-20,yy-2+f*4); g.quadraticCurveTo(-10,yy+2,0,yy+4); g.quadraticCurveTo(10,yy+2,20,yy-2+f*4); g.quadraticCurveTo(12,yy-10-f*6,0,yy); g.fill();
    g.fillStyle=hsl((270+hue)%360,20,18); g.beginPath(); g.ellipse(0,yy+1,6,7,0,0,TAU); g.fill(); g.beginPath(); g.moveTo(-5,yy-4); g.lineTo(-3,yy-10); g.lineTo(-1,yy-5); g.fill(); g.beginPath(); g.moveTo(5,yy-4); g.lineTo(3,yy-10); g.lineTo(1,yy-5); g.fill();
    g.fillStyle='#ff5252'; g.fillRect(-4,yy-1,2.2,2.2); g.fillRect(1.5,yy-1,2.2,2.2); }
  else if(k==='skeleton'){ const leg=walk?Math.sin(walk*10)*3:0, bone='#e8e2cf';
    g.strokeStyle=bone; g.lineWidth=2.5; g.lineCap='round'; g.beginPath(); g.moveTo(-3,-12); g.lineTo(-4+leg,0); g.moveTo(3,-12); g.lineTo(4-leg,0); g.stroke();
    g.beginPath(); g.moveTo(0,-26); g.lineTo(0,-12); g.stroke(); for(let i=0;i<3;i++){ g.beginPath(); g.moveTo(-5,-24+i*4); g.lineTo(5,-24+i*4); g.stroke(); }
    g.fillStyle=bone; g.beginPath(); g.arc(0,-32,6.5,0,TAU); g.fill(); g.fillRect(-4,-28,8,4);
    g.fillStyle=hsl((190+hue)%360,90,60); g.fillRect(-4,-34,2.5,2.5); g.fillRect(1,-34,2.5,2.5);
    g.save(); g.translate(-5,-22); g.rotate(-0.8-(atk?Math.sin(atk*Math.PI)*1.1:0)); g.fillStyle=STEEL; g.fillRect(-1.5,-16,3,16); g.fillStyle=WOOD; g.fillRect(-4,-1,8,2.5); g.restore(); }
  else if(k==='golem'){ const c=hsl((30+hue)%360,10,42), c2=hsl((30+hue)%360,10,32), leg=walk?Math.sin(walk*6)*2:0;
    g.fillStyle=c2; g.fillRect(-9+leg,-12,7,12); g.fillRect(2-leg,-12,7,12);
    g.fillStyle=c; rr(g,-12,-32,24,21,4); g.fill(); g.fillStyle=c2; rr(g,-7,-42,14,11,3); g.fill();
    g.fillStyle=hsl((25+hue)%360,95,60); g.shadowColor=g.fillStyle; g.shadowBlur=6; g.fillRect(-4,-38,3,3); g.fillRect(1,-38,3,3); g.fillRect(-2,-25,4,4); g.shadowBlur=0;
    g.fillStyle=c2; g.save(); g.translate(-12,-28); g.rotate(atk?-Math.sin(atk*Math.PI)*1.2:0); rr(g,-6,0,7,18,3); g.fill(); g.restore(); rr(g,11,-28,7,18,3); g.fill(); }
  else { const c=hsl((0+hue)%360,60,38), leg=walk?Math.sin(walk*10)*3:0, f=Math.sin(t*5)*3;   // demonio
    g.fillStyle=hsl((0+hue)%360,50,20); g.beginPath(); g.moveTo(2,-26); g.lineTo(18,-38-f); g.lineTo(14,-22); g.lineTo(20,-18); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-2,-26); g.lineTo(-18,-38-f); g.lineTo(-14,-22); g.lineTo(-20,-18); g.closePath(); g.fill();
    g.fillStyle=DARK; g.fillRect(-6+leg,-12,5,12); g.fillRect(1-leg,-12,5,12);
    g.fillStyle=c; rr(g,-8,-28,16,17,4); g.fill(); g.beginPath(); g.arc(0,-33,7,0,TAU); g.fill();
    g.fillStyle='#f3e9d2'; g.beginPath(); g.moveTo(-5,-37); g.lineTo(-9,-45); g.lineTo(-2,-39); g.fill(); g.beginPath(); g.moveTo(5,-37); g.lineTo(9,-45); g.lineTo(2,-39); g.fill();
    g.fillStyle='#ffd23e'; g.fillRect(-5,-35,2.5,2); g.fillRect(-0.5,-35,2.5,2);
    g.save(); g.translate(-7,-20); g.rotate(-0.4-(atk?Math.sin(atk*Math.PI)*1.1:0)); g.strokeStyle='#444'; g.lineWidth=2; g.beginPath(); g.moveTo(0,0); g.lineTo(0,-20); g.stroke();
      g.strokeStyle=STEEL; g.beginPath(); g.moveTo(-4,-20); g.lineTo(-4,-26); g.moveTo(0,-20); g.lineTo(0,-27); g.moveTo(4,-20); g.lineTo(4,-26); g.stroke(); g.restore(); }   // tridente
  // jefes: corona (élite: morada y más grande)
  if(o.boss){ const top=k==='bat'?-36:k==='slime'?-22:k==='golem'?-44:k==='skeleton'?-40:k==='demon'?-47:-37;
    g.fillStyle=o.elite?'#c86bff':'#e8b04a'; g.beginPath(); g.moveTo(-8,top); g.lineTo(-6,top-8); g.lineTo(-2,top-3); g.lineTo(0,top-9); g.lineTo(2,top-3); g.lineTo(6,top-8); g.lineTo(8,top); g.closePath(); g.fill(); }
  if(hit){ g.globalAlpha=hit*0.3; g.fillStyle='#fff'; g.beginPath(); g.ellipse(0,-16,12,14,0,0,TAU); g.fill(); g.globalAlpha=1; }
  g.restore();
}

/* ---------- partículas ---------- */
let P=[];
function burst(x,y,color,n){ for(let i=0;i<(n||6);i++){ const a=Math.random()*TAU, v=30+Math.random()*60; P.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-40,life:0.5+Math.random()*0.3,c:color||'#fff',r:1.5+Math.random()*1.5}) } if(P.length>160) P=P.slice(-160) }
function parts(g,dt){ P=P.filter(p=>(p.life-=dt)>0); for(const p of P){ p.vy+=140*dt; p.x+=p.vx*dt; p.y+=p.vy*dt; g.globalAlpha=Math.min(1,p.life*2); g.fillStyle=p.c; g.fillRect(p.x-p.r/2,p.y-p.r/2,p.r,p.r) } g.globalAlpha=1 }
const clearParts=()=>{ P=[] };


/* ---------- efectos de combate ----------
   addFx(tipo, datos): proyectiles, tajos, críticos y el efecto de cada habilidad. drawFx(g, ctx) los dibuja cada fotograma.
   ctx = {hx, rx, gy, foes:[{x,r}], now}: hx = héroe, rx = rival (PvP), foes = monstruos vivos (x y tamaño).
   side: 'hero' (lo lanza tu héroe, va hacia los enemigos) o 'rival' (lo lanza el rival del PvP, va hacia ti). */
let FX=[], SH=0;
const now=()=>performance.now()/1000;
function addFx(type,o){ const f={type,t0:now(),side:'hero',...(o||{})}; if(type==='name') f.row=FX.filter(x=>x.type==='name'&&x.side===f.side&&now()-x.t0<(LIFE.name)).length; FX.push(f); if(FX.length>80) FX=FX.slice(-80) }
function shake(a){ SH=Math.min(8,Math.max(SH,a)) }
function shakeOffset(dt){ if(SH<0.05){ SH=0; return [0,0] } const o=[(Math.random()*2-1)*SH,(Math.random()*2-1)*SH]; SH*=Math.pow(0.02,dt); return o }
// duración de cada efecto (s); las de habilidad con efecto largo usan su 'dur'
const LIFE={proj:0.18,slash:0.2,crit:0.35,name:1.1,bola:0.9,ejecutar:0.4,luz:0.8,perforante:0.35,muro:1,armaduraHielo:0.6,marca:0.6,nube:2,congelar:0.5,luzVuelve:0.6,reloj:0.7,combustionHit:0.6};
const glow=(g,c,b)=>{ g.shadowColor=c; g.shadowBlur=b };
function orb(g,x,y,r,c){ glow(g,c,10); g.fillStyle=c; g.beginPath(); g.arc(x,y,r,0,TAU); g.fill(); g.shadowBlur=0; g.fillStyle='#fff'; g.beginPath(); g.arc(x,y,r*0.45,0,TAU); g.fill() }
function drawFx(g,c){
  const T=c.now, out=[];
  for(const f of FX){ const age=T-f.t0, life=f.dur||LIFE[f.type]||0.6, k=age/life; if(k>=1) continue; out.push(f);
    const me=f.side==='rival'?c.rx:c.hx, dir=f.side==='rival'?-1:1, gy=c.gy;
    const tx=f.side==='rival'?[c.hx]:(c.foes.length?c.foes.map(o=>o.x):c.rx!=null?[c.rx]:[]), front=tx.length?tx[0]:me+60*dir;
    const to=f.e&&f.e.x!=null?f.e.x:f.tx!=null?f.tx:front;
    g.save();
    if(f.type==='proj'){ const sx=me+14*dir, sy=gy-34, x=sx+(to-sx)*k, y=sy+k*16;
      if(f.kind==='arrow'){ g.strokeStyle='#e8dcc0'; g.lineWidth=2; g.beginPath(); g.moveTo(x-12*dir,y); g.lineTo(x,y); g.stroke(); g.fillStyle=STEEL; g.beginPath(); g.moveTo(x+4*dir,y); g.lineTo(x-2*dir,y-3); g.lineTo(x-2*dir,y+3); g.fill(); }
      else if(f.kind==='fire'){ for(let i=3;i>0;i--){ g.globalAlpha=0.25*i; orb(g,x-i*5*dir,y,2+i,'#ff8a2a') } g.globalAlpha=1; orb(g,x,y,5,'#ffb347') }
      else orb(g,x,y,4.5,f.color||'#ffe38a'); }
    else if(f.type==='slash'){ const x=to-4*dir; g.strokeStyle=f.color||'#fff'; g.globalAlpha=1-k; g.lineWidth=f.crit?4:2.5; glow(g,f.color||'#fff',f.crit?10:4);
      g.beginPath(); g.arc(x,gy-20,16+k*6,-1.2-k*0.6,1+k*0.3); g.stroke(); }
    else if(f.type==='crit'){ g.globalAlpha=1-k; g.strokeStyle='#ffd35a'; g.lineWidth=3; glow(g,'#ffd35a',12); g.beginPath(); g.arc(to,gy-22,6+k*26,0,TAU); g.stroke();
      for(let i=0;i<6;i++){ const a=i*TAU/6+k; g.beginPath(); g.moveTo(to+Math.cos(a)*(8+k*14),gy-22+Math.sin(a)*(8+k*14)); g.lineTo(to+Math.cos(a)*(14+k*24),gy-22+Math.sin(a)*(14+k*24)); g.stroke() } }
    else if(f.type==='name'){ g.globalAlpha=Math.min(1,(1-k)*3); g.font='800 11px "Nunito Sans", system-ui, sans-serif'; g.textAlign='center'; g.fillStyle='#ffd35a'; glow(g,'#000',4);
      const w=g.measureText(f.text).width, x=Math.max(w/2+4,Math.min((c.W||1e4)-w/2-4,me));   // dentro del escenario
      g.fillText(f.text,x,gy-100-k*12-(f.row||0)*13); }   // si salen varias a la vez, una encima de otra
    // ----- habilidades -----
    else if(f.type==='muro'||f.type==='baluarte'){ const col=f.type==='muro'?'#7fb6ff':'#b9b2a4';
      g.globalAlpha=f.type==='muro'?(1-k)*0.8:0.35+0.1*Math.sin(age*6); g.strokeStyle=col; g.fillStyle=col+'33'; g.lineWidth=2.5; glow(g,col,10);
      g.beginPath(); g.ellipse(me,gy-32,24,38,0,0,TAU); g.fill(); g.stroke();
      if(f.type==='muro'){ g.globalAlpha=1-k; g.beginPath(); g.ellipse(me+dir*k*120,gy,8+k*20,4+k*6,0,0,TAU); g.stroke(); } }   // onda que va hacia los enemigos
    else if(f.type==='bola'){ tx.slice(0,3).forEach((x,i)=>{ const kk=Math.min(1,k*1.8-i*0.15); if(kk<=0) return; const sx=me+10*dir, px=sx+(x-sx)*Math.min(1,kk), py=gy-40-Math.sin(Math.min(1,kk)*Math.PI)*30;
        if(kk<1){ orb(g,px,py,6,'#ff8a2a') } else { const e=Math.min(1,(k*1.8-i*0.15-1)*2); g.globalAlpha=1-e; orb(g,x,gy-16,6+e*18,'#ff6a1a') } }); }
    else if(f.type==='ejecutar'){ g.globalAlpha=1-k; g.strokeStyle='#ff3b3b'; g.lineWidth=5; glow(g,'#ff3b3b',14); const x=front, y=gy-22, d=18*Math.min(1,k*4);
      g.beginPath(); g.moveTo(x-d,y-d); g.lineTo(x+d,y+d); g.moveTo(x+d,y-d); g.lineTo(x-d,y+d); g.stroke(); }
    else if(f.type==='luz'){ for(let i=0;i<6;i++){ const kk=k*6-i*0.6; if(kk<0||kk>1.4) continue; g.globalAlpha=Math.max(0,1-Math.abs(kk-0.4)); g.fillStyle='#fff3b0'; glow(g,'#ffe066',14);
        g.fillRect(front-3+((i%3)-1)*5,0,6,gy-12); } }
    else if(f.type==='perforante'){ const x=me+dir*(20+k*400); g.strokeStyle='#bff0ff'; g.lineWidth=3; glow(g,'#7fe0ff',14); g.globalAlpha=1-k*0.5; g.beginPath(); g.moveTo(x-40*dir,gy-32); g.lineTo(x,gy-32); g.stroke(); orb(g,x,gy-32,3,'#e8fbff'); }
    else if(f.type==='rapido'||f.type==='sed'||f.type==='sacrificio'||f.type==='combustion'){   // auras sobre el héroe mientras dura el efecto
      const col={rapido:'#ffb347',sed:'#ff4d4d',sacrificio:'#8a1c2c',combustion:'#ff7a1a'}[f.type];
      g.globalAlpha=0.25+0.12*Math.sin(age*8); g.fillStyle=col; glow(g,col,16); g.beginPath(); g.ellipse(me,gy-30,20,36,0,0,TAU); g.fill();
      if(f.type==='rapido'){ g.globalAlpha=0.6; g.strokeStyle=col; g.lineWidth=1.5; for(let i=0;i<3;i++){ const yy=gy-50+i*14+((age*40+i*7)%10); g.beginPath(); g.moveTo(me-22*dir,yy); g.lineTo(me-36*dir,yy); g.stroke(); } }
      if(f.type==='sed'||f.type==='sacrificio'){ g.globalAlpha=0.8; g.fillStyle=col; for(let i=0;i<3;i++){ const yy=gy-40+((age*30+i*13)%40); g.fillRect(me-10+i*9,yy,2,4); } } }
    else if(f.type==='clon'){ g.globalAlpha=0.35+0.1*Math.sin(age*5); if(c.drawClone) c.drawClone(me-26*dir,f.side); }
    else if(f.type==='juicio'){ g.globalAlpha=0.35+0.1*Math.sin(age*4); g.strokeStyle='#ffe066'; g.fillStyle='rgba(255,224,102,.12)'; g.lineWidth=2; glow(g,'#ffe066',12);
      const w=Math.min(1,age*2)*90; g.beginPath(); g.ellipse(me+dir*w*0.5,gy,w,10,0,0,TAU); g.fill(); g.stroke(); g.globalAlpha*=0.5; g.fillStyle='#fff6c8'; g.fillRect(me-8,0,16,gy); }
    else if(f.type==='armaduraHielo'||f.type==='iceArmor'){ if(f.type==='armaduraHielo'){ tx.forEach((x,i)=>{ for(let j=0;j<3;j++){ const px=me+(x-me)*k, py=gy-30-j*8+Math.sin(k*Math.PI)*-10; g.fillStyle='#bfe9ff'; glow(g,'#7fd0ff',8); g.save(); g.translate(px,py); g.rotate(k*6+j); g.fillRect(-3,-1.2,6,2.4); g.restore(); } }); }
      else { g.globalAlpha=0.5; g.fillStyle='#bfe9ff'; glow(g,'#7fd0ff',8); for(let i=0;i<5;i++){ const a=age*1.5+i*TAU/5; g.save(); g.translate(me+Math.cos(a)*20,gy-32+Math.sin(a)*30); g.rotate(a); g.beginPath(); g.moveTo(0,-5); g.lineTo(2.5,0); g.lineTo(0,5); g.lineTo(-2.5,0); g.fill(); g.restore(); } } }
    else if(f.type==='marca'){ g.globalAlpha=1-k; g.strokeStyle='#ff4d4d'; g.lineWidth=2; const r=30-k*18; g.beginPath(); g.arc(front,gy-22,r,0,TAU); g.stroke(); }
    else if(f.type==='nube'){ tx.forEach(x=>{ g.globalAlpha=0.35*(1-k*0.5); g.fillStyle='#7ddc5a'; glow(g,'#7ddc5a',14); for(let i=0;i<4;i++){ g.beginPath(); g.arc(x-12+i*8,gy-28-Math.sin(age*3+i)*4,9,0,TAU); g.fill(); } }); }
    else if(f.type==='congelar'){ const x=f.tx!=null?f.tx:front; g.globalAlpha=1-k; g.strokeStyle='#bfe9ff'; g.lineWidth=2; glow(g,'#7fd0ff',10); for(let i=0;i<6;i++){ const a=i*TAU/6; g.beginPath(); g.moveTo(x,gy-20); g.lineTo(x+Math.cos(a)*(6+k*16),gy-20+Math.sin(a)*(6+k*16)); g.stroke(); } }
    else if(f.type==='luzVuelve'){ for(let i=0;i<(f.n||3);i++){ const kk=Math.min(1,k*1.4-i*0.1); if(kk<0) continue; orb(g,front+(me-front)*kk,gy-30-Math.sin(kk*Math.PI)*20,3,'#ffe066') } }
    else if(f.type==='reloj'){ g.globalAlpha=1-k; g.strokeStyle='#ffd35a'; g.lineWidth=2; glow(g,'#ffd35a',10); g.beginPath(); g.arc(me,gy-32,14+k*20,0,TAU); g.stroke(); }
    else if(f.type==='combustionHit'){ tx.forEach(x=>{ g.globalAlpha=1-k; orb(g,x,gy-14,4+k*12,'#ff7a1a') }); }
    g.restore(); }
  FX=out }
// estados de un monstruo (encima de su dibujo): ardiendo, envenenado, congelado, marcado
function status(g,x,gy,r,st,t){ const s=r/13;
  if(st.frozen){ g.save(); g.globalAlpha=0.45; g.fillStyle='#9fdcff'; g.strokeStyle='#e8fbff'; g.lineWidth=1.5; g.beginPath(); rr(g,x-13*s,gy-34*s,26*s,34*s,4); g.fill(); g.stroke(); g.restore(); }
  if(st.burn){ g.save(); for(let i=0;i<3;i++){ const fx=x-8*s+i*8*s, h=(8+Math.sin(t*14+i*2)*3)*s, fy=gy-18*s-((t*30+i*9)%10)*s*0.4; g.globalAlpha=0.85; g.fillStyle=i%2?'#ff8a2a':'#ffd35a'; glow(g,'#ff6a1a',8);
      g.beginPath(); g.moveTo(fx-3*s,fy); g.quadraticCurveTo(fx,fy-h,fx+3*s,fy); g.fill(); } g.restore(); }
  if(st.poison){ g.save(); g.fillStyle='#8ee06a'; for(let i=0;i<3;i++){ const yy=gy-10*s-((t*20+i*11)%24)*s; g.globalAlpha=0.7; g.beginPath(); g.arc(x-6*s+i*6*s,yy,1.8*s,0,TAU); g.fill(); } g.restore(); }
  if(st.mark){ g.save(); g.strokeStyle='#ff4d4d'; g.lineWidth=1.5; g.globalAlpha=0.9; const yy=gy-r*3.7-14, rr2=5; g.beginPath(); g.arc(x,yy,rr2,0,TAU); g.moveTo(x-rr2-3,yy); g.lineTo(x+rr2+3,yy); g.moveTo(x,yy-rr2-3); g.lineTo(x,yy+rr2+3); g.stroke(); g.restore(); } }
const clearFx=()=>{ FX=[]; SH=0 };

root.ART={hero,monster,kindFor,burst,parts,clearParts,shade,addFx,drawFx,status,shake,shakeOffset,clearFx};
})(typeof window!=='undefined'?window:globalThis);
