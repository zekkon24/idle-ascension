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
// oro abreviado desde 1000: K mil, M millón, B mil millones
const fmtG=n=>{ const a=Math.abs(n||0); if(a<1000) return fmt(n); let s=''; for(const [k,v] of [['K',1e3],['M',1e6],['B',1e9]]) if(a>=v) s=String(+(n/v).toFixed(n/v<10?2:n/v<100?1:0))+k; return s };
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
let tab='up', invView='main', shopView='cofres', evView=null, modView=null;
let chestSel=null; const CHEST_RAR={wood:'C',silver:'R',mode:'E'};   // cofre elegido en Inventario → Cofres y color de rareza de cada cofre
let expandedId=null, forgeId=null, lockSel=[], forjaBack='armas'; // forjaBack: adónde vuelve "← Volver" desde la Forja
let pendingName='', pendingReforge=null, pendingDis=null, pendingSpin=null, buyCtx=null, modeReady=null;
const reduceMotion=()=>!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
// escribe HTML solo si cambia (evita rehacer botones mientras se tocan)
const setHTML=(el,h)=>{ if(el&&el.__h!==h){ el.__h=h; el.innerHTML=nbsp(h); } };
const F={rar:'all',stat:'any',min:'',max:''};
const fx={shots:[],floats:[],flash:0};
// Habilidades: el botón solo lleva su dibujo; manteniéndolo pulsado se ve el nombre y qué hace (sin números)
const SKI={
  muro:['<path d="M32 5L53 12V29C53 43 44 52 32 59C20 52 11 43 11 29V12Z" fill="#b9c0cc"/><path d="M32 5L53 12V29C53 43 44 52 32 59Z" fill="#6f7785" opacity="0.6"/><path d="M32 11L47 16V29C47 39 41 46 32 52C23 46 17 39 17 29V16Z" fill="#2b2f40"/><path d="M32 11L47 16V29C47 39 41 46 32 52C23 46 17 39 17 29V16Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="32" cy="31" r="11" fill="#7fc8e8" opacity="0.22"/><path d="M32 21v19M25 28l7-7 7 7M26 37h12" fill="none" stroke="#7fc8e8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 16l9-3" fill="none" stroke="#eef2f8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/><path d="M32 5L53 12V29C53 43 44 52 32 59C20 52 11 43 11 29V12Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>','Levanta un escudo y golpea a los enemigos cercanos.'],
  bola:['<path d="M5 59C9 47 17 39 27 34L25 42C32 38 37 34 41 28C41 42 31 53 17 57Z" fill="#e2502a"/><path d="M5 59C9 47 17 39 27 34L25 42C32 38 37 34 41 28C41 42 31 53 17 57Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="40" cy="24" r="16" fill="#ff8a2a" stroke="#140f1c" stroke-width="3"/><circle cx="41" cy="25" r="11" fill="#ffb347"/><path d="M33 20l7 3-7 2zM48 20l-7 3 7 2z" fill="#140f1c"/><path d="M35 30h11l-1 4h-9z" fill="#140f1c"/><path d="M37 30h2v2h-2zM42 30h2v2h-2z" fill="#fff3c4"/><circle cx="33" cy="14" r="3.2" fill="#fff3c4"/>','Lanza una bola de fuego que quema a varios enemigos.'],
  perforante:['<path d="M7 57L21 43" fill="none" stroke="#7fc8e8" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/><path d="M12 52L46 18" fill="none" stroke="#140f1c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 52L46 18" fill="none" stroke="#8a5a34" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M57 7L38 12L52 26Z" fill="#b9c0cc"/><path d="M57 7L38 12L52 26Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M54 10L43 13" fill="none" stroke="#eef2f8" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 52L6 39L17 44Z" fill="#e2605a"/><path d="M12 52L6 39L17 44Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 52L25 58L20 47Z" fill="#b8323a"/><path d="M12 52L25 58L20 47Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M28 22l-6-6M42 40l6 6" fill="#140f1c"/><path d="M26 20l-5-5M44 42l5 5" fill="none" stroke="#ffd66b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>','Un disparo que atraviesa a todos los enemigos.'],
  ejecutar:['<path d="M17 59L37 22" fill="none" stroke="#140f1c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M17 59L37 22" fill="none" stroke="#8a5a34" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 45L29 38" fill="none" stroke="#140f1c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 45L29 38" fill="none" stroke="#e8b04a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 23L20 15L26 30Z" fill="#6f7785"/><path d="M32 23L20 15L26 30Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M33 9C46 2 61 12 58 31C52 26 46 26 40 33L31 25C35 20 35 15 33 9Z" fill="#b9c0cc"/><path d="M58 31C52 26 46 26 40 33L36 29C42 23 50 22 58 31Z" fill="#6f7785"/><path d="M37 11C46 8 54 13 56 21" fill="none" stroke="#eef2f8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 9C46 2 61 12 58 31C52 26 46 26 40 33L31 25C35 20 35 15 33 9Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M55 27c1.5 4 1.5 7-.5 8.5-2.5-1.5-2.5-4.5.5-8.5z" fill="#b8323a"/><path d="M55 27c1.5 4 1.5 7-.5 8.5-2.5-1.5-2.5-4.5.5-8.5z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>','Un golpe enorme; si mata, se recarga antes.'],
  luz:['<circle cx="32" cy="32" r="26" fill="#ffd66b" opacity="0.13"/><path d="M34 3L13 35H27L20 61L51 25H36L44 3Z" fill="#ffd66b"/><path d="M44 3L36 25H51L38 40L42 25H30Z" fill="#a8741e" opacity="0.45"/><path d="M33 8L19 32" fill="none" stroke="#fff3c4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 3L13 35H27L20 61L51 25H36L44 3Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M53 40l3.5 4.5-3.5 4.5-3.5-4.5z" fill="#fff3c4"/><path d="M53 40l3.5 4.5-3.5 4.5-3.5-4.5z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M10 46l3 4-3 4-3-4z" fill="#fff3c4"/><path d="M10 46l3 4-3 4-3-4z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>','Golpes de luz encadenados que después vuelven y te curan.'],
  sed:['<path d="M32 4C41 17 51 27 51 41A19 19 0 0 1 13 41C13 27 23 17 32 4Z" fill="#b8323a"/><path d="M32 4C41 17 51 27 51 41A19 19 0 0 1 32 60Z" fill="#7a1e26" opacity="0.6"/><path d="M24 21c-3 5-4 9-4 13" fill="none" stroke="#f07a6e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 33l9 3M44 33l-9 3" fill="none" stroke="#140f1c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="39" r="3.2" fill="#ffd66b" stroke="#140f1c" stroke-width="2"/><circle cx="39" cy="39" r="3.2" fill="#ffd66b" stroke="#140f1c" stroke-width="2"/><path d="M23 46q9 6 18 0" fill="none" stroke="#140f1c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 48l2 6 2.5-5z" fill="#fff"/><path d="M27 48l2 6 2.5-5z" fill="none" stroke="#140f1c" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M37 48l-2 6-2.5-5z" fill="#fff"/><path d="M37 48l-2 6-2.5-5z" fill="none" stroke="#140f1c" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M32 4C41 17 51 27 51 41A19 19 0 0 1 13 41C13 27 23 17 32 4Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>','Sacrificas vida a cambio de un escudo y robo de vida.'],
  combustion:['<path d="M32 3C36 15 50 21 50 39A18 18 0 0 1 14 39C14 31 18 25 22 21C22 27 24 31 28 33C26 21 28 12 32 3Z" fill="#e2502a"/><path d="M33 20C36 28 44 32 44 41A12 12 0 0 1 20 41C20 36 23 32 26 30C26 34 28 36 30 37C29 31 31 26 33 20Z" fill="#ff8a2a"/><path d="M32 44c3 3 5 5 5 8a5 5 0 0 1-10 0c0-3 2-5 5-8z" fill="#ffd66b"/><path d="M24 37l6 2.5M40 37l-6 2.5" fill="none" stroke="#140f1c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="27" cy="41" r="2" fill="#140f1c"/><circle cx="37" cy="41" r="2" fill="#140f1c"/><path d="M32 3C36 15 50 21 50 39A18 18 0 0 1 14 39C14 31 18 25 22 21C22 27 24 31 28 33C26 21 28 12 32 3Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>','Tus quemaduras hacen más daño y saltan a otros enemigos.'],
  rapido:['<path d="M4 26h12M2 36h10M6 46h9" fill="none" stroke="#140f1c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 26h12M2 36h10M6 46h9" fill="none" stroke="#7fc8e8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 37L50 8L57 7L56 14L30 40Z" fill="#b9c0cc"/><path d="M30 40L56 14L57 7L52 9L28 38Z" fill="#6f7785" opacity="0.5"/><path d="M50 10L31 34" fill="none" stroke="#eef2f8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 37L50 8L57 7L56 14L30 40Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M20 31L36 47" fill="none" stroke="#140f1c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 31L36 47" fill="none" stroke="#e8b04a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 42L16 51" fill="none" stroke="#140f1c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M25 42L16 51" fill="none" stroke="#8a5a34" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="14" cy="53" r="4.5" fill="#e8b04a" stroke="#140f1c" stroke-width="2.5"/>','Atacas mucho más rápido durante un rato.'],
  clon:['<path d="M22 10C13 10 8 18 8 27V52H36V27C36 18 31 10 22 10Z" fill="#3b2a5e"/><path d="M22 10C13 10 8 18 8 27V52H36V27C36 18 31 10 22 10Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="22" cy="28" rx="8" ry="7" fill="#140f1c"/><circle cx="19" cy="28" r="1.9" fill="#b066e8"/><circle cx="25" cy="28" r="1.9" fill="#b066e8"/><path d="M42 14C33 14 28 22 28 31V58H56V31C56 22 51 14 42 14Z" fill="#9b6ad6"/><path d="M42 14C51 14 56 22 56 31V58H46V31C46 23 45 17 42 14Z" fill="#5a3a86" opacity="0.55"/><path d="M42 14C33 14 28 22 28 31V58H56V31C56 22 51 14 42 14Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="42" cy="33" rx="8.5" ry="7.5" fill="#140f1c"/><circle cx="38.5" cy="33" r="2.4" fill="#ffd66b"/><circle cx="45.5" cy="33" r="2.4" fill="#ffd66b"/>','Un clon de sombra copia tus golpes durante un rato.'],
  juicio:['<circle cx="32" cy="32" r="27" fill="#ffd66b" opacity="0.12"/><path d="M28.3 15.4L32.0 2.0L35.7 15.4ZM41.1 17.6L53.2 10.8L46.4 22.9ZM48.6 28.3L62.0 32.0L48.6 35.7ZM46.4 41.1L53.2 53.2L41.1 46.4ZM35.7 48.6L32.0 62.0L28.3 48.6ZM22.9 46.4L10.8 53.2L17.6 41.1ZM15.4 35.7L2.0 32.0L15.4 28.3ZM17.6 22.9L10.8 10.8L22.9 17.6Z" fill="#e8b04a"/><path d="M28.3 15.4L32.0 2.0L35.7 15.4ZM41.1 17.6L53.2 10.8L46.4 22.9ZM48.6 28.3L62.0 32.0L48.6 35.7ZM46.4 41.1L53.2 53.2L41.1 46.4ZM35.7 48.6L32.0 62.0L28.3 48.6ZM22.9 46.4L10.8 53.2L17.6 41.1ZM15.4 35.7L2.0 32.0L15.4 28.3ZM17.6 22.9L10.8 10.8L22.9 17.6Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="32" cy="32" r="15" fill="#ffd66b" stroke="#140f1c" stroke-width="3"/><path d="M20 32Q32 21 44 32Q32 43 20 32Z" fill="#fff3c4"/><path d="M20 32Q32 21 44 32Q32 43 20 32Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="32" cy="32" r="5.5" fill="#e8b04a" stroke="#140f1c" stroke-width="2"/><circle cx="32" cy="32" r="2.4" fill="#140f1c"/>','Un aura que te cura y quema a los enemigos cercanos.'],
  baluarte:['<path d="M14 16L3 11L10 25Z" fill="#c9ced8"/><path d="M14 16L3 11L10 25Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M50 16L61 11L54 25Z" fill="#c9ced8"/><path d="M50 16L61 11L54 25Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M15 36L4 43L16 44Z" fill="#c9ced8"/><path d="M15 36L4 43L16 44Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M49 36L60 43L48 44Z" fill="#c9ced8"/><path d="M49 36L60 43L48 44Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M24 10L28 2L32 10ZM32 10L36 2L40 10Z" fill="#c9ced8"/><path d="M24 10L28 2L32 10ZM32 10L36 2L40 10Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M14 10H50V34C50 46 42 54 32 59C22 54 14 46 14 34Z" fill="#8a919e"/><path d="M32 10H50V34C50 46 42 54 32 59Z" fill="#5a6170" opacity="0.6"/><path d="M18 14H46" fill="none" stroke="#eef2f8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/><path d="M14 10H50V34C50 46 42 54 32 59C22 54 14 46 14 34Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="32" cy="31" r="8" fill="#e8b04a" stroke="#140f1c" stroke-width="2.5"/><circle cx="30" cy="29" r="2.2" fill="#ffe08a"/>','Más defensa y devuelves parte del daño que recibes.'],
  armaduraHielo:['<path d="M10 27L22 22L27 45L18 51Z" fill="#7fc8e8"/><path d="M10 27L22 22L27 45L18 51Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M54 27L42 22L37 45L46 51Z" fill="#7fc8e8"/><path d="M54 27L42 22L37 45L46 51Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M32 4L41 20L36 50H28L23 20Z" fill="#a8d8f0"/><path d="M32 4L41 20L36 50H32Z" fill="#3f86b8" opacity="0.45"/><path d="M30 12L27 22M18 28l3 10M46 28l-3 10" fill="none" stroke="#e6f6ff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 4L41 20L36 50H28L23 20Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M10 56H54" fill="none" stroke="#140f1c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 56H54" fill="none" stroke="#a8d8f0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>','Esquirlas de hielo a todos; quien te golpea recibe más.'],
  marca:['<path d="M32 2v12M32 50v12M2 32h12M50 32h12" fill="none" stroke="#140f1c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 2v12M32 50v12M2 32h12M50 32h12" fill="none" stroke="#e2605a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="32" r="21" fill="none" stroke="#140f1c" stroke-width="8"/><circle cx="32" cy="32" r="21" fill="none" stroke="#e2605a" stroke-width="4"/><circle cx="32" cy="30" r="9" fill="#e9dfc8" stroke="#140f1c" stroke-width="2.5"/><path d="M27 37h10v5H27z" fill="#e9dfc8"/><path d="M27 37h10v5H27z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="28.5" cy="29.5" r="2.4" fill="#140f1c"/><circle cx="35.5" cy="29.5" r="2.4" fill="#140f1c"/><path d="M32 32l-1.5 3h3z" fill="#140f1c"/>','Marcas a un enemigo y recibe más daño.'],
  nube:['<path d="M22 49v6M32 48v10M42 49v6" fill="none" stroke="#140f1c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 49v6M32 48v10M42 49v6" fill="none" stroke="#6cc47a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 44A10 10 0 0 1 16 24A14 14 0 0 1 43 19A12 12 0 0 1 49 44Z" fill="#6cc47a"/><path d="M13 37C26 41 40 41 51 37A12 12 0 0 1 49 44H15A10 10 0 0 1 13 37Z" fill="#2d6a3a" opacity="0.6"/><path d="M19 24A14 14 0 0 1 41 18" fill="none" stroke="#c8f5c0" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 44A10 10 0 0 1 16 24A14 14 0 0 1 43 19A12 12 0 0 1 49 44Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="26" cy="31" r="4.2" fill="#140f1c"/><circle cx="38" cy="31" r="4.2" fill="#140f1c"/><circle cx="26" cy="31" r="1.4" fill="#c8f5c0"/><circle cx="38" cy="31" r="1.4" fill="#c8f5c0"/><path d="M32 34l-2 4h4z" fill="#140f1c"/>','Una nube tóxica que envenena a todos los enemigos.'],
  sacrificio:['<path d="M32 57C14 45 6 35 6 25A12 12 0 0 1 32 19A12 12 0 0 1 58 25C58 35 50 45 32 57Z" fill="#b8323a"/><path d="M32 57C50 45 58 35 58 25A12 12 0 0 0 32 19Z" fill="#7a1e26" opacity="0.6"/><path d="M12 22a6 6 0 0 1 8-4" fill="none" stroke="#f07a6e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 57C14 45 6 35 6 25A12 12 0 0 1 32 19A12 12 0 0 1 58 25C58 35 50 45 32 57Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M52 3L58 9L37 30L31 24Z" fill="#b9c0cc"/><path d="M52 3L58 9L37 30L31 24Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M53 6L36 23" fill="none" stroke="#eef2f8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 25L36 34" fill="none" stroke="#140f1c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 25L36 34" fill="none" stroke="#e8b04a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 31L23 38" fill="none" stroke="#140f1c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 31L23 38" fill="none" stroke="#8a5a34" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 52c2 3 3 4.5 3 6a3 3 0 0 1-6 0c0-1.5 1-3 3-6z" fill="#b8323a"/><path d="M36 52c2 3 3 4.5 3 6a3 3 0 0 1-6 0c0-1.5 1-3 3-6z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>','Sacrificas vida para golpear más fuerte a los jefes.'],
};
// habilidades de la Torre (cartas): usan el dibujo de una parecida y su texto
{ const A={tGolpe:'ejecutar',tMuro:'muro',tSangria:'sacrificio',tTorbellino:'perforante',tBaluarte:'baluarte',tSed:'sed',tLluvia:'rapido',tFestin:'marca'};
  for(const k in A) if(SKI[A[k]]&&CFG.tower.cards[k]) SKI[k]=[SKI[A[k]][0],CFG.tower.cards[k].desc]; }
const skIcon=id=>`<svg class="ski" viewBox="0 0 64 64" width="30" height="30" aria-hidden="true">${(SKI[id]||['<circle cx="32" cy="32" r="15" fill="currentColor"/>'])[0]}</svg>`;   // iconos propios (64×64, paleta del juego)
const skTip=x=>`<b>${esc(x.name||'')}</b><br>${(SKI[x.id]||[0,esc(x.desc||'')])[1]}`;

// números de daño: suben sin parar; si llega otro golpe al mismo objetivo en menos de 0,3 s se suma al último número (no se amontonan)
function pushFloat(f){ const last=fx.floats.filter(o=>(f.hero?o.hero:o.e===f.e)&&!o.crit===!f.crit&&o.v!=null&&f.v!=null).pop();
  if(last&&last.max-last.life<0.3){ last.v+=f.v; last.txt=(f.hero?'-':'')+fmt(last.v); return }
  // cada número sale un poco desplazado al azar y, si hay otros recientes cerca, se coloca encima (no se pisan)
  f.dx=(Math.random()-0.5)*18; f.vx=(Math.random()-0.5)*14;
  const fxX=o=>o.hero?-1e3:(o.e&&o.e.x)||0, near=fx.floats.filter(o=>!o.hero===!f.hero&&o.max-o.life<0.35&&Math.abs(fxX(o)-fxX(f))<30).length;
  f.lane=Math.min(3,near);
  f.max=f.life; fx.floats.push(f); if(fx.floats.length>40) fx.floats.shift() }

/* ---------- Telegram: colores, vibración y botón atrás ---------- */
const TG=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initData?Telegram.WebApp:null;
// Pantalla completa en el móvil (Telegram 8.0+); si no, al menos ocupa toda la altura. Sin cerrar el juego al deslizar hacia abajo.
if(TG){ try{ TG.ready(); TG.expand(); if(TG.disableVerticalSwipes) TG.disableVerticalSwipes();
  if(/^(ios|android)$/.test(TG.platform)&&TG.isVersionAtLeast&&TG.isVersionAtLeast('8.0')&&TG.requestFullscreen&&!TG.isFullscreen) TG.requestFullscreen(); }catch(e){} }
// en pantalla completa la cabecera va justo debajo de los botones de Telegram (sin margen extra)
const fsMark=()=>{ try{ document.documentElement.classList.toggle('tgfs',!!(TG&&TG.isFullscreen)) }catch(e){} };
if(TG){ fsMark(); try{ TG.onEvent('fullscreenChanged',fsMark) }catch(e){} }
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
  tab='up'; renderTab() }
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
  if(d>=0.5) pushFloat({e,v:d,txt:fmt(d),crit,life:0.9}) });   // (sin «0» de golpes que no hacen daño)
G.on('heroHit',({d})=>{ const B=G.B, f=B&&B.enemies.find(e=>!e.dead&&e.arrive<=B.t); if(f) f._atkAt=performance.now(); fx.ratkAt=performance.now(); if(battery()||tab!=='up') return; fx.flash=0.15; if(d>0.08*G.heroStats().hp) ART.shake(3); if(d>=0.5) pushFloat({hero:true,v:d,txt:'-'+fmt(d),life:0.8}) });
G.on('dodge',()=>{ if(!battery()&&tab==='up') pushFloat({hero:true,txt:'esquiva',life:0.8}) });
G.on('level',l=>{ if(tab==='up'&&!battery()){ ART.addFx('levelup',{text:'¡Nivel '+l+'!'}); haptic('light') } else toast('¡Nivel '+l+'!') });
// Jefes: sin ventana; el botín va a la bolsa (icono de cofre) y el icono da un pequeño salto
// Botín de jefe: el cofre y los materiales salen del jefe y vuelan a Inventario, donde entran solos (los monstruos normales no sueltan nada)
const stageXY=e=>{ const cv=$('#cv'); if(!cv||!e||e.x==null||!fx.sc) return null; const r=cv.getBoundingClientRect(); return {x:r.left+e.x*fx.sc,y:r.top+(fx.gy-30)*fx.sc} };
function flyLoot(items){ const B=G.B, boss=B&&B.enemies.find(e=>e.x!=null), from=stageXY(boss), to=document.querySelector('.nav [data-tab="inv"]');
  if(!from||!to||tab!=='up'||battery()||reduceMotion()) return false;
  if(boss) ART.addFx('loot',{e:boss}); const tr=to.getBoundingClientRect(), tx=tr.left+tr.width/2, ty=tr.top+tr.height/2;
  items.forEach((html,i)=>{ const el=document.createElement('div'); el.className='flyi'; el.innerHTML=html; document.body.appendChild(el);
    const dx=(i-(items.length-1)/2)*26, up=-50-Math.random()*20;
    el.animate([{transform:`translate(${from.x-12}px,${from.y-12}px) scale(.4)`,opacity:0},{transform:`translate(${from.x-12+dx}px,${from.y-12+up}px) scale(1.3)`,opacity:1,offset:.35},
      {transform:`translate(${from.x-12+dx}px,${from.y-12+up+8}px) scale(1.1)`,offset:.55},{transform:`translate(${tx-12}px,${ty-12}px) scale(.6)`,opacity:.9}],{duration:1100+i*120,easing:'cubic-bezier(.3,.7,.4,1)'})
      .onfinish=()=>{ el.remove(); to.animate([{transform:'scale(1)'},{transform:'scale(1.3)'},{transform:'scale(1)'}],{duration:300}) } }); return true }
