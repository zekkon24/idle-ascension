/* Idle Ascension · DIBUJOS (héroes y monstruos en el canvas del combate: sprites de sprites/ y vectores)
   Lo que no tiene sprite se dibuja con formas; todo se anima por código. Solo dibuja; no sabe nada de las reglas.
   ART.hero(g, x, y, o)     o = {cls, color, evo, path, flip, walk, atk, hit, t}
     walk: fase de andar (segundos, 0 = quieto) · atk: 0..1 progreso del golpe (0 = sin golpe) · hit: 0..1 recibe golpe
   ART.monster(g, x, y, o)  o = {kind, r, hue, boss, elite, t, walk, atk, hit, die}
     kind: slime, goblin, bat, orc, skeleton, golem, demon y sus jefes y élites (ver ZONES) · die: 0..1 (animación de muerte)
   ART.kindFor(zone, i, {boss, elite, mode})   tipo de monstruo de la franja (0 pradera, 1 cueva, 2 bosque, 3 cementerio, 4 portal;
     en el modo Infierno la 4 es el infierno): normales por turnos, o el jefe / élite de la franja
   ART.burst(x, y, color, n) · ART.parts(g, dt)   partículas (golpes y muertes)
   Sprites (carpeta sprites/, WebP): las 5 clases, el goblin, el murciélago y el esqueleto se dibujan con su imagen en cuanto carga;
   hasta entonces (o si no carga) se dibujan en vectores. Slime, gólem y demonio siguen en vectores.
   ART.onSprites(fn) avisa cuando han terminado de cargar · ART.spriteSrc(cls) dirección de la imagen de una clase
   ART.face(cls) imagen y encuadre de la cara (retrato) · ART.hasSprite(cls) */
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

/* ---------- sprites ---------- */
// H: alto en unidades del combate (héroes 10, esqueleto 7, goblin 6, murciélago 5) · ax: eje del cuerpo (fracción del ancho)
// hx: centro de la cabeza (corona de jefe) · fly: altura de vuelo · los héroes miran a la derecha y los monstruos a la izquierda
// face: centro de la cara (fracciones del ancho y del alto) y su tamaño (fracción del alto), para el retrato de la cabecera
const SPR={Guerrero:{f:'guerrero',H:64,ax:0.46,face:[0.55,0.24,0.40]}, Mago:{f:'mago',H:64,ax:0.365,face:[0.57,0.30,0.42]}, Arquero:{f:'arquero',H:64,ax:0.36,face:[0.38,0.25,0.40]},
  Asesino:{f:'asesino',H:61.5,ax:0.44,face:[0.44,0.24,0.40]}, Clerigo:{f:'clerigo',H:64,ax:0.415,face:[0.50,0.33,0.40]},
  skeleton:{f:'esqueleto',H:45.2,ax:0.46,hx:0.52}, goblin:{f:'goblin',H:38.9,ax:0.485,hx:0.485}, bat:{f:'murcielago',H:32.6,ax:0.38,hx:0.22,fly:9}};
const sprWait=[]; let sprLeft=0;
const sprSrc=k=>{ const v=root.APP_VERSION; return 'sprites/'+SPR[k].f+'.webp'+(v&&v!=='DEV'?'?v='+v:'') };
if(typeof Image!=='undefined') for(const k in SPR){ const sp=SPR[k], im=new Image(); sprLeft++;
  const done=ok=>{ if(ok){ sp.img=im; sp.W=sp.H*im.naturalWidth/im.naturalHeight } if(--sprLeft===0) sprWait.splice(0).forEach(fn=>{ try{ fn() }catch(e){} }) };
  im.onload=()=>done(im.naturalWidth>0); im.onerror=()=>done(false); im.src=sprSrc(k) }
const onSprites=fn=>{ if(sprLeft===0) fn(); else sprWait.push(fn) };
const sprOf=k=>SPR[k]&&SPR[k].img?SPR[k]:null;
// copias de la imagen: silueta blanca (al recibir un golpe) y teñida (modos Pesadilla e Infierno); se hacen una vez
function sprCopy(sp,key,paint){ sp.c=sp.c||{}; if(sp.c[key]!==undefined) return sp.c[key];
  try{ const im=sp.img, cv=document.createElement('canvas'); cv.width=im.naturalWidth; cv.height=im.naturalHeight; const c=cv.getContext('2d');
    c.drawImage(im,0,0); paint(c,cv.width,cv.height); c.globalCompositeOperation='destination-in'; c.globalAlpha=1; c.drawImage(im,0,0); sp.c[key]=cv }
  catch(e){ sp.c[key]=null }
  return sp.c[key] }
const sprWhite=sp=>sprCopy(sp,'w',(c,w,h)=>{ c.globalCompositeOperation='source-in'; c.fillStyle='#fff'; c.fillRect(0,0,w,h) });
const sprHue=(sp,hue)=>!hue?sp.img:sprCopy(sp,'h'+hue,(c,w,h)=>{ c.globalCompositeOperation='color'; c.globalAlpha=0.5; c.fillStyle=`hsl(${hue} 70% 50%)`; c.fillRect(0,0,w,h) })||sp.img;
// dibuja el sprite con los pies en (0,0); cx: eje horizontal (fracción del ancho)
function sprDraw(g,sp,img,cx,hit){ const w=sp.W, h=sp.H, x=-w*cx;
  g.drawImage(img,x,-h,w,h);
  if(hit){ const wi=sprWhite(sp); if(wi){ const a=g.globalAlpha; g.globalAlpha=a*hit*0.6; g.drawImage(wi,x,-h,w,h); g.globalAlpha=a } } }

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
  const sp=sprOf(cls);
  if(sp){   // sprite: respira quieto, se balancea al andar, se lanza al golpear (o retrocede al disparar) y destella al recibir
    if(o.ghost) g.globalAlpha=0.55;
    if(evo){ const a=g.globalAlpha; g.globalAlpha=a*(0.2+0.08*Math.sin(t*3)); g.fillStyle=trim; g.beginPath(); g.ellipse(0,-sp.H*0.48,sp.H*0.4,sp.H*0.56,0,0,TAU); g.fill(); g.globalAlpha=a; }
    const ranged=cls==='Arquero'||cls==='Mago'||cls==='Clerigo', k=atk?Math.sin(atk*Math.PI):0;
    g.translate(ranged?-k*3:k*8,-bob); g.rotate(walk?Math.sin(walk*9)*0.035:ranged?-k*0.05:k*0.13);
    const br=walk||atk?0:Math.sin(t*2.2)*0.015; g.scale(1-br*0.5,1+br);
    sprDraw(g,sp,sp.img,o.center?0.5:sp.ax,hit);
    g.restore(); return; }
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
// franjas de 30 fases: monstruos normales, jefe (cada 10 fases) y élite (fases 50, 100 y 150; Jefe semanal). La última franja es
// el portal (gólems) y, en el modo Infierno, el infierno (demonios). Sin élite propio en una franja, se usa el jefe.
const ZONES=[{n:['slime'],boss:'slimeKing',elite:'slimeKing'},                 // pradera
  {n:['goblin','bat','goblin'],boss:'hobgoblin',elite:'shaman'},                  // cueva: goblins y murciélagos (jefe Hobgoblin, élite Chamán)
  {n:['orc'],boss:'orcWarlord',elite:'orcWarlord'},                               // bosque: orcos (jefe Caudillo)
  {n:['skeleton'],boss:'skelKnight',elite:'lichKing'},                            // cementerio (jefe Caballero, élite Rey no muerto)
  {n:['golem'],boss:'golemBoss',elite:'portalGuard'},                             // portal (jefe Coloso, élite Guardián del portal)
  {n:['demon'],boss:'demonLord',elite:'archdemon'}];                              // infierno (modo Infierno)
// tipos sin dibujo propio todavía: se dibujan como su monstruo base (más grandes y con corona, por ser jefes)
const BASE={slimeKing:'slime',hobgoblin:'goblin',shaman:'goblin',orcWarlord:'orc',skelKnight:'skeleton',lichKing:'skeleton',golemBoss:'golem',portalGuard:'golem',demonLord:'demon',archdemon:'demon'};
const kindFor=(zone,i,o)=>{ o=o||{}; const zi=zone===4&&o.mode===2?5:Math.max(0,Math.min(4,zone|0)), z=ZONES[zi];
  return o.boss?(o.elite?z.elite:z.boss):z.n[i%z.n.length] };