const MATI='<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="34" r="24" fill="#b066e8" opacity="0.18"/><path d="M32 4L50 22L32 60L14 22Z" fill="#c86bff"/><path d="M32 4L50 22L32 60Z" fill="#7a3fb0" opacity="0.55"/><path d="M14 22H50M32 4L26 22L32 60L38 22Z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/><path d="M22 15l5-6" fill="none" stroke="#f2dcff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/><path d="M32 4L50 22L32 60L14 22Z" fill="none" stroke="#140f1c" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
function bossLoot(mat,chest){ const b=document.querySelector('.nav [data-tab="inv"]'); updateHUD(); const items=[...(chest?[ICON.wood]:[]),ICON.scrap,...Array(Math.min(3,mat||0)).fill(MATI)];
  if(!flyLoot(items)&&b&&!reduceMotion()) b.animate([{transform:'scale(1)'},{transform:'scale(1.25)'},{transform:'scale(1)'}],{duration:450}) }
G.on('boss',({mat})=>{ haptic('medium'); bossLoot(mat,true) });
G.on('bossFarm',({mat})=>{ if(mat) bossLoot(mat,false) });
G.on('mode',({name})=>{ showModal(`<h3>Modo ${name}</h3><p class="hint">Vuelves a la fase 1. Los enemigos son mucho más fuertes, dan más oro y los jefes sueltan ${G.modeCfg().mat}.</p><button class="btn gold" data-act="close">Continuar</button>`) });
G.on('defeat',({fase,kind})=>toast(kind==='farm'?'Derrota: farmeando la fase '+fase:'Retrocedes a la fase '+fase));
G.on('fase',()=>refreshTabIfStatic());
G.on('wave',()=>{});
G.on('bossPhase',({k})=>{ haptic('medium'); toast(k==='rage'?'¡El jefe se enfurece!':'¡El jefe llama refuerzos!'); });
G.on('towerEnd',r=>{ tab='ev'; modView='torre'; evView=null; towerTab='run'; renderTab();
  if(r.won&&!r.pick){ toast(`Piso ${r.floor} superado · +${r.souls} almas`); return }   // combate normal: sin mejora, solo almas
  if(r.won){ toast(`Piso ${r.floor} superado${r.souls?` · +${r.souls} almas`:''}`); return }   // la recompensa se elige directamente en la pantalla de la Torre
  const fin=r.final?`<p class="hint">Daño al jefe final: <b>${fmt(r.dmg||0)}</b> (récord ${fmt(G.towerState().bossDmg||0)}).</p>`:'';
  later(()=>showModal(r.crown?`<h3>¡La cola de lagarto te salva!</h3><p class="hint">Revives con el ${Math.round(CFG.tower.grims.lagarto.hp*100)} % de vida en el piso ${r.floor}.</p>${fin}<button class="btn gold" data-act="close">Seguir</button>`
  :`<h3>Has caído en el piso ${r.floor}</h3>${fin}<p class="hint">${r.canRevive?'Puedes revivir una vez viendo un anuncio.':'Fin de la partida.'}</p><div class="ctrl">${r.canRevive?'<button class="btn gold" data-act="towerRev">Revivir · anuncio</button>':''}<button class="btn" data-act="close">Vale</button></div>`)); });
// vida de todos los enemigos del combate junta: lo que les queda / el total (los que aún no han salido cuentan llenos;
// los que llegan después, como los esbirros, suman al total). Jefe de vida infinita: barra llena (∞)
const FOEB=new WeakMap();
function foeBar(B){ if(B.kind==='pvp'||!B.enemies.length||B.enemies.some(e=>e.immortal&&!e.dead)) return null; if(B.enemies.some(e=>e.inf&&!e.dead)) return {p:1,inf:true};
  let st=FOEB.get(B); if(!st){ st={seen:new WeakSet(),tot:0}; FOEB.set(B,st); }
  let left=0, mx=0; for(const e of B.enemies){ if(!st.seen.has(e)){ st.seen.add(e); st.tot+=e.max; } mx=Math.max(mx,e.max); if(!e.dead) left+=Math.max(0,e.hp); }
  const wait=Math.max(0,(B.count||0)-(B.spawned||0)), tot=st.tot+wait*mx; left+=wait*mx;   // campaña: los que faltan por salir
  return tot>0?{p:Math.max(0,Math.min(1,left/tot))}:null }
// Torre: al conseguir un grimorio AL AZAR (cofre, altar), en medio de la pantalla «Obtenido» con su nombre y qué hace (se encolan si son varios)
const gotQ=[]; let gotOn=false;
function gotShow(){ if(gotOn||!gotQ.length) return; gotOn=true; const b=gotQ.shift(), f=G.boonInfo(b), c=RARC[f.r], el=document.createElement('div');
  el.className='gotpop'; el.style.borderColor=c; el.innerHTML=`<span class="s">Obtenido</span><b style="color:${c}">${FAMI[f.fam]||''} ${esc(f.name)}</b><span class="pill" style="color:${c}">${f.kind}</span><p>${esc(f.desc)}</p>`;
  const done=()=>{ if(!el.parentNode) return; el.classList.add('out'); setTimeout(()=>{ el.remove(); gotOn=false; gotShow() },250) };
  el.addEventListener('click',done); document.body.appendChild(el); haptic('ok'); setTimeout(done,2600) }
G.on('towerGot',b=>{ gotQ.push(b); gotShow() });
// Torre: élite o jefe ganado → la recompensa se elige encima de la pelea (que espera). Si se cierra la ventana, vuelve a salir
function towerPickModal(){ const run=G.towerState().run; if(!run||!run.pick) return;
  showModal(`<h3>${G.B&&G.B.node==='boss'?'¡Jefe vencido!':'¡Élite vencido!'}</h3><p class="hint">Elige 1:</p><div class="mlist">${run.pick.map(boonCard).join('')}</div>`) }
G.on('towerPickNow',()=>{ tab='up'; renderTab(); later(towerPickModal); haptic('ok') });
G.on('towerReward',({floor,b})=>toast(`Piso ${floor}: ${bundleTxt(b)}`));
G.on('surprise',({k,reward})=>{ const C=CFG.surprise;
  if(k==='horde'){ haptic('medium'); toast(`¡Horda! 30 s con oro ×${C.horde.gold}`); } else if(k==='wander'){ haptic('medium'); toast(`¡Jefe errante! Véncelo en ${C.wander.dur} s`); }
  else if(/Win$/.test(k)){ haptic('ok'); toast({wanderWin:'¡Jefe errante vencido! '}[k]+bundleTxt(reward)); updateHUD(); }
  else if(k==='wanderFled') toast('El jefe errante huyó'); });
G.on('pvpEnd',r=>{ tab='ev'; modView='pvp'; evView=null; haptic(r.win?'ok':'medium');
  if(r.rival.match&&pvpOnline()) Telemetry.pvp(CFG,'pvpResult',{match:r.rival.match,win:r.win,draw:r.draw}).then(j=>{ if(j&&j.ok){ G.pvpSync(j); if(PVI) Object.assign(PVI.me,{rating:j.rating,games:j.games,wins:j.wins,rank:j.rank,left:j.left}); pvpLoad(); } });
  renderTab(); later(()=>showModal(`<h3>${r.win?'¡Victoria!':r.draw?'Empate':'Derrota'}</h3><p class="hint">Contra ${esc(r.rival.name)} (${clName(r.rival.cls)})${r.draw?' · nadie cayó en 30 s':''} · tú ${Math.round(r.me*100)} % de vida, rival ${Math.round(r.them*100)} %.<br>${r.d>0?'+':''}${r.d} puntos (ahora ${fmt(r.rating)}).</p><button class="btn gold" data-act="close">Vale</button>`)); });
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
G.on('hallEnd',r=>{ tab='ev'; modView='campana'; renderTab(); haptic(r.won?'ok':'medium');
  later(()=>showModal(`<h3>${r.won?'¡Victoria!':'Derrota'} ${'★'.repeat(r.star)}</h3><p class="hint">Jefe de la fase ${r.f} (${CFG.modes[r.m].name})${r.won?'':' · te ha derrotado'}</p>
    ${r.rw?`<div class="loot"><div><span>${r.first?'1.ª victoria':'Repetir'}</span><b>${bundleHTML(r.rw)}${r.rw.scrap?` ${ICON.scrap}${fmt(r.rw.scrap)}`:''}</b></div></div>`:''}
    <p class="hint">Intentos hoy: ${G.hallTriesLeft()}/${CFG.hall.tries}</p><button class="btn gold" data-act="close">Continuar</button>`)) });
function evEndModal(r){ const boss=r.kind==='boss', rw=r.best>0?(boss?G.wbReward(r.pos):G.evReward(r.pos)):null; if(!r.best) r={...r,pos:'–'};
  showModal(`<h3>${boss?'Jefe semanal':'Mazmorra'}</h3>
    <div class="evhead"><div><span class="s">${boss?'Daño':'Muertes'}</span><b>${boss?fmt(r.dmg):r.kills}</b></div><div><span class="s">Puesto</span><b>${r.pos}</b></div><div><span class="s">${boss?'Total semana':'Total hoy'}</span><b>${boss?fmt(r.best):r.best}</b></div></div>
    ${r.got&&Object.keys(r.got).length?`<p class="hint">Por tus muertes de hoy: <b>${bundleHTML(r.got)}</b></p>`:''}
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
  return `<div class="loot reveal">${sorted.map(x=>`<div><span style="color:var(--r${x.r})">${wName(x)}</span><span class="s">${x.autoEq?'equipada':''}${x.auto?' · desmontada (+'+x.auto+')':''}</span></div>`).join('')}</div>`;
}

/* ---------- estructura ---------- */
// iconos de las monedas de arriba: moneda de oro, token (rombo) y chatarra (engranaje)
const ICON={
  gold:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="#e8b04a" stroke="#140f1c" stroke-width="3.5"/><path d="M47.6 16.4A22 22 0 0 1 16.4 47.6" fill="none" stroke="#a8741e" stroke-width="5" opacity=".55"/><circle cx="32" cy="32" r="16" fill="none" stroke="#a8741e" stroke-width="3"/><path d="M32 21l3 7 7.5.6-5.7 4.9 1.8 7.3L32 37l-6.6 3.8 1.8-7.3-5.7-4.9L29 28z" fill="#a8741e"/><path d="M16 22a18 18 0 0 1 10-8" fill="none" stroke="#ffe08a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 6a26 26 0 1 0 .1 0Z" fill="none" stroke="#140f1c" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  tok:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4L57 25L32 60L7 25Z" fill="#7fc8e8"/><path d="M7 25L19 10H45L57 25Z" fill="#bfe6f7"/><path d="M32 60L57 25H42Z" fill="#3f86b8" opacity="0.7"/><path d="M32 60L22 25H7Z" fill="#5aa6d6" opacity="0.6"/><path d="M7 25H57M22 25L32 10L42 25M22 25L32 60L42 25" fill="none" stroke="#140f1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/><path d="M15 19l5-6" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/><path d="M32 4L57 25L32 60L7 25Z" fill="none" stroke="#140f1c" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  scrap:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M57.5 26.8L57.5 37.2L50.0 38.0L49.0 40.5L53.7 46.4L46.4 53.7L40.5 49.0L38.0 50.0L37.2 57.5L26.8 57.5L26.0 50.0L23.5 49.0L17.6 53.7L10.3 46.4L15.0 40.5L14.0 38.0L6.5 37.2L6.5 26.8L14.0 26.0L15.0 23.5L10.3 17.6L17.6 10.3L23.5 15.0L26.0 14.0L26.8 6.5L37.2 6.5L38.0 14.0L40.5 15.0L46.4 10.3L53.7 17.6L49.0 23.5L50.0 26.0Z" fill="#c9a27e"/><path d="M32 32L58 32A26 26 0 0 1 32 58Z" fill="#7a5536" opacity="0.45"/><path d="M57.5 26.8L57.5 37.2L50.0 38.0L49.0 40.5L53.7 46.4L46.4 53.7L40.5 49.0L38.0 50.0L37.2 57.5L26.8 57.5L26.0 50.0L23.5 49.0L17.6 53.7L10.3 46.4L15.0 40.5L14.0 38.0L6.5 37.2L6.5 26.8L14.0 26.0L15.0 23.5L10.3 17.6L17.6 10.3L23.5 15.0L26.0 14.0L26.8 6.5L37.2 6.5L38.0 14.0L40.5 15.0L46.4 10.3L53.7 17.6L49.0 23.5L50.0 26.0Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="32" cy="32" r="10" fill="#5c3b1e" stroke="#140f1c" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="#140f1c"/><path d="M18 20a18 18 0 0 1 8-6" fill="none" stroke="#f2d3b2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/></svg>',
  // cofres: madera (marrón), plata (gris) y modo (morado)
  wood:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M7 30H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="#8a5a34"/><path d="M7 30H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M7 46H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="#4a2e16" opacity="0.55"/><path d="M7 30V25C7 16 14 10 23 10H41C50 10 57 16 57 25V30Z" fill="#a06a3e"/><path d="M7 30V25C7 16 14 10 23 10H41C50 10 57 16 57 25V30Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 18c3-3 7-4 11-4" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/><path d="M18 11V57M46 11V57" fill="none" stroke="#140f1c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 11V57M46 11V57" fill="none" stroke="#e8b04a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 24H38V39H26Z" fill="#e8b04a"/><path d="M26 24H38V39H26Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M30 29h4v6h-4z" fill="#140f1c"/><path d="M27 25.5h10" fill="none" stroke="#ffe08a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/></svg>',
  silver:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M7 30H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="#8a919e"/><path d="M7 30H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M7 46H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="#4a505e" opacity="0.55"/><path d="M7 30V25C7 16 14 10 23 10H41C50 10 57 16 57 25V30Z" fill="#b9c0cc"/><path d="M7 30V25C7 16 14 10 23 10H41C50 10 57 16 57 25V30Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 18c3-3 7-4 11-4" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/><path d="M18 11V57M46 11V57" fill="none" stroke="#140f1c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 11V57M46 11V57" fill="none" stroke="#eef2f8" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 24H38V39H26Z" fill="#eef2f8"/><path d="M26 24H38V39H26Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M30 29h4v6h-4z" fill="#140f1c"/><path d="M27 25.5h10" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/></svg>',
  mode:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M7 30H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="#7a4fc0"/><path d="M7 30H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M7 46H57V53A5 5 0 0 1 52 58H12A5 5 0 0 1 7 53Z" fill="#3b2a5e" opacity="0.55"/><path d="M7 30V25C7 16 14 10 23 10H41C50 10 57 16 57 25V30Z" fill="#9b6ad6"/><path d="M7 30V25C7 16 14 10 23 10H41C50 10 57 16 57 25V30Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M13 18c3-3 7-4 11-4" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/><path d="M18 11V57M46 11V57" fill="none" stroke="#140f1c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 11V57M46 11V57" fill="none" stroke="#e8b04a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 24H38V39H26Z" fill="#e8b04a"/><path d="M26 24H38V39H26Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M30 29h4v6h-4z" fill="#140f1c"/><path d="M27 25.5h10" fill="none" stroke="#ffe08a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/></svg>',
  // tickets (Mazmorra naranja, Jefe rojo con calavera, PvP azul), esencia (gota morada) y emblema (escudo dorado con estrella)
  ticket:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M5 16H59V26A6 6 0 0 0 59 38V48H5V38A6 6 0 0 0 5 26Z" fill="#e8964a"/><path d="M5 38A6 6 0 0 0 5 26V16H59V26A6 6 0 0 0 59 38V48H5Z" fill="#e8964a"/><path d="M5 40H59V48H5Z" fill="#a85a1e" opacity="0.5"/><path d="M44 19V45" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/><path d="M44 19V45" stroke="#fff" stroke-width="1.4" stroke-dasharray="2.5 3" opacity=".5"/><path d="M5 16H59V26A6 6 0 0 0 59 38V48H5V38A6 6 0 0 0 5 26Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M20 24a7 7 0 0 1 14 0v14H20z" fill="#5c3b1e"/><path d="M20 24a7 7 0 0 1 14 0v14H20z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M23 38V25a4 4 0 0 1 8 0v13z" fill="#140f1c"/><circle cx="27" cy="31" r="1.3" fill="#ffe08a"/></svg>',
  bossTicket:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M5 16H59V26A6 6 0 0 0 59 38V48H5V38A6 6 0 0 0 5 26Z" fill="#d9534f"/><path d="M5 38A6 6 0 0 0 5 26V16H59V26A6 6 0 0 0 59 38V48H5Z" fill="#d9534f"/><path d="M5 40H59V48H5Z" fill="#7a1e26" opacity="0.5"/><path d="M44 19V45" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/><path d="M44 19V45" stroke="#fff" stroke-width="1.4" stroke-dasharray="2.5 3" opacity=".5"/><path d="M5 16H59V26A6 6 0 0 0 59 38V48H5V38A6 6 0 0 0 5 26Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="25" cy="29" r="8.5" fill="#e9dfc8" stroke="#140f1c" stroke-width="2.5"/><path d="M20 35h10v5H20z" fill="#e9dfc8"/><path d="M20 35h10v5H20z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="22" cy="28.5" r="2.3" fill="#140f1c"/><circle cx="28" cy="28.5" r="2.3" fill="#140f1c"/></svg>',
  pvp:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M5 16H59V26A6 6 0 0 0 59 38V48H5V38A6 6 0 0 0 5 26Z" fill="#4f8fd9"/><path d="M5 38A6 6 0 0 0 5 26V16H59V26A6 6 0 0 0 59 38V48H5Z" fill="#4f8fd9"/><path d="M5 40H59V48H5Z" fill="#1f3f6e" opacity="0.5"/><path d="M44 19V45" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/><path d="M44 19V45" stroke="#fff" stroke-width="1.4" stroke-dasharray="2.5 3" opacity=".5"/><path d="M5 16H59V26A6 6 0 0 0 59 38V48H5V38A6 6 0 0 0 5 26Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M16 39L34 21M34 39L16 21" fill="none" stroke="#140f1c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 39L34 21M34 39L16 21" fill="none" stroke="#eef2f8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 37l4 4M36 37l-4 4" fill="none" stroke="#140f1c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 37l4 4M36 37l-4 4" fill="none" stroke="#e8b04a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ess:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="36" r="24" fill="#b066e8" opacity="0.18"/><path d="M32 4C41 18 51 28 51 41A19 19 0 0 1 13 41C13 28 23 18 32 4Z" fill="#9b6ad6"/><path d="M32 4C41 18 51 28 51 41A19 19 0 0 1 32 60Z" fill="#5a3a86" opacity="0.6"/><path d="M32 50c-7 0-11-5-9-10 2-4 8-3 8 1" fill="none" stroke="#d6b8ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M23 22c-3 5-4 9-4 13" fill="none" stroke="#d6b8ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/><path d="M32 4C41 18 51 28 51 41A19 19 0 0 1 13 41C13 28 23 18 32 4Z" fill="none" stroke="#140f1c" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M48 8l2 4.5 4.5 2-4.5 2L48 21l-2-4.5-4.5-2 4.5-2z" fill="#fff3c4"/><path d="M48 8l2 4.5 4.5 2-4.5 2L48 21l-2-4.5-4.5-2 4.5-2z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>',
  ev:'<svg class="ic" viewBox="0 0 64 64" aria-hidden="true"><path d="M32 4L55 12V30C55 45 45 54 32 60C19 54 9 45 9 30V12Z" fill="#e8b04a"/><path d="M32 4L55 12V30C55 45 45 54 32 60Z" fill="#a8741e" opacity="0.55"/><path d="M32 11L48 17V30C48 41 41 48 32 53C23 48 16 41 16 30V17Z" fill="#7a5414"/><path d="M32 11L48 17V30C48 41 41 48 32 53C23 48 16 41 16 30V17Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M32 18l3.6 7.4 8.1 1.1-5.9 5.7 1.4 8L32 36.4l-7.2 3.8 1.4-8-5.9-5.7 8.1-1.1z" fill="#ffe08a"/><path d="M32 18l3.6 7.4 8.1 1.1-5.9 5.7 1.4 8L32 36.4l-7.2 3.8 1.4-8-5.9-5.7 8.1-1.1z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M14 15l8-3" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/><path d="M32 4L55 12V30C55 45 45 54 32 60C19 54 9 45 9 30V12Z" fill="none" stroke="#140f1c" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/></svg>'
};
// iconos de la barra de abajo y de las categorías (trazo del color del texto)
const IC=(d,sz=20)=>`<svg class="ico" viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
// iconos propios de color (misma paleta que los de la Tienda): la Torre
const GI={torre:'<path d="M17 22H47V60H17Z" fill="#6f7785"/><path d="M32 22H47V60H32Z" fill="#4a505e" opacity="0.7"/><path d="M17 34H47M17 46H47M26 22v12M38 34v12M26 46v14" fill="none" stroke="#140f1c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.35"/><path d="M17 22H47V60H17Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 10H20V16H26V10H38V16H44V10H52V24H12Z" fill="#9aa1ad"/><path d="M12 10H20V16H26V10H38V16H44V10H52V24H12Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M26 60V48a6 6 0 0 1 12 0v12z" fill="#140f1c"/><path d="M26 60V48a6 6 0 0 1 12 0v12z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="32" cy="32" r="8" fill="#b066e8" opacity="0.35"/><path d="M28 27a4 4 0 0 1 8 0v9h-8z" fill="#d6b8ff"/><path d="M28 27a4 4 0 0 1 8 0v9h-8z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M32 10V2" fill="none" stroke="#140f1c" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 10V2" fill="none" stroke="#b9c0cc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 2l10 4-10 4z" fill="#e2605a"/><path d="M33 2l10 4-10 4z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'};
const GIC=(d,sz=22)=>`<svg class="ico" viewBox="0 0 64 64" width="${sz}" height="${sz}" aria-hidden="true">${d}</svg>`;
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
function renderShell(){ avKey=null;   // el retrato se vuelve a pintar en la pantalla nueva
  $('#app').innerHTML=`
  <div class="top"><span class="av" id="avatar" aria-hidden="true"></span><div class="uname" id="uName"></div><b class="sttl" id="scrT"></b>
    <div class="res"><span title="Oro" aria-label="Oro">${ICON.gold}<b id="rGold"></b></span>
    <span title="Tokens (comprados + ganados)" aria-label="Tokens">${ICON.tok}<b id="rTok"></b></span>
    <span title="Chatarra" aria-label="Chatarra">${ICON.scrap}<b id="rScrap"></b></span></div></div>
  <div id="battle" class="battle">
  <div class="hero"><div id="evoSlot"></div>
    </div>
  <div class="stage"><canvas id="cv" width="600" height="220"></canvas><div class="vshud" id="vsHud" hidden><div class="vsw me"><svg class="vsv" viewBox="0 0 200 22" preserveAspectRatio="none"><defs><linearGradient id="gMe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fe2a9"/><stop offset=".45" stop-color="#6cc47a"/><stop offset="1" stop-color="#3d8a4b"/></linearGradient><clipPath id="cpMe"><path d="M11,1 H199 L187,21 H11 A10,10 0 0 1 11,1 Z"/></clipPath></defs><path d="M11,1 H199 L187,21 H11 A10,10 0 0 1 11,1 Z" class="trk"/><g clip-path="url(#cpMe)"><rect class="tr" y="0" height="22" width="0"/><rect class="fl" y="0" height="22" width="0"/><rect class="shn" x="0" y="2" width="200" height="6"/></g><path d="M11,1 H199 L187,21 H11 A10,10 0 0 1 11,1 Z" class="frm" vector-effect="non-scaling-stroke"/></svg><i class="vssh"></i><div class="vsst" id="stMe"></div></div><div class="vsc" id="vsC"><small></small><b></b></div><div class="vsw foe"><svg class="vsv" viewBox="0 0 200 22" preserveAspectRatio="none"><defs><linearGradient id="gFoe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f29a93"/><stop offset=".45" stop-color="#e2605a"/><stop offset="1" stop-color="#9b3a35"/></linearGradient><clipPath id="cpFoe"><path d="M1,1 H189 A10,10 0 0 1 189,21 H13 Z"/></clipPath></defs><path d="M1,1 H189 A10,10 0 0 1 189,21 H13 Z" class="trk"/><g clip-path="url(#cpFoe)"><rect class="tr" y="0" height="22" width="0"/><rect class="fl" y="0" height="22" width="0"/><rect class="shn" x="0" y="2" width="200" height="6"/></g><path d="M1,1 H189 A10,10 0 0 1 189,21 H13 Z" class="frm" vector-effect="non-scaling-stroke"/></svg><div class="vsst" id="stFoe"></div></div></div><span class="fasetxt" id="faseTxt"></span><div class="skbar" id="skBar"></div><div class="sktip" id="skTip" hidden></div><div id="skMode"></div><div class="sidebtns"><button class="calbtn" id="grimBtn" data-act="grimOpen" aria-label="Grimorio" title="Grimorio" hidden><svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><path d="M12 8H48A6 6 0 0 1 54 14V56H18A6 6 0 0 1 12 50Z" fill="#5a3a86"/><path d="M12 8H21V50H12Z" fill="#3b2a5e"/><path d="M18 50H54V56H18A3 3 0 0 1 18 50Z" fill="#e9dfc8"/><path d="M18 50H54V56H18A3 3 0 0 1 18 50Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="37" cy="28" r="11" fill="#b066e8" opacity="0.35"/><path d="M28 28Q37 20 46 28Q37 36 28 28Z" fill="#ffd66b"/><path d="M28 28Q37 20 46 28Q37 36 28 28Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="37" cy="28" r="2.8" fill="#140f1c"/><path d="M45 8H54V17Z" fill="#e8b04a"/><path d="M45 8H54V17Z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M12 8H48A6 6 0 0 1 54 14V56H18A6 6 0 0 1 12 50Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg><i class="lootn" id="grimN" hidden>!</i></button><button class="calbtn" id="dailyBtn" data-act="dailyOpen" aria-label="Premios diarios" title="Premios diarios"><svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><path d="M8 30H56V54A4 4 0 0 1 52 58H12A4 4 0 0 1 8 54Z" fill="#8a5a34"/><path d="M8 30H56V54A4 4 0 0 1 52 58H12A4 4 0 0 1 8 54Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M8 46H56V54A4 4 0 0 1 52 58H12A4 4 0 0 1 8 54Z" fill="#5c3b1e" opacity="0.6"/><path d="M8 30V25C8 16 15 11 24 11H40C49 11 56 16 56 25V30Z" fill="#a06a3e"/><path d="M8 30V25C8 16 15 11 24 11H40C49 11 56 16 56 25V30Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M14 18c3-3 7-4 11-4" fill="none" stroke="#ffe08a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/><path d="M19 12V57M45 12V57" fill="none" stroke="#140f1c" stroke-width="7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 12V57M45 12V57" fill="none" stroke="#e8b04a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 25H37V38H27Z" fill="#e8b04a"/><path d="M27 25H37V38H27Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="32" cy="31" r="1.8" fill="#140f1c"/><circle cx="32" cy="6" r="3" fill="#ffe08a" opacity="0.9"/><circle cx="24" cy="5" r="2" fill="#ffe08a" opacity="0.7"/><circle cx="41" cy="5" r="2" fill="#ffe08a" opacity="0.7"/></svg><i class="lootn" id="dailyN" hidden>!</i></button><button class="calbtn boostbtn" id="boostBtn" data-act="boostOpen" aria-label="Potenciadores" title="Potenciadores"><svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><path d="M26 8H38V19C47 22 52 30 52 39A20 20 0 0 1 12 39C12 30 17 22 26 19Z" fill="#2b2f40"/><path d="M13 39C21 35 43 43 51 39A19 19 0 0 1 13 39Z" fill="#e8b04a"/><path d="M14 44C24 46 40 48 50 44A19 19 0 0 1 14 44Z" fill="#a8741e" opacity="0.55"/><circle cx="26" cy="46" r="2.4" fill="#ffe08a"/><circle cx="36" cy="50" r="1.8" fill="#ffe08a"/><circle cx="31" cy="42" r="1.5" fill="#fff3c4"/><path d="M19 29c-3 3-4 7-4 10" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/><path d="M26 8H38V19C47 22 52 30 52 39A20 20 0 0 1 12 39C12 30 17 22 26 19Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M23 3H41V10H23Z" fill="#8a5a34"/><path d="M23 3H41V10H23Z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/></svg></button></div><span class="boosttime" id="boostTime" hidden></span></div>
  </div>
  <div id="tab"></div>`;
  for(const k in NAVL) navSet(k,0);
  $('#nav').hidden=false; { const st=document.querySelector('[data-tab="shop"]'); if(st) st.hidden=!CFG.shopTab; } if(tab==='shop'&&!CFG.shopTab) tab='up'; renderTab();
}
function updateHUD(){
  if(!S||!$('#rGold')) return;
  unlockCheck();
  const h=G.heroStats(), B=G.B;
  const ev=G.inEvent();
  // en Inicio: retrato, nombre y dinero; en las demás pantallas, solo el dinero en una barra fina fija arriba (como en los RPG de móvil); luchando, nada
  { const tp=document.querySelector('.top'); if(tp){ tp.hidden=tab==='up'&&ev; tp.classList.toggle('slim',tab!=='up'); const t=$('#scrT'), nt=((tab==='ev'&&{campana:'Campaña',eventos:'Eventos',pvp:'PvP',torre:'Torre'}[modView])||NAVL[tab]||'').toUpperCase(); if(t&&t.textContent!==nt) t.textContent=nt; } }
   // el nivel solo cuenta farmeando: en eventos, Torre y PvP no se ve   // retrato, nombre y dinero: solo en Inicio farmeando (en el resto ocupa sitio)
  // abajo a la derecha: la fase (o, en un evento, el tiempo y la puntuación)
  $('#faseTxt').classList.add('top');   // debajo de tu barra de vida (los iconos de abajo a la derecha quedan libres)
  setHTML($('#faseTxt'),ev&&B.kind==='pvp'?`⏱ ${Math.ceil(Math.max(0,CFG.pvp.maxT-(B.rt||0)))} s · ×${G.duelSpeed().toLocaleString('es-ES',{maximumFractionDigits:1})}`:ev&&B.kind==='hall'?`⏱ ${mmss(B.t*1000)}${B.rage?` · 🔥 Furia ${B.rage}`:''}`:ev&&B.kind==='tower'?(B.final?`Daño ${fmt((G.towerState().run.finalDmg||0)+B.mD)}`:''):ev&&B.kind==='boss'?`⏱ ${mmss(Math.max(0,CFG.wboss.dur-B.t)*1000)} · Daño ${fmt(B.dmg)}`
    :ev?`⏱ ${mmss(Math.max(0,CFG.event.maxDur-(B.rt||0))*1000)}${G.labSpeed()>1.05?` · ×${G.labSpeed().toLocaleString('es-ES',{maximumFractionDigits:1})}`:''} · Nv ${(G.evRamp()||{r:0}).r+1} · ☠ ${B.kills}`:G.streak().mul>1?`<span class="stk">🔥 +${Math.round((G.streak().mul-1)*100)} %</span>`:'');   // campaña: la fase ya va en el emblema de arriba
  { const f=$('#faseTxt'); f.hidden=!f.innerHTML; }
  setHTML($('#uName'),`<span class="nt">${esc(S.name||'')}</span>`);   // solo el nombre: la clase ya se ve en el retrato
  avatar();   // nombre y, debajo, la clase

  $('#rGold').textContent=fmtG(S.gold); $('#rTok').textContent=fmt(G.tokens()); $('#rScrap').textContent=fmt(S.scrap);
  // emblema del centro (entre las dos barras): dónde estás y si es jefe o élite
  { const sp=!ev&&G.surpriseState(), run=ev&&B&&B.kind==='tower'?G.towerState().run:null;
    // jefe: calavera morada · jefe de élite: calavera roja · élite (Torre): ÉLITE en naranja · horda: HORDA en rojo · errante: naranja · PvP: VS en azul
    const SK='\u0000skull', [lb,mn,cl]=!B?['FASE',S.fase,'']:B.kind==='pvp'?['PVP','VS','pvp']:run?(B.final?['FINAL','∞','boss']:B.node==='boss'?['JEFE',SK,'boss']:B.node==='elite'?['ÉLITE',run.floor,'elite']:['PISO',run.floor,''])
      :B.kind==='hall'?['★'.repeat(B.hall.star),SK,B.elite?'eboss':'boss']:B.kind==='boss'?['SEMANAL',SK,'boss']:ev?['MAZMORRA',(G.evRamp()||{r:0}).r+1,'']:B.boss?[B.elite?'ÉLITE':'JEFE',SK,B.elite?'eboss':'boss']
      :sp?[Math.ceil(sp.left)+' s',{horde:'HORDA',wander:'ERRANTE'}[sp.k]||'¡!',sp.k==='horde'?'horde':'wander']:['FASE',S.fase,''];
    const c=$('#vsC'), k=lb+'|'+mn+'|'+cl; if(c&&c.dataset.k!==k){ c.dataset.k=k; c.className='vsc'+(cl?' '+cl:'')+(mn===SK?' sk':'')+(String(mn).length>3?' long':'');
      c.innerHTML=`<small>${esc(lb)}</small>`+(mn===SK?`<svg viewBox="0 0 24 24" width="22" height="22" aria-label="Jefe"><path fill="currentColor" d="M12 2C6.9 2 3 5.6 3 10.3c0 2.9 1.5 5.2 3.8 6.6V20a1 1 0 0 0 1 1h1.6v-2h1.4v2h2.4v-2h1.4v2h1.6a1 1 0 0 0 1-1v-3.1c2.3-1.4 3.8-3.7 3.8-6.6C21 5.6 17.1 2 12 2Zm-3.6 11.2a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm7.2 0a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2ZM12 13.3l1.2 2.2h-2.4l1.2-2.2Z"/></svg>`:`<b>${esc(String(mn))}</b>`); } }
  const fab=$('#upFab'); if(fab){ fab.hidden=tab!=='up'||ev; if(!fab.hidden) setHTML(fab,upStrip()); }
  // Grimorio: icono de libro en el combate desde el nivel grimoire.showLvl (o si ya se tiene); brilla cuando se puede evolucionar
  const gb=$('#grimBtn'); if(gb){ const shown=!ev&&(G.grimOwned()||S.lvl>=CFG.grimoire.showLvl||S.evo>=1), evoNow=shown&&!(S.evo>=1)&&G.grimDone()&&G.evoLvlOk();
    gb.hidden=!shown; gb.classList.toggle('on',evoNow); gb.dataset.act=evoNow?'evoOpen':'grimOpen'; gb.setAttribute('aria-label',evoNow?'Evolucionar':'Grimorio'); $('#grimN').hidden=!evoNow; }
  const es=$('#evoSlot'); if(es){ const soon=G.nextEvo()&&G.nextEvo().pending&&S.lvl>=G.lvlCap(); setHTML(es,soon&&!ev?'<span class="pill">Evolución: próximamente</span>':''); }
  const sbs=document.querySelector('.sidebtns'); if(sbs) sbs.hidden=ev;   // en los eventos no se ven los iconos del combate
  const db=$('#dailyBtn'); if(db){ db.hidden=ev; $('#dailyN').hidden=!(G.calState().can||G.wheelState().free); }   // premios diarios: calendario y ruleta

  const hs=$('#hStats'); if(hs) hs.innerHTML=`<div class="sl">
      <span>Vida <b>${fmt(h.hp)}</b></span><span>Def <b>${fmt(h.df)}</b></span>${h.ls?`<span>Robo <b>${pct(h.ls)}</b></span>`:''}${h.ev?`<span>Evasión <b>${pct(h.ev)}</b></span>`:''}</div>
    <div class="sl"><span>Daño <b>${fmt(h.atk)}</b></span><span>Vel <b>${h.spd.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})}/s</b></span><span>Crít <b>${pct(h.cr)}</b></span><span>D. crít <b>+${Math.round(h.cd*100)} %</b></span>${h.bd?`<span>Jefes <b>+${pct(h.bd)}</b></span>`:''}</div>`;
  if(S.loot) G.claimLoot();   // el botín de los jefes entra solo en el inventario (sin icono de botín)
  const ep=$('#evPause'); if(ep){ const l=G.evPauseLeft(); if(l>0) ep.textContent=mmss(l); else if(tab==='ev') renderTab(); }
  const bl=G.boostLeft(), bt=$('#boostTime'), bb=$('#boostBtn');
  if(bt){ bt.hidden=!bl||ev; if(bl) bt.textContent='×'+CFG.boosts.speed.mult+' '+mmss(bl); } if(bb) bb.classList.toggle('on',bl>0);
  if(boostModalOpen) updateBoostModal();
  if(G.towerRewardPending()&&!modalOpen()) towerPickModal();   // la recompensa de la pelea no se puede saltar
  const on=!ev&&G.canAdvanceMode(); if(on&&modeReady===false) toast(`¡${CFG.modes[S.mode+1].name} desbloqueado! Míralo en Modos → Campaña`); modeReady=on;
  // habilidades: solo las desbloqueadas; la recarga se ve con el reloj gris (sin números). En los eventos, botón Auto/Manual
  const sb=$('#skBar'); if(sb){ const L=G.skills().filter(x=>!x.locked), inEv=G.inEvent(), pvp=G.pvpOn(), auto=pvp?true:inEv&&!!(S.opt&&S.opt.evAuto), on=inEv?auto:!(S.opt&&S.opt.autoSkills===false), key=L.map(x=>x.slot+x.id).join()+inEv+on;
    // al final de las habilidades, un círculo AUTO/MAN (se lanzan solas o a mano)
    sb.hidden=G.autoOnly();   // PvP, Torre y Mazmorra: siempre automáticas, sin botones
    if(sb.dataset.k!==key){ sb.dataset.k=key; sb.classList.toggle('many',L.length>4); sb.innerHTML=L.map(x=>`<button class="skb" data-act="skill" data-k="${x.slot}" aria-label="${esc(x.name||'')}">${skIcon(x.id)}<i class="skcd"></i></button>`).join('')
      +(L.length?`<button class="skmode${on?' on':''}" data-act="skAuto" aria-pressed="${on}" aria-label="Habilidades ${on?'automáticas':'a mano'}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/></svg><small>${on?'AUTO':'MAN'}</small></button>`:''); }
    { const sm=$('#skMode'); if(sm&&sm.innerHTML) sm.innerHTML=''; }
    L.forEach((x,i)=>{ const b=sb.children[i]; if(!b) return; const p=x.ready?0:x.left/x.cd; b.classList.toggle('ready',x.ready);
      b.querySelector('.skcd').style.background=p?`conic-gradient(rgba(0,0,0,.65) ${p*360}deg, transparent 0)`:'none'; }); }
  { const n=misBadge(); navSet('mis',n); if(tab==='mis'&&misKeyNow()!==misKey) renderTab(); }
  document.querySelectorAll('[data-need]').forEach(b=>{const [k,v]=b.dataset.need.split(':');b.disabled=(S[k]<+v)});
  const nc=chestTotal();
  navSet('ev',((G.evPaused()?0:(G.modeOpen('lab')?G.evFreeLeft():0)+(G.modeOpen('boss')?G.wbFreeLeft():0))+(G.modeOpen('pvp')?G.pvpFreeLeft():0)+(G.evPending()?1:0)+(G.wbPending()?1:0)+(CFG.league.show&&G.leaguePending()?1:0)));
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
  // al cambiar de pestaña, la pantalla nueva entra con un pequeño fundido hacia arriba
  if(renderTab.last!==tab){ renderTab.last=tab; if(tab!=='up'&&!battery()){ el.classList.remove('tabin'); void el.offsetWidth; el.classList.add('tabin'); } }
  const bt=$('#battle'); if(bt) bt.hidden=tab!=='up'; $('#app').classList.toggle('home',tab==='up'); // el combate sigue funcionando por detrás
  if(tab==='up') el.innerHTML='';
  const fab=$('#upFab'); if(fab) fab.hidden=tab!=='up'||G.inEvent();
  // Inventario: pantalla principal (Equipo + Cofres/Materiales); Armas y Grimorio se abren desde el Equipo, a pantalla propia
  if(tab==='inv'){ const back=(v,t)=>`<button class="back" data-act="invview" data-v="${v}">← ${t}</button>`;
    el.innerHTML=nbsp((invView==='forja'?'':invView==='grim'?back('main','Volver al inventario'):invBanner())+tabInv()); if(invView==='armas'||invView==='main') renderList(); fitSheet(); }
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
// Barra de mejoras fija sobre la barra de abajo: un toque compra 1 nivel (o todos los posibles en MÁX)
let upHeld=false, upRep=null;   // mantener pulsada una mejora: compra seguido, cada vez más rápido
function upHoldStop(){ clearTimeout(upRep); upRep=null }
document.addEventListener('pointerdown',e=>{ const b=e.target.closest('.upt'); if(!b) return; upHoldStop(); upHeld=false; const k=b.dataset.k; let n=0;
  const tick=()=>{ if(!G.buyUpgrade(k)){ upHoldStop(); updateHUD(); return } upHeld=true; n++; if(n%3===0) haptic('light'); updateHUD(); upRep=setTimeout(tick,Math.max(35,140-n*8)) };
  upRep=setTimeout(tick,380) });
['pointerup','pointercancel'].forEach(ev=>document.addEventListener(ev,upHoldStop));
const UPS={atk:'Daño',hp:'Vida',df:'Defensa',spd:'Velocidad'};
function upStrip(){ const st=G.heroStats();
  const t=Object.keys(UPS).map(k=>{ const c=G.upCost(k), v=st[k], ok=S.gold>=c;
    const nv=k==='spd'?v.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}):fmt(v);
    return `<button class="upt${ok?' ok':''}" data-act="upBuy" data-k="${k}" aria-label="Mejorar ${UPS[k]} por ${fmt(c)} oro"><span class="un">${UPS[k]}</span><b>${nv}</b><span class="uc"><i class="dot" style="background:var(--gold)"></i>${fmtG(c)}</span></button>` }).join('');
  return `<div class="upx lv" aria-label="Nivel ${S.lvl}"><small>Lv.</small><b>${S.lvl}</b></div>${t}` }
// Modos: Normal, Pesadilla, Infierno. Muestra dónde estás, qué da cada uno y qué hace falta para pasar al siguiente.
function nameModal(){ showModal(`<h3>Tu nombre</h3><input id="nameIn" class="nameinp" maxlength="16" autocomplete="nickname" placeholder="3-16 letras" value="${esc(S.name||'')}">
  <p class="hint">No se podrá cambiar.</p><div class="ctrl"><button class="btn gold" data-act="nameSave">Guardar</button></div>`); const i=$('#nameIn'); if(i) i.focus() }
// Campaña · Sala de jefes: cada jefe de campaña vencido se puede volver a luchar (3 intentos al día, ★/★★/★★★)
let hallMode=null, hallSel=null, hallStar=1;
const bossPicCache={};
function bossPic(m,f){ const k=m+'_'+f; if(bossPicCache[k]===undefined&&window.ART){ try{ const cv=document.createElement('canvas'); cv.width=120; cv.height=120; const g=cv.getContext('2d');
    g.scale(1.6,1.6); ART.monster(g,37,66,{kind:ART.kindFor(Math.floor((f-1)/30),0,{boss:true,elite:f%50===0,mode:m}),r:f%50===0?24:20,hue:[0,190,300][m]||0,boss:true,elite:f%50===0,t:0});
    bossPicCache[k]=cv.toDataURL() }catch(e){ bossPicCache[k]='' } } return bossPicCache[k]||'' }
const starsHTML=(n,size)=>[1,2,3].map(i=>`<i class="${i<=n?'on':''}"${size?` style="font-size:${size}px"`:''}>★</i>`).join('');
function tabHall(){ const H=CFG.hall, L=G.hallBosses(), left=G.hallTriesLeft();
  if(hallMode==null) hallMode=Math.min(S.mode,CFG.modes.length-1);
  const M=CFG.modes[hallMode], mine=L.filter(b=>b.m===hallMode), cur=hallMode===S.mode, next=hallMode===S.mode+1;
  const chips=`<div class="fchips">${CFG.modes.map((x,m)=>`<button data-act="hallMode" data-v="${m}" aria-pressed="${m===hallMode}" ${x.locked?'disabled':''}>${x.locked?'🔒 ':''}${x.name}</button>`).join('')}</div>`;
  const status=M.locked?'<p class="hint">Próximamente.</p>':cur?`<p class="hint">Fase actual ${S.best}/${CFG.phaseCap} · ${mine.some(b=>b.beaten)?'cada jefe de élite que vences entra aquí':`vence al jefe de élite de la fase ${H.every} para abrir la sala`}</p>`:hallMode<S.mode?'<p class="hint">Completado</p>'
    :next&&G.canAdvanceMode()?`<button class="btn gold" data-act="modeGo">Ir a ${M.name}</button>`:`<p class="hint">Vence la fase ${CFG.phaseCap} de ${CFG.modes[hallMode-1].name} y evoluciona para entrar.</p>`;
  const tiles=mine.map(b=>`<button class="htile${b.beaten?'':' lock'}${b.elite?' elite':''}${hallSel===b.id?' sel':''}" data-act="hallSel" data-id="${b.id}" ${b.beaten?'':'disabled'}>
      ${b.beaten?`<img src="${bossPic(b.m,b.f)}" alt="">`:'<span class="hlk">🔒</span>'}<span class="hf">${b.elite?'👑 ':''}${b.f}</span><span class="hst">${starsHTML(b.stars)}</span></button>`).join('');
  const sel=mine.find(b=>b.id===hallSel&&b.beaten); let sheet='';
  if(sel){ const st=Math.min(hallStar,sel.stars+1), first=st>sel.stars, rw=G.hallReward(sel,st,first);
    const sb=[1,2,3].map(i=>`<button class="hsb${i===st?' on':''}${i<=sel.stars?' done':''}" data-act="hallStar" data-v="${i}" ${i>sel.stars+1?'disabled':''}>${'★'.repeat(i)}${i<=sel.stars?' ✓':''}</button>`).join('');
    sheet=`<div class="hsheet"><div class="ctrl" style="justify-content:space-between"><b>Jefe de la fase ${sel.f}${sel.elite?' · Élite':''}</b><span class="hst big">${starsHTML(sel.stars)}</span></div>
      <div class="hsbs">${sb}</div>
      <div class="loot"><div><span>${first?'1.ª victoria':'Repetir'}</span><b>${bundleHTML(rw)}${rw.scrap?` ${ICON.scrap}${fmt(rw.scrap)}`:''}</b></div></div>
      <button class="btn gold" data-act="hallGo" data-id="${sel.id}" data-v="${st}" ${left&&!G.inEvent()?'':'disabled'}>Luchar ${'★'.repeat(st)} · ${left}/${H.tries} intentos</button></div>`; }
  return `<section class="panel"><div class="ctrl" style="justify-content:space-between"><h3>Campaña · Jefes de élite</h3><span class="pill">Intentos hoy <b>${left}/${H.tries}</b></span></div>
    ${chips}${status}${sheet}<div class="hgrid">${tiles}</div>
    <p class="hint">Sin tiempo límite: desde el minuto 1, el jefe se enfurece cada 10 s · ★★ y ★★★ son más fuertes y dan más · repetir da oro y chatarra</p></section>` }
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
let forjaTab='lvl', fdetOpen=false;   // fdetOpen: el panel «Filtros y desmontar» sigue como lo dejaste
// Forja: el arma en un marco del color de su rareza, estrellas de nivel y dos pestañas, Subir nivel y Reforjar
const ICSPD='<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>';
function tabForja(){
  const it=G.findItem(forgeId)||G.equipped();
  if(!it) return `${scrHead('FORJA',forjaBack)}<section class="panel"><p class="hint">Vacío.</p></section>`;
  forgeId=it.id;
  const m=G.weaponMain(it), eq=it.id===S.equippedId, own=it.cls===S.cls, max=it.lvl>=CFG.weapon.maxLvl;
  const n=G.lvlCostItems(it), sc=G.lvlCostScrap(it), have=G.fodderFor(it).length;
  const mn=G.weaponMain({r:it.r,lvl:Math.min(CFG.weapon.maxLvl,it.lvl+1)});
  const p=G.reforgePrice(it,lockSel.length,'scrap'), pt=lockSel.length===1&&tokOpen()?G.reforgePrice(it,1,'token'):null;
  const stars=Array.from({length:CFG.weapon.maxLvl},(_,i)=>`<i class="${i<it.lvl?'on':''}">★</i>`).join('');
  const row=(ic,k,a,b)=>`<div class="fgrow"><span class="fgi">${IC(ic,18)}</span><span class="fgk">${k}</span>${max?`<b>+${pct(a)}</b>`:`<s>+${pct(a)}</s><em>→</em><b class="up">+${pct(b)}</b>`}</div>`;
  // material: Esencia (gota), Esencia de pesadilla e infernal (cristal); tienes / pide
  const MATIC=[ICON.ess,MATI,MATI.replace('<svg class="ic"','<svg class="ic" style="filter:hue-rotate(-60deg) saturate(1.4)"')];
  const matNeed=(mats,scrap)=>[scrap?`<span class="fgm" style="color:var(--${S.scrap>=scrap?'good':'bad'})">${ICON.scrap}${fmt(scrap)}</span>`:'',...(mats||[]).map((q,m)=>q?`<span class="fgm" style="color:var(--${(S.mats[m]||0)>=q?'good':'bad'})" title="${CFG.modes[m].mat}">${MATIC[m]}${fmt(S.mats[m]||0)}/${fmt(q)}</span>`:'')].join('');
  const asc=max?G.ascendInfo(it.id):null, mc=!max&&have<n?G.lvlMatCost(it):null;
  const ascBody=!asc||asc.top?'<p class="hint" style="text-align:center">Nivel y rareza máximos</p>':`
      <p class="hint" style="text-align:center">Nivel máximo. <b>Ascender</b>: pasa a <b style="color:var(--r${asc.next})">${CFG.rarName[asc.next]}</b> al nivel ${CFG.weapon.ascend.lvl}, con sus stats mejorados${CFG.weapon[asc.next][2]>it.sec.length?' y un stat nuevo':''}.</p>
      <div class="fgneed"><span>Otra ${CFG.rarName[it.r]} nv ${CFG.weapon.maxLvl} (se gasta)</span><b style="color:var(--${asc.partner?'good':'bad'})">${asc.partner?'✓':'0/1'}</b></div>
      <div class="fgneed"><span>Coste</span><span class="fgms">${matNeed(asc.cost.mats,asc.cost.scrap)}</span></div>
      <button class="fgcta asc" style="--rc:var(--r${asc.next})" data-act="ascAsk" data-id="${it.id}" ${asc.can?'':'disabled'}><b>ASCENDER A ${CFG.rarName[asc.next].toUpperCase()}</b><span>${asc.can?'Listo':!asc.partner?`Te falta otra ${CFG.rarName[it.r]} al nivel ${CFG.weapon.maxLvl}`:'Te faltan materiales'}</span></button>`;
  const lvlBody=max?ascBody:`
      ${row(ICONS.armas,'Daño',m.d,mn.d)}${row(ICSPD,'Velocidad',m.s,mn.s)}
      <div class="fgneed"><span>Armas iguales</span><b style="color:var(--${have>=n?'good':'bad'})">${have}/${n}</b></div>
      <button class="fgcta" data-act="lvl" data-id="${it.id}" ${have<n||S.scrap<sc?'disabled':''}><b>SUBIR A NIVEL ${it.lvl+1}</b><span>${sc?`${ICON.scrap} ${fmt(sc)} chatarra · `:''}${n} arma${n>1?'s':''} igual${n>1?'es':''}</span></button>
      ${mc&&mc.miss?`<button class="btn fgalt" data-act="lvlMat" data-id="${it.id}" ${mc.lack||S.scrap<sc+mc.scrap?'disabled':''}>Pagar ${mc.miss===1?'la copia que falta':'las '+mc.miss+' copias que faltan'} con <span class="fgms">${matNeed(mc.mats,sc+mc.scrap)}</span></button>`:''}`;
  const refBody=`${it.sec.map((x,i)=>statRow(it,x,i,{lock:true,imp:true})).join('')}
      <button class="fgcta" data-act="ref" data-id="${it.id}" data-pay="scrap" ${S.scrap<p.scrap?'disabled':''}><b>REFORJAR</b><span>${ICON.scrap} ${fmt(p.scrap)} chatarra</span></button>
      ${pt?`<button class="btn sm" data-act="ref" data-id="${it.id}" data-pay="token">O con token: ${fmt(pt.scrap)} chat. + ${pt.tokens} token</button>`:''}
      <div class="rlegend"><span>${LOCK_SVG(true)} fija un stat (cuesta más)</span><span><b>↑</b> sube solo ese stat</span></div>`;
  return `${scrHead('FORJA',forjaBack)}<section class="fgp">
    <div class="fgframe" style="--rc:var(--r${it.r})">${wIcon(it,120)}
      ${eq?'<span class="pill fgeq">Equipada</span>':own?`<button class="btn sm fgeq" data-act="equip" data-id="${it.id}">Equipar</button>`:''}</div>
    <div class="fgname">${wName(it)}</div>
    <div class="fgrar" style="--rc:var(--r${it.r})"><span>${CFG.rarName[it.r].toUpperCase()}</span><span class="fgst">${stars}</span></div>${legendLine(it)}
    <div class="fgtabs"><button class="${forjaTab==='lvl'?'on':''}" data-act="forjaTab" data-v="lvl">Subir nivel</button><button class="${forjaTab==='ref'?'on':''}" data-act="forjaTab" data-v="ref">Reforjar <small>${lockSel.length}/${G.maxLocks(it)}</small></button></div>
    <div class="fgbody">${forjaTab==='lvl'?lvlBody:refBody}</div>
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
// Retrato redondo (cabeza del dibujo del héroe) y escenarios de art.js como imagen de fondo (se pintan una vez)
let avKey=null;
function avatar(){ const k=[S.cls,S.evo,S.path].join(), el=$('#avatar'); if(!el||k===avKey) return;   // solo cuando cambia el dibujo
  const f=window.ART&&ART.face(S.cls), cw=el.clientWidth;
  if(f&&cw){ const h=0.8*cw/f.d, w=h*f.ar; avKey=k;   // sprite: la cara llena el círculo
    el.style.cssText=`background-image:url(${f.src});background-size:${w.toFixed(1)}px ${h.toFixed(1)}px;background-position:${(cw/2-f.x*w).toFixed(1)}px ${(cw/2-f.y*h).toFixed(1)}px`; return }
  heroImg(); const src=heroImgCache[k]; if(src){ avKey=k; el.style.cssText=''; el.style.backgroundImage=`url(${src})` } }
const sceneCache={};
function sceneImg(zone,w,h){ const k=zone+'_'+w+'_'+h; if(!sceneCache[k]&&window.ART){ try{ const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const g=cv.getContext('2d');
  ART.scene(g,w,h,Math.round(h*0.8),zone,0,0,0); sceneCache[k]=cv.toDataURL('image/jpeg',0.8) }catch(e){ sceneCache[k]='' } } return sceneCache[k]||'' }
const zoneNow=()=>Math.floor(((Math.max(1,S.best)-1)%150)/30);
const scrHead=(t,backV)=>`<div class="scrhd">${backV?`<button class="scrb" data-act="invview" data-v="${backV}" aria-label="Volver">‹</button>`:''}<b>${t}</b></div>`;
// Inventario: el héroe con el mismo dibujo del combate (se pinta una vez y se guarda como imagen)
const heroImgCache={};
function heroImg(){ const c=CFG.classes[S.cls], k=[S.cls,S.evo,S.path].join();
  if(!heroImgCache[k]&&window.ART){ const sp=ART.hasSprite(S.cls);   // con sprite: centrado y algo más pequeño (es más ancho que el dibujo)
    try{ const cv=document.createElement('canvas'); cv.width=184; cv.height=240; const g=cv.getContext('2d');
    g.scale(sp?3:3.2,sp?3:3.2); ART.hero(g,sp?30.6:25,sp?78:73,{cls:S.cls,color:c.color,evo:S.evo,path:S.path,center:sp}); heroImgCache[k]=cv.toDataURL() }catch(e){ if(sp) heroImgCache[k]=ART.spriteSrc(S.cls) } }
  return heroImgCache[k]?`<img class="silh" src="${heroImgCache[k]}" width="92" height="120" alt="">`:classSVG(S.cls) }
// al cargar los sprites, el retrato y el héroe del inventario se vuelven a pintar con ellos
if(window.ART) ART.onSprites(()=>{ for(const k in heroImgCache) delete heroImgCache[k]; avKey=null; if(!S) return; avatar(); const b=$('.ibart'); if(b) b.innerHTML=heroImg() });
// Cabecera del inventario: el héroe grande sobre el escenario de su zona y sus huecos (arma y grimorio)
function invBanner(){ const w=G.equipped(), bg=sceneImg(zoneNow(),390,190), gshown=G.grimOwned()||S.lvl>=CFG.grimoire.showLvl||S.evo>=1;
  const ws=w?`<button class="ibslot" style="--rc:var(--r${w.r})" data-act="forge" data-id="${w.id}" data-from="main" aria-label="Arma: ${wName(w)}">${wIcon(w)}<span class="ibl">Nv ${w.lvl}</span></button>`:`<button class="ibslot empty" data-act="invview" data-v="armas" aria-label="Sin arma">—</button>`;
  const gs=gshown?`<button class="ibslot" style="--rc:var(--rE)" data-act="grimOpen" aria-label="Grimorio">${((document.querySelector('#grimBtn svg')||{}).outerHTML||'📖').replace(/width="\d+" height="\d+"/,'width="34" height="34"')}${G.grimOwned()?`<span class="ibl">Nv ${G.grimLevel()}</span>`:''}</button>`:`<span class="ibslot empty" aria-label="Grimorio bloqueado">🔒</span>`;
  return `<section class="ibanner" style="background-image:linear-gradient(180deg,rgba(18,20,28,.1),rgba(18,20,28,.85)),url(${bg})">
    <div class="ibart">${heroImg()}</div>
    <div class="ibinfo"><b>${esc(S.name||'')}</b><span>${heroName().toUpperCase()}</span><small>Nivel ${S.lvl}</small></div>
    <div class="ibslots">${ws}${gs}</div></section>` }
function tabInv(){
  if(invView==='forja') return tabForja();
  const nc=chestTotal(), nm=(S.scrap>0?1:0)+(S.tokens>0?1:0)+(S.won>0?1:0)+Object.values(S.mats||{}).filter(n=>n>0).length+(S.evm>0?1:0)+(S.tickets>0?1:0)+(S.bossTickets>0?1:0)+(S.pvpTickets>0?1:0);
  // pantalla principal: solo las pestañas, sin nada abierto hasta que toques una
  const cur=invView==='main'?'armas':invView;
  const head=`<div class="utabs" role="tablist">
    <button data-act="invview" data-v="armas" class="${cur==='armas'?'on':''}">Armas <small>${G.invCount()}/${G.invMax()}</small></button>
    <button data-act="invview" data-v="cofres" class="${cur==='cofres'?'on':''}">Cofres <small>${nc}</small></button>
    <button data-act="invview" data-v="mat" class="${cur==='mat'?'on':''}">Materiales <small>${nm}</small></button>
</div>`;
  if(invView==='grim') return `<section class="panel">${tabGrim()}</section>`;
  if(invView==='cofres'){
    // Cofres en casillas como las armas (borde del color de su rareza); al tocar uno, su ficha tapa el héroe
    const owned=CHEST_TYPES.filter(k=>G.chestCount(k)>0); if(!owned.includes(chestSel)) chestSel=null;
    const tile=k=>`<button class="itile ctile${chestSel===k?' sel':''}" style="--rc:var(--r${CHEST_RAR[k]})" data-act="chestSel" data-k="${k}" aria-pressed="${chestSel===k}" aria-label="Cofre de ${CFG.chests[k].name.toLowerCase()}">${ICON[k]}<span class="tl">×${G.chestCount(k)}</span></button>`;
    const sheet=k=>{ const n=G.chestCount(k), r=CHEST_RAR[k]; return `<div class="isheet fixed" style="--rc:var(--r${r})">
      <div class="ishd"><div class="isart ctile">${ICON[k]}</div><div style="min-width:0;flex:1"><b class="isn">Cofre de ${CFG.chests[k].name.toLowerCase()}</b><span class="rar" style="color:var(--r${r})">${CFG.rarName[r].toUpperCase()}</span>
        <div class="s">Tienes ${n} · ${CFG.chests[k].from}</div></div>
        <button class="isx" data-act="chestSel" data-k="${k}" aria-label="Cerrar">✕</button></div>
      <div class="isacts"><button class="btn" data-act="info" data-k="${k}">Info</button><button class="btn gold" data-act="open1" data-k="${k}">Abrir 1</button><button class="btn" data-act="openAll" data-k="${k}" ${n>1?'':'disabled'}>Abrir todos</button></div></div>` };
    return `${head}<section class="panel">${chestSel?sheet(chestSel):''}${owned.length?`<div class="igrid">${owned.map(tile).join('')}</div>`:'<p class="hint">Vacío.</p>'}</section>`;
  }
  if(invView==='mat'){
    const t=[], add=(n,c,name,ic)=>{ if(n>0) t.push(`<div class="mtile" style="--mc:${c}" title="${name}"><span class="mi">${IC(ic||ICONS.mat,26)}</span><b>${fmt(n)}</b><span class="mn">${name}</span></div>`) };
    add(S.scrap,'var(--scrap)','Chatarra','<path d="M12 3l2.2 3.2 3.8-.6-.6 3.8L20.6 12l-3.2 2.2.6 3.8-3.8-.6L12 20.6l-2.2-3.2-3.8.6.6-3.8L3.4 12l3.2-2.2-.6-3.8 3.8.6z"/><circle cx="12" cy="12" r="3"/>');
    for(const [m,n] of Object.entries(S.mats||{})) add(n,'var(--rE)',CFG.modes[m].mat);
    add(S.evm,'var(--rL)',CFG.event.mat+'s','<path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7z"/>');
    add(S.tickets,'var(--rE)','Ticket Mazmorra','<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/>');
    add(S.bossTickets,'var(--bad)','Ticket Jefe','<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/>');
    add(S.pvpTickets,'var(--gold)','Ticket PvP','<path d="M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"/>');
    add(S.tokens,'var(--tok)','Tokens','<path d="M12 3l8 9-8 9-8-9z"/>');
    add(S.won,'var(--good)','Tokens ganados','<path d="M12 3l8 9-8 9-8-9z"/>');
    return `${head}<section class="panel">${t.length?`<div class="mgrid">${t.join('')}</div>`:'<p class="hint">Vacío.</p>'}</section>`;
  }
  // solo salen las opciones que tienes (rarezas, clases y stats de tus armas); si la elegida ya no existe, vuelve a "todas"
  const have=S.items.filter(x=>x.id!==S.equippedId), hasStat=k=>have.some(x=>x.sec.some(y=>y.k===k));
  if(F.rar!=='all'&&!have.some(x=>x.r===F.rar)) F.rar='all';
  if(F.stat!=='any'&&!hasStat(F.stat)) F.stat='any';
  const statOpts=Object.entries(CFG.sec).filter(([k])=>hasStat(k)).map(([k,s])=>`<option value="${k}" ${F.stat===k?'selected':''}>${s.n}</option>`).join('');
  return `${head}<section class="panel">
    <details class="fdet"${fdetOpen?' open':''}><summary>Filtros y desmontar</summary><div class="filters fpanel"><div class="ctrl" id="fHead">${fHead()}</div>
      <div class="frow"><select id="fRar" aria-label="Rareza">${['all',...R.filter(r=>have.some(x=>x.r===r))].map(r=>`<option value="${r}" ${F.rar===r?'selected':''}>${r==='all'?'Rareza':CFG.rarName[r]}</option>`).join('')}</select>
        <select id="fStat" aria-label="Stat"><option value="any">Cualquier stat</option>${statOpts}</select></div>
      <div class="frow"><input type="number" id="fMin" aria-label="Mínimo %" inputmode="decimal" placeholder="mín" value="${esc(F.min)}">
        <input type="number" id="fMax" aria-label="Máximo %" inputmode="decimal" placeholder="máx" value="${esc(F.max)}"></div>
      <div id="bulk"></div>
    </div></details>
    <div id="invList" class="ilist"></div></section>`;
}
// Grimorios: 2 por clase. Desbloquear con recursos o tokens; suben contigo; solo uno activo (cambiar cuesta tokens). Efecto desde el nivel 25 del grimorio.
// coste: si lo tienes, "124 ✓" en verde; si no, "tienes / pide" en rojo
const costRow=(n,have,v)=>{ const f=n==='Oro'?fmtG:fmt; return `<div><span>${n}</span><b style="color:var(--${have>=v?'good':'bad'})">${have>=v?f(v)+' ✓':f(Math.floor(have))+' / '+f(v)}</b></div>` };
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
// Inventario en cuadrícula: casilla con el color de rareza, nivel, ★ bloqueada y ▲ mejor que la equipada
// arma de cada clase (así se distinguen de un vistazo las de otras clases): espada, bastón, arco, daga y maza
const WSVG={Guerrero:'<path d="M27 33L51 6L59 5L58 13L31 38Z" fill="#b9c0cc"/><path d="M31 38L58 13L59 5L55 7L29 36Z" fill="#6f7785" opacity="0.55"/><path d="M52 10L33 32" fill="none" stroke="#eef2f8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 33L51 6L59 5L58 13L31 38Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M22 28L38 44" fill="none" stroke="#140f1c" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 28L38 44" fill="none" stroke="#e8b04a" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 39L15 51" fill="none" stroke="#140f1c" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M27 39L15 51" fill="none" stroke="#8a5a34" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="13" cy="53" r="5" fill="#e8b04a" stroke="#140f1c" stroke-width="2.5"/>',Mago:'<path d="M14 58L42 22" fill="none" stroke="#140f1c" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 58L42 22" fill="none" stroke="#8a5a34" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 60l4-4" fill="none" stroke="#140f1c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 60l4-4" fill="none" stroke="#e8b04a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M38 26l-5-5 7-7 6 6z" fill="#e8b04a"/><path d="M38 26l-5-5 7-7 6 6z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="49" cy="14" r="13" fill="#b066e8" opacity="0.25"/><circle cx="48" cy="15" r="8.5" fill="#9b6ad6" stroke="#140f1c" stroke-width="3"/><circle cx="46" cy="13" r="3" fill="#d6b8ff"/><path d="M48 15a8.5 8.5 0 0 0 8.5-1A8.5 8.5 0 0 1 48 23.5Z" fill="#5a3a86" opacity="0.6"/>',Arquero:'<path d="M14 7c27 3 43 20 43 44" fill="none" stroke="#140f1c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 7c27 3 43 20 43 44" fill="none" stroke="#8a5a34" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 7L57 51" fill="none" stroke="#e9dfc8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 55L43 21" fill="none" stroke="#140f1c" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 55L43 21" fill="none" stroke="#c9ced8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M49 15l-11 2 9 9z" fill="#b9c0cc"/><path d="M49 15l-11 2 9 9z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M9 55l2-10 6 4z" fill="#e2605a"/><path d="M9 55l2-10 6 4z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><path d="M9 55l10-2-4-6z" fill="#b8323a"/><path d="M9 55l10-2-4-6z" fill="none" stroke="#140f1c" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>',Asesino:'<path d="M53 7C50 19 42 28 31 34L27 30C33 19 42 11 53 7Z" fill="#b9c0cc"/><path d="M53 7C50 19 42 28 31 34L29 32C39 25 47 17 53 7Z" fill="#6f7785" opacity="0.6"/><path d="M50 11C44 18 39 23 33 29" fill="none" stroke="#eef2f8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M53 7C50 19 42 28 31 34L27 30C33 19 42 11 53 7Z" fill="none" stroke="#140f1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><path d="M21 28L35 42" fill="none" stroke="#140f1c" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 28L35 42" fill="none" stroke="#e8b04a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 38L14 50" fill="none" stroke="#140f1c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M26 38L14 50" fill="none" stroke="#3b2a5e" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="11" cy="53" r="4.5" fill="#b8323a" stroke="#140f1c" stroke-width="2.5"/>',Clerigo:'<path d="M12 58L34 34" fill="none" stroke="#140f1c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 58L34 34" fill="none" stroke="#8a5a34" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 60l5-5" fill="none" stroke="#140f1c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 60l5-5" fill="none" stroke="#e8b04a" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M42 6l4 7 7-3-2 8 8 2-6 5 6 5-8 2 2 8-7-3-4 7-4-7-7 3 2-8-8-2 6-5-6-5 8-2-2-8 7 3z" fill="#9aa1ad"/><path d="M42 6l4 7 7-3-2 8 8 2-6 5 6 5-8 2 2 8-7-3-4 7-4-7-7 3 2-8-8-2 6-5-6-5 8-2-2-8 7 3z" fill="none" stroke="#140f1c" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="42" cy="22" r="9" fill="#c9ced8" stroke="#140f1c" stroke-width="2.5"/><circle cx="42" cy="22" r="4" fill="#e8b04a" stroke="#140f1c" stroke-width="2"/><circle cx="39" cy="19" r="2" fill="#ffffff" opacity="0.8"/>'};
const wIcon=(it,sz=38)=>`<svg viewBox="0 0 64 64" width="${sz}" height="${sz}" aria-hidden="true">${WSVG[it&&it.cls]||WSVG.Guerrero}</svg>`;
const RLET={C:'C',U:'PC',R:'R',E:'É',L:'L',M:'M'};   // inicial de la rareza (para no depender solo del color)
function itemTile(it){ const eq=it.id===S.equippedId, own=it.cls===S.cls, up=own&&!eq&&betterThanEquipped(it), sel=expandedId===it.id;
  return `<button class="itile${sel?' sel':''}${own?'':' other'}" style="--rc:var(--r${it.r})" data-act="expand" data-id="${it.id}" aria-pressed="${sel}" aria-label="${wName(it)} ${CFG.rarName[it.r]} nivel ${it.lvl}${own?'':' (otra clase)'}">
    ${wIcon(it)}<span class="tl"><b>${RLET[it.r]||''}</b>Nv ${it.lvl}</span>${it.fav?'<span class="tf">★</span>':''}${up?'<span class="tu">▲</span>':''}<span class="td">+${Math.round(G.weaponMain(it).d*100)}%</span></button>` }
function itemSheet(it){ const m=G.weaponMain(it), own=it.cls===S.cls;
  return `<div class="isheet fixed" style="--rc:var(--r${it.r})">
    <div class="ishd"><div class="isart">${wIcon(it)}</div><div style="min-width:0;flex:1"><b class="isn">${wName(it)}</b> <span class="rar" style="color:var(--r${it.r})">${CFG.rarName[it.r].toUpperCase()}</span>
      <div class="s">Nv ${it.lvl} · Daño +${pct(m.d)} · Velocidad +${pct(m.s)}</div></div>
      <button class="star${it.fav?' on':''}" data-act="fav" data-id="${it.id}" aria-label="${it.fav?'Quitar bloqueo':'Bloquear'}">★</button>
      <button class="isx" data-act="expand" data-id="${it.id}" aria-label="Cerrar">✕</button></div>
    ${legendLine(it)}<div class="sec">${chips(it.sec,false,it.r)}</div>
    <div class="isacts"><button class="btn" data-act="dis1" data-id="${it.id}" ${it.fav?'disabled':''}>Desmontar</button>
      <button class="btn" data-act="forge" data-id="${it.id}">Forjar</button>
      <button class="btn gold" data-act="equip" data-id="${it.id}" ${own?'':'disabled'}>Equipar</button></div></div>` }
function renderList(){
  const el=$('#invList'); if(!el) return; setHTML($('#fHead'),fHead());
  const list=filtered(), dis=list.filter(x=>x.id!==S.equippedId&&!x.fav);
  const bulk=$('#bulk'); if(bulk) bulk.innerHTML=`<div class="ctrl"><span class="s">${list.length} de ${G.invCount()} armas</span><button class="btn sm" data-act="disAsk" ${dis.length?'':'disabled'}>Desmontar las filtradas (${dis.length})</button></div>`;
  const sel=list.find(x=>x.id===expandedId);
  const shown=list.slice(0,80), room=Math.max(0,Math.min(G.invMax()-G.invCount(),(4-shown.length%4)%4+4));
  el.classList.toggle('has-sheet',!!sel);
  el.innerHTML=nbsp(`${sel?itemSheet(sel):''}${list.length?`<div class="igrid">${shown.map(itemTile).join('')}${'<span class="itile empty"></span>'.repeat(F.rar==='all'&&F.stat==='any'?room:0)}</div>`:(G.invCount()?'<p class="hint">Sin resultados.</p>':'<p class="hint">Vacío.</p>')}
    ${list.length>80?`<p class="hint">+${list.length-80} más</p>`:''}`);
  fitSheet(); updateHUD();
}
// la ficha del arma tapa justo el recuadro del héroe (si se ve); si se ha bajado la página, queda arriba del todo
function fitSheet(){ const sh=document.querySelector('.isheet.fixed'), bn=document.querySelector('.ibanner'); if(!sh||!bn) return;
  const r=bn.getBoundingClientRect(), top=document.querySelector('.top').getBoundingClientRect().bottom+6;
  Object.assign(sh.style,{left:r.left+'px',right:'auto',width:r.width+'px',maxWidth:'none',top:Math.max(top,r.top)+'px',minHeight:r.height+'px'}) }
window.addEventListener('resize',fitSheet);
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
const priceTxt=(k,n=1)=>k==='silver'?`${fmtG(G.silverCost(n))} oro`:`${fmt(G.shopPrice(k)*n)} tokens`;
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
// Tienda en rejilla (como en los RPG de móvil): cada producto con su dibujo grande sobre un brillo de su color, nombre y botón de precio con la moneda
const SHOPTONE={silver:'#b9c0cc',mode:'#9b6ad6',ticket:'#e8964a',bossTicket:'#d9534f',pvp:'#4f8fd9',ess:'#a46be0',ev:'#e8b04a'};
const priceHTML=(k,n=1)=>k==='silver'?`${ICON.gold}${fmtG(G.silverCost(n))}`:`${ICON.tok}${fmt(G.shopPrice(k)*n)}`;
function shopCard(k){ const it=SHOP[k];
  return `<div class="scard" style="--tone:${SHOPTONE[k]||'var(--gold)'}"><button class="ibtn" data-act="${it.info?'info':'shopInfo'}" data-k="${k}" aria-label="Info de ${it.name}">i</button>
    <button class="sc-ic" data-act="${it.info?'info':'shopInfo'}" data-k="${k}" aria-label="Qué es ${it.name}">${ICON[k]||''}</button><div class="sc-n">${it.name}</div><div class="sc-s">${k==='silver'?silverNote():'&nbsp;'}</div>
    ${k==='silver'||tokOpen()?`<button class="btn gold sc-buy" data-act="buyAsk" data-k="${k}">${priceHTML(k)}</button>`:soon}</div>` }
function tabShop(){
  const today=G.dayKey();
  const head=`<div class="fchips" role="tablist">${[['cofres','Cofres'],['tokens','Tokens'],['subs','Suscripciones']].map(([v,l])=>`<button data-act="shopview" data-v="${v}" aria-pressed="${shopView===v}">${l}</button>`).join('')}</div>`;
  let body='';
  if(shopView==='cofres') body=offerRows()+`<div class="sgrid">${['silver','mode','ticket','bossTicket','ess','ev'].map(shopCard).join('')}</div>`;
  const crypto=window.TonPay&&TonPay.on(CFG); if(!crypto) payCoin='stars';
  if(shopView==='tokens') body=`<div class="loot"><div><span>Tus tokens</span><b>${fmt(G.tokens())}</b></div></div>
    ${crypto?`<div class="ctrl" style="justify-content:space-between"><span class="s">Pagar con</span><div class="fchips">${[['stars','⭐ Stars'],['TON','TON'],['USDT','USDT']].map(([v,l])=>`<button data-act="payCoin" data-v="${v}" aria-pressed="${payCoin===v}">${l}</button>`).join('')}</div></div>`:''}
    ${payCoin==='stars'?firstOfferRow():''}
    <div class="sgrid">${CFG.tokens.packs.map((n,i)=>{ const bn=(CFG.tokens.bonus||{})[n]||0; return `<div class="scard${bn?' deal':''}" style="--tone:var(--tok)">${bn?`<span class="sc-tag">+${Math.round(bn/n*100)} %</span>`:''}
      <div class="sc-ic sc-stack">${ICON.tok.repeat(Math.min(3,i+1))}</div><div class="sc-n">${fmt(n+bn)} tokens</div><div class="sc-s">${bn?`${fmt(n)} + ${fmt(bn)} de regalo`:'&nbsp;'}</div>
      ${payCoin==='stars'?payBtn('t'+n,n*CFG.stars.perToken,`data-act="tokBuy" data-k="${n}"`).replace('btn sm gold','btn gold sc-buy'):`<button class="btn gold sc-buy" data-act="cryptoBuy" data-k="t${n}">${usd(n)} en ${payCoin}</button>`}</div>` }).join('')}</div>
    ${CFG.devTools?`<div class="ctrl"><button class="btn sm" data-act="wdAsk" ${S.won>=CFG.tokens.withdraw.min?'':'disabled'}>Retirar ganados (prueba)</button></div>`:''}
    <p class="hint">${payCoin==='stars'?'Se pagan con Telegram Stars ⭐.':`Se paga con tu cartera (Telegram Wallet, Tonkeeper…) en la red TON. El precio en ${payCoin==='TON'?'TON se fija al cambio del momento':'USDT es en dólares'}. Llega en 1-2 min.`}</p>
    ${crypto?'<div class="ctrl"><button class="btn sm" data-act="cryptoCheck">¿Pagaste y no llegó? Comprobar</button></div>':''}`;
  if(shopView==='subs') body=`
    <div class="chest"><div><div class="cn">Tarjeta mensual</div><div class="s">+${Math.round(CFG.cardGold*100)} % oro · 30 días${G.hasCard()?' · quedan '+(S.cardUntil-today)+' días':''}</div></div><div class="acts">${tokOpen()?`<button class="btn sm gold" data-act="sub" data-k="card">${fmt(CFG.cardPrice)} tokens</button>`:soon}</div></div>
    <div class="chest"><div><div class="cn">VIP</div><div class="s">Combate ×${CFG.vipSpeed} · sin conexión hasta ${CFG.offlineVipH} h · 30 días${G.hasVip()?' · quedan '+(S.vipUntil-today)+' días':''}</div></div><div class="acts">${tokOpen()?`<button class="btn sm gold" data-act="sub" data-k="vip">${fmt(CFG.vipPrice)} tokens</button>`:soon}</div></div>`;
  return `<section class="panel">${head}${body}</section>`;
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
    <div class="loot"><div><span>Total</span><b id="buyTotal">${priceTxt(k,n)}</b></div><div><span>Tienes</span><b>${k==='silver'?fmtG(S.gold)+' oro':fmt(G.tokens())+' tokens'}</b></div>${k==='silver'&&Number.isFinite(G.silverLeft())?`<div><span>Quedan hoy</span><b>${G.silverLeft()}</b></div>`:''}</div>
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
const NODE={fight:['⚔️','Combate','Enemigos normales · +'+CFG.tower.souls.fight+' almas'],elite:['💀','Élite','Con rasgos · eliges 1 de 3 (hasta Épica)'],treasure:['🎁','Cofre','Sin luchar · 1 grimorio al azar'],rest:['🔥','Hoguera','Antes del jefe: te curas del todo'],boss:['👑','Jefe','Eliges 1 de 3 grimorios legendarios'],shop:['🛒','Tienda','Cartas y grimorios por almas'],event:['❓','?','Evento, combate, tienda o cofre'],altar:['🕯️','Altar maldito','1 grimorio legendario y 1 maldición']};
// mapa de la Torre (estilo Slay the Spire): abajo el piso de donde vienes (✓), encima el actual (los caminos que puedes
// tomar brillan y llevan su nombre) y arriba los 3 siguientes. Cada tipo de casilla tiene su color.
const NCOL={shop:'#2fb37a',fight:'#c8735a',elite:'#a86be0',treasure:'#e8b04a',rest:'#f08a3c',event:'#4f95e6',altar:'#c0392b',boss:'#e5484d'};
function towerMapSvg(run){ const map=G.towerMap(), trail=(run.trail||[]).filter(t=>t.f<run.floor).sort((a,b)=>a.f-b.f), E=CFG.tower.boss.every, FK=CFG.tower.route.fork||1;
  // filas de abajo arriba: el camino ya recorrido, el piso actual y los siguientes
  const rows=trail.map(t=>({f:t.f,n:t.row.n,c:t.row.c,pick:t.i,past:true})).concat(map.map((m,k)=>({f:run.floor+k,n:m.n,c:m.c,now:k===0})));
  const boss=rows.some(r=>r.n[0]==='boss'), W=340, rowH=92, H=rows.length*rowH+40+(boss?40:0);
  const jit=(f,c,k)=>{ const x=Math.sin(f*91.7+c*13.3+k)*43758.5; return (x-Math.floor(x))*2-1 };   // pequeño desorden fijo: aire de mapa dibujado
  const rowY=r=>H-52-r*rowH, X=(c,f)=>[70,170,270][c]+jit(f,c,1)*10, Y=(r,f,c)=>rowY(r)+jit(f,c,2)*6;
  const P=(r,i)=>{ const R=rows[r]; return [X(R.c[i],R.f),Y(r,R.f,R.c[i])] };
  const curve=(a,b)=>{ const [x1,y1]=a,[x2,y2]=b,my=(y1+y2)/2; return `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}` };
  const nowR=rows.findIndex(r=>r.now), cur=rows[nowR], okI=cur?cur.n.map((_,i)=>G.towerCanGo(i)):[];
  let s=`<defs><pattern id="tmBrick" width="40" height="22" patternUnits="userSpaceOnUse"><path d="M0 11H40M20 0V11M0 11V22M40 11V22" stroke="rgba(255,255,255,.035)" stroke-width="1.2"/></pattern>
    <radialGradient id="tmBg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2a2340"/><stop offset=".6" stop-color="#171427"/><stop offset="1" stop-color="#0b0a14"/></radialGradient>
    <radialGradient id="tmFog" cx="50%" cy="0%" r="70%"><stop offset="0" stop-color="rgba(229,72,77,.28)"/><stop offset="1" stop-color="rgba(229,72,77,0)"/></radialGradient>
    <radialGradient id="tmDisk" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#3a3550"/><stop offset="1" stop-color="#14121f"/></radialGradient>
    <filter id="tmGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="tmSoft"><feGaussianBlur stdDeviation="10"/></filter></defs>
    <rect width="${W}" height="${H}" fill="url(#tmBg)"/><rect width="${W}" height="${H}" fill="url(#tmBrick)"/>${boss?`<rect width="${W}" height="${H*.5}" fill="url(#tmFog)"/>`:''}
    <rect width="16" height="${H}" fill="#0e0c18" opacity=".8"/><rect x="${W-16}" width="16" height="${H}" fill="#0e0c18" opacity=".8"/>`;
  for(let i=0;i<24;i++){ const x=20+Math.abs(jit(i,3,5))*300, y=Math.abs(jit(i,7,9))*H; s+=`<circle class="tme" style="animation-delay:-${(Math.abs(jit(i,4,4))*6).toFixed(1)}s" cx="${x}" cy="${y}" r="${(.8+Math.abs(jit(i,1,4))*1.6).toFixed(1)}" fill="${i%3?'#e8b04a':'#ff7a45'}"/>` }   // ascuas
  // franja de cruce (entre un piso de cruce y el siguiente) y placa con el número de piso
  rows.forEach((R,r)=>{ const y=rowY(r), N=rows[r+1];
    if(N&&R.n.length===3&&N.n.length===3&&(R.f%E)%FK===0) s+=`<rect x="18" y="${y-rowH/2-20}" width="${W-36}" height="40" rx="10" fill="rgba(232,176,74,.05)" stroke="rgba(232,176,74,.2)" stroke-dasharray="3 5"/><text x="${W-26}" y="${y-rowH/2+4}" text-anchor="end" class="tmx">⤧ CRUCE</text>`;
    s+=`<rect x="2" y="${y-11}" width="26" height="22" rx="6" fill="${R.now?'#e8b04a':'#22203a'}" stroke="${R.now?'#ffd98a':'#3a3656'}"/><text x="15" y="${y+4}" text-anchor="middle" class="tmf${R.now?' cur':''}">${R.f}</text>` });
  // caminos curvos: recorrido (dorado), los que puedes tomar ahora (dorados y animados) y los de delante (punteados)
  for(let r=0;r<rows.length-1;r++){ const A=rows[r], Bn=rows[r+1];
    for(const [a,b] of G.towerLinks(A,Bn,A.f)){ const d=curve(P(r,a),P(r+1,b));
      if(A.past&&Bn.past){ if(a===A.pick&&b===Bn.pick) s+=`<path d="${d}" stroke="#e8b04a" stroke-width="10" opacity=".18" fill="none" filter="url(#tmSoft)"/><path d="${d}" class="tml path"/>`; continue }
      if(A.past){ if(a===A.pick&&okI[b]) s+=`<path d="${d}" class="tml on" filter="url(#tmGlow)"/>`; continue }
      s+=`<path d="${d}" class="tml${A.now&&!okI[a]?' off':''}"/>`; } }
  // casillas: medallón con anillo del color del tipo (el icono va aparte: se puede cambiar sin tocar el marco)
  let nodes='';
  rows.forEach((R,r)=>R.n.forEach((k,i)=>{ const [x,y]=P(r,i), col=NCOL[k]||'#888', N=NODE[k]||['?',k], B=k==='boss', ok=!!(R.now&&okI[i]), done=R.past&&i===R.pick;
    const rr=B?38:ok?27:23, cls=R.past?(done?' done':' gone'):R.now?(ok?' ok':' no'):' fu';
    let g=`<g class="tmn${cls}"${ok?` data-act="towerGo" data-k="${i}" role="button" aria-label="${N[1]}"`:''}>`;
    if(B) g+=`<circle cx="${x}" cy="${y}" r="66" fill="#e5484d" opacity=".25" filter="url(#tmSoft)"/>`+[-1,1].map(d=>`<path d="M${x+d*30} ${y-24}Q${x+d*62} ${y-30} ${x+d*58} ${y-66}Q${x+d*48} ${y-40} ${x+d*20} ${y-34}Z" fill="#5a1418" stroke="#e5484d" stroke-width="2" stroke-linejoin="round"/>`).join('');
    if(ok) g+=`<circle cx="${x}" cy="${y}" r="${rr+16}" fill="transparent"/><circle cx="${x}" cy="${y}" r="${rr+11}" fill="${col}" opacity=".25" filter="url(#tmSoft)"/><circle class="tmr" cx="${x}" cy="${y}" r="${rr+7}"/>`;
    g+=`<circle cx="${x}" cy="${y+3}" r="${rr+3}" fill="#000" opacity=".5"/><circle cx="${x}" cy="${y}" r="${rr+3}" fill="${done?'#7a5a1c':col}"/>`
      +`<circle cx="${x}" cy="${y}" r="${rr+3}" fill="none" stroke="${ok?'#ffe2a0':'rgba(255,255,255,.25)'}" stroke-width="${ok?2.5:1}"/>`
      +`<circle cx="${x}" cy="${y}" r="${rr-3}" fill="url(#tmDisk)" stroke="rgba(0,0,0,.6)" stroke-width="2"/><ellipse cx="${x-rr*.25}" cy="${y-rr*.45}" rx="${rr*.45}" ry="${rr*.18}" fill="#fff" opacity=".08"/>`
      +(done?`<text x="${x}" y="${y+8}" text-anchor="middle" class="tmc">✓</text>`:`<text x="${x}" y="${y+(B?10:7)}" text-anchor="middle" class="tmi" style="font-size:${B?30:ok?21:18}px">${N[0]}</text>`);
    if(ok||(B&&!R.past)){ const lbl=B?`JEFE · PISO ${R.f}`:N[1].toUpperCase(), w=lbl.length*7+16, ly=B?y-rr-48:y+rr+8;
      g+=`<rect x="${x-w/2}" y="${ly}" width="${w}" height="18" rx="9" fill="#120f1d" stroke="${B?'#e5484d':'#e8b04a'}" stroke-width="1.5"/><text x="${x}" y="${ly+13}" text-anchor="middle" class="tmk${B?' b':''}">${lbl}</text>` }
    nodes+=g+'</g>' }));
  // franja del tramo: 9 pisos y el jefe al final
  const m=(run.floor-1)%E, strip=`<div class="ttramo"><span>TRAMO ${Math.floor((run.floor-1)/E)+1}</span>${Array.from({length:E-1},(_,i)=>`<i class="${i<m?'d':i===m?'c':''}"></i>`).join('')}<b class="${m===E-1?'c':''}">👑</b></div>`;
  const leg=['fight','elite','event','rest','shop','treasure'].map(k=>`<span><i style="border-color:${NCOL[k]};background:${NCOL[k]}33">${NODE[k][0]}</i>${NODE[k][1]==='?'?'Evento':NODE[k][1]}</span>`).join('');
  return `${strip}<div class="tmapbox"><svg class="tmapsvg" viewBox="0 0 ${W} ${H}" width="100%" data-now="${nowR}">${s}${nodes}</svg></div><p class="hint" style="text-align:center;margin:6px 0 0">Toca un camino brillante${trail.length?' · desliza para ver tu ruta':''}</p><div class="tleg">${leg}</div>` }
const MECH={invocador:'Invocador',enfurecido:'Enfurecido',fases:'Escudo de fases',final:'Jefe final'};
// eventos ?: título, texto y botones [c, etiqueta, ¿se puede?]
function towerEvView(run){ const id=run.ev.id, E=CFG.tower.events, hp=run.hp==null?1:run.hp, so=run.souls||0, cu=(run.curses||[]).length;
  const V={fuente:['Fuente de sangre',`Pierdes el ${E.fuente.hp*100} % de vida y eliges 1 de 3 épicas (cartas o grimorios).`,[['si','Beber',hp>E.fuente.hp]]],
    mercader:['Mercader errante',`Elige 1 de 3 raras (cartas o grimorios) por ${E.mercader.cost} almas.`,[['si',`Comprar · ${E.mercader.cost} almas`,so>=E.mercader.cost]]],
    trampa:['Cofre sospechoso',`${Math.round(E.trampa.good*100)} %: eliges 1 de 3. Si no, pierdes el ${E.trampa.hp*100} % de vida.`,[['si','Abrir',true]]],
    santuario:['Santuario',`Por ${E.santuario.cost} almas: te curas el ${E.santuario.heal*100} % o quitas una maldición.`,[['si',`Curar · ${E.santuario.cost}`,so>=E.santuario.cost],['quitar',`Quitar maldición · ${E.santuario.cost}`,so>=E.santuario.cost&&cu>0]]],
    altar:['Altar maldito','Recibes un grimorio legendario al azar y una maldición al azar.',[['si','Aceptar',true]]]}[id];
  return `<div class="misTop"><b>${V[0]}</b><p class="hint">${V[1]}</p><div class="ctrl">${V[2].map(([c,t,ok])=>`<button class="btn gold" data-act="towerEv" data-k="${c}" ${ok?'':'disabled'}>${t}</button>`).join('')}<button class="btn" data-act="towerEv" data-k="no">Irse</button></div></div>` }
const RARC={C:'var(--rC)',R:'var(--rR)',E:'var(--rE)',L:'var(--rL)'}, FAMI={f:'🗡️',e:'🛡️',s:'🩸'};
// cuántas copias tienes ya (las cartas de estadística y efecto se acumulan)
const boonHave=b=>{ const run=G.towerState().run; return run?run.boons.filter(x=>x.t===b.t&&x.id===b.id).length:0 };
const haveTag=b=>{ const n=boonHave(b); return n?` <span class="pill" style="color:var(--good)">Tienes ${n} → ${n+1}</span>`:'' };
const boonHead=(b,f,c)=>`<div class="ctrl" style="justify-content:space-between"><b style="color:${c}">${FAMI[f.fam]||''} ${f.name}</b><span class="pill" style="color:${c}">${f.kind}</span></div>`;
function boonCard(b,i){ const f=G.boonInfo(b), c=RARC[f.r]; return `<button class="mcard bcard" data-act="towerPick" data-k="${i}" style="border-color:${c}">${boonHead(b,f,c)}<span class="s">${esc(f.desc)}${haveTag(b)}</span></button>` }
let towerTab='run', TWR=null, twrBusy=false;   // pestaña de la Torre (partida o ranking) y el ranking descargado
function towerRankLoad(){ if(twrBusy||!(typeof Telemetry!=='undefined'&&Telemetry.canSync(CFG))) return; twrBusy=true;
  Telemetry.pvp(CFG,'towerTop').then(j=>{ twrBusy=false; if(j&&j.ok){ TWR={...j,at:Date.now()}; if(tab==='ev'&&towerTab==='rank') renderTab(); } }) }
function towerRankView(){ const T=G.towerState(), on=typeof Telemetry!=='undefined'&&Telemetry.canSync(CFG);
  if(on&&(!TWR||Date.now()-TWR.at>60000)) towerRankLoad();
  const list=(rows,val,mine,rank)=>`<div class="rank twrank">${rows.map((x,i)=>`<div${x.me?' class="me"':''}><b>${i+1}</b><span>${esc(x.name)}</span><b>${val(x)}</b></div>`).join('')||'<div><span></span><span>Aún nadie</span><b></b></div>'}${rank>10?`<div class="gap">…</div><div class="me"><b>${rank}</b><span>${esc(S.name||'Tú')}</span><b>${mine}</b></div>`:''}</div>`;
  const me=TWR?TWR.me:{floor:T.reach||0,dmg:T.bossDmg||0};
  const cols=TWR?`<div class="twcols"><div><h4>Piso más alto</h4>${list(TWR.floors,x=>x.floor,me.floor,me.rankF)}</div><div><h4>Daño al jefe final</h4>${list(TWR.dmg,x=>fmt(x.dmg),fmt(me.dmg),me.rankD)}</div></div>`
    :`<p class="hint">${on?'Cargando…':'Ranking solo en Telegram.'}</p>`;
  return `<p class="hint">Los 10 mejores. El jefe del piso ${CFG.tower.maxFloor} tiene vida infinita: gana quien más daño le hace.</p>${cols}
    <div class="evhead"><div><span class="s">Tu piso más alto</span><b>${T.reach||0}</b></div><div><span class="s">Tu daño al jefe final</span><b>${fmt(T.bossDmg||0)}</b></div></div>` }
function tabTower(){ const T=G.towerState(), run=T.run;
  if(run) towerTab='run';   // dentro de una partida no se ve el ranking ni los récords
  let body='';
  if(towerTab==='rank') body=towerRankView();
  else if(!run) body=`<p class="hint">Roguelike: todos empiezan con el mismo héroe, tu personaje no cuenta. 1 vida. Las cartas te hacen más fuerte; los grimorios deciden tu build. En el piso ${CFG.tower.maxFloor} espera un jefe con vida infinita.</p>
      <div class="evhead"><div><span class="s">Tu piso más alto</span><b>${T.reach||0}</b></div><div><span class="s">Tu daño al jefe final</span><b>${fmt(T.bossDmg||0)}</b></div></div>
      <button class="btn gold" data-act="towerStart">Empezar partida</button>`;
  else if(run.lives<=0) body=`<p class="hint">Has caído en el piso ${run.floor}.${run.finalDmg?` Daño al jefe final: <b>${fmt(run.finalDmg)}</b>.`:''}</p><div class="ctrl">${run.adRev?'':'<button class="btn gold" data-act="towerRev">Revivir · anuncio</button>'}<button class="btn" data-act="towerQuit">Terminar partida</button></div>`;
  else if(run.ev) body=towerEvView(run);
  else if(run.shop) body=towerShopView(run);
  else if(run.pick) body=`<p class="hint">Elige 1:</p><div class="mlist">${run.pick.map(boonCard).join('')||'<p class="hint">No queda nada nuevo.</p>'}</div>${run.pick.length?'':'<button class="btn gold" data-act="towerPick" data-k="0">Seguir</button>'}`;
  else body=towerMapSvg(run);
  const nfx=run?run.boons.length+(run.curses||[]).length:0;
  const tabs=`<div class="fchips twtabs"><button data-act="towerTab" data-k="run" aria-pressed="${towerTab==='run'}">Partida</button><button data-act="towerTab" data-k="rank" aria-pressed="${towerTab==='rank'}">Ranking</button></div>`;
  return `<section class="panel"><div class="ctrl" style="justify-content:space-between"><h3>Torre</h3>${run?`<button class="btn sm" data-act="towerFx">Efectos${nfx?` · ${nfx}`:''}</button>`:''}</div>${run?'':tabs}
    ${run?`<div class="evhead"><div><span class="s">Piso</span><b>${run.floor}</b></div><div><span class="s">Almas</span><b>${run.souls||0}</b></div><div><span class="s">Salud</span><b>${Math.round((run.hp==null?1:run.hp)*100)} %</b></div></div>`:''}
    ${body}</section>` }
// tienda: 4 cartas y 2 grimorios (compras los que puedas pagar con almas) y quitar 1 cosa que tengas
function towerShopView(run){ const sh=run.shop, so=run.souls||0, rc=G.towerRemoveCost();
  const item=(b,i)=>{ const f=G.boonInfo(b), c=RARC[f.r], got=sh.bought.includes(i), pr=G.towerPrice(b);
    return `<div class="mcard bcard" style="border-color:${c}${got?';opacity:.45':''}">${boonHead(b,f,c)}<span class="s">${esc(f.desc)}${got?'':haveTag(b)}</span>
      <div class="ctrl" style="justify-content:flex-end">${got?'<span class="pill" style="color:var(--good)">Comprado</span>':`<button class="btn sm gold" data-act="towerBuy" data-k="${i}" ${so>=pr?'':'disabled'}>${pr} almas</button>`}</div></div>` };
  const idx=sh.items.map((b,i)=>[b,i]);
  return `<p class="hint">Tienda · tienes <b>${so}</b> almas</p><h4>Cartas</h4><div class="mlist">${idx.filter(([b])=>b.t==='c').map(([b,i])=>item(b,i)).join('')||'<p class="hint">No quedan cartas.</p>'}</div>
    <h4>Grimorios</h4><div class="mlist">${idx.filter(([b])=>b.t==='g').map(([b,i])=>item(b,i)).join('')||'<p class="hint">No quedan grimorios.</p>'}</div>
    <div class="ctrl"><button class="btn" data-act="towerRemove" ${sh.removed||!run.boons.length||so<rc?'disabled':''}>${sh.removed?'Ya has quitado 1':`Quitar 1 cosa · ${rc} almas`}</button><button class="btn" data-act="towerShopLeave">Salir de la tienda</button></div>` }
// tienda: elegir qué quitar (cartas y grimorios; las maldiciones no)
function towerRemoveModal(){ const run=G.towerState().run; if(!run||!run.shop) return;
  showModal(`<h3>Quitar 1 cosa · ${G.towerRemoveCost()} almas</h3><p class="hint">Las maldiciones no se pueden quitar.</p><div class="mlist">${run.boons.map((b,i)=>{ const f=G.boonInfo(b), c=RARC[f.r];
    return `<button class="mcard bcard" data-act="towerRemoveYes" data-k="${i}" style="border-color:${c}">${boonHead(b,f,c)}<span class="s">${esc(f.desc)}</span></button>` }).join('')}</div><button class="btn" data-act="close">Cancelar</button>`) }
// Efectos de la partida (ocultos en la pantalla): grimorios y cartas por calidad (Legendaria → Común) y las maldiciones al final
function towerFxModal(){ const T=G.towerState(), run=T.run; if(!run) return; const ord={L:0,E:1,R:2,C:3};
  const group=t=>Object.values(run.boons.filter(b=>b.t===t).reduce((o,b)=>{ const f=G.boonInfo(b), k=b.id; (o[k]=o[k]||{b,f,n:0}).n++; return o },{})).sort((a,b)=>ord[a.f.r]-ord[b.f.r]||a.f.name.localeCompare(b.f.name));
  const box=L=>L.map(({f,n})=>`<div style="border-color:${RARC[f.r]}"><b style="color:${RARC[f.r]}">${FAMI[f.fam]||''} ${f.name}${n>1?' ×'+n:''}</b><span class="s">${f.kind} · ${esc(f.desc)}</span></div>`).join('');
  const g=group('g'), c=group('c'), nxt=(()=>{ for(let f=T.best+1;;f++) for(const r of CFG.tower.rewards) if(f%r.every===0) return {f,b:r.b} })();
  showModal(`<h3>Efectos</h3>${g.length?`<h4>Grimorios</h4><div class="tfx">${box(g)}</div>`:''}${c.length?`<h4>Cartas</h4><div class="tfx">${box(c)}</div>`:''}${!g.length&&!c.length?'<p class="hint">Aún no tienes cartas ni grimorios.</p>':''}
    ${(run.curses||[]).length?`<h4>Maldiciones</h4><div class="tfx">${run.curses.map(c=>`<div style="border-color:var(--bad)"><b style="color:var(--bad)">☠ ${CFG.tower.curses[c].name}</b><span class="s">Maldición · ${CFG.tower.curses[c].desc}</span></div>`).join('')}</div>`:''}
    <p class="hint">🗡️ Fuerza y Crítico · 🛡️ Escudo y Espinas · 🩸 Sangre. Siguiente premio de récord: piso ${nxt.f} · ${bundleHTML(nxt.b)}</p>
    <div class="ctrl"><button class="btn gold" data-act="close">Cerrar</button>${!G.inEvent()&&run.lives>0?'<button class="btn" data-act="towerQuit">Abandonar partida</button>':''}</div>`) }
/* ---------- PvP: contra el fantasma de otro jugador (su partida al 100 %) · Elo ---------- */
// Dentro de Telegram el servidor elige el rival (jugadores reales con puntos parecidos; si no hay, bot) y guarda los puntos.
// Fuera de Telegram: bots (tu partida con otra clase) y puntos solo en el móvil.
const pvpOnline=()=>!!(window.Telemetry&&Telemetry.canSync&&Telemetry.canSync(CFG));
let PVI=null, pvpBusy=false;
function pvpLoad(){ if(!pvpOnline()) return; Telemetry.pvp(CFG,'pvpInfo').then(j=>{ if(!j||!j.ok) return; PVI=j; G.pvpSync(j.me); if(tab==='ev'&&modView==='pvp') renderTab(); }) }
const clName=c=>CFG.classes[c]?clsLabel(c):(c||'');   // nombre de la clase (con tilde); '' si el servidor no la sabe
// icono de división: escudo del color de la liga con una marca distinta por división (Bronce, Plata, Oro, Diamante, Leyenda)
const DIVMARK=['','<path d="M8 11l4 3 4-3" stroke="#0008" stroke-width="2" fill="none"/>','<path d="M12 6.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#0007"/>','<path d="M12 6l4 4-4 6-4-6z" fill="#fff9" stroke="#0006"/>','<path d="M6.5 14l1-6 2.8 3L12 6.5 13.7 11l2.8-3 1 6z" fill="#0007"/>'];
function divIcon(pts,sz){ const L=G.pvpLeague(pts), i=Math.max(0,CFG.pvp.leagues.findIndex(x=>x[1]===L.name));
  return `<svg class="divic" viewBox="0 0 24 24" width="${sz||22}" height="${sz||22}" aria-label="${L.name}"><title>${L.name}</title><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="${L.color}" stroke="#0008" stroke-width="1"/>${DIVMARK[i]||''}</svg>` }
function tabPvp(){ const P=G.pvpState(), on=pvpOnline(), L=G.pvpLeague(P.rating);
  const head=`<div class="evhead pvphead"><div>${divIcon(P.rating,30)}<span class="s" style="color:${L.color}">${L.name}</span></div><div><span class="s">Puntos</span><b>${fmt(P.rating)}</b></div><div><span class="s">V / D</span><b>${P.wins}/${P.games-P.wins}</b></div><div><span class="s">Tickets</span><b>${S.pvpTickets||0}</b><span class="s">${G.pvpFreeLeft()}/${CFG.pvp.free} gratis</span></div></div>`;
  const busy=G.inEvent()||pvpBusy, can=G.pvpCanFight();
  const riv=`<div class="ctrl"><button class="btn gold" style="flex:2" data-act="pvpGo" ${busy||!can?'disabled':''}>${pvpBusy?'Buscando rival…':G.pvpFreeLeft()?'Luchar (gratis)':can?'Luchar (1 ticket)':'Sin combates hoy'}</button>
    ${tokOpen()?`<button class="btn" style="flex:1" data-act="buyAsk" data-k="pvp">+${CFG.pvp.pack} 🎟 · ${CFG.pvp.packCost} tok</button>`:''}</div>`;
  const row=(pos,x)=>`<div class="${x.me?'me':''}"><span>${divIcon(x.rating,20)}</span><span>${pos}. ${esc(x.name)}</span><b>${fmt(x.rating)}</b></div>`;
  const top=on?(PVI?`<div class="rank pvprank"><div class="rh"><span>Rango</span><span>Nombre</span><b>Puntos</b></div>${PVI.top.map((x,i)=>row(i+1,x)).join('')||'<div><span></span><span>Aún nadie</span><b></b></div>'}${PVI.top.length&&!PVI.top.some(x=>x.me)&&PVI.me.rank?'<div class="gap">…</div>'+row(PVI.me.rank,{name:S.name||'Tú',rating:P.rating,me:1}):''}</div>`:'<p class="hint">Cargando…</p>'):'<p class="hint">Ranking solo en Telegram.</p>';
  const defs=on&&PVI&&PVI.log.length?PVI.log.map(x=>`<div><span style="color:${x.won?'var(--bad)':'var(--good)'}">${x.won?'✗':'✓'}</span><span>🛡 ${esc(x.name)}</span><b>${x.d>0?'+':''}${x.d}</b></div>`).join(''):'';
  const hist=P.hist.map(x=>`<div><span style="color:${x.win?'var(--good)':x.draw?'var(--muted)':'var(--bad)'}">${x.win?'V':x.draw?'E':'D'}</span><span>${esc(x.name)}${x.bot?' (bot)':''}</span><b>${x.d>0?'+':''}${x.d}</b></div>`).join('');
  return `<section class="panel"><h3>PvP</h3>${head}${riv}<h3>Ranking</h3>${top}</section>
  ${hist||defs?`<details class="panel fold"><summary><h3>Historial</h3></summary><div class="rank">${hist}${defs}</div></details>`:''}
  <details class="panel fold"><summary><h3>Premios de la semana</h3></summary>${rewTable(CFG.pvp.rewards)}<p class="hint">Cierra en ${dhm(G.weekLeft())}.</p>
    <div class="ctrl" style="flex-wrap:wrap;gap:10px">${CFG.pvp.leagues.map(([p,n,c])=>`<span class="ctrl" style="gap:4px">${divIcon(p,18)}<b style="color:${c}">${n}</b> <span class="s">${p||0}</span></span>`).join('')}</div></details>` }
function tabEv(){
  if(evView==='lab') return tabLab();
  if(evView==='boss') return tabBoss();
  if(evView==='league') return tabLeague();
  const paused=G.evPaused(), lp=G.evPending(), bp=G.wbPending();
  const lb=G.evToday(), lpos=lb?G.evRank(G.evShownDay(),lb):null, bd=G.wbWeekDmg(), bpos=bd?G.wbRank(G.wbShownWeek(),bd):null;
  const card=(k,title,sub,tk,line,pend)=>!G.modeOpen(k)?`<button class="evcard locked" data-act="lockInfo" data-k="${k}"><span class="evt">🔒 ${title}</span><span class="s">${sub}</span><span class="evl"><span>${reqTxt(k)}</span></span></button>`:`<button class="evcard" data-act="evOpen" data-k="${k}"><span class="evt">${title}${pend?' <sup class="nb">!</sup>':''}</span><span class="s">${sub}</span>
    <span class="evl"><span>${tk}</span><span>${line}</span></span></button>`;
  // Campaña (Normal, Pesadilla, Infierno), Eventos (Mazmorra, Jefe semanal; la Liga está oculta) y PvP (próximamente)
  const back=`<button class="back" data-act="modview" data-v="">← Modos</button>`;
  if(!modView){ const pend=(G.evPending()?1:0)+(G.wbPending()?1:0)+(CFG.league.show&&G.leaguePending()?1:0), M=G.modeCfg();
    const tw=G.towerState(), tr=tw.run, pv=G.pvpState(), cap=CFG.phaseCap, bg=(z,w,h)=>`background-image:linear-gradient(180deg,rgba(10,10,16,0) 35%,rgba(10,10,16,.8)),url(${sceneImg(z,w,h)})`;
    const modesTxt=CFG.modes.map((x,i)=>`<span class="${i===S.mode?'on':''}">${x.name.toUpperCase()}</span>`).join('');
    return `<div class="mgrid2">
      <button class="mcard2 wide" style="${bg(zoneNow(),360,150)}" data-act="modview" data-v="campana">
        <span class="mbadge g">${G.hallTriesLeft()} INTENTOS</span><span class="mk">AVENTURA PRINCIPAL</span><b class="mt">Campaña</b><span class="mm">${modesTxt}</span>
        <span class="mp"><small>Progreso</small><b>Fase ${S.best} / ${cap}</b></span><span class="mbar"><i style="width:${S.best/cap*100}%"></i></span></button>
      ${!G.modeOpen('lab')&&!G.modeOpen('boss')?`<button class="mcard2 locked" style="${bg(4,180,170)}" data-act="lockInfo" data-k="lab">${lockBadge('lab')}<b class="mt">Eventos</b><span class="mf">${reqTxt('lab')}</span></button>`:`<button class="mcard2" style="${bg(4,180,170)}" data-act="modview" data-v="eventos">${pend?`<span class="mbadge">${pend} PREMIO${pend>1?'S':''}</span>`:`<span class="mbadge g">${G.evFreeLeft()+G.wbFreeLeft()} GRATIS</span>`}
        <b class="mt">Eventos</b><span class="mf">${G.modeOpen('boss')?`⏱ Jefe: ${dhm(G.weekLeft())}`:'Jefe: '+reqTxt('boss').split(' · ')[0]}</span></button>`}
      ${G.modeOpen('pvp')?`<button class="mcard2" style="${bg('arena',180,170)}" data-act="modview" data-v="pvp"><span class="mbadge g">${G.pvpFreeLeft()} GRATIS</span>
        <b class="mt">PvP</b><span class="mf">🛡 ${fmt(pv.rating)} puntos</span></button>`
        :`<button class="mcard2 locked" style="${bg('arena',180,170)}" data-act="lockInfo" data-k="pvp">${lockBadge('pvp')}<b class="mt">PvP</b><span class="mf">${reqTxt('pvp')}</span></button>`}
      ${G.modeOpen('tower')?`<button class="mcard2 wide low" style="${bg(3,360,110)}" data-act="modview" data-v="torre"><span class="mico">${GIC(GI.torre,40)}</span>
        <span><b class="mt">Torre</b><span class="mf">${tr?`Piso ${tr.floor} · ♥ ${tr.lives}`:`Récord: piso ${tw.best}`}</span></span></button>`
        :`<button class="mcard2 wide low locked" style="${bg(3,360,110)}" data-act="lockInfo" data-k="tower"><span class="mico">${GIC(GI.torre,40)}</span><span><b class="mt">Torre</b><span class="ms">${reqTxt('tower')}</span></span>${lockBadge('tower')}</button>`}
    </div>` }
  if(modView==='campana') return back+tabHall();
  if(modView==='torre') return back+tabTower();
  if(modView==='pvp') return back+tabPvp();
  return `${back}<section class="panel"><h3>Eventos</h3>
    ${card('lab','Mazmorra','Ranking diario por muertes',`Entradas <b>${G.evFreeLeft()+S.tickets}</b>`,paused?'En pausa':lb?`Hoy ${lb} · puesto ${lpos}`:'Aún no has jugado hoy',!!lp)}
    ${CFG.league&&CFG.league.show?(n=>card('league','Liga de '+n.name,'Bote mensual repartido según tus puntos',`Puntos <b>${fmt(n.pts)}</b>`,`Premio estimado ${fmt(n.tok)} tokens`,!!G.leaguePending()))(G.leagueNow()):''}
    ${card('boss','Jefe semanal','Ranking semanal por daño',`Entradas <b>${G.wbFreeLeft()+S.bossTickets}</b>`,paused?'En pausa':bd?`Semana ${fmt(bd)} · puesto ${bpos}`:`Cierra en ${dhm(G.weekLeft())}`,!!bp)}
  </section>`;
}
function tabLab(){
  const V=CFG.event, paused=G.evPaused(), d=G.evShownDay(), best=G.evToday(), pend=G.evPending(), live=G.inEvent();
  const pos=best?G.evRank(d,best):null;
  return `<button class="back" data-act="evBack">← Eventos</button>
  <section class="panel"><h3>Mazmorra</h3>
    ${pend?`<div class="misTop"><div class="ctrl" style="justify-content:space-between"><b>Premio de ayer · puesto ${pend.pos}</b><button class="btn sm gold" data-act="evClaim">Recoger</button></div><span class="s">${pendText(pend)}</span></div>`:''}
    ${paused?pauseBox():''}
    ${(A=>A?`<div class="affx"><span class="affi">${AFFICO[A.id]||'✦'}</span><div><small>MODIFICADOR DE HOY</small><b>${A.name}</b><span>${A.desc}</span></div></div>`:'')(G.evAffix(d))}
    <div class="evhead"><div><span class="s">Entradas</span><b>${G.evFreeLeft()+S.tickets}</b></div><div><span class="s">${paused?'Total de ayer':'Total hoy'}</span><b>${best||'–'}</b></div><div><span class="s">Puesto</span><b>${pos||'–'}</b></div></div>
    ${(M=>M&&!paused?`<div class="mbar evms"><span>${ICON[M.ch]} Próximo cofre</span><div class="rbar"><i style="width:${(best%M.every)/M.every*100}%"></i></div><span>${best%M.every}/${M.every}</span></div><p class="hint" style="margin-top:-4px">Cada ${M.every} muertes del día: 1 cofre de madera · cada ${M.big}: además 1 de plata</p>`:'')(V.milestones)}
    <div class="ctrl"><button class="btn gold" style="flex:1" data-act="evGo" ${(S.tickets>0||G.evFreeLeft())&&!live&&!paused?'':'disabled'}>${live?'En curso…':paused?'En pausa':'Entrar'}</button>
    ${tokOpen()?`<button class="btn" data-act="buyAsk" data-k="ticket">+1 ticket · ${V.ticketCost} tok</button>`:''}</div>
    <p class="hint">Máx. ${V.maxDur/60} min · cuentan las muertes del día</p>
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
    ${(J=>J?`<div class="affx boss"><span class="affi">${WBICO[J.id]||'👑'}</span><div><small>JEFE DE ESTA SEMANA</small><b>${J.name}</b><span>${J.desc}</span><span class="weak">Débil contra: <b>${J.weak}</b></span></div></div>`:'')(G.wbBoss(w))}
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
// misiones: barra con el progreso, premios como iconos y, a la derecha, «Recoger» (brilla) si está completa o «Ir» (te lleva) si no
const MISGO={event:'eventos',pvp:'pvp',chests:'cofres',upgrade:'up',kills:'up'};
const misBtn=(m,act)=>m.claimed?'<span class="mcheck" aria-label="Recogida">✓</span>':m.done?`<button class="btn sm gold mclaim" data-act="${act}" data-k="${m.k}">Recoger</button>`
  :MISGO[m.k]?`<button class="btn sm mgo" data-act="misGo" data-k="${m.k}">Ir</button>`:'';
const misRank=m=>m.claimed?2:m.done?0:1, misRows=(L,act,M)=>[...L].sort((a,b)=>misRank(a)-misRank(b)).map(m=>`<div class="mrow${m.claimed?' done':m.done?' ready':''}"><div class="mi"><b>${m.t}</b>
      <div class="mbar"><div class="rbar"><i style="width:${Math.min(100,m.prog/m.n*100)}%"></i></div><span>${fmt(Math.min(m.prog,m.n))}/${fmt(m.n)}</span></div>
      <div class="mrw">${bundleHTML(m.rew||{})}<span class="rw xp">+${m.xp||M.xp} XP pase</span></div></div>
      ${misBtn(m,act)}</div>`).join('');
function tabMis(){ const P=G.passState();
  const chips=`<div class="fchips">${[['dia','Diarias',G.missionsReady()],['sem','Semanal',G.weeklyReady()],['pass','Pase',G.passReady()],['soc','Socios',0]].map(([v,l,n])=>`<button data-act="misView" data-v="${v}" aria-pressed="${misView===v}">${l}${n?` <sup class="nb" style="position:static">${n}</sup>`:''}</button>`).join('')}</div>`;
  let body='';
  const bonusRow=(kind,t)=>{ const st=G.bonusState(kind), L=kind==='week'?G.weekMissions():G.missions(), n=L.filter(m=>m.claimed).length;
    return `<div class="mrow bonus${st.got?' done':st.can?' ready':''}"><div class="mi"><b>${t}</b><div class="mbar"><div class="rbar"><i style="width:${n/L.length*100}%"></i></div><span>${n}/${L.length}</span></div><div class="mrw">${bundleHTML(st.b)}</div></div>
      ${st.got?'<span class="mcheck" aria-label="Recogido">✓</span>':st.can?`<button class="btn sm gold mclaim" data-act="misBonus" data-k="${kind}">Recoger</button>`:'<span class="mlock" aria-label="Aún no">🔒</span>'}</div>` };
  if(misView==='dia') body=bonusRow('day','Bonus: completa todas las diarias')+misRows(G.missions(),'misClaim',CFG.missions)+'<p class="hint">Se renuevan cada día.</p>';
  if(misView==='sem') body=bonusRow('week','Bonus: completa todas las semanales')+misRows(G.weekMissions(),'weekClaim',CFG.missions.weekly)+`<p class="hint">Se renuevan cada lunes · quedan ${dhm(G.weekLeft())}.</p>`;
  if(misView==='pass'){ const L=CFG.pass.levels, rows=[]; for(let l=1;l<=L;l++){ const open=l<=P.lvl;
      const cell=(prem)=>{ const got=prem?P.cp[l]:P.cf[l], lock=prem&&!P.prem; return `<div class="pc${got?' got':''}${open&&!got&&!lock?' can':''}${lock?' lock':''}">${bundleHTML(G.passReward(l,prem))}${got?' ✓':''}</div>` };
      rows.push(`<div class="prow${open?' open':''}"><span class="pl">${l}</span>${cell(false)}${cell(true)}</div>`) }
    body=`<div class="ctrl" style="justify-content:space-between"><b>Nivel ${P.lvl}/${L}</b><span class="s">Quedan ${P.daysLeft} días</span></div>
      <div class="rbar"><i style="width:${P.lvl>=L?100:P.into/P.need*100}%;background:var(--gold)"></i></div><span class="s">${P.lvl>=L?'¡Pase completo!':P.into+'/'+P.need+' XP · las misiones dan XP'}</span>
      ${P.prem?'':`<div class="chest offer"><div><div class="cn">Pase de pago</div><div class="s">Premios dorados</div></div><div class="acts">${payBtn('pass',CFG.stars.pass.stars,'data-act="devPass"')}</div></div>`}
      <button class="btn gold" data-act="passAll" ${G.passReady()?'':'disabled'}>Reclamar todo (${G.passReady()})</button>
      <div class="prow ph"><span class="pl">Nv</span><div class="pc">Gratis</div><div class="pc">De pago</div></div>
      <div class="plist">${rows.join('')}</div>`; }
  if(misView==='soc'){ const R=CFG.referral, inv=inviteRow();
    body=`<p class="hint">Invita a tus amigos: tu amigo recibe ${R.giftSilver} cofre de plata y tú ${R.goalSilver} cofres cuando llegue a la fase ${R.goalFase}.</p>${inv||'<p class="hint">Para invitar, abre el juego desde Telegram.</p>'}`; }
  return `<section class="panel">${chips}<div id="misBox" class="mlist">${body}</div></section>` }
const misBadge=()=>G.missionsReady()+G.weeklyReady()+G.passReady();
// Ruleta diaria: tirada gratis + tirada con anuncio; resalta el premio que toca
// pestañas de «Premios diarios» (Calendario · Ruleta), con aviso si hay algo por recoger
const dailyTabs=cur=>`<div class="fchips">${[['calOpen','Calendario',G.calState().can],['wheelOpen','Ruleta',G.wheelState().free]].map(([a,l,n])=>`<button data-act="${a}" aria-pressed="${cur===a}">${l}${n?' <sup class="nb" style="position:static">!</sup>':''}</button>`).join('')}</div>`;
function wheelModal(hit){ const W=G.wheelState(), tot=W.list.reduce((a,x)=>a+x.w,0);
  showModal(`<h3>Premios diarios</h3>${dailyTabs('wheelOpen')}<div class="wheelg">${W.list.map((x,i)=>`<div class="wcell${hit===i?' hit':''}"><b>${bundleHTML(x.b)}</b><span class="s">${Math.round(x.w/tot*100)} %</span></div>`).join('')}</div>
    <div class="ctrl"><button class="btn gold" data-act="wheelSpin" ${W.free?'':'disabled'}>${W.free?'Girar gratis':'Gratis: mañana'}</button><button class="btn" data-act="wheelAd" ${W.ad?'':'disabled'}>${W.ad?'Girar con anuncio':'Anuncio: mañana'}</button></div>
    <p class="hint">Una tirada gratis al día y otra viendo un anuncio.</p><button class="btn" data-act="close">Cerrar</button>`) }
function wheelGo(viaAd){ const r=G.spinWheel(viaAd); if(!r) return; const L=G.wheelState().list.length; let i=0, n=L*2+r.i;
  if(!$('#modal .wcell')) wheelModal();   // (tras el anuncio se vuelve a abrir la ruleta)
  if(reduceMotion()){ wheelModal(r.i); toast('Ruleta: '+bundleTxt(r.b)); return }
  const tick=()=>{ document.querySelectorAll('#modal .wcell').forEach((c,j)=>c.classList.toggle('hit',j===i%L)); if(i++<n) setTimeout(tick,40+i*6); else { haptic('ok'); wheelModal(r.i); toast('Ruleta: '+bundleTxt(r.b)); updateHUD(); } };
  document.querySelectorAll('#modal .ctrl button').forEach(b=>b.disabled=true); tick(); }
// Calendario: icono en el combate; ventana con los 7 días
function calModal(){ const C=G.calState();
  showModal(`<h3>Premios diarios</h3>${dailyTabs('calOpen')}<div class="calg">${C.list.map((b,i)=>{ const d=i+1, got=d<C.day||(d===C.day&&!C.can), now=d===C.day&&C.can;
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
    ${row('gold',`+${fmtG(G.goldBoostValue())} oro`,boostSub('gold'))}
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
  if(r.applied) toast(k==='speed'?`Velocidad ×${CFG.boosts.speed.mult} activada`:`+${fmtG(r.gold)} oro`);
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
${G.canEvolve()?'':`<p class="hint">Los jefes de ${CFG.modes[c.essMode].name} sueltan esencias (más cuanto más alta la fase). Los ${CFG.event.mat.toLowerCase()}s se ganan en Modos → Eventos.</p>`}` }
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
    <div class="loot"><div><span>Oro</span><b>+${fmtG(off.gold)}</b></div>${off.lvlTo>off.lvlFrom?`<div><span>Nivel</span><b>${off.lvlFrom} → ${off.lvlTo}</b></div>`:''}</div>
    <div class="ctrl"><button class="btn${off.capped?'':' gold'}" data-act="close">Recoger</button>
    ${off.bonus?`<button class="btn gold" data-act="offAd">×${CFG.offlineAdMult.toLocaleString('es-ES')} con anuncio (+${fmtG(off.bonus)})</button>`:''}</div>`);
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
  return `<section class="panel"><div class="row"><div><div class="t">Nombre</div><div class="s">${esc(S.name||'—')}</div></div></div>${canNotify()?`<div class="row"><div><div class="t">Avisos del bot</div><div class="s">Te escribe cuando tu héroe llena el tiempo sin conexión</div></div><div class="acts"><button class="btn sm${S.opt&&S.opt.notify?' on':''}" data-act="notifyAsk">${S.opt&&S.opt.notify?'Activados':'Activar'}</button></div></div>`:''}<div class="row"><div><div class="t">Modo batería</div><div class="s">Menos efectos, gasta menos</div></div><div class="acts"><button class="btn sm${on?' gold':''}" data-act="battery" aria-pressed="${on}">${on?'Activado':'Desactivado'}</button></div></div>
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
  $('#nav').hidden=true; $('#upFab').hidden=true;
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
  upBuy:(b,k)=>{ if(upHeld){ upHeld=false; return } if(!G.buyUpgrade(k)) toast('No tienes oro suficiente'); updateHUD() },
  skill:(b,k)=>{ const x=G.skills().find(s=>s.slot===k); if(!x) return; if(x.locked) return toast(`${x.name}: ${(SKI[x.id]||[0,x.desc])[1]}`);
    const r=G.useSkill(k); if(r.ok){ haptic('medium'); toast(x.name) } else if(r.why==='cd') toast(`${x.name}: ${Math.ceil(r.left)} s`); else if(r.why==='nofight') toast('Espera a que empiece el combate'); else if(r.why==='auto') toast('Aquí las habilidades son automáticas') },
  // botón Auto/Manual del combate: en los eventos cambia opt.evAuto; en la campaña, opt.autoSkills
  skAuto:()=>{ if(G.autoOnly()){ toast('Aquí las habilidades son siempre automáticas'); }
    else if(G.inEvent()){ G.setOpt('evAuto',!(S.opt&&S.opt.evAuto)); toast(S.opt.evAuto?'Habilidades automáticas en el evento':'Habilidades a mano en el evento'); }
    else { G.setOpt('autoSkills',S.opt&&S.opt.autoSkills===false); toast(S.opt.autoSkills===false?'Habilidades: solo a mano':'Habilidades automáticas en campaña'); } updateHUD(); if(tab==='dev') renderTab() },
  autoSkills:()=>{ G.setOpt('autoSkills',S.opt&&S.opt.autoSkills===false); toast(S.opt.autoSkills===false?'Habilidades: solo a mano':'Habilidades automáticas en campaña'); renderTab() },
  misView:b=>{ misView=b.dataset.v; renderTab() },
  calOpen:()=>calModal(),
  dailyOpen:()=>G.calState().can||!G.wheelState().free?calModal():wheelModal(),
  towerStart:()=>{ G.towerStart(); renderTab() },
  towerFx:()=>towerFxModal(),
  towerBuy:(b,k)=>{ if(G.towerShopBuy(+k)){ haptic('ok'); renderTab() } },
  towerShopLeave:()=>{ G.towerShopLeave(); renderTab() },
  towerRemove:()=>towerRemoveModal(),
  towerRemoveYes:(b,k)=>{ const x=G.towerShopRemove(+k); closeModal(); if(x){ toast('Quitado: '+G.boonInfo(x).name); haptic('ok'); } renderTab() },
  towerTab:(b,k)=>{ towerTab=k==='rank'?'rank':'run'; renderTab() },
  towerEv:(b,k)=>{ const r=G.towerEvent(k); if(!r) return; if(r.curse) toast('Maldición: '+CFG.tower.curses[r.curse].name); if(r.good===false) toast('¡Era una trampa!'); renderTab() },
  towerRev:()=>playAd(()=>{ closeModal(); if(G.towerRevive()){ toast('¡Has revivido!'); renderTab() } }),
  towerQuit:()=>showModal(`<h3>¿Terminar la partida?</h3><p class="hint">Pierdes las mejoras de esta partida. El récord y los premios se quedan.</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="towerQuitYes">Terminar</button></div>`),
  towerQuitYes:()=>{ G.towerAbandon(); closeModal(); renderTab() },
  towerGo:(b,k)=>{ const r=G.towerGo(+k); if(!r) return; if(r.k==='rest') toast(r.full?'Hoguera: ya tenías la vida llena':'Hoguera: vida al máximo'); if(r.k==='treasure'&&!r.got) toast('Cofre vacío: ya tienes todos los grimorios'); if(G.inEvent()){ tab='up'; } renderTab() },
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
  misGo:(b,k)=>{ const v=MISGO[k]; if(!v) return; closeModal();
    if(v==='up'){ tab='up' } else if(v==='cofres'){ tab='inv'; invView='cofres' } else { tab='ev'; modView=v; evView=null; if(v==='pvp') pvpLoad() }
    renderTab(); window.scrollTo({top:0}) },
  modview:b=>{ modView=b.dataset.v||null; evView=null; if(modView==='pvp') pvpLoad(); renderTab(); window.scrollTo({top:0}); },
  lgClaim:()=>{ const p=G.leagueClaim(); if(p){ toast(`+${fmt(p.tok)} tokens de la Liga`); renderTab(); } },
  evClaim:()=>{ const p=G.claimEvent(); if(p){ toast(p.rew?evRewPlain(p.rew):'Sin premio'); renderTab(); } },
  close:()=>{stopSpin();boostModalOpen=false;grimOpen=false;clearInterval(adTimer);adTimer=null;closeModal()},
  equip:(b,k,id)=>{if(G.equip(id))renderTab()},
  fav:(b,k,id)=>{const f=G.toggleFav(id);if(f===null)return;toast(f?'Arma bloqueada: no se desmonta ni se usa para forjar':'Arma desbloqueada');if(tab==='inv'&&invView==='armas')renderList();else renderTab()},
  lvlMat:(b,k,id)=>{ const it=G.findItem(id), r=G.levelUp(id,true); if(r.ok) toast(wName(it)+' sube a nivel '+r.lvl); else toast(r.why==='scrap'?'Te falta chatarra':'Te falta material'); renderTab() },
  lockInfo:(b,k)=>{ const u=UNL[k]; if(u) toast(`🔒 ${u[0]}: se desbloquea en ${reqTxt(k)}`) },
  unlGo:(b,k)=>{ closeModal(); tab='ev'; modView=k==='pvp'?'pvp':k==='tower'?'torre':'eventos'; evView=k==='lab'||k==='boss'?k:null; if(k==='pvp') pvpLoad(); renderTab(); window.scrollTo({top:0}) },
  hallMode:b=>{ hallMode=+b.dataset.v; hallSel=null; renderTab() },
  hallSel:(b,k,id)=>{ hallSel=hallSel===id?null:id; const x=G.hallBosses().find(q=>q.id===id); hallStar=x?Math.min(3,x.stars+1):1; renderTab() },
  hallStar:b=>{ hallStar=+b.dataset.v; renderTab() },
  hallGo:(b,k,id)=>{ if(G.hallStart(id,+b.dataset.v)){ tab='up'; renderTab(); } else toast(G.hallTriesLeft()?'No se puede luchar ahora':'Sin intentos hoy: vuelve mañana') },
  ascAsk:(b,k,id)=>{ const it=G.findItem(id), a=it&&G.ascendInfo(id); if(!a||!a.can) return;
    showModal(`<h3>¿Ascender ${esc(wName(it))}?</h3><p class="hint">Pasa a <b style="color:var(--r${a.next})">${CFG.rarName[a.next]}</b> al nivel ${CFG.weapon.ascend.lvl}. Se gasta otra ${CFG.rarName[it.r]} nv ${CFG.weapon.maxLvl} (${esc(wName(a.partner))}) y el material.</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="ascYes" data-id="${id}">Ascender</button></div>`) },
  ascYes:(b,k,id)=>{ closeModal(); const it=G.findItem(id), r=G.ascend(id); if(r.ok){ toast(`¡${wName(it)} asciende a ${CFG.rarName[r.r]}!`); haptic('ok'); } renderTab() },
  lvl:(b,k,id)=>{const r=G.levelUp(id),it=G.findItem(id);
    if(r.ok) toast(wName(it)+' sube a nivel '+r.lvl);
    else if(r.why==='items') toast(`Necesitas ${r.need} ${wName(it)} más`);
    else if(r.why==='scrap') toast('Te falta chatarra');
    renderTab()},
  dis1:(b,k,id)=>{ const it=G.findItem(id); if(!it) return; if(R.indexOf(it.r)>=2||it.lvl>1){ pendingDis=[id]; return showModal(`<h3>¿Desmontar ${esc(wName(it))}?</h3><p class="hint">${CFG.rarName[it.r]} nv ${it.lvl} · +${G.disValue(it)} chatarra</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="disYes">Desmontar</button></div>`) } disToast(G.dismantle([id]));renderTab()},
  disAsk:()=>{const ids=filtered().filter(x=>x.id!==S.equippedId&&!x.fav).map(x=>x.id);const v=ids.reduce((s,id)=>s+G.disValue(G.findItem(id)),0);
    pendingDis=ids;showModal(`<h3>¿Desmontar ${ids.length} armas?</h3><p class="hint">+${v} chatarra · la equipada y las ★ se quedan</p><div class="ctrl"><button class="btn" data-act="close">Cancelar</button><button class="btn gold" data-act="disYes">Desmontar</button></div>`)},
  disYes:()=>{closeModal();disToast(G.dismantle(pendingDis||[]));pendingDis=null;renderTab()},
  invFull:()=>{ closeModal(); tab='inv'; invView='armas'; fdetOpen=true; renderTab() },   // inventario lleno: filtros abiertos para desmontar
  forjaTab:(b)=>{forjaTab=b.dataset.v;renderTab()},
  forge:(b,k,id)=>{forgeId=id;lockSel=[];forjaBack=b.dataset.from||'armas';tab='inv';invView='forja';renderTab();window.scrollTo({top:0})},
  invview:b=>{const v=b.dataset.v; if(v==='forja') forjaBack='armas'; invView=v; renderTab()}, // tocar la pestaña abierta la cierra
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
  chestSel:(b,k)=>{ chestSel=chestSel===k?null:k; renderTab() },
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

// mantener pulsada una habilidad: se ve su nombre y qué hace (y no se lanza)
let skPress=null, skSkip=false;
function skTipHide(){ const t=$('#skTip'); if(t) t.hidden=true }
// mantener pulsado un rasgo del élite, la mecánica del jefe o una maldición (Torre): qué hace
document.addEventListener('pointerdown',e=>{ const b=e.target.closest('[data-tip]'); if(!b) return; clearTimeout(skPress);
  skPress=setTimeout(()=>{ const t=$('#skTip'); if(!t) return; const [n,d]=b.dataset.tip.split('|'); haptic('light');
    const st=b.closest('.stage'), up=st&&b.getBoundingClientRect().top>st.getBoundingClientRect().top+st.clientHeight/2; t.classList.toggle('up',!!up);
    t.innerHTML=`<b>${n}</b><br>${d}`; t.hidden=false; clearTimeout(t._h); t._h=setTimeout(skTipHide,2500) },350) });
document.addEventListener('pointerdown',e=>{ const b=e.target.closest('.skb'); if(!b) return; clearTimeout(skPress);
  skPress=setTimeout(()=>{ const x=G.skills().find(s=>s.slot===b.dataset.k), t=$('#skTip'); if(!x||!t) return; skSkip=true; haptic('light');
    t.classList.remove('up'); t.innerHTML=skTip(x); t.hidden=false; clearTimeout(t._h); t._h=setTimeout(skTipHide,2500) },450) });
['pointerup','pointercancel','pointerleave'].forEach(ev=>document.addEventListener(ev,()=>clearTimeout(skPress)));
document.addEventListener('contextmenu',e=>{ if(e.target.closest('.skb,[data-tip],.upt')) e.preventDefault() });
// tocar un icono de estado: su nombre y qué hace al momento
document.addEventListener('click',e=>{ const b=e.target.closest('.sti[data-tip]'); if(!b) return; const t=$('#skTip'); if(!t) return; clearTimeout(skPress); const [n,d]=b.dataset.tip.split('|');
  t.classList.remove('up'); t.innerHTML=`<b>${n}</b><br>${d}`; t.hidden=false; clearTimeout(t._h); t._h=setTimeout(skTipHide,2500) });
document.addEventListener('click',e=>{
  if(skSkip&&e.target.closest('.skb')){ skSkip=false; return } skSkip=false;
  const b=e.target.closest('[data-act],[data-tab],[data-f]'); if(!b) return;
  if(b.dataset.tab){ if(adTimerOn()) return; if(b.dataset.tab==="ev"&&tab==="ev"){ evView=null; modView=null; } /* tocar Modos estando dentro vuelve al inicio de Modos */ boostModalOpen=false;stopSpin();closeModal();if(b.dataset.tab==="inv") invView='main'; /* Inventario siempre abre la pantalla principal */ tab=b.dataset.tab;lockSel=[];renderTab();return}
  if(b.dataset.f){F[b.dataset.f]=b.dataset.v;document.querySelectorAll(`[data-f="${b.dataset.f}"]`).forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===b.dataset.v));renderList();return}
  const fn=ACT[b.dataset.act]; if(fn) fn(b,b.dataset.k,+b.dataset.id);
});
document.addEventListener('toggle',e=>{ if(e.target.classList&&e.target.classList.contains('fdet')) fdetOpen=e.target.open },true);
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
  const gy=Math.min(H-30,Math.round(H*0.68)); fx.sc=sc; fx.gy=gy;
  ART.scene(g,W,H,gy,zone,battery()?0:fx.scroll||0,smode,battery()?0:performance.now()/1000);
  const hx=W*0.24, c=CFG.classes[S.cls], now=performance.now(), T=now/1000, anim=!battery();
  const prog=(at,ms)=>at&&anim?Math.max(0,Math.min(1,(now-at)/ms)):0, pulse=(at,ms)=>{ const k=prog(at,ms); return k>0&&k<1?k:0 };
  // el héroe anda mientras no hay enemigo delante (entre oleadas o mientras se acercan)
  const walking=!B||B.over||!B.enemies.some(e=>!e.dead&&B.t>=e.arrive-0.05);
  fx.walkT=walking&&anim?(fx.walkT||0)+dt:0;
  if(walking&&anim) fx.scroll=(fx.scroll||0)+dt*40;
  ART.hero(g,hx,gy,{cls:S.cls,color:c.color,evo:S.evo,path:S.path,walk:fx.walkT,atk:pulse(fx.atkAt,260),hit:fx.flash>0?fx.flash/0.15:0,t:anim?T:0});
  if(!B){ if(anim) ART.parts(g,dt); return }
  const h=G.heroStats(), contact=hx+44, spawnX=W+24;   // los sprites son más anchos que los dibujos: algo más de hueco
  if(B.kind==='pvp'){ const e=B.enemies[0], rc=CFG.classes[e.cls]||c, rv=G.pvpState().rival||{}, rx=Math.max(W*0.7,hx+100), p=Math.min(1,B.t/(e.walk||0.8)), x=spawnX-(spawnX-rx)*p; e.x=x;
    ART.hero(g,x,gy,{cls:e.cls,color:rc.color,evo:rv.evo||0,path:rv.path,flip:true,walk:p<1&&anim?T:0,atk:pulse(fx.ratkAt,260),hit:fx.rflash>0?fx.rflash/0.12:0,t:anim?T+1.3:0}); fx.rflash=Math.max(0,(fx.rflash||0)-dt);
    const nm=n=>{ n=String(n||''); return n.length>10?n.slice(0,9)+'…':n };   // nombres cortos: no se pisan
    g.textAlign='center'; g.font='700 9px "Nunito Sans", system-ui, sans-serif'; g.fillStyle='#ece7da'; g.fillText(nm(e.name),x,gy-92); g.fillText(nm(S.name),hx,gy-92);
  }
  // monstruos: tipo según la zona (campaña: la fase; Mazmorra: el grupo; Torre: el piso) y color según el modo
  const modeHue=m=>[0,190,300][Math.min(2,m||0)];
  let q=0, idx=0; const drawQ=[];
  for(const e of B.enemies){ if(B.kind==='pvp') break;
    const dieK=e.dead?(B.t-(e.deadAt||0))/0.45:0; if(e.dead&&(dieK>=1||e.x===undefined)) continue;
    if(!e._k){ const f=e.f||S.fase, zone=B.kind==='boss'?4:B.kind==='tower'?Math.min(4,Math.floor((G.towerState().run||{floor:1}).floor/20)):zoneOf(f);
      const m=e.f?Math.floor((e.f-1)/150):B.kind?0:S.mode; e._k=ART.kindFor(zone,idx,{boss:B.boss&&!e.minion,elite:B.elite,mode:m}); e._hue=modeHue(m); }   // color del modo
    idx++;
    const p=Math.min(1,(B.t-e.spawn)/(e.walk||CFG.enemy.walk));
    const big=B.boss&&!e.minion, cx=contact+((big?(B.elite?26:21):13)-13)*2.4;   // los esbirros del jefe, de tamaño normal y sin corona   // los grandes se paran más lejos (no tapan al héroe)
    // en cola, en dos filas al tresbolillo: la de atrás un poco más arriba y más pequeña (da profundidad y no se tapan)
    if(e._row==null) e._row=big?0:idx%2;
    const r=(big?(B.elite?26:21):13)*(e._row?0.86:1), y=gy-e._row*3;
    let x=e.dead?e.x:spawnX-(spawnX-cx)*p; if(!e.dead&&p>=1){x+=q*24;q++}
    e.x=x; drawQ.push(()=>{
    if(e.dead&&!e._burst){ e._burst=1; if(anim) ART.burst(x,gy-r,'#d9d2c0',8); }
    ART.monster(g,x,y,{kind:e._k,r,hue:e._hue,boss:big,elite:B.elite,t:anim?T+(e.spawn||0):0,walk:p<1&&anim?T:0,atk:pulse(e._atkAt,300),hit:anim&&e._hitAt&&now-e._hitAt<100?1-(now-e._hitAt)/100:0,die:Math.max(0,dieK)});
    if(anim&&!e.dead) ART.status(g,x,gy,r,{frozen:e.frozen>B.t,burn:(e.burn&&e.burn.some(u=>u>B.t))||(e.dot>B.t&&e.dotKind==='fuego'),poison:e.poison&&e.poison.some(p=>p.until>B.t),mark:e.mark>B.t},T);
    if(bars&&!e.immortal&&!e.dead&&B.event&&!B.kind){ const by=y-r*3.7-6; g.fillStyle='#0009'; g.fillRect(x-18,by,36,4); g.fillStyle='#e2605a'; g.fillRect(x-18,by,36*Math.max(0,e.hp/e.max),4); }   // Mazmorra (sin fin): barra de cada uno
    }); drawQ[drawQ.length-1].row=e._row;
  }
  drawQ.filter(d=>d.row).forEach(d=>d()); drawQ.filter(d=>!d.row).forEach(d=>d());   // primero la fila de atrás
  if(anim) ART.parts(g,dt);
  if(anim){ const foes=B.kind==='pvp'?[]:B.enemies.filter(e=>!e.dead&&e.x!=null).map(e=>({x:e.x}));
    ART.drawFx(g,{W,hx,rx:B.kind==='pvp'?B.enemies[0].x:null,gy,foes,now:now/1000,
      drawClone:(x,side)=>{ if(side==='rival'){ const e=B.enemies[0], rv=G.pvpState().rival||{}; ART.hero(g,x,gy,{cls:e.cls,color:(CFG.classes[e.cls]||c).color,evo:rv.evo,path:rv.path,flip:true,t:T}) } else ART.hero(g,x,gy,{cls:S.cls,color:ART.shade(c.color,0.5),evo:S.evo,path:S.path,ghost:true,t:T+0.5}) }}); }
  fx.floats=fx.floats.filter(f=>(f.life-=dt)>0);
  // números de daño: saltan con un pequeño «pop» (empiezan grandes y se asientan), suben en arco y se desvanecen;
  // con contorno oscuro para leerse sobre cualquier fondo; los críticos, más grandes y dorados
  g.textAlign='center'; g.lineJoin='round';
  for(const f of fx.floats){ const k=f.max-f.life, x=(f.hero?hx:(f.e&&f.e.x)||0)+(f.dx||0)+(f.vx||0)*k, y=(f.hero?gy-58:gy-52)-(f.lane||0)*11-k*38-Math.min(k,0.25)*24;
    const pop=k<0.12?1+0.5*(1-k/0.12):1, sz=(f.crit?16:f.hero?11:10)*pop;
    g.font=`900 ${sz.toFixed(1)}px "Nunito Sans", system-ui, sans-serif`;
    g.globalAlpha=Math.min(1,f.life/0.3); g.lineWidth=f.crit?3:2.4; g.strokeStyle='#140f1c';
    const t=f.txt+(f.crit?'!':''); g.strokeText(t,x,y); g.fillStyle=f.hero?'#ef6b62':(f.crit?'#ffc94a':'#f4efe2'); g.fillText(t,x,y); }
  g.globalAlpha=1; fx.flash=Math.max(0,fx.flash-dt);
  vsHud(B,h);
}
// Barras de vida (HUD de juego de lucha: Street Fighter, Tekken, Marvel Snap): pegadas arriba del combate, la tuya a la
// izquierda y la de los enemigos (todos juntos) a la derecha, en espejo, con el emblema del centro entre las dos.
// Se vacían hacia el centro; lo que acabas de perder queda en claro un momento (estela) y luego baja.
// El escudo es una barra azul fina justo debajo de la tuya. Con menos del 25 % de vida tu barra late en rojo.
const WBICO={enjambre:'🪲',coloso:'🛡️',bestia:'🐗',liche:'💀',dragon:'🐉'};   // jefes de la semana
// Desbloqueo de modos: nombre, qué es y qué falta («Fase 10 · vas por la 4», «Día 7 · faltan 3 días»)
const UNL={lab:['Mazmorra','Aguanta oleadas sin fin: ranking diario y cofres por muertes','lab'],boss:['Jefe semanal','Un jefe distinto cada semana: ranking por daño','boss'],
  pvp:['PvP','Duelos contra la partida de otros jugadores','pvp'],tower:['Torre','Roguelike: sube pisos eligiendo cartas y grimorios','torre']};