const hsl=(h,s,l)=>`hsl(${h} ${s}% ${l}%)`;
function monster(g,x,y,o){
  const kk=o.kind||'slime', k=BASE[kk]||kk, r=o.r||13, s=r/13, t=o.t||0, die=o.die||0, hit=o.hit||0, atk=o.atk||0, walk=o.walk||0, hue=k==='demon'?0:o.hue||0;   // los demonios ya son del infierno: sin tinte
  g.save(); g.translate(x+(hit?hit*5:0)-(atk?Math.sin(atk*Math.PI)*8:0),y);
  if(die){ g.globalAlpha=1-die; g.translate(0,die*6); }
  shadow(g,12*s);
  g.scale(s,s);
  if(die) g.rotate(die*0.5);
  const eye=(ex,ey,c)=>{ g.fillStyle=c||'#fff'; g.beginPath(); g.arc(ex,ey,2.2,0,TAU); g.fill(); g.fillStyle=DARK; g.beginPath(); g.arc(ex-0.7,ey,1.1,0,TAU); g.fill(); };
  const sp=sprOf(kk)||sprOf(k);
  if(sp){ const a=atk?Math.sin(atk*Math.PI):0;
    if(k==='bat'){ const f=Math.sin(t*14); g.translate(0,-sp.fly+Math.sin(t*3)*3); g.scale(1,1+f*0.06); }
    else{ g.translate(0,walk?-Math.abs(Math.sin(walk*10))*1.5:0); g.rotate(walk?Math.sin(walk*10)*0.05:-a*0.15); const br=walk||atk?0:Math.sin(t*2.4)*0.015; g.scale(1-br*0.5,1+br); }
    sprDraw(g,sp,sprHue(sp,hue),sp.ax,hit); }
  else if(k==='slime'){ const sq=1+Math.sin(t*6+(walk||0)*8)*0.08;
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
  else if(k==='orc'){ const leg=walk?Math.sin(walk*8)*3:0, sk=hsl((100+hue)%360,30,38), sk2=hsl((100+hue)%360,30,27), arm='#2b2a30', arm2='#3f3e48';   // orco (provisional): armadura negra y hacha
    g.fillStyle=DARK; g.fillRect(-8+leg,-16,6,16); g.fillRect(2-leg,-16,6,16); g.fillStyle='#2a2226'; g.fillRect(-9+leg,-3,8,3); g.fillRect(1-leg,-3,8,3);
    g.fillStyle=arm; rr(g,-11,-37,22,23,5); g.fill(); g.fillStyle=arm2; g.fillRect(-9,-35,5,17); g.fillStyle='#7a2420'; g.fillRect(-11,-19,22,4);
    g.fillStyle=arm2; g.beginPath(); g.arc(-10,-35,6,Math.PI,0); g.fill(); g.beginPath(); g.arc(10,-35,6,Math.PI,0); g.fill();
    g.fillStyle=STEEL; [[-13,-40],[-8,-41],[8,-41],[13,-40]].forEach(([px,py])=>{ g.beginPath(); g.moveTo(px-1.5,py+2); g.lineTo(px,py-3); g.lineTo(px+1.5,py+2); g.fill() });
    g.fillStyle=sk; g.beginPath(); g.arc(-1,-44,8,0,TAU); g.fill(); g.beginPath(); g.moveTo(-8,-46); g.lineTo(-14,-49); g.lineTo(-8,-43); g.fill(); g.beginPath(); g.moveTo(6,-46); g.lineTo(11,-49); g.lineTo(6,-43); g.fill();
    g.fillStyle=sk2; g.fillRect(-9,-42,15,6); g.fillStyle='#f3e9d2'; [[-7,-42],[2,-42]].forEach(([px,py])=>{ g.beginPath(); g.moveTo(px,py); g.lineTo(px+1.2,py-4); g.lineTo(px+2.4,py); g.fill() });
    g.fillStyle=DARK; g.fillRect(-8,-49,12,1.6); g.fillStyle='#ff4a3a'; g.fillRect(-6,-47.5,2.5,2); g.fillRect(-1,-47.5,2.5,2);
    g.save(); g.translate(-8,-31); g.rotate(-0.15-(atk?Math.sin(atk*Math.PI)*1.4:0)); g.fillStyle=sk; g.fillRect(-2.5,-11,5,11); g.fillStyle=WOOD; g.fillRect(-1.5,-28,3,19);
      g.fillStyle=STEEL; g.beginPath(); g.moveTo(-1.5,-28); g.lineTo(-10,-31); g.quadraticCurveTo(-13,-24,-10,-17); g.lineTo(-1.5,-20); g.fill(); g.fillStyle='#8a2a22'; g.fillRect(-11,-25,2,5); g.restore(); }
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
  if(o.boss){ if(sp) g.translate((sp.hx-sp.ax)*sp.W,k==='bat'?7-sp.H:5-sp.H);   // sprite: corona sobre la cabeza
    const top=sp?0:k==='orc'?-54:k==='bat'?-36:k==='slime'?-22:k==='golem'?-44:k==='skeleton'?-40:k==='demon'?-47:-37;
    g.fillStyle=o.elite?'#c86bff':'#e8b04a'; g.beginPath(); g.moveTo(-8,top); g.lineTo(-6,top-8); g.lineTo(-2,top-3); g.lineTo(0,top-9); g.lineTo(2,top-3); g.lineTo(6,top-8); g.lineTo(8,top); g.closePath(); g.fill(); }
  if(hit&&!sp){ g.globalAlpha=hit*0.3; g.fillStyle='#fff'; g.beginPath(); g.ellipse(0,-16,12,14,0,0,TAU); g.fill(); g.globalAlpha=1; }
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
// los textos (nombre de habilidad, ¡Nivel!) se apilan uno encima de otro, no se pisan
function addFx(type,o){ const f={type,t0:now(),side:'hero',...(o||{})}; if(type==='name'||type==='levelup') f.row=FX.filter(x=>(x.type==='name'||x.type==='levelup')&&x.side===f.side&&now()-x.t0<(LIFE[x.type])).length; FX.push(f); if(FX.length>80) FX=FX.slice(-80) }
function shake(a){ SH=Math.min(8,Math.max(SH,a)) }
function shakeOffset(dt){ if(SH<0.05){ SH=0; return [0,0] } const o=[(Math.random()*2-1)*SH,(Math.random()*2-1)*SH]; SH*=Math.pow(0.02,dt); return o }
// duración de cada efecto (s); las de habilidad con efecto largo usan su 'dur'
const LIFE={levelup:1.4,loot:0.9,proj:0.18,slash:0.2,crit:0.35,name:1.1,bola:0.9,ejecutar:0.4,luz:0.8,perforante:0.35,muro:1,armaduraHielo:0.6,marca:0.6,nube:2,congelar:0.5,luzVuelve:0.6,reloj:0.7,combustionHit:0.6};
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
      g.fillText(f.text,x,gy-100-k*12-(f.row||0)*16); }   // si salen varias a la vez, una encima de otra
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
    else if(f.type==='levelup'){ const r=10+k*46; g.globalAlpha=1-k; g.strokeStyle='#ffd35a'; g.lineWidth=3; glow(g,'#ffd35a',16); g.beginPath(); g.ellipse(me,gy-30,r,r*0.6,0,0,TAU); g.stroke();
      for(let i=0;i<10;i++){ const a=i*TAU/10+age, rr2=14+k*40; orb(g,me+Math.cos(a)*rr2,gy-30+Math.sin(a)*rr2*0.6-k*20,2,'#ffe38a') }
      g.globalAlpha=Math.min(1,(1-k)*2); g.font='900 15px "Nunito Sans", system-ui, sans-serif'; g.textAlign='center'; g.fillStyle='#ffd35a'; glow(g,'#000',5); g.fillText(f.text,Math.max(40,me),gy-104-k*16-(f.row||0)*16); }
    else if(f.type==='loot'){ const x=to; g.globalAlpha=1-k; g.fillStyle='#ffd35a'; glow(g,'#ffd35a',18); for(let i=0;i<10;i++){ const a=i*TAU/10+age*1.5; g.save(); g.translate(x,gy-30); g.rotate(a); g.fillRect(8,-1.5,20+k*30,3); g.restore() } }
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

/* ---------- escenarios ----------
   scene(g, W, H, gy, zone, scroll, mode, t): fondo en capas (cielo, lejos, medio y suelo) que se desplazan a distinta velocidad
   (parallax) según 'scroll' (cuánto ha andado el héroe). Mismo estilo que los personajes: contorno oscuro, sombreado plano y luces vivas.
   zone (franjas de 30 fases): 0 pradera, 1 cueva, 2 bosque, 3 cementerio, 4 portal; 'hell' infierno (la zona 4 en el modo Infierno),
   'arena' (PvP). mode: 1 Pesadilla (tinte morado), 2 Infierno (tinte rojo; la zona 4 pasa a ser el infierno).
   Cada capa se pinta una vez en una imagen (por tamaño de pantalla) y luego solo se copia; lo animado (luciérnagas, ascuas,
   niebla, el remolino del portal) se dibuja en cada fotograma. */
const rnd=i=>{ const x=Math.sin(i*127.1+311.7)*43758.5453; return x-Math.floor(x) };   // azar fijo (siempre igual para cada i)
// repite un dibujo cada 'tw' unidades, desplazado por 'off'
function tiles(W,tw,off,fn){ const o=((off%tw)+tw)%tw; for(let k=-1;k*tw-o<W+tw;k++) fn(k*tw-o,k) }
const OUT='#15101a';
const rgba=(hex,a)=>{ const n=parseInt(hex.slice(1),16); return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})` };
// relleno con el contorno de los personajes
function ink(g,fill,lw){ if(fill){ g.fillStyle=fill; g.fill() } g.lineWidth=lw||1.1; g.strokeStyle=OUT; g.stroke() }
// luz (se suma a lo de debajo)
function light(g,x,y,r,col,a){ const gr=g.createRadialGradient(x,y,0,x,y,r); gr.addColorStop(0,rgba(col,a==null?0.8:a)); gr.addColorStop(1,rgba(col,0));
  g.save(); g.globalCompositeOperation='lighter'; g.fillStyle=gr; g.fillRect(x-r,y-r,2*r,2*r); g.restore() }
function grad(g,y0,y1,stops){ const gr=g.createLinearGradient(0,y0,0,y1); stops.forEach((c,i)=>gr.addColorStop(i/(stops.length-1),c)); return gr }
// dibuja fn en x y en sus copias a ±P (para que la capa empalme sin costura)
const rep=(P,x,fn)=>{ fn(x-P); fn(x); fn(x+P) };
// línea de colinas que se repite cada P (suma de senos)
function ridge(g,P,base,amp,f,ph,bot){ g.beginPath(); g.moveTo(-2,bot); for(let x=-2;x<=P+2;x+=4){ let y=base; f.forEach((k,i)=>{ y-=amp[i]*Math.sin(TAU*k*x/P+ph[i]) }); g.lineTo(x,y) } g.lineTo(P+2,bot); g.closePath() }
// nube: un solo contorno alrededor de todas sus bolas, con el borde de abajo encendido
function cloud(g,cx,cy,w,c,lit){ const B=[[0,1,w*0.8,5]]; for(let k=0;k<5;k++){ const r=w*(0.16+0.1*Math.sin(k*1.9+1.2)+(k===2?0.08:0)); B.push([-w*0.62+k*w*0.31,-r*0.55,r,r*0.8]) } const path=()=>{ g.beginPath(); B.forEach(([x,y,a,b])=>{ g.moveTo(cx+x+a,cy+y); g.ellipse(cx+x,cy+y,a,b,0,0,TAU) }) };
  path(); g.lineWidth=2; g.strokeStyle=OUT; g.stroke(); g.fillStyle=c; g.fill(); g.save(); path(); g.clip(); g.beginPath(); g.ellipse(cx,cy+6,w,3.4,0,0,TAU); g.fillStyle=lit; g.fill(); g.restore() }
// estrellas
function stars(g,W,h,n,seed){ for(let i=0;i<n;i++){ g.globalAlpha=0.25+rnd(seed+i*3)*0.6; g.fillStyle='#e8ecff'; const s=rnd(seed+i*7)>0.85?1.6:0.9; g.fillRect(rnd(seed+i)*W,rnd(seed+i*5)*h,s,s) } g.globalAlpha=1 }
// roca facetada: base, cara en sombra a la derecha y brillo a la izquierda
function rock(g,x,y,w,h,c,sh,hi){ g.beginPath(); g.moveTo(x,y); g.lineTo(x+w*0.15,y-h*0.7); g.lineTo(x+w*0.45,y-h); g.lineTo(x+w*0.8,y-h*0.75); g.lineTo(x+w,y); g.closePath(); g.fillStyle=c; g.fill();
  g.beginPath(); g.moveTo(x+w*0.45,y-h); g.lineTo(x+w*0.8,y-h*0.75); g.lineTo(x+w,y); g.lineTo(x+w*0.55,y); g.closePath(); g.fillStyle=sh; g.fill();
  g.beginPath(); g.moveTo(x+w*0.15,y-h*0.7); g.lineTo(x+w*0.45,y-h); g.strokeStyle=hi; g.lineWidth=1.2; g.stroke();
  g.beginPath(); g.moveTo(x,y); g.lineTo(x+w*0.15,y-h*0.7); g.lineTo(x+w*0.45,y-h); g.lineTo(x+w*0.8,y-h*0.75); g.lineTo(x+w,y); ink(g,null,1) }
// cristal (cian o morado) con su brillo
function crystal(g,x,y,h,c,lite){ const w=h*0.35; g.beginPath(); g.moveTo(x-w,y); g.lineTo(x-w,y-h*0.7); g.lineTo(x,y-h); g.lineTo(x+w,y-h*0.7); g.lineTo(x+w,y); g.closePath(); ink(g,c,0.9);
  g.beginPath(); g.moveTo(x,y-h); g.lineTo(x+w,y-h*0.7); g.lineTo(x+w,y); g.lineTo(x,y); g.closePath(); g.fillStyle='rgba(0,0,0,.28)'; g.fill();
  g.beginPath(); g.moveTo(x-w*0.5,y-h*0.15); g.lineTo(x-w*0.5,y-h*0.7); g.strokeStyle=lite; g.lineWidth=0.9; g.stroke() }
// árbol de copa redonda
function tree(g,x,y,s,trunk,c,sh,hi){ g.beginPath(); g.moveTo(x-2*s,y); g.lineTo(x-1.4*s,y-14*s); g.lineTo(x+1.4*s,y-14*s); g.lineTo(x+2*s,y); g.closePath(); ink(g,trunk,1);
  const B=[[-8,-20,9],[7,-21,9],[0,-28,11],[-4,-34,8],[5,-33,7]];
  g.beginPath(); B.forEach(([bx,by,r])=>{ g.moveTo(x+bx*s+r*s,y+by*s); g.arc(x+bx*s,y+by*s,r*s,0,TAU) }); g.fillStyle=sh; g.fill(); g.lineWidth=2.2; g.strokeStyle=OUT; g.stroke(); g.fill();
  g.beginPath(); B.forEach(([bx,by,r])=>{ g.moveTo(x+bx*s-1.5*s+r*s*0.75,y+by*s-1.5*s); g.arc(x+bx*s-1.5*s,y+by*s-1.5*s,r*s*0.75,0,TAU) }); g.fillStyle=c; g.fill();
  g.fillStyle=hi; B.slice(2).forEach(([bx,by,r])=>{ g.beginPath(); g.arc(x+bx*s-r*s*0.35,y+by*s-r*s*0.4,r*s*0.32,0,TAU); g.fill() }) }
// pino (triángulos en pisos)
function pine(g,x,y,h,c,hi,lw){ const w=h*0.36; for(let j=0;j<3;j++){ const yb=y-j*h*0.26, yt=yb-h*0.48; g.beginPath(); g.moveTo(x-w*(1-j*0.22),yb); g.lineTo(x,yt); g.lineTo(x+w*(1-j*0.22),yb); g.closePath(); ink(g,c,lw||0.9);
  if(hi){ g.beginPath(); g.moveTo(x-1,yt+3); g.lineTo(x-w*(1-j*0.22)*0.7,yb-1.5); g.strokeStyle=hi; g.lineWidth=1; g.stroke() } } }

/* definición de cada escenario: cielo (fijo), capas [velocidad, periodo, alto sobre el suelo, dibujo] y animación */
const SCN={
  0:{ // pradera al atardecer: sol bajo, nubes encendidas, colinas, árboles, molino y flores
    sky:(g,W,gy)=>{ g.fillStyle=grad(g,0,gy,['#0d1230','#27275a','#6a3a62','#d8684a']); g.fillRect(0,0,W,gy+1); stars(g,W,gy*0.45,26,11);
      const sx=W*0.7, sy=gy-46; light(g,sx,sy,90,'#ff7a3a',0.55); g.beginPath(); g.arc(sx,sy,24,0,TAU); ink(g,'#ffb85a',1.4); g.beginPath(); g.arc(sx-5,sy-5,15,0,TAU); g.fillStyle='#ffd88a'; g.fill();
      for(let i=0;i<4;i++){ const cx=W*(0.12+i*0.27+rnd(40+i)*0.1), cy=gy*(0.12+(i%2)*0.14+rnd(50+i)*0.08), w=22+rnd(60+i)*18; cloud(g,cx,cy,w,'#3a2d62','#e0785a') } },
    layers:[
      [0.1,400,95,(g,P,gy)=>{ ridge(g,P,gy-34,[16,9],[2,3],[1,4],gy+2); ink(g,'#2b2c5a',1); g.save(); g.clip(); ridge(g,P,gy-31,[16,9],[2,3],[1,4],gy+2); g.fillStyle='#24244e'; g.fill(); g.restore();
        for(let i=0;i<5;i++){ const x=rnd(70+i)*P; rep(P,x,xx=>{ g.beginPath(); g.arc(xx,gy-40-rnd(80+i)*14,4,0,TAU); g.rect(xx-0.6,gy-40-rnd(80+i)*14,1.2,10); ink(g,'#1f2246',0.8) }) } }],
      [0.35,300,70,(g,P,gy)=>{ ridge(g,P,gy-12,[7,4],[1,3],[0.5,2],gy+2); ink(g,'#1f3d33',1.1); ridge(g,P,gy-10,[7,4],[1,3],[0.5,2],gy+2); g.save(); g.clip(); g.fillStyle='#1a3329'; g.fillRect(0,gy-20,P,30); g.restore();
        const mx=P*0.62; rep(P,mx,x=>{ g.beginPath(); g.moveTo(x-7,gy-12); g.lineTo(x-4,gy-44); g.lineTo(x+4,gy-44); g.lineTo(x+7,gy-12); g.closePath(); ink(g,'#4a3434',1); g.beginPath(); g.moveTo(x-5.5,gy-44); g.lineTo(x,gy-50); g.lineTo(x+5.5,gy-44); ink(g,'#7a2a2a',1);
          g.beginPath(); g.rect(x-1.5,gy-26,3,5); g.fillStyle='#ffcf6a'; g.fill(); light(g,x,gy-24,8,'#ffb347',0.6);
          for(let j=0;j<4;j++){ const a=j*TAU/4+0.4; g.save(); g.translate(x,gy-42); g.rotate(a); g.beginPath(); g.rect(-1,0,2,20); g.rect(-1,6,5,13); ink(g,'#c9b28a',0.8); g.restore() } });
        [0.15,0.34,0.86].forEach((f,i)=>rep(P,f*P,x=>tree(g,x,gy-8,0.9+rnd(90+i)*0.35,'#3a2a22','#2f6a34','#1e4426','#5fa040'))) }],
      [1,160,14,(g,P,gy,H)=>{ g.fillStyle='#24331a'; g.fillRect(0,gy,P,H-gy); pebbles(g,P,gy,H,'#1a2612','#3a5228',2000); g.fillStyle='#3d2e20'; g.fillRect(0,gy+9,P,10); g.fillStyle='#4e3b28'; for(let i=0;i<6;i++) g.fillRect(rnd(100+i)*P,gy+11+rnd(110+i)*5,6,1.5);
        g.beginPath(); g.moveTo(0,gy+9); g.lineTo(P,gy+9); g.moveTo(0,gy+19); g.lineTo(P,gy+19); g.strokeStyle=OUT; g.lineWidth=0.8; g.stroke();
        g.beginPath(); g.moveTo(-2,gy+3); for(let x=-2;x<=P+2;x+=4) g.lineTo(x,gy-1.5-((x/4)%2?2.5:0)); g.lineTo(P+2,gy+3); g.closePath(); ink(g,'#4f8a34',1); g.beginPath(); g.moveTo(0,gy+0.5); g.lineTo(P,gy+0.5); g.strokeStyle='#86c24e'; g.lineWidth=1; g.stroke();
        for(let i=0;i<9;i++){ const x=rnd(130+i)*P, c=['#ffd23e','#e2605a','#c070ff'][i%3]; rep(P,x,xx=>{ g.beginPath(); g.moveTo(xx,gy); g.lineTo(xx,gy-5); g.strokeStyle='#2f5a22'; g.lineWidth=0.8; g.stroke(); g.beginPath(); g.arc(xx,gy-6,1.8,0,TAU); ink(g,c,0.6) }) }
        for(let i=0;i<3;i++) rep(P,rnd(150+i)*P,x=>rock(g,x,gy+3,7,5,'#6a6460','#4a4442','#8a847c')) }]],
    fx:(g,W,H,gy,sc,t)=>{ for(let i=0;i<9;i++){ const x=((rnd(i)*W*1.4-sc*0.6+Math.sin(t*0.6+i)*14)%W+W)%W, y=gy-14-rnd(i+20)*70+Math.sin(t*1.3+i*2)*6, a=0.5+0.5*Math.sin(t*3+i*1.7);
      light(g,x,y,5,'#d8ff6a',0.55*a); g.fillStyle=rgba('#f4ffb0',a); g.fillRect(x-0.7,y-0.7,1.4,1.4) } } },

  1:{ // cueva de los goblins: estalactitas, columnas, cristales y setas que brillan, antorchas del campamento
    sky:(g,W,gy)=>{ g.fillStyle=grad(g,0,gy,['#06050b','#120e20','#1e1630']); g.fillRect(0,0,W,gy+1);
      for(let i=0;i<5;i++) light(g,rnd(200+i)*W,gy*(0.3+rnd(210+i)*0.5),30+rnd(220+i)*30,i%2?'#6a3aff':'#2ab0ff',0.18) },
    layers:[
      [0.1,360,9999,(g,P,gy)=>{ for(let i=0;i<9;i++){ const x=rnd(300+i)*P, h=20+rnd(310+i)*40, w=8+rnd(320+i)*12; rep(P,x,xx=>{ g.beginPath(); g.moveTo(xx-w,-2); g.lineTo(xx,h); g.lineTo(xx+w,-2); ink(g,'#1d162c',1); g.beginPath(); g.moveTo(xx-w*0.5,0); g.lineTo(xx-1,h*0.8); g.strokeStyle='#3a2f55'; g.lineWidth=1; g.stroke() }) }
        ridge(g,P,gy-30,[14,8,5],[2,3,7],[0,1,2],gy+2); ink(g,'#1f1832',1); ridge(g,P,gy-27,[14,8,5],[2,3,7],[0,1,2],gy+2); g.fillStyle='#1a142a'; g.fill();
        for(let i=0;i<6;i++){ const x=rnd(330+i)*P, y=gy-24-rnd(340+i)*20; rep(P,x,xx=>{ light(g,xx,y,10,i%2?'#d06bff':'#5fe3ff',0.35); crystal(g,xx,y+4,7,i%2?'#a052e0':'#3cb8e0','#e8f8ff') }) } }],
      [0.4,280,9999,(g,P,gy)=>{ [0.2,0.68].forEach((f,i)=>rep(P,f*P,x=>{ const w=11+rnd(400+i)*6; g.beginPath(); g.moveTo(x-w-8,-2); g.quadraticCurveTo(x-w,30,x-w*0.8,gy*0.5); g.quadraticCurveTo(x-w,gy-20,x-w-10,gy+1); g.lineTo(x+w+10,gy+1); g.quadraticCurveTo(x+w,gy-20,x+w*0.8,gy*0.5); g.quadraticCurveTo(x+w,30,x+w+8,-2); g.closePath(); ink(g,'#2c2342',1.3);
          g.save(); g.clip(); g.fillStyle='#1d172e'; g.fillRect(x+w*0.25,-2,w*2,gy+4); g.fillStyle='#4a3d6a'; g.fillRect(x-w*0.8,-2,2.2,gy+4); g.restore();
          for(let j=0;j<3;j++){ g.beginPath(); g.moveTo(x-w*0.5+j*w*0.4,gy*(0.25+j*0.2)); g.lineTo(x-w*0.2+j*w*0.4,gy*(0.25+j*0.2)+6); g.strokeStyle=OUT; g.lineWidth=0.8; g.stroke() }
          const c=i?'#d06bff':'#5fe3ff', cd=i?'#9a4ad8':'#30a8d8'; light(g,x+w+6,gy-8,26,c,0.45); crystal(g,x+w+2,gy+1,16,cd,'#f0fbff'); crystal(g,x+w+10,gy+1,10,cd,'#f0fbff'); crystal(g,x+w-5,gy+1,8,cd,'#f0fbff') }));
        const tx=P*0.45; rep(P,tx,x=>{ g.beginPath(); g.moveTo(x,gy-26); g.lineTo(x+2,gy+1); ink(g,'#5a3a24',1.6); g.beginPath(); g.moveTo(x-3,gy-26); g.quadraticCurveTo(x,gy-38,x+3,gy-26); g.closePath(); ink(g,'#ffb347',0.9); light(g,x,gy-30,22,'#ff8a2a',0.6);
          g.beginPath(); g.moveTo(x+14,gy+1); g.lineTo(x+22,gy-16); g.lineTo(x+30,gy+1); g.closePath(); ink(g,'#5a4a3a',1.1); g.beginPath(); g.moveTo(x+22,gy-16); g.lineTo(x+26,gy+1); g.strokeStyle=OUT; g.lineWidth=0.8; g.stroke() }) }],
      [1,140,12,(g,P,gy,H)=>{ g.fillStyle='#19142a'; g.fillRect(0,gy,P,H-gy); pebbles(g,P,gy,H,'#120e1e','#3a3052',2100); g.beginPath(); g.moveTo(-2,gy+4); for(let x=-2;x<=P+2;x+=7) g.lineTo(x,gy-1-rnd((((x%P)+P)%P)*0.37)*2.5); g.lineTo(P+2,gy+4); g.closePath(); ink(g,'#3a3052',1); g.beginPath(); g.moveTo(0,gy+0.5); g.lineTo(P,gy+0.5); g.strokeStyle='#5c4e80'; g.lineWidth=0.9; g.stroke();
        g.fillStyle='rgba(0,0,0,.25)'; for(let i=0;i<7;i++) g.fillRect(rnd(500+i)*P,gy+7+rnd(510+i)*14,8,2);
        for(let i=0;i<3;i++) rep(P,rnd(520+i)*P,x=>rock(g,x,gy+3,9,6,'#3e3456','#2a2340','#5c5080'));
        for(let i=0;i<4;i++) rep(P,rnd(530+i)*P,x=>{ light(g,x,gy-3,9,'#4affd0',0.5); g.beginPath(); g.moveTo(x,gy+1); g.lineTo(x,gy-3); g.strokeStyle='#cfe'; g.lineWidth=1; g.stroke(); g.beginPath(); g.ellipse(x,gy-4,3.2,2,0,Math.PI,0); g.closePath(); ink(g,'#3ae0b8',0.7) }) }]],
    fx:(g,W,H,gy,sc,t)=>{ for(let i=0;i<4;i++){ const per=2.2+rnd(i)*1.5, k=((t+rnd(i+5)*per)%per)/per, x=rnd(i+9)*W; g.fillStyle='#8ad8ff'; g.globalAlpha=0.7*(1-k); g.fillRect(x,k*gy,1,3); } g.globalAlpha=1;
      for(let i=0;i<10;i++){ const x=((rnd(i+30)*W-sc*0.5)%W+W)%W+Math.sin(t+i)*4, y=gy-((t*6*(1+rnd(i+40))+rnd(i+50)*gy)%gy); g.fillStyle=i%2?'#c48aff':'#7fe8ff'; g.globalAlpha=0.5; g.fillRect(x,y,1.2,1.2) } g.globalAlpha=1 } },

  2:{ // bosque de los orcos: pinos en la niebla, troncos enormes, tótems con calavera y estandarte rojo, helechos y setas
    sky:(g,W,gy)=>{ g.fillStyle=grad(g,0,gy,['#060f10','#0e2522','#1a3d33']); g.fillRect(0,0,W,gy+1);
      g.save(); g.globalCompositeOperation='lighter'; for(let i=0;i<3;i++){ const x=W*(0.2+i*0.3); g.beginPath(); g.moveTo(x,0); g.lineTo(x+16,0); g.lineTo(x+60,gy); g.lineTo(x+30,gy); g.closePath(); g.fillStyle='rgba(160,255,200,.035)'; g.fill() } g.restore() },
    layers:[
      [0.1,380,170,(g,P,gy)=>{ for(let i=0;i<10;i++) rep(P,rnd(600+i)*P,x=>pine(g,x,gy-22,55+rnd(610+i)*35,'#163a35',null,0.8)); g.fillStyle=grad(g,gy-60,gy,['rgba(90,150,130,0)','rgba(90,150,130,.25)']); g.fillRect(0,gy-60,P,62);
        for(let i=0;i<12;i++) rep(P,rnd(620+i)*P,x=>pine(g,x,gy+1,38+rnd(630+i)*26,'#102b26','#24504a',0.9)) }],
      [0.4,320,9999,(g,P,gy)=>{ [0.12,0.58].forEach((f,i)=>rep(P,f*P,x=>{ const w=9+rnd(700+i)*4; g.beginPath(); g.moveTo(x-w,-2); g.lineTo(x-w,gy-10); g.quadraticCurveTo(x-w-4,gy-2,x-w-12,gy+1); g.lineTo(x+w+12,gy+1); g.quadraticCurveTo(x+w+4,gy-2,x+w,gy-10); g.lineTo(x+w,-2); g.closePath(); ink(g,'#2e231c',1.3);
          g.save(); g.clip(); g.fillStyle='#1d1612'; g.fillRect(x+w*0.3,-2,w*2,gy+4); g.fillStyle='#4a3a2c'; g.fillRect(x-w+1.5,-2,2,gy+4); g.restore();
          for(let j=0;j<6;j++){ g.beginPath(); g.moveTo(x-w*0.4+((j*7)%9)-2,gy*(0.1+j*0.14)); g.lineTo(x-w*0.4+((j*7)%9),gy*(0.1+j*0.14)+10); g.strokeStyle=OUT; g.lineWidth=0.8; g.stroke() }
          g.beginPath(); [[-22,26,20],[4,18,24],[26,30,18]].forEach(([bx,by,r])=>{ g.moveTo(x+bx+r,by); g.arc(x+bx,by,r,0,TAU) }); g.fillStyle='#173d26'; g.fill(); g.lineWidth=2.2; g.strokeStyle=OUT; g.stroke(); g.fill();
          g.fillStyle='#24603a'; [[-24,22,13],[2,13,16],[24,26,11]].forEach(([bx,by,r])=>{ g.beginPath(); g.arc(x+bx,by,r,0,TAU); g.fill() });
          for(let j=0;j<3;j++){ const vx=x-16+j*16, vl=30+rnd(720+i*3+j)*30; g.beginPath(); g.moveTo(vx,34); g.quadraticCurveTo(vx+4,34+vl/2,vx,34+vl); g.strokeStyle='#2f6a34'; g.lineWidth=1.2; g.stroke(); g.fillStyle='#4e9a48'; for(let q=10;q<vl;q+=9){ g.beginPath(); g.ellipse(vx+2,34+q,2,1.2,0.5,0,TAU); g.fill() } } }));
        const tx=P*0.36; rep(P,tx,x=>{ g.beginPath(); g.rect(x-1.6,gy-46,3.2,47); ink(g,'#4a3424',1); g.beginPath(); g.rect(x-10,gy-40,20,3); ink(g,'#4a3424',1);
          g.beginPath(); g.moveTo(x-8,gy-37); g.lineTo(x+8,gy-37); g.lineTo(x+8,gy-14); g.lineTo(x+4,gy-18); g.lineTo(x,gy-13); g.lineTo(x-4,gy-18); g.lineTo(x-8,gy-14); g.closePath(); ink(g,'#a82a22',1); g.fillStyle='#e04a3a'; g.fillRect(x-7,gy-36,2,17); g.fillStyle='#15101a'; g.fillRect(x-3,gy-31,6,1.5); g.fillRect(x-1,gy-34,2,8);
          g.beginPath(); g.arc(x,gy-50,5,0,TAU); ink(g,'#e8e2cf',1); g.beginPath(); g.rect(x-3,gy-47,6,4); ink(g,'#e8e2cf',0.8); g.fillStyle=OUT; g.fillRect(x-3,gy-52,2.2,2.4); g.fillRect(x+0.8,gy-52,2.2,2.4);
          g.beginPath(); g.moveTo(x-5,gy-53); g.lineTo(x-9,gy-60); g.lineTo(x-4,gy-55); g.moveTo(x+5,gy-53); g.lineTo(x+9,gy-60); g.lineTo(x+4,gy-55); ink(g,'#d8d0b8',0.8) }) }],
      [1,150,14,(g,P,gy,H)=>{ g.fillStyle='#16200f'; g.fillRect(0,gy,P,H-gy); pebbles(g,P,gy,H,'#0f170a','#2f4a22',2200); g.fillStyle='rgba(0,0,0,.22)'; for(let i=0;i<6;i++) g.fillRect(rnd(800+i)*P,gy+7+rnd(810+i)*14,9,2);
        g.beginPath(); g.moveTo(-2,gy+3); for(let x=-2;x<=P+2;x+=3) g.lineTo(x,gy-1-((x/3)%2?2:0)); g.lineTo(P+2,gy+3); g.closePath(); ink(g,'#2f5a26',1); g.beginPath(); g.moveTo(0,gy+0.5); g.lineTo(P,gy+0.5); g.strokeStyle='#58923e'; g.lineWidth=1; g.stroke();
        for(let i=0;i<4;i++) rep(P,rnd(820+i)*P,x=>{ for(let j=-2;j<=2;j++){ g.beginPath(); g.moveTo(x,gy); g.quadraticCurveTo(x+j*4,gy-10,x+j*7,gy-7+Math.abs(j)); ink(g,null,2.2); g.strokeStyle='#2d6630'; g.lineWidth=1.2; g.stroke() } });
        for(let i=0;i<3;i++) rep(P,rnd(840+i)*P,x=>{ g.beginPath(); g.rect(x-1,gy-4,2,4); ink(g,'#e8dcc0',0.7); g.beginPath(); g.ellipse(x,gy-4.5,4,2.6,0,Math.PI,0); g.closePath(); ink(g,'#d6402f',0.8); g.fillStyle='#fff'; g.fillRect(x-2,gy-6,1,1); g.fillRect(x+1,gy-5.5,1,1) }) }]],
    fx:(g,W,H,gy,sc,t)=>{ g.fillStyle='rgba(170,230,200,.05)'; tiles(W,170,sc*0.7+t*5,(x)=>{ g.beginPath(); g.ellipse(x+80,gy-8,80,10,0,0,TAU); g.fill() });
      for(let i=0;i<7;i++){ const x=((rnd(i+60)*W-sc*0.5+Math.sin(t*0.5+i)*10)%W+W)%W, y=gy-20-rnd(i+70)*80+Math.sin(t*1.1+i)*5, a=0.5+0.5*Math.sin(t*2.6+i*1.3); light(g,x,y,5,'#ffe066',0.5*a); g.fillStyle=rgba('#fff4b0',a); g.fillRect(x-0.6,y-0.6,1.2,1.2) } } },

  3:{ // cementerio: luna grande, capilla con ventanas encendidas, árboles secos, verja, lápidas y niebla verde
    sky:(g,W,gy)=>{ g.fillStyle=grad(g,0,gy,['#07081a','#17163a','#33285a']); g.fillRect(0,0,W,gy+1); stars(g,W,gy*0.7,34,21);
      const mx=W*0.72, my=gy*0.28; light(g,mx,my,85,'#9affc8',0.3); g.beginPath(); g.arc(mx,my,22,0,TAU); ink(g,'#e4f0d0',1.3); g.fillStyle='#c4d4b0'; [[-7,-5,4],[6,4,5],[-3,9,3]].forEach(([a,b,r])=>{ g.beginPath(); g.arc(mx+a,my+b,r,0,TAU); g.fill() });
      for(let i=0;i<3;i++){ const bx=mx-30+i*22, by=my+18+i*6; g.beginPath(); g.moveTo(bx-5,by-2); g.quadraticCurveTo(bx-2,by-4,bx,by); g.quadraticCurveTo(bx+2,by-4,bx+5,by-2); g.lineTo(bx,by+1); g.closePath(); g.fillStyle=OUT; g.fill() } },
    layers:[
      [0.1,420,150,(g,P,gy)=>{ ridge(g,P,gy-16,[8,5],[1,3],[2,0],gy+2); ink(g,'#141430',1);
        const cx=P*0.3; rep(P,cx,x=>{ g.beginPath(); g.rect(x-16,gy-46,32,32); ink(g,'#1c1a38',1.1); g.beginPath(); g.moveTo(x-19,gy-46); g.lineTo(x,gy-64); g.lineTo(x+19,gy-46); g.closePath(); ink(g,'#221f44',1.1); g.beginPath(); g.rect(x+8,gy-88,9,42); ink(g,'#1c1a38',1.1); g.beginPath(); g.moveTo(x+6,gy-88); g.lineTo(x+12.5,gy-104); g.lineTo(x+19,gy-88); g.closePath(); ink(g,'#221f44',1);
          g.fillStyle=OUT; g.fillRect(x+12,gy-112,1.4,9); g.fillRect(x+9.5,gy-109,6.4,1.4);
          [[x-9,gy-38],[x+3,gy-38],[x+12.5,gy-78]].forEach(([wx,wy])=>{ light(g,wx,wy+3,9,'#ffb347',0.5); g.beginPath(); g.moveTo(wx-2.5,wy+7); g.lineTo(wx-2.5,wy+1); g.arc(wx,wy+1,2.5,Math.PI,0); g.lineTo(wx+2.5,wy+7); g.closePath(); ink(g,'#ffcf6a',0.7) }) });
        [0.62,0.85].forEach((f,i)=>rep(P,f*P,x=>{ const h=40+i*14; g.strokeStyle=OUT; g.lineCap='round'; g.lineWidth=4; g.beginPath(); g.moveTo(x,gy-14); g.quadraticCurveTo(x-3,gy-14-h*0.5,x+2,gy-14-h); g.stroke();
          [[0.5,-1],[0.65,1],[0.8,-1]].forEach(([k,d])=>{ g.lineWidth=2; g.beginPath(); g.moveTo(x-1,gy-14-h*k); g.quadraticCurveTo(x+d*8,gy-18-h*k,x+d*14,gy-26-h*k); g.stroke() }); g.strokeStyle='#221f3a'; g.lineWidth=2; g.beginPath(); g.moveTo(x,gy-14); g.quadraticCurveTo(x-3,gy-14-h*0.5,x+2,gy-14-h); g.stroke() })) }],
      [0.4,264,80,(g,P,gy)=>{ g.strokeStyle=OUT; g.lineWidth=1.6; g.beginPath(); g.moveTo(0,gy-22); g.lineTo(P,gy-22); g.moveTo(0,gy-8); g.lineTo(P,gy-8); g.stroke();
        for(let x=4;x<P;x+=8){ g.beginPath(); g.moveTo(x,gy+1); g.lineTo(x,gy-28); g.strokeStyle=OUT; g.lineWidth=1.6; g.stroke(); g.beginPath(); g.moveTo(x-1.8,gy-27); g.lineTo(x,gy-32); g.lineTo(x+1.8,gy-27); g.closePath(); g.fillStyle=OUT; g.fill(); g.beginPath(); g.moveTo(x+0.5,gy-26); g.lineTo(x+0.5,gy-2); g.strokeStyle='#3a3858'; g.lineWidth=0.6; g.stroke() }
        for(let i=0;i<6;i++){ const x=rnd(900+i)*P, h=13+rnd(910+i)*9, w=8+rnd(920+i)*4, cross=rnd(930+i)>0.65; rep(P,x,xx=>{ if(cross){ g.beginPath(); g.rect(xx-1.8,gy-h-6,3.6,h+7); g.rect(xx-6,gy-h,12,3.4); ink(g,'#545870',1); g.fillStyle='#7a7f96'; g.fillRect(xx-1.4,gy-h-5,1,h+5) }
          else{ g.beginPath(); g.moveTo(xx-w/2,gy+1); g.lineTo(xx-w/2,gy-h+w/2); g.arc(xx,gy-h+w/2,w/2,Math.PI,0); g.lineTo(xx+w/2,gy+1); g.closePath(); ink(g,'#4e5268',1.1); g.save(); g.clip(); g.fillStyle='#363a50'; g.fillRect(xx+w*0.15,gy-h-2,w,h+4); g.fillStyle='#727790'; g.fillRect(xx-w/2+0.8,gy-h+w/2,1.2,h-w/2); g.restore();
            g.fillStyle=OUT; g.fillRect(xx-2.5,gy-h+w/2+2,5,1); g.fillRect(xx-0.5,gy-h+w/2,1,5); g.beginPath(); g.moveTo(xx+1,gy-6); g.lineTo(xx+2.5,gy-3); g.lineTo(xx+1.5,gy); g.strokeStyle=OUT; g.lineWidth=0.6; g.stroke() } }) }
        const lx=P*0.5; rep(P,lx,x=>{ g.beginPath(); g.rect(x-0.9,gy-34,1.8,35); ink(g,'#2a2838',0.8); g.beginPath(); g.rect(x-3,gy-41,6,7); ink(g,'#2a2838',0.9); light(g,x,gy-37,16,'#7affb0',0.65); g.fillStyle='#b8ffd0'; g.fillRect(x-1.5,gy-39.5,3,4) }) }],
      [1,150,14,(g,P,gy,H)=>{ g.fillStyle='#16161e'; g.fillRect(0,gy,P,H-gy); pebbles(g,P,gy,H,'#0e0e14','#3a3a4a',2300); g.fillStyle='rgba(0,0,0,.25)'; for(let i=0;i<6;i++) g.fillRect(rnd(1000+i)*P,gy+7+rnd(1010+i)*14,9,2);
        g.beginPath(); g.moveTo(-2,gy+3); for(let x=-2;x<=P+2;x+=3) g.lineTo(x,gy-0.5-((x/3)%2?0:2.2)); g.lineTo(P+2,gy+3); g.closePath(); ink(g,'#36402f',1); g.beginPath(); g.moveTo(0,gy+0.5); g.lineTo(P,gy+0.5); g.strokeStyle='#5a6a48'; g.lineWidth=0.9; g.stroke();
        for(let i=0;i<2;i++) rep(P,rnd(1020+i)*P,x=>{ g.beginPath(); g.ellipse(x,gy+1,9,3.5,0,Math.PI,0); ink(g,'#2e2a26',0.9) });
        for(let i=0;i<3;i++) rep(P,rnd(1030+i)*P,x=>{ g.beginPath(); g.moveTo(x-3,gy-0.5); g.lineTo(x+3,gy-1.5); g.strokeStyle='#d8d0b8'; g.lineWidth=1.3; g.stroke(); g.beginPath(); g.arc(x+6,gy-2,2,0,TAU); ink(g,'#d8d0b8',0.6) }) }]],
    fx:(g,W,H,gy,sc,t)=>{ g.fillStyle='rgba(140,255,190,.06)'; tiles(W,150,sc*0.9+t*7,(x)=>{ g.beginPath(); g.ellipse(x+70,gy-3,72,8,0,0,TAU); g.fill() }); tiles(W,210,sc*0.6-t*4,(x)=>{ g.beginPath(); g.ellipse(x+100,gy-12,90,7,0,0,TAU); g.fill() });
      for(let i=0;i<3;i++){ const x=((rnd(i+80)*W-sc*0.4+Math.sin(t*0.4+i)*20)%W+W)%W, y=gy-24-rnd(i+90)*40+Math.sin(t*1.5+i)*8; light(g,x,y,8,'#8ff4ff',0.45+0.2*Math.sin(t*3+i)); g.fillStyle='#e0ffff'; g.fillRect(x-0.8,y-0.8,1.6,1.6) } } },

  4:{ // el portal que defienden los gólems: islas flotantes, ruinas, arco con runas y remolino
    sky:(g,W,gy)=>{ g.fillStyle=grad(g,0,gy,['#0b0820','#23123e','#4a1a4c','#7a2a58']); g.fillRect(0,0,W,gy+1); stars(g,W,gy*0.6,30,31);
      g.save(); g.globalCompositeOperation='lighter'; for(let i=0;i<2;i++){ g.beginPath(); g.moveTo(-10,gy*(0.18+i*0.12)); g.bezierCurveTo(W*0.3,gy*(0.05+i*0.1),W*0.6,gy*(0.35+i*0.08),W+10,gy*(0.15+i*0.1)); g.lineWidth=10-i*4; g.strokeStyle=i?'rgba(255,90,200,.07)':'rgba(90,220,255,.07)'; g.stroke() } g.restore();
      for(let i=0;i<3;i++){ const x=W*(0.15+i*0.33), y=gy*(0.3+rnd(1100+i)*0.25), w=14+rnd(1110+i)*10; g.beginPath(); g.moveTo(x-w,y); g.lineTo(x+w,y); g.lineTo(x+w*0.4,y+w*0.9); g.lineTo(x-w*0.2,y+w*1.2); g.closePath(); ink(g,'#2c2244',1); g.beginPath(); g.rect(x-w,y-2,w*2,3); ink(g,'#3a2e5a',0.9); light(g,x,y+w*0.5,8,'#7fd0ff',0.5); g.fillStyle='#bfefff'; g.fillRect(x-1,y+w*0.4,2,3) } },
    layers:[
      [0.1,400,130,(g,P,gy)=>{ g.beginPath(); g.moveTo(-2,gy+2); for(let x=-2;x<=P+2;x+=10) g.lineTo(x,gy-22-Math.abs(Math.sin(TAU*x/P*3))*34-rnd(((Math.round(x)%P)+P)%P)*8); g.lineTo(P+2,gy+2); g.closePath(); ink(g,'#1d1733',1); g.save(); g.clip(); g.fillStyle='#16112a'; g.fillRect(0,gy-30,P,40); g.restore();
        for(let i=0;i<4;i++) rep(P,rnd(1200+i)*P,x=>{ const h=20+rnd(1210+i)*26; g.beginPath(); g.rect(x-4,gy-h,8,h); ink(g,'#2a2240',0.9); g.beginPath(); g.moveTo(x-4,gy-h); g.lineTo(x-1,gy-h-4); g.lineTo(x+2,gy-h-1); g.lineTo(x+4,gy-h-3); g.lineTo(x+4,gy-h); ink(g,'#2a2240',0.9) }) }],
      [0.4,360,110,(g,P,gy)=>{ const px=P*0.55; rep(P,px,x=>{ const ox=26, top=gy-78; light(g,x,gy-40,60,'#a050ff',0.35);
          [-1,1].forEach(d=>{ for(let j=0;j<6;j++){ const by=gy-j*11; g.beginPath(); g.rect(x+d*ox-6-(j%2),by-11,12+(j%2)*2,11); ink(g,j%2?'#4a4262':'#544c6e',1); g.fillStyle='#2e2842'; g.fillRect(x+d*ox+2,by-10,3.5,9) }
            for(let j=0;j<4;j++){ light(g,x+d*ox,gy-8-j*15,5,'#7fd0ff',0.6); g.fillStyle='#bff0ff'; g.fillRect(x+d*ox-0.8,gy-11-j*15,1.6,5) } });
          for(let j=0;j<9;j++){ const a0=Math.PI+j*Math.PI/9, a1=a0+Math.PI/9; g.beginPath(); g.arc(x,top+12,ox+6,a0,a1); g.arc(x,top+12,ox-6,a1,a0,true); g.closePath(); ink(g,j%2?'#4a4262':'#585074',1) }
          g.beginPath(); g.moveTo(x-6,top-6); g.lineTo(x,top-12); g.lineTo(x+6,top-6); g.lineTo(x+4,top+2); g.lineTo(x-4,top+2); g.closePath(); ink(g,'#7a3aa8',1); light(g,x,top-4,10,'#d06bff',0.7) });
        [0.08,0.92].forEach((f,i)=>rep(P,f*P,x=>{ const h=26+i*8; g.beginPath(); g.moveTo(x-6,gy+1); g.lineTo(x-5,gy-h+4); g.lineTo(x,gy-h); g.lineTo(x+5,gy-h+6); g.lineTo(x+6,gy+1); g.closePath(); ink(g,'#3e3656',1.1); g.fillStyle='#2a2440'; g.fillRect(x+1,gy-h+5,4,h-5);
          for(let j=0;j<3;j++){ light(g,x-1,gy-h+8+j*7,5,'#7fd0ff',0.55); g.fillStyle='#bff0ff'; g.fillRect(x-2.5,gy-h+7+j*7,3,1.2) } })) }],
      [1,150,12,(g,P,gy,H)=>{ g.fillStyle='#17131f'; g.fillRect(0,gy,P,H-gy); pebbles(g,P,gy,H,'#0f0c16','#3a3150',2400); g.beginPath(); g.moveTo(-2,gy+4); for(let x=-2;x<=P+2;x+=6) g.lineTo(x,gy-1-rnd((((x%P)+P)%P)*0.53)*2); g.lineTo(P+2,gy+4); g.closePath(); ink(g,'#3a3150',1); g.beginPath(); g.moveTo(0,gy+0.5); g.lineTo(P,gy+0.5); g.strokeStyle='#5a4e7e'; g.lineWidth=0.9; g.stroke();
        for(let i=0;i<2;i++) rep(P,rnd(1300+i)*P,x=>{ light(g,x+8,gy+10,12,'#6fb8ff',0.4); g.beginPath(); g.moveTo(x,gy+5); g.lineTo(x+6,gy+9); g.lineTo(x+11,gy+8); g.lineTo(x+16,gy+13); g.strokeStyle='#9fd8ff'; g.lineWidth=1; g.stroke() });
        for(let i=0;i<3;i++) rep(P,rnd(1320+i)*P,x=>rock(g,x,gy+3,8,6,'#443a5e','#2e2742','#685c90')) }]],
    fx:(g,W,H,gy,sc,t)=>{ const P=360, off=sc*0.4, ox=26, cy=gy-38;
      tiles(W+120,P,off-P*0.55,(x0)=>{ const x=x0; if(x<-60||x>W+60) return; g.save(); g.beginPath(); g.moveTo(x-ox+6,gy); g.lineTo(x-ox+6,gy-66); g.arc(x,gy-66,ox-6,Math.PI,0); g.lineTo(x+ox-6,gy); g.closePath(); g.clip();
        g.fillStyle='#0a0614'; g.fillRect(x-ox,gy-100,ox*2,100);
        g.globalCompositeOperation='lighter'; for(let i=0;i<7;i++){ const r=4+i*5, a=t*(1.6-i*0.12)+i; g.beginPath(); g.arc(x,cy,r,a,a+Math.PI*1.2); g.strokeStyle=i%2?'rgba(208,107,255,.55)':'rgba(110,210,255,.5)'; g.lineWidth=2.4; g.stroke() }
        light(g,x,cy,18,'#e0b0ff',0.6+0.2*Math.sin(t*3)); g.restore() });
      for(let i=0;i<8;i++){ const k=((t*0.25+rnd(i+100))%1), x=((rnd(i+110)*W-sc*0.4)%W+W)%W, y=gy-10-k*90; g.fillStyle=i%2?'#d8a0ff':'#9fe8ff'; g.globalAlpha=0.7*(1-k); g.fillRect(x+Math.sin(t+i)*5,y,1.3,1.3) } g.globalAlpha=1 } },

  hell:{ // infierno (solo en el modo Infierno): cielo rojo, volcanes con lava, rocas de obsidiana encendidas, grietas y ascuas
    sky:(g,W,gy)=>{ g.fillStyle=grad(g,0,gy,['#100202','#350907','#7a1e0c','#c0400f']); g.fillRect(0,0,W,gy+1);
      for(let i=0;i<4;i++){ const cx=W*(0.12+i*0.27+rnd(1400+i)*0.1), cy=gy*(0.1+(i%2)*0.16+rnd(1410+i)*0.08), w=24+rnd(1420+i)*18; cloud(g,cx,cy,w,'#2a0806','#d04a1a') } },
    layers:[
      [0.1,380,130,(g,P,gy)=>{ [0.25,0.7].forEach((f,i)=>rep(P,f*P,x=>{ const h=70+i*20, w=70+i*14; light(g,x,gy-h,40,'#ff5a1a',0.55); g.beginPath(); g.moveTo(x-w,gy+2); g.lineTo(x-9,gy-h); g.lineTo(x+9,gy-h); g.lineTo(x+w,gy+2); g.closePath(); ink(g,'#240908',1.1);
          g.save(); g.clip(); g.fillStyle='#1a0605'; g.beginPath(); g.moveTo(x+4,gy-h); g.lineTo(x+w,gy+2); g.lineTo(x+20,gy+2); g.fill(); g.restore();
          g.beginPath(); g.moveTo(x-6,gy-h+2); g.quadraticCurveTo(x-14,gy-h*0.6,x-22,gy-h*0.25); g.strokeStyle='#ff6a1a'; g.lineWidth=2.4; g.stroke(); g.strokeStyle='#ffd04a'; g.lineWidth=0.9; g.stroke();
          g.beginPath(); g.ellipse(x,gy-h,9,2.5,0,0,TAU); ink(g,'#ff8a2a',0.9) })) }],
      [0.4,280,90,(g,P,gy)=>{ for(let i=0;i<5;i++) rep(P,rnd(1500+i)*P,x=>{ const h=22+rnd(1510+i)*40, w=8+rnd(1520+i)*8; g.beginPath(); g.moveTo(x-w,gy+1); g.lineTo(x-w*0.3,gy-h*0.6); g.lineTo(x,gy-h); g.lineTo(x+w*0.4,gy-h*0.5); g.lineTo(x+w,gy+1); g.closePath(); ink(g,'#1c0d10',1.2);
          g.beginPath(); g.moveTo(x-w+1,gy); g.lineTo(x-w*0.3+0.5,gy-h*0.6); g.lineTo(x,gy-h+2); g.strokeStyle='#ff7a2a'; g.lineWidth=1.1; g.stroke() });
        const sx=P*0.5; rep(P,sx,x=>{ for(let j=0;j<5;j++){ const bx=x-8+(j%3)*7, by=gy-2-Math.floor(j/3)*5; g.beginPath(); g.arc(bx,by-2,3.2,0,TAU); ink(g,'#d8c8a8',0.8); g.fillStyle=OUT; g.fillRect(bx-1.8,by-3,1.3,1.3); g.fillRect(bx+0.5,by-3,1.3,1.3) } }) }],
      [1,150,12,(g,P,gy,H)=>{ g.fillStyle='#170a08'; g.fillRect(0,gy,P,H-gy); pebbles(g,P,gy,H,'#0e0504','#4a1a10',2500); g.beginPath(); g.moveTo(-2,gy+4); for(let x=-2;x<=P+2;x+=6) g.lineTo(x,gy-1-rnd((((x%P)+P)%P)*0.71)*2); g.lineTo(P+2,gy+4); g.closePath(); ink(g,'#3a1610',1); g.beginPath(); g.moveTo(0,gy+0.5); g.lineTo(P,gy+0.5); g.strokeStyle='#6a2a18'; g.lineWidth=0.9; g.stroke();
        for(let i=0;i<3;i++) rep(P,rnd(1600+i)*P,x=>{ light(g,x+10,gy+11,14,'#ff5a12',0.5); g.beginPath(); g.moveTo(x,gy+6); g.lineTo(x+7,gy+10); g.lineTo(x+12,gy+9); g.lineTo(x+20,gy+14); g.strokeStyle='#ff6a1a'; g.lineWidth=1.6; g.stroke(); g.strokeStyle='#ffd04a'; g.lineWidth=0.6; g.stroke() });
        rep(P,P*0.7,x=>{ light(g,x,gy+16,22,'#ff7a1a',0.55); g.beginPath(); g.ellipse(x,gy+16,16,3.5,0,0,TAU); ink(g,'#ff6a1a',1); g.beginPath(); g.ellipse(x-2,gy+15.5,9,1.6,0,0,TAU); g.fillStyle='#ffd04a'; g.fill() }) }]],
    fx:(g,W,H,gy,sc,t)=>{ g.fillStyle='#ffb347'; for(let i=0;i<16;i++){ const px=((rnd(i)*W+t*6*(i%3+1)-sc*0.3)%W+W)%W, py=gy-((t*20*(1+rnd(i+4))+rnd(i+8)*gy)%gy); g.globalAlpha=0.6*rnd(i+2)+0.25; g.fillRect(px,py,1.6,1.6) } g.globalAlpha=1;
      g.fillStyle=`rgba(255,90,20,${0.06+0.04*Math.sin(t*2)})`; g.fillRect(0,gy-30,W,H-gy+30) } },

  arena:{ // arena del PvP: gradas con arcos y público, estandartes y antorchas, arena del suelo
    sky:(g,W,gy)=>{ g.fillStyle=grad(g,0,gy,['#120d1c','#251a30','#3a2a3c']); g.fillRect(0,0,W,gy+1); stars(g,W,gy*0.4,18,41) },
    layers:[
      [0.05,240,110,(g,P,gy)=>{ g.beginPath(); g.rect(-2,gy-92,P+4,94); ink(g,'#3a2e3c',1.1); g.fillStyle='#2c2230'; g.fillRect(0,gy-92,P,6);
        for(let x=6;x<P;x+=30){ g.beginPath(); g.moveTo(x,gy-6); g.lineTo(x,gy-34); g.quadraticCurveTo(x+12,gy-52,x+24,gy-34); g.lineTo(x+24,gy-6); g.closePath(); ink(g,'#120c16',1); g.beginPath(); g.moveTo(x+2,gy-60); g.lineTo(x+2,gy-74); g.quadraticCurveTo(x+12,gy-84,x+22,gy-74); g.lineTo(x+22,gy-60); g.closePath(); ink(g,'#120c16',0.9) }
        for(let i=0;i<60;i++){ const x=rnd(1700+i)*P, y=gy-88+rnd(1710+i)*6; g.fillStyle=['#8a6a5a','#6a5a7a','#a07a5a','#5a6a7a'][i%4]; g.beginPath(); g.arc(x,y,1.8,0,TAU); g.fill() }
        g.beginPath(); g.rect(-2,gy-6,P+4,8); ink(g,'#4a3a44',1);
        for(let j=0;j<4;j++){ const x=j*60+38, c=['#a82a22','#2a4a9a','#c9a23a','#2a7a4a'][j]; g.beginPath(); g.moveTo(x-6,gy-58); g.lineTo(x+6,gy-58); g.lineTo(x+6,gy-36); g.lineTo(x,gy-40); g.lineTo(x-6,gy-36); g.closePath(); ink(g,c,1); g.fillStyle='rgba(255,255,255,.25)'; g.fillRect(x-5,gy-57,2,18) }
        for(let j=0;j<4;j++){ const x=j*60+8; g.beginPath(); g.rect(x-1,gy-28,2,10); ink(g,'#3a2a24',0.8); light(g,x,gy-31,14,'#ff9a3a',0.6); g.beginPath(); g.moveTo(x-2.5,gy-28); g.quadraticCurveTo(x,gy-37,x+2.5,gy-28); g.closePath(); ink(g,'#ffc04a',0.7) } }],
      [1,120,12,(g,P,gy,H)=>{ g.fillStyle='#6b5236'; g.fillRect(0,gy,P,H-gy); g.beginPath(); g.moveTo(-2,gy); g.lineTo(P+2,gy); g.lineTo(P+2,gy+3); g.lineTo(-2,gy+3); ink(g,'#8a6a44',1); g.fillStyle='rgba(0,0,0,.15)'; for(let i=0;i<8;i++) g.fillRect(rnd(1800+i)*P,gy+6+rnd(1810+i)*16,7,1.6);
        g.fillStyle='rgba(255,230,180,.12)'; for(let i=0;i<6;i++) g.fillRect(rnd(1820+i)*P,gy+5+rnd(1830+i)*18,4,1) }]],
    fx:()=>{} }
};
// piedras y marcas sueltas por el suelo (en la capa de suelo de cada escenario)
function pebbles(g,P,gy,H,c,hi,seed){ for(let i=0;i<14;i++){ const x=rnd(seed+i)*P, y=gy+10+rnd(seed+i*3)*(H-gy-16), w=2+rnd(seed+i*5)*4; rep(P,x,xx=>{ g.beginPath(); g.ellipse(xx,y,w,w*0.45,0,0,TAU); g.fillStyle=c; g.fill(); g.fillStyle=hi; g.fillRect(xx-w*0.5,y-w*0.3,w*0.6,0.8) }) } }
function scene(g,W,H,gy,zone,scroll,mode,t){ if(zone===4&&mode===2) zone='hell';
  const z=SCN[zone]||SCN[0];
  // las capas se pintan a la resolución real de la pantalla y se copian píxel a píxel (sin reescalar: más nítido y más rápido)
  let m=null, pr=1; try{ m=g.getTransform(); if(m.b||m.c) m=null; else pr=Math.min(4,Math.max(0.5,m.a)) }catch(e){ m=null }
  const kz=zone+'|'+Math.round(W)+'|'+Math.round(H)+'|'+Math.round(gy)+'|'+pr.toFixed(3);
  const blit=(c,x,y,w,h)=>{ if(m){ g.save(); g.setTransform(1,0,0,1,Math.round(m.e),Math.round(m.f)); g.drawImage(c,Math.round(x*pr),Math.round(y*pr)); g.restore() } else g.drawImage(c,x,y,w,h) };
  const skyC=lcache('s|'+kz,W,gy+1,pr,x=>z.sky(x,W,gy));
  if(skyC) blit(skyC,0,0,W,gy+1); else z.sky(g,W,gy);
  z.layers.forEach(([s,P,up,draw],i)=>{ const y0=Math.max(0,gy-up), h=(i===z.layers.length-1?H:gy+3)-y0;
    const c=lcache('l'+i+'|'+kz,P,h,pr,x=>{ x.translate(0,-y0); draw(x,P,gy,H) });
    const o=((scroll*s)%P+P)%P;
    if(c){ const Pp=c.width/pr; for(let x=-o;x<W;x+=Pp) blit(c,x,y0,Pp,h) }
    else{ g.save(); g.beginPath(); g.rect(0,y0,W,h); g.clip(); for(let x=-o;x<W;x+=P){ g.save(); g.translate(x,0); draw(g,P,gy,H); g.restore() } g.restore() } });
  const sh=g.createLinearGradient(0,gy+4,0,H); sh.addColorStop(0,'rgba(0,0,0,0)'); sh.addColorStop(1,'rgba(0,0,0,.4)'); g.fillStyle=sh; g.fillRect(0,gy+4,W,H-gy-4);   // el suelo se oscurece hacia abajo
  g.save(); z.fx(g,W,H,gy,scroll,t); g.restore();
  // tinte del modo (Pesadilla morado, Infierno rojo) y viñeta
  if(mode&&zone!=='hell'){ g.fillStyle=mode===1?'rgba(90,40,140,.18)':'rgba(170,20,20,.16)'; g.fillRect(0,0,W,H) }
  const v=g.createRadialGradient(W/2,gy*0.7,Math.min(W,H)*0.3,W/2,gy*0.7,Math.max(W,H)*0.8); v.addColorStop(0,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,.45)'); g.fillStyle=v; g.fillRect(0,0,W,H) }
// imágenes de las capas, por escenario y tamaño (si ocupan más de ~8 millones de píxeles, unos 32 MB, se vacía y se rehace lo que se use)
const LC={}; let LCpx=0;
function lcache(k,w,h,pr,draw){ if(LC[k]) return LC[k]; if(typeof document==='undefined') return null;
  const px=w*h*pr*pr; if(LCpx+px>8e6){ for(const q in LC) delete LC[q]; LCpx=0 } LCpx+=px;
  try{ const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w*pr)); c.height=Math.max(1,Math.ceil(h*pr)); const x=c.getContext('2d'); x.scale(c.width/w,pr); x.lineJoin='round'; x.lineCap='round'; draw(x); return LC[k]=c }catch(e){ return null } }

root.ART={scene,hero,monster,onSprites,spriteSrc:cls=>SPR[cls]&&SPR[cls].img?sprSrc(cls):null,face:cls=>{ const sp=sprOf(cls); return sp&&sp.face?{src:sprSrc(cls),x:sp.face[0],y:sp.face[1],d:sp.face[2],ar:sp.W/sp.H}:null },hasSprite:cls=>!!sprOf(cls),kindFor,burst,parts,clearParts,shade,addFx,drawFx,status,shake,shakeOffset,clearFx};
})(typeof window!=='undefined'?window:globalThis);