const reqTxt=k=>{ const r=G.modeReq(k); return !r?'':r.fase?`Fase ${r.fase} · vas por la ${S.best}`:`Día ${r.day} de juego · falta${r.left>1?'n':''} ${r.left} día${r.left>1?'s':''}` };
const lockBadge=k=>`<span class="mlock2">🔒 ${G.modeReq(k).fase?'FASE '+G.modeReq(k).fase:'DÍA '+G.modeReq(k).day}</span>`;
function unlockCheck(){ if(G.inEvent()||modalOpen()) return; const nw=G.unlockNew().filter(k=>UNL[k]); if(!nw.length) return; haptic('ok');   // si se abren varios a la vez, un solo aviso
  const k=nw[0], u=UNL[k], many=nw.length>1;
  later(()=>showModal(`<div class="unl"><span class="unl-i">🔓</span><small>¡NUEVO${many?'S MODOS DESBLOQUEADOS':' MODO DESBLOQUEADO'}!</small><h3>${nw.map(x=>UNL[x][0]).join(' · ')}</h3><p class="hint">${many?nw.map(x=>`<b>${UNL[x][0]}</b>: ${UNL[x][1]}`).join('<br>'):u[1]}</p></div>
    <div class="ctrl"><button class="btn" data-act="close">Luego</button><button class="btn gold" style="flex:1" data-act="unlGo" data-k="${k}">Ir a ${u[0]}</button></div>`)) }
const AFFICO={furia:'😤',enjambre:'🐜',certero:'🎯',sinCura:'🚫',gigantes:'🗿',vampiros:'🩸'};   // modificadores del día de la Mazmorra
const VST={B:null,me:{cur:1,from:0,at:0},foe:{cur:1,from:0,at:0}};
// iconos de estado bajo las barras: [icono, nombre, qué hace, ¿malo?]
const ST_ICO={life:['❤️','Vida','Si caes, pierdes una vida (sin vidas, la partida termina)'],atk:['⚔️','Más daño','Tus golpes hacen más daño'],spd:['💨','Más velocidad','Atacas más rápido'],ls:['🩸','Robo de vida','Te curas con el daño que haces'],
  baluarte:['🛡️','Baluarte','Más defensa y devuelves el daño que recibes'],atk1:['👑','Contra jefes','Más daño a los jefes'],taken:['🧱','Protegido','Recibes menos daño'],
  sang:['🗡️','Sangría','Tus próximos golpes hacen +100 %'],combust:['🔥','Combustión','Tus golpes queman'],clone:['👥','Clon de sombra','Un clon copia tus golpes'],
  aura:['✨','Luz del juicio','Te curas y quemas a los cercanos'],ice:['❄️','Armadura de hielo','Quien te pega recibe esquirlas'],cloud:['☁️','Nube tóxica','Envenena a todos los enemigos'],
  c_vida:['💪','Enemigos más fuertes','Maldición: los enemigos tienen +20 % de vida',1],c_fragil:['💔','Frágil','Maldición: −15 % de vida máxima',1],c_rasgo:['☠️','Élites temibles','Maldición: los élites traen un rasgo más',1],
  t_rapido:['⚡'],t_regenera:['💚'],t_escudo:['🛡️'],t_espinas:['🌵'],t_furioso:['😡'],t_gigante:['🗿'],
  m_invocador:['👥'],m_enfurecido:['💢'],m_fases:['🔰'],m_final:['♾️'],p_rage:['💢','Enfurecido','Pega y ataca más rápido'],p_summon:['👥','Refuerzos','Ha llamado ayudantes']};
function stIcons(list){ return list.map(([k,extra])=>{ const d=ST_ICO[k]||['❔',k,'']; const n=d[1]||'', t=d[2]||'';
  return `<i class="sti${d[3]?' bad':''}${k==='life'?' life':''}" data-tip="${esc(d[0]+' '+n)}|${esc(t+(extra||''))}">${d[0]}</i>` }).join('') }
function vsHud(B,h){ const el=$('#vsHud'); if(!el) return; el.hidden=!B; if(!B) return;
  if(VST.B!==B){ VST.B=B; VST.me={cur:Math.max(0,B.hp/h.hp),from:0,at:0}; VST.foe={cur:1,from:0,at:0}; }
  const now=performance.now();
  // estela: solo el trozo que quitó el ÚLTIMO golpe (en crema), que se ve un momento y se apaga
  // barras en SVG (el marco dorado va por encima del color). Tu barra se llena desde la izquierda; la de los enemigos, desde la derecha
  const set=(w,st,p,txt)=>{ const fl=w.querySelector('.fl'), tr=w.querySelector('.tr'), mine=w.classList.contains('me'), W=x=>Math.max(0,Math.min(1,x))*200;
    if(p<st.cur-0.0005){ st.from=st.cur; st.at=now; } st.cur=p;
    const age=now-st.at, on=st.from>p&&age<650, put=(r,v)=>{ r.setAttribute('width',W(v)); r.setAttribute('x',mine?0:200-W(v)); };
    put(tr,on?st.from:0); tr.style.opacity=on?(age<400?1:1-(age-400)/250):0; put(fl,p); };   // sin texto: la barra se lee sola
  const hp=Math.max(0,B.hp/h.hp), me=el.querySelector('.me'), foe=el.querySelector('.foe');
  set(me,VST.me,hp,Math.ceil(hp*100)+' %'); me.classList.toggle('low',hp<0.25);
  { const sh=me.querySelector('.vssh'), v=Math.min(100,G.heroShield()/h.hp*100); sh.style.width=v+'%'; sh.style.display=v>0.3?'':'none'; }
  const fb=B.kind==='pvp'?{p:Math.max(0,B.enemies[0].hp/B.enemies[0].max)}:!(B.event&&!B.kind)?foeBar(B):null;
  foe.style.visibility=fb?'visible':'hidden'; if(fb) set(foe,VST.foe,fb.p,fb.inf?'∞':Math.ceil(fb.p*100)+' %');
  // iconos: lo tuyo (efectos de habilidades y maldiciones de la Torre) y lo de los enemigos (rasgos, mecánica del jefe, fases)
  const run=B.kind==='tower'?G.towerState().run:null, TT=CFG.tower;
  const lives=run?Array(Math.max(0,run.lives||0)).fill(['life']):[];   // Torre: tus vidas, como corazones
  const AF=B.event&&!B.kind&&B.aff; if(AF&&!ST_ICO['a_'+AF.id]) ST_ICO['a_'+AF.id]=[AFFICO[AF.id]||'✦','Modificador del día: '+AF.name,AF.desc];
  const mine=(AF?[['a_'+AF.id]]:[]).concat(lives,G.heroBuffs().map(x=>[x.k,x.left!=null?` · ${Math.ceil(x.left)} s`:x.n?` · quedan ${x.n}`:'']),run?(run.curses||[]).map(c=>['c_'+c]):[]);
  const foes=[]; if(run){ if(B.mech) foes.push(['m_'+B.mech]); if(B.node==='elite') for(const t of new Set(B.enemies.flatMap(e=>e.traits||[]))) foes.push(['t_'+t]); }
  for(const e of B.enemies) if(!e.dead&&e.phase&&!foes.some(f=>f[0]==='p_'+e.phase)) foes.push(['p_'+e.phase]);
  if(B.kind==='boss'&&B.wb){ const J=B.wb, k='w_'+J.id; if(!ST_ICO[k]) ST_ICO[k]=[WBICO[J.id]||'👑',J.name,J.desc+' · Débil contra: '+J.weak,1]; foes.push([k,J.armor&&B.enemies[0]&&B.enemies[0].broken?' · ¡armadura rota!':'']); }
  for(const [k] of foes){ if(k[0]==='t'&&!ST_ICO[k][1]){ const t=TT.traits[k.slice(2)]; ST_ICO[k][1]=t.name; ST_ICO[k][2]=t.desc; } if(k[0]==='m'&&!ST_ICO[k][1]){ ST_ICO[k][1]=MECH[k.slice(2)]; ST_ICO[k][2]=TT.bossMech.desc[k.slice(2)]; } }
  const put=(id,list)=>{ const x=$(id), hh=stIcons(list.map(([k,e])=>[k,e&&e.replace(/\d+ s$/,'')])); if(x&&x.dataset.h!==hh){ x.dataset.h=hh; x.innerHTML=stIcons(list); } };
  put('#stMe',mine); put('#stFoe',foes); }

/* ---------- bucle ---------- */
let last=performance.now(), hudT=0, drawT=0, offT=0;
function loop(now){
  const real=Math.min(0.25,(now-last)/1000); last=now;
  if(S&&G.B&&!window.GAME_PAUSED){                        // en mantenimiento o actualizando, el juego se para
    G.tickBoost(real*1000); // el ×2 solo se gasta mientras se juega
    let sim=real*(S.speed||1)*G.speedMult()*(G.towerOn()?CFG.tower.speed||1:1);   // la Torre va algo más despacio
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
  if(G.autoLoot()) setTimeout(()=>toast('Botín de jefes: enviado al inventario'),400);
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
