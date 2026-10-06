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
  muro:['<path fill="currentColor" d="M274.663 63.02L90.792 80.26l154.193 19.273c5.063-13.339 12.952-24.341 22.541-31.828a52 52 0 0 1 7.137-4.683zm19.832 12.803c-5.092.166-10.492 2.296-15.879 6.502c-7.835 6.118-15.009 16.575-18.83 29.688s-3.477 26.099-.289 35.927c3.188 9.829 8.73 16.071 15.633 18.395s14.766.596 22.601-5.522c7.835-6.117 15.01-16.574 18.83-29.687c3.822-13.113 3.48-26.1.292-35.928s-8.73-16.07-15.633-18.394a19 19 0 0 0-6.725-.98zm166.85 9.485c-24.113 13.949-46.193 20.298-87.233 17.252L340.48 228.452c-.675 2.682-.318 6 1.922 10.87c2.243 4.876 6.355 10.89 11.836 17.607c9.99 12.242 24.527 27.16 39.573 44.238c14.56-5.5 28.23-12.828 38.972-20.19c11.841-8.113 20.234-16.95 21.965-19.939l42.027-118.22c-16.748-14.613-29.471-33.974-35.43-57.51m-288.07 51.261L23.652 158.331l89.309 12.988l2.158-5.052zm286.265 2.325l16.941 6.078l-39.123 109.037l-37.212 19.181l-8.247-15.998l30.913-15.933zm-259.842 4.394l-70.586 36.043l-29.222 68.422l19.218 8.809l24.905-57.764l59.299-22.973l-14.702 75.955l-.963 1.477c-32.725 50.18-71.654 93.41-118.464 134.28L42.722 432.98l17.021 7.245l31.875-43.989l1.38-.906c45.476-29.872 75.93-62.333 112.255-94.492l4.533-4.012l5.426 2.686c23.365 11.571 42.934 24.117 62.107 37.705l8.924 6.324l-69.006 65.643l24.649 39.794l17.67-10.308l-20.078-28.477l8.224-5.004c29.884-18.186 49.986-39.43 71.938-66.039c-23.653-35.6-42.006-49.433-71.592-71.267l9.908-7.227c34.703-25.312 38.132-54.476 41.61-79.449c-9.203 4.441-19.498 5.772-29.473 2.414c-13.488-4.54-22.924-16.472-27.465-30.473c-.17-.522-.321-1.054-.479-1.584zm116.62 45.04c-1.355 7.027-3.324 14.17-6.092 21.349l14.056 9.666l5.938-22.223zm-174.243 97.476l-126.85 17.953l99.67 14.105a599 599 0 0 0 27.18-32.058m91.781 82.73l-95.892 21.432l59.406 13.277z"/>','Levanta un escudo y golpea a los enemigos cercanos.'],
  bola:['<path fill="currentColor" d="M108.28 18.78c-1.2 6.05 1.1 13.32 9.095 19.876c15.883 13.01 36.716-3.12 27.875-19.875h-36.97zm174.564 0c13.572 15.575 25.36 48.026 21.687 77.22c-3.915 31.118-22.083 59.048-73.624 67.094v.094a37 37 0 0 0-5.812 1.343c4.17.89 8.657 2.86 13.344 6.22c24.482 17.577 3.918 55.804-26.125 36.47c-8.196-5.266-12.213-12.31-13.032-19.19c-4.615 11.776-2.376 25.68 12.47 37.126c42.122 32.48 76.872-19.863 48.844-50.437c35.076-12.994 54.042-38.53 60.594-65.97c17.85 2.145 40.616 8.678 58.156 22.22c19.867 15.337 34.025 38.73 29.844 79.25l-.032.405v.406c-.43 27.1 3.257 52.267 13.906 77.314c-.175-.088-.355-.164-.53-.25c10.834 28.695-4.215 77.915-32.094 76.375a47 47 0 0 1-4.625-.47c10.87-3.895 19.736-14.11 20.187-31.47c.57-21.935-30.486-31.816-48.688-21.28c1.853-10.077 5.738-19.852 11.125-27.53a60 60 0 0 0 6.188-7.095c.204.627.43 1.27.72 1.906c9.98 22.058 34.89 7.416 25.186-11.405c-4.35-8.457-11.074-10.648-16.686-9.03c3.504-11.767 3.415-24.225.406-35.72c-3.952-15.098-13.013-28.82-26.625-37.03c-7.976-4.812-17.48-7.51-27.844-7.44a62 62 0 0 0-2.092.064c-5.57.233-11.385 1.277-17.313 3.186c-5.246.927-10.17 3.588-14.03 8.438c-23.005 28.896 14.76 74.018 41.967 39.687c8.61-10.862 8.926-21.705 4.813-30.374a35 35 0 0 1 4.844 2.438c8.787 5.3 15.35 14.822 18.217 25.78c2.87 10.96 1.946 23.044-3.312 33.126c-4.384 8.406-11.626 15.654-23.28 20.28c-1.272.41-2.53.853-3.783 1.314c18.878 44.79-9.97 58.624-46.03 37.156c-6.794 10.808-11.198 22.857-13.25 35.47c9.883-4.887 23.666-6.502 41.687-2.595c28.884 6.263 33.747 41 18.75 61.906c.643-2.984 1.033-6.202 1.124-9.686c.48-18.44-18.605-29.432-37-29.156c-17.28.258-33.966 10.457-33.28 33.75c.14 4.844 1.124 9.19 2.748 13.03c-4.827-1.217-9.4-2.263-13.593-3.312c-20.567-5.145-33.424-9.23-50.25-42.22c-11.65-22.837-13.746-44.61-9.657-62.717c.35-1.55.75-3.07 1.187-4.564c.887-2.386 2.22-4.867 4.063-7.437c14.096-19.637 44.76-3.16 29.25 20.936c-1.586 2.468-3.375 4.467-5.282 6.03c10.913-.16 22-6.1 29.69-20.56c13.784-25.93-8.35-51.58-31.5-51.688c-1.84-.01-3.696.173-5.532.5c-3.696-10.15-11.607-14.724-19.125-14.657c-11.395.103-21.84 10.833-15.063 28.814c1.5 3.97 3.765 6.996 6.438 9.187c-15.838 24.13-20.18 58.28-6.22 93.376c-28.655 4.51-48 1-62.25-6.375c-16.074-8.32-26.524-22.114-35.718-38.124s-16.705-33.956-27.813-48.97c-9.438-12.754-22.502-23.363-40.28-26.686v19c10.905 2.694 18.18 9.218 25.28 18.813c9.153 12.37 16.656 29.85 26.594 47.156c9.94 17.305 22.74 34.724 43.376 45.405c19.365 10.023 44.896 13.558 79.28 7.28c17.85 31.407 38.335 40.456 59 45.626c20.14 5.04 40.485 7.83 68.376 28.97c1.97 1.66 3.995 3.258 6.032 4.78c.594.49 1.18.965 1.78 1.47l.095-.094c44.505 32.063 102.997 31.564 138.467-3.906c38.87-38.87 35.765-105.384-6.187-150.844c-26.624-35.576-33.77-66.875-33.156-105.562h-.03c4.428-45.38-13.045-76.668-37.033-95.188c-21.172-16.346-46.585-23.457-67-25.875c1.496-26.37-5.78-52.345-17.717-71.5h-23.22zM88.438 52.688c-3.178 0-6.483.374-9.907 1.188c-5.71 1.356-10.715 4.073-15 7.75c-.027.024-.064.038-.093.063c-2.25 1.463-4.222 3.494-5.75 6.093c-.033.058-.092.1-.124.157c-2.415 4.2-3.617 9.88-2.907 17.063c2.628 26.407 40.834 27.546 39.313-3.875c-.388-8.14-3.673-14.105-8.19-17.813c15.426 4.92 26.523 22.082 16.72 48.063c-10.34 27.408-41.76 29.372-55.47 12.313c5.018 20.444 20.162 35.828 46.44 29.656c14.73-3.46 24.825-11.138 31-20.78c.233 17.556-5.215 34.5-14.782 47.967c-18.347 25.828-50.26 39.48-90.782 19.126v20.375c40.907 16.38 78.436 3.814 100.875-22.155c19.068 10 28.71 30.633 27.782 48.344c-.462 8.83-3.42 16.56-8.75 22.25c1.273-11.394-3.145-22.947-14.906-28.064c-35.92-15.636-71.766 35.453-29.125 53.906c2.805 1.213 5.5 2.042 8.095 2.563v.03c.085.01.165.024.25.033c3.398.657 6.63.743 9.625.375c14.957-.285 27.384-4.945 36.375-12.844c10.904-9.582 16.36-23.27 17.094-37.283c1.275-24.38-11.26-50.987-35.69-64.78c6.762-12.177 10.956-25.986 12.157-40.313a45.4 45.4 0 0 0 15.97 5.656c12.77 1.955 25.603-1.35 36.312-7.844s19.516-16.308 23.75-28.437c3.2-9.173 3.47-19.695-.032-30.064c-3.167-14.78-14.114-27.622-29.438-27.625c-2.21 0-4.495.248-6.875.814c-30.3 7.19-32.07 68.89 1.625 70.062c-7.1 3.967-15.24 5.71-22.53 4.594c-7.578-1.16-14.436-4.948-20.095-13.906c-2.58-13.888-8.185-27.66-17.25-40.344c-7.554-12.997-20.047-22.31-35.688-22.313zm157.156 57.75c-4.71.03-9.694 2.802-13.156 9.532c-9.705 18.82 15.205 33.46 25.187 11.405c5.02-11.105-3.04-20.995-12.03-20.938zm48.437 145.5c-19.927.602-18.62 25.754-.717 27.532c24.093 2.383 23.874-26.494 2.718-27.5a25 25 0 0 0-2-.032z"/>','Lanza una bola de fuego que quema a varios enemigos.'],
  perforante:['<path fill="currentColor" d="M20.91 20.002v32.29l357.793 338.9L20.91 101.407v58.942l355.942 250.224l-86.89-17.527l26.913 30.947l-70.502 3.008l245.633 64.603l-65.502-249.054l-15.352 92.36l-27.3-31.46l16.683 60.464L161.26 20.002h-22.37l142.276 208.935L109.496 42.17l98.975 138.547L45.194 20.002zm433 92.186l-32.234 38.482l55.19 208.21l15.286-217.794l-38.242-28.9zm-231.88 327.89l-24.975 23.47l21.674 27.62l149.225-12.78l-145.926-38.31z"/>','Un disparo que atraviesa a todos los enemigos.'],
  ejecutar:['<path fill="currentColor" d="M316.938 18.406c-16.917.16-35.992 8.394-51.344 23.813c-25.855 25.966-31.416 62.47-12.438 81.53s55.332 13.468 81.188-12.5C360.2 85.282 365.76 48.78 346.78 29.72c-7.71-7.745-18.268-11.422-29.842-11.314M26.125 33.344C68.1 93.84 134.52 136.714 204.188 163.874c.768.296 1.542.584 2.312.876c74.676 28.292 158.988 40.7 228.22 31.875c.072-.013.144-.018.217-.03c73.4-13.258 89.237-60.577-38.562-134.25c163.392 147.973-242.187 125.144-370.25-29zM220.28 189.688a66 66 0 0 0-10.874 7.375c-12.204 10.163-20.78 24.71-26.75 42.187c-10.988 32.16-12.56 73.362-13.375 109.563h40.064l.625 8.656l10.218 136.467h86.687l9.03-136.406l.595-8.717h38.53c1.694-40.387-.062-81.073-12.25-111.594c-3.295-8.256-7.23-15.796-12-22.5c-36.92-4.4-74.495-12.92-110.5-25.032z"/>','Un golpe enorme; si mata, se recarga antes.'],
  luz:['<path fill="currentColor" d="M17.488 17.883V27.1l31.72 13.17c-4.947 16.663-7.873 34.187-8.507 52.275L17.49 89.443v63.428l28.852-3.917a208 208 0 0 0 17.527 47.068l-46.38 19.193v85.652l77.298-60.297a211.3 211.3 0 0 0 36.154 31.762L17.487 419.047v74.812h79.15l80.544-197.33a208 208 0 0 0 45.746 11.35l-24.914 185.98H299.93L275.055 308.18a208 208 0 0 0 46.29-10.948l79.96 196.63h92.16v-58.548L368.043 273.34a211.3 211.3 0 0 0 35.68-30.682l89.742 69.053V221.18l-57.643-23.737a208.2 208.2 0 0 0 17.95-47.15l39.693 5.292v-68.31l-33.748 4.543a209.2 209.2 0 0 0-8.65-52.09l42.398-17.505v-4.338h-112.22l-42.282 32.527c-4.65-8.143-10.22-15.098-16.805-21.683l8.13-10.845H167.655l7.59 9.758c-6.94 6.73-12.477 14.34-17.346 22.767l-41.744-32.527zm416.22 29.012c4.37 15.116 6.913 31.006 7.392 47.43l-88.584 11.925c.04-1.177 0-2.065 0-3.254c0-7.216-.776-14.88-2.168-21.683zM66.57 47.48l78.856 32.747c-1.546 7.146-2.168 15.16-2.168 22.767c0 1.19-.04 2.075 0 3.254L59.31 95.03a190.5 190.5 0 0 1 7.262-47.55zm82.65 87.5c2.51 7.588 5.67 14.977 9.758 21.684l-77.84 32.21a189.5 189.5 0 0 1-16.204-42.446l84.287-11.448zm197.872 1.086l88.07 11.743a189.8 189.8 0 0 1-16.63 42.514l-81.74-33.658c3.9-6.395 7.833-13.4 10.3-20.6zm-171.852 41.74c5.61 5.437 11.178 10.017 17.89 14.096l-50.806 65.703a191.8 191.8 0 0 1-32.846-28.5l65.762-51.298zm144.203.003l69.49 53.47a191.7 191.7 0 0 1-32.296 27.33l-52.915-68.333c5.71-3.65 10.837-7.81 15.72-12.468zm-37.404 22.768l32.274 79.365a190 190 0 0 1-41.74 9.715L261.44 206.54c6.972-.943 14.133-3.712 20.6-5.962zm-66.138 1.084c6.534 2.07 13.58 4.128 20.6 4.88l-11.096 82.825a189.8 189.8 0 0 1-41.18-10.1z"/>','Golpes de luz encadenados que después vuelven y te curan.'],
  sed:['<path fill="currentColor" d="M256 19c-47.103.059-104.37 1.514-134.777 35.078c-19.272 22.051-22.113 59.34-22.141 91.55c-.013 15.25.89 29.319 1.84 40.03c3.42 2.125 6.765 3.998 10.168 5.508c1.906-6.213 4.188-12.19 6.889-17.853a411 411 0 0 1-.897-27.668c.004-4.162.11-8.397.309-12.645H128v-18h-9.143a200 200 0 0 1 2.141-14H144V83h-18.324c2.45-7.015 5.462-12.914 9.101-17.078c30.825-28.62 70.834-28.757 108.229-28.904L256 76l12.994-38.982c36.423.166 84.794 3.054 108.229 28.904c3.639 4.164 6.652 10.063 9.101 17.078H368v18h23.002c.862 4.51 1.573 9.203 2.14 14H384v18h10.61c.197 4.248.304 8.483.308 12.645a411 411 0 0 1-.897 27.667c2.701 5.664 4.983 11.64 6.89 17.854c3.402-1.51 6.748-3.383 10.167-5.508c.95-10.711 1.853-24.78 1.84-40.03c-.028-32.21-2.869-69.499-22.14-91.55C352.365 17.425 303.361 18.985 256 19m-91.682 128.897C132.974 165.035 121 205.545 121 252v48c2.884 29.924 30.052 42.574 48 60.271V444c0 4.935 2.352 9.45 7.75 14.36c20.432 15.936 53.229 24.47 79.21 24.64h.04c28.357-3.426 58.33-5.59 79.395-24.613C340.683 453.505 343 449 343 444v-83.729c18.205-18.5 47.537-34.698 48-60.271v-48c0-46.455-11.974-86.965-43.318-104.104c-11.741-6.42-25.102-6.616-40.256-2.98c-19.464 5.613-35.334 13.104-51.426 21.147c-17.188-7.926-35.068-17.077-51.426-21.147c-13.699-3.296-28.23-3.457-40.256 2.98zm-106.84 34.318c1.809 22.782 8.967 56.005 18.95 82.625c5.798 15.461 12.661 28.809 18.986 36.398c3.162 3.795 6.131 6.012 6.967 5.13c.835-.883.619-3.576.619-6.368v-48c0-14.72 1.138-29.342 3.768-43.207c-9.004-3.482-16.74-8.624-23.76-13.305c-8.927-5.95-16.756-11.044-25.53-13.273m397.043 0c-8.773 2.23-16.602 7.322-25.529 13.273c-7.02 4.68-14.756 9.823-23.76 13.305C407.862 222.658 409 237.281 409 252v48c0 2.792-.216 5.485.62 6.367c.835.883 3.804-1.334 6.966-5.129c6.325-7.59 13.188-20.937 18.986-36.398c9.983-26.62 17.141-59.842 18.95-82.625zM176 207.27l70.363 70.366l-10.32 10.32C238.517 292.391 240 296.565 240 300h-96c0-16 16-48 48-48c1.182 0 2.46.194 3.797.523L176 232.727l-25.637 25.636l-12.726-12.726zM192 300c8.837 0 16-7.163 16-16s-7.163-16-16-16s-16 7.163-16 16s7.163 16 16 16m144-92.729l38.363 38.366l-12.726 12.726L336 232.727l-19.797 19.796c1.337-.33 2.615-.523 3.797-.523c32 0 48 32 48 48h-96c0-3.435 1.483-7.609 3.957-12.043l-10.32-10.32zM320 300c8.837 0 16-7.163 16-16s-7.163-16-16-16s-16 7.163-16 16s7.163 16 16 16m-203.393 36.496c-28.117 11.146-58.94 25.26-93.828 42.373c39.48 16.026 70 37.572 90.092 61.317c14.463 17.092 23.58 35.612 26.248 53.814h70.611c-16.114-4.813-33.438-11.931-45.091-22.324C156.82 464.566 151 455.065 151 444v-76.002c-12.82-11.535-24.674-19.302-34.393-31.502m278.786 0c-9.543 12.279-23.267 21.558-34.393 31.502V444c0 11-5.683 20.495-13.395 27.613c-14.023 11.575-28.946 17.825-44.95 22.387h70.226c2.667-18.202 11.785-36.722 26.248-53.814c20.092-23.745 50.613-45.29 90.092-61.317c-34.889-17.114-65.71-31.227-93.828-42.373m-165.784 4.467c7.613 4.7 16.541 13.529 26.391 14.037c10.283-2.687 17.928-7.524 26.39-14.037l11.22 14.074C282.997 362.708 267.95 372.778 256 373c-14.83-1.544-26.226-9.059-37.61-17.963zm-31.293 48.625L211.93 403h88.433l13.25-13.342l12.774 12.684L307.855 421H301l-13 39l-13-39h-38l-13 39l-13-39h-6.447l-18.87-18.588z"/>','Sacrificas vida a cambio de un escudo y robo de vida.'],
  combustion:['<path fill="currentColor" d="M312.344 16.813c5.096 53.015-76.687 71.94 3.812 131c-21.002-67.855 39.96-80.94-3.812-131m-173.47 43.124c2.864 58.907-7.995 100.984-34.093 136.97l-.5.28c1.42-28.968-14.337-52.78-32.093-75.906c2.882 39.21-3.964 78.4-20.156 117.564c-20.79 23.86-32.718 51.704-32.718 81.437c0 88.458 105.59 160.158 235.875 160.158s235.907-71.7 235.907-160.157c0-10.08-1.377-19.935-4-29.5c-6.37-30.335-7.76-49.572-.313-59.155c12.078-15.54 11.654-39.39-2.405-62.406c-7.558 48.062-39.085 30.124-63.063-53.72c-27.96 94.983-72.27-4.392-58.406-53.156c-26.26 21.598-29.623 69.962-28.22 107.125a317 317 0 0 0-17.436-3.75c-44.64-15.223-78.633-56.624-62.375-86.814c-22.038 10.264-24.77 32.17-16.375 57.22c19.214 57.337-56.703-10.13-53.72-56.064l-17.093 72.688c-.154-34.474-5.844-73.924-28.812-92.813zM255.19 197c109.056 0 197.468 60.017 197.468 134.063c0 22.193-7.938 43.127-22 61.562c-15.436 6.877-24-22.344-25.53-41.47c-16.12 20.592-.576 58.922-17.407 75.064c-2.128-10.244-11.962-22.962-25.345-30.75c2.11 22.203-4.025 43.33-29.72 58.936c-31.15 5.69-44.428-28.71-49.56-54.22c-4.033 33.512-16.028 58.988-49.97 64.095a285 285 0 0 1-12.094-1.155c-30.51-18.392-20.632-49.433-24.25-78.594c-2.93 29.505-24.438 65.4-39 56.158c-25.677-16.295 10.893-33.548-9.53-63.657c-2.415 30.193-21.75 31.483-42.03 29.876c.94-14.196 1.723-28.353-2.75-41.25c-9.138 7.68-18.04 15.838-34.564 9.938c-7.223-13.934-11.156-28.92-11.156-44.53C57.75 257.017 146.13 197 255.188 197z"/>','Tus quemaduras hacen más daño y saltan a otros enemigos.'],
  rapido:['<path fill="currentColor" d="m257.313 15.688l-50.375 87.53l28.156-8.53l22.28-38.72l22.407 38.782l28.126 8.47zm-138.938 77.75l18.5 99.28l14.156-22.093L141.595 120l48.97 17.313l23.124-10.157l-95.313-33.72zm278.72 0l-95.314 33.718l23.876 10.5L375.562 120l-9.812 52.688l12.844 20.03l18.5-99.28zm-139.72 2.03l-9.344 2.844v104.47l9.69 11.343l9-10.5V98.28l-9.345-2.81zm81.22 52.032l-54.345 63.688l.344.28l-14.563 17l12.033 14.063l71.093-83.343l-4.75-7.375zm-161.25.53l-8.595 3.782l-5.47 8.532l255.5 299.469L433 447.688l-8.094-9.47l22.688-10.03l11.47-5.063l-8.158-9.53l-44.125-51.783l-2.31-2.718l-3.564-.47l-49.562-6.655l-174-203.94zm56.06 123.22l-62.218 72.688l-.125-.094l-6.625 7.75l-49.718 6.687l-3.564.47l-2.312 2.72l-44.28 51.936l-8.158 9.563l11.5 5.06l22.75 10.064l-8.187 9.594l14.218 12.156L245.594 285.28l-12.188-14.03zm24.376 28.125l-9.75 11.28v178.75h18.69v-15.092l24.874 7.437l12.03 3.594v-87l-2.374-2.656l-34.53-38.47v-47.5zm-111.5 73.5l-42.936 50.375L86.906 416l33.844-39.688l25.53-3.437zm223.22.375l25.406 3.438l33.656 39.468l-16.312 7.22zm-140.03 4.375l-16.064 18.094l-2.344 2.655v87.031l12.063-3.656l6.344-1.906v-102.22zm37.25 7.563l18.217 20.312v54.75l-18.218-5.438v-69.625zm-87.75 5.406l-64.564 74.687l3.5 5.44l6.813 10.592l8.155-9.593l44.28-51.94l2.314-2.686l-.064-3.563l-.437-22.936zm157.905.156l-.438 22.97l-.093 3.53l2.312 2.72l44.125 51.75l8.19 9.592l6.78-10.625l3.53-5.5z"/>','Atacas mucho más rápido durante un rato.'],
  clon:['<path fill="currentColor" d="M250.322 18.494c-25.06 3.26-47.158 32.267-47.158 69.346c0 20.453 7.06 38.57 17.502 51.166l10.123 12.213l-15.59 2.932c-13.676 2.574-23.794 9.896-32.272 21.547c-8.48 11.65-14.86 27.7-19.326 46.095c-8.23 33.9-9.916 75.216-10.143 111.275h44.007l11.883 159.512h96.37l10.514-159.512h41.88c-.013-36.448-.353-78.316-7.81-112.48c-4.042-18.524-10.176-34.575-18.777-46.12c-8.6-11.543-19.21-18.81-34.482-21.18l-15.912-2.468l10.037-12.59c9.99-12.533 16.7-30.436 16.7-50.392c0-39.537-24.776-69.268-52.352-69.268c-2.915 0-4.754-.135-5.196-.078zm178.608 1.078c-31.872-.534-61.166 26.473-71.084 63.49c-4.575 17.073-4.83 35.29-.817 51.108c-10.96 1.307-20.99 5.173-29.772 10.996c5.563 3.58 10.537 7.906 14.906 12.814c7.998-4.296 16.716-6.28 27.084-5.492l15.816 1.2l-6.615-14.415c-5.86-12.764-7.33-33.55-2.554-51.377c8.122-30.308 31.484-49.75 52.75-49.61q2.126.011 4.22.29l.01.002c.263.037 1.817.567 4.44 1.27c23.73 6.36 38.404 37.853 29.168 72.324c-4.66 17.392-15.965 34.567-27.02 42.73l-12.954 9.565l14.73 6.502c13.063 5.765 20.835 13.86 25.885 24.348s7.12 23.674 6.846 38.674c-.5 27.368-8.862 60.148-17.2 91.362l-36.864-9.88l-51.232 153.712l-42.69.11l-1.23 18.69l57.402-.146l49.914-149.758l37.946 10.166l2.42-9.025c9.022-33.677 19.603-71.135 20.22-104.89c.31-16.876-1.89-32.994-8.693-47.124c-5.016-10.417-12.696-19.57-23.065-26.622c10.814-11.607 19.228-27.125 23.637-43.58c11.288-42.13-6.228-85.52-42.38-95.21l-.003-.003c-1.106-.296-3.297-1.274-6.81-1.744h-.008l-2.838-.38l-.295.146c-1.09-.082-2.185-.226-3.27-.244zm-349.32.46c-4.49.056-9.02.665-13.538 1.876c-.095.026-.327.068-.44.094l-.575-.574l-5.76 2.377h-.002C27.32 36.99 13.11 77.635 23.69 117.12c4.574 17.073 13.46 32.977 24.845 44.67c-9.328 6.978-16.34 15.908-21.053 25.99c-6.507 13.924-8.973 29.83-9.11 46.6c-.27 33.543 8.753 71.01 17.82 104.845l2.42 9.027l40.02-10.727l51.11 149.454l60.46.153l-1.39-18.694l-45.7-.116l-52.446-153.37l-38.73 10.378c-8.028-30.892-15.098-63.467-14.875-90.8c.122-14.997 2.417-28.276 7.354-38.84c4.937-10.56 12.24-18.566 23.865-24.15l14.298-6.87l-12.94-9.176c-11.456-8.122-23.12-25.39-27.896-43.215c-8.66-32.315 3.867-62.596 24.653-71.188l.025-.01c.244-.1 1.86-.42 4.486-1.12h.002l.002-.003a34.7 34.7 0 0 1 9.072-1.175c21.47.027 44.263 19.06 52.344 49.223c4.66 17.392 3.46 37.92-2.035 50.517l-6.436 14.76l16.01-1.734c13.355-1.447 23.684 1.234 32.868 7.016c4.285-4.866 9.108-9.17 14.46-12.742a78 78 0 0 0-2.212-1.572c-9.55-6.512-20.777-10.598-33.283-11.522c3.562-15.46 3.09-33.105-1.318-49.56c-9.878-36.864-39.338-63.538-70.77-63.14z"/>','Un clon de sombra copia tus golpes durante un rato.'],
  juicio:['<path fill="currentColor" d="M257.47 23.406c-66.354 0-120.158 53.415-120.158 119.313c0 18.87 4.427 36.7 12.282 52.56h-.094l1.938 3.564c.212.395.408.795.625 1.187l45.343 84.19l-89.53-47.595v214.5l61.343-32.625l77.405-162.125c-17.123-32.793-48.563-96.2-48.563-119.938c0-32.592 26.59-59 59.407-59s59.436 26.41 59.436 59c0 30.663-51.987 126.665-58.22 138.063L196.97 403.78l.436-.25l-2.906 5.376l-39.875 83.563h210.813l-47.907-88.94l89.564 47.595v-214.5l-61.688 32.78l-96.594 166.658h41.907v18.687h-74.346l8.126-14.03l122.72-211.626l15.874-29.5l2.344-4.313h-.094c7.85-15.86 12.25-33.694 12.25-52.56c0-65.896-53.772-119.314-120.125-119.314zm0 72.78c-22.19 0-39.908 17.658-39.908 39.595c0 21.94 17.717 39.564 39.907 39.564s39.936-17.625 39.936-39.563c0-21.936-17.747-39.593-39.937-39.593z"/>','Un aura que te cura y quema a los enemigos cercanos.'],
  baluarte:['<path fill="currentColor" d="M71.604 21.99v111.12l61.156 75.814v188.654H93.408l-28.7 92.836h151.1l-6.103-92.613h.043l-1.17-119.35l-18.687.185l.848 86.545h-22.92c-13.43-71.44 4.462-150.097 60.967-158.86c-9.133-11.458-15.006-27.38-15.006-45.02c0-34.844 22.177-62.962 49.413-62.962c1.703 0 3.466-.262 5.123 0h.002c24.873 3.23 44.29 30.293 44.29 62.96c0 18.09-6.196 34.244-15.74 45.755c51.727 9.73 76.564 84.763 61.333 158.127h-24.616l.85-86.545l-18.688-.184l-1.115 113.64l-7.323 98.324h146.54l-28.702-92.836H385.79V208.924l61.155-75.813V21.99H382.52v52.414h-39.213V21.99h-65.123v52.414H239.67V21.99h-65.125v52.414h-38.512V21.99h-64.43zm180.652 326.62v142.245h18.69V348.61z"/>','Más defensa y devuelves parte del daño que recibes.'],
  armaduraHielo:['<path fill="currentColor" d="M259.303 23.195C191.17 23.188 122.745 33.57 54.896 54.732l-6.12 2.825l-.303 6.52c0 95.313 9.696 178.568 40.297 249.96s82.32 130.185 165.277 174.62l4.672 2.337l4.087-2.336C343.87 445.236 396.29 386.753 427.5 315.205c31.21-71.547 41.465-155.484 41.465-251.13V57.07l-6.424-2.336c-67.16-21.138-135.104-31.53-203.237-31.537zm0 18.69c63.658.006 127.43 10.16 190.388 29.2c-.554 91.083-10.827 170.314-39.71 236.528c-29.03 66.545-76.342 120.412-151.26 161.772c-77.04-42.382-124.524-95.885-153.015-162.356c-28.282-65.985-37.458-145.078-37.96-235.944c63.81-19.192 127.7-29.208 191.558-29.2zm2.385 38.52l-55.875 32.44l30.125 52.218a67.4 67.4 0 0 0-15.844 9.187l-30.125-52.188l-55.782 32.376v63.812h60.53a68 68 0 0 0-.655 9.313c0 3.177.232 6.305.656 9.375h-60.532V301.5l55.718 32.344l30.313-52.5a67.4 67.4 0 0 0 15.78 9.28l-30.25 52.438l55.938 32.47l55.906-32.376l-30.344-52.53a67.5 67.5 0 0 0 15.78-9.313L333.44 334l55.25-32v-65.063H328.5c.424-3.07.656-6.197.656-9.375c0-3.156-.237-6.27-.656-9.312h60.188v-64.344l-55.313-32l-30.22 52.375a67.5 67.5 0 0 0-15.842-9.218l30.218-52.343l-55.842-32.314zm-.094 97.97c27.22 0 49.22 21.964 49.22 49.188c-.002 27.224-21.996 49.187-49.22 49.187s-49.188-21.966-49.188-49.188c0-27.22 21.967-49.187 49.188-49.187"/>','Esquirlas de hielo a todos; quien te golpea recibe más.'],
  marca:['<path fill="currentColor" d="M107.563 21.406c122.47 187.613 107.72 216.17-74.97 55.813c83.344 103.73 183.05 185.66 287.876 260.75c-47.685 54.762-65.51 116.2-39.283 141.374c27.95 26.827 95.317 2.292 150.25-54.938s76.668-125.547 48.72-152.375c-26.4-25.338-87.652-4.57-140.657 46.033C267.523 213.846 194.602 110.56 107.562 21.406zm324.906 266.781c9.865-.14 18.234 2.508 24.25 8.282c21.386 20.528 4.908 72.768-37.126 116.56c-42.035 43.794-93.957 62.81-115.344 42.283c-19.952-19.15-6.325-65.992 29.72-107.75c3.706 2.625 7.405 5.264 11.124 7.875c-26.5 31.075-36.24 65.542-21.406 79.78c16.03 15.39 54.65 1.294 86.156-31.53c31.507-32.825 44-71.99 27.97-87.375c-15.205-14.592-50.578-2.533-81.064 26.75c-2.594-3.763-5.187-7.52-7.78-11.282c28.526-27.297 60.18-43.263 83.5-43.592zm-22.033 37.375c5.66-.08 10.457 1.44 13.907 4.75c12.267 11.774 2.827 41.758-21.28 66.875c-24.11 25.118-53.89 36.024-66.158 24.25c-11.245-10.793-3.876-36.93 16-60.562c5.976 4.173 11.97 8.327 17.97 12.47c-9.746 11-14.027 22.66-9.563 27.124c4.904 4.903 18.483-.735 30.343-12.595s17.498-25.47 12.594-30.375c-4.778-4.778-17.8.476-29.438 11.72q-6.316-9.138-12.625-18.283c16.46-15.875 34.774-25.184 48.25-25.375z"/>','Marcas a un enemigo y recibe más daño.'],
  nube:['<path fill="currentColor" d="M256 106c-33.81 0-61.887 22.69-71.25 53.438C174.532 154.22 163.258 151 151 151c-41.42 0-75 33.58-75 75c0 1.784.346 3.405.468 5.157C41.284 243.387 16 276.65 16 316c0 49.706 40.294 90 90 90h300c49.706 0 90-40.294 90-90c0-39.35-25.284-72.614-60.468-84.843c.123-1.752.468-3.374.468-5.157c0-41.42-33.58-75-75-75c-12.258 0-23.532 3.222-33.75 8.437C317.887 128.69 289.81 106 256 106m-60 90l60 60l60-60l30 30l-60 60l60 60l-30 30l-60-60l-60 60l-30-30l60-60l-60-60z"/>','Una nube tóxica que envenena a todos los enemigos.'],
  sacrificio:['<path fill="currentColor" d="M227.438 18.594L207.313 87.97c-51.705 15-93.266 51.876-115.188 99.06l-73.406 9.814l58 43.094c-1.834 13.845-2.095 28.103-.626 42.593a182.9 182.9 0 0 0 13.5 52.845l-33.563 63.22l62.69-15.97a185 185 0 0 0 34.155 31.22l4.063 72l44.656-47.5a183 183 0 0 0 10.687 3.155v51.094h18.69v-47.25c9.448 1.436 19.105 2.11 28.905 2.03v45.22h18.688V446.28c16.735-1.836 32.71-5.878 47.656-11.81l48.31 30.5l1.814 2.186v25.438h18.687V460.5l-2.092-2.563l-12.594-15.437l-8.47-34.344a184.6 184.6 0 0 0 47.813-56.687l67.438 2.655l-49.313-51.406c3.958-18.31 5.146-37.53 3.157-57.158c-1.816-17.9-6.148-34.947-12.626-50.812l.75 1.063l45.094-59.063l-73.094 12.03c-33.67-41.52-84.87-67.627-140.97-68.06l-32.687-62.126zm31.343 80.78c18.82 0 37.02 3.223 54.033 9.157l4.625 40.595l34.187-20.97c38.577 26.43 65.657 69.033 70.75 119.282c.18 1.775.346 3.546.47 5.313l-48.283 16.125l45.188 29.03c-8.816 42.143-33.876 78.896-68.97 102.626V235.75c1.017-6.205 1.21-12.552.408-19.03c-7.203-58.14-80.477-59.517-100.844-6.75c-36.378-45.1-100.77-19.982-93.656 37.186c3.574 28.718 29.094 49.678 55.593 67.22v107.78C157.405 406.133 113.557 362.12 99 305l29.72-24.97l-34.814-21.405c.983-31.41 10.888-60.917 27.47-85.813l41.31 3.782l-15.81-33.625c25.302-23.35 58.116-39.006 95.06-42.75a167 167 0 0 1 16.845-.845m73.314 178.94v133.123c-16.367 8.158-34.377 13.722-53.53 16.063l-.002-79.063c10.236-20.103 35.553-43.51 53.532-70.125zM230.97 326.31c10.877 6.818 21.026 13.216 28.905 19.5v82.907a164.7 164.7 0 0 1-28.906-2.283V326.313z"/>','Sacrificas vida para golpear más fuerte a los jefes.'],
};
// habilidades de la Torre (cartas): usan el dibujo de una parecida y su texto
{ const A={tGolpe:'ejecutar',tMuro:'muro',tSangria:'sacrificio',tTorbellino:'perforante',tBaluarte:'baluarte',tSed:'sed',tLluvia:'rapido',tFestin:'marca'};
  for(const k in A) if(SKI[A[k]]&&CFG.tower.cards[k]) SKI[k]=[SKI[A[k]][0],CFG.tower.cards[k].desc]; }
const skIcon=id=>`<svg class="ski" viewBox="0 0 512 512" width="30" height="30" fill="currentColor" aria-hidden="true">${(SKI[id]||['<circle cx="256" cy="256" r="120"/>'])[0]}</svg>`;   // iconos de game-icons.net (CC BY 3.0)
const skTip=x=>`<b>${esc(x.name||'')}</b><br>${(SKI[x.id]||[0,esc(x.desc||'')])[1]}`;

// números de daño: suben sin parar; si llega otro golpe al mismo objetivo en menos de 0,3 s se suma al último número (no se amontonan)
function pushFloat(f){ const last=fx.floats.filter(o=>(f.hero?o.hero:o.e===f.e)&&!o.crit===!f.crit&&o.v!=null&&f.v!=null).pop();
  if(last&&last.max-last.life<0.3){ last.v+=f.v; last.txt=(f.hero?'-':'')+fmt(last.v); return }
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
const MATI='<svg class="ic" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1l5 5-5 9-5-9z" fill="#c86bff"/><path d="M8 1l2 5-2 9-2-9z" fill="#fff5"/></svg>';
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
// Torre: al conseguir un grimorio AL AZAR (cofre, altar), en medio de la pantalla «Obtenido» con su nombre y qué hace (se encolan si son varios)
const gotQ=[]; let gotOn=false;
function gotShow(){ if(gotOn||!gotQ.length) return; gotOn=true; const b=gotQ.shift(), f=G.boonInfo(b), c=RARC[f.r], el=document.createElement('div');
  el.className='gotpop'; el.style.borderColor=c; el.innerHTML=`<span class="s">Obtenido</span><b style="color:${c}">${FAMI[f.fam]||''} ${esc(f.name)}</b><span class="pill" style="color:${c}">${f.kind}</span><p>${esc(f.desc)}</p>`;
  const done=()=>{ if(!el.parentNode) return; el.classList.add('out'); setTimeout(()=>{ el.remove(); gotOn=false; gotShow() },250) };
  el.addEventListener('click',done); document.body.appendChild(el); haptic('ok'); setTimeout(done,2600) }
G.on('towerGot',b=>{ gotQ.push(b); gotShow() });
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
// iconos rellenos de game-icons.net (CC BY 3.0)
const GI={campana:'<path fill="currentColor" d="M254.25 15.344c-132.537 0-240.188 107.62-240.188 240.156c0 132.537 107.65 240.188 240.188 240.188S494.406 388.038 494.406 255.5S386.786 15.344 254.25 15.344m0 18.687c122.436 0 221.47 99.034 221.47 221.47c0 65.65-28.465 124.583-73.75 165.125V238.75l14-22.78h-7.595L364 101.5l-43.813 114.47h-8.156l14.595 22.78v33.875h-36.813v-88.188l14.625-22.78h-7.593l-44.406-114.47l-44.375 114.47h-7.594l14.03 22.78v123.22h-37.375v-18.094l14.594-22.782h-8.19l-43.78-114.467L95.344 266.78H87.75l14.03 22.783V416.25C59.25 375.9 32.75 318.83 32.75 255.5c0-122.436 99.064-221.47 221.5-221.47zm1.094 160.532h18.687v36.344h-18.686v-36.344zm110.156 87.97h18.688v36.312H365.5V282.53zm-246.656 22.03h18.687v36.344h-18.686v-36.344zm50.875 29.407h18.686v36.342H169.72V333.97zm170.81 30.5h18.69v36.342h-18.69z"/>',eventos:'<path fill="currentColor" d="m193.571 26.027l35.192 83.99c14.877 7.658 33.121 6.696 47.488-1.279l40.283-85.976c-45.582-7.268-84.512-4.945-122.963 3.265m137.3 7.606l-32.038 71.38c12.536 12.349 37.237 18.872 47.033 15.448l31.172-64.691c-12.422-8.392-27.428-15.886-46.168-22.137zm-154.86-1.97c-21.814 6.55-40.982 16.35-56.099 28.591c14.941 15.844 28.861 34.184 38.194 52.832c24.477 6.133 35.479-6.849 47.475-18.55zm-74.245 34.831c-36.541 32.91-66.523 76.42-78.068 125.215l65.957 3.353c12.006-30.53 24.552-56.284 54.231-72.755c-9.883-20.24-23.626-39.403-42.12-55.813m292.503-.29l-31.852 61.044c32.54 21.007 43.572 41.348 52.597 69l72.464-8.43c-9.612-55.894-42.206-107.047-93.209-121.614m-52.233 137.2c4.757 12.937-15.842 29.7-9.07 39.428c-4.011.85-8.874 1.642-14.385-8.957c-1.126 12.49 2.172 19.603 12.168 29.209c-2.682.783-8.045 2.75-12.08.566c-1.24 7.386 10.867 13.863 20.725 14.832l8.392-2.175c-6.09-1.106-7.881-3.315-10.627-6.13c2.97-1.32 12.554-7.117 2.149-14.751c12.634-2.752 6.035-14.89 4.14-21.862c7.525 7.798 15.243 22.54 21.862 7.084c4.176 12.604 6.561 12.12 13.614 9.107c1.054 9.196-2.957 14.791-8.792 22.518l12.494-4.992c6.018-5.026 20.16-25.502 6.428-35.5c2.603 12.443-5.563 14.388-18.672-10.937c-4.377 30.773-12.236-7.49-28.346-17.44m-321.668 2.108v66.242l72.842-11.858l1.592-49.873zm143.486.363c3.732 8.72-14.487 45.226-18.865 14.453c-13.109 25.325-23.908 24.26-21.304 11.817c-13.732 9.998-1.347 33.458 4.671 38.484l11.229 3.001c-5.835-7.727-11.565-13.614-10.512-22.81c7.053 3.013 10.492 5.604 14.668-7c6.618 15.456 17.32-4.378 24.846-12.175c-1.554 11.494-6.282 22.427 7.303 25.197c-9.13 10.082 1.899 19.99-12.694 22.812l8.393 2.176c9.857-.97 20.385-10.606 19.144-17.992c-4.035 2.183-7.818 3.376-10.5 2.594c9.996-9.607 10.662-21.46 9.536-33.95c-5.511 10.6-7.917 11.738-11.752 13.698c6.77-9.728-5.927-32.285-14.163-40.305m327.512 1.172l-77.57 5.687l1.156 79.192l75.524 2.842zM98.313 279.81l-79.955 9.779l1.202 99.754l83.54 1.152zm280.659 7.347l-28.332 7.031l21.455 68.315l16.125-5.043zm-246.961 3.348l-9.248 70.303l16.125 5.043l21.455-68.315zM412.269 310.3v83.58l79.166-8.031l2.289-75.55zm84.605 91.656l-88.934 9.947l-1.16 80.727l90.674.586zm-395.822 2.002l-81.848 2.322l-4.658 86.184h90z"/>',torre:'<path fill="currentColor" d="M71 22.406v102.53h202.25v18.69h-73.22v36.968h-18.686v-36.97H79.156l43.375 53.782h180.44v18.688H180.905v36.97H162.22v-36.97h-39.407v163.562h58.53v-44.75H157.47V316.22h74.155v-33.66H193.72v-18.687h97.218v18.688h-40.625v33.656h73.28v18.686h-32.437v44.75h26.313v18.688h-63.69l-2.686 74.03l-18.688-.687l2.656-73.343H93.032V398h-.22l-28.687 92.844h79.844l9.81-70.688l18.5 2.563l-9.468 68.124H453.25L424.562 398h-30.03V197.78l51.812-64.25V22.407h-64.406v52.438h-39.22V22.406h-65.124v52.438h-38.53V22.406h-65.126v52.438h-38.5V22.406zm129.03 312.5v44.75h72.44v-44.75z"/>',pvp:'<path fill="currentColor" d="m311.313 25.625l-23 10.656l-29.532 123.032l60.814-111.968l-8.28-21.72zM59.625 50.03c11.448 76.937 48.43 141.423 100.188 195.75a3267 3267 0 0 0 42.718-29.405c-22.156-27.314-37.85-56.204-43.593-86.28c-34.214-26.492-67.613-53.376-99.312-80.064zm390.47.032C419.178 76.1 386.64 102.33 353.31 128.22c-10.333 58.234-58.087 112.074-118.218 158.624c-65.433 50.654-146.56 92.934-215.28 121.406l-.002 32.78c93.65-34.132 195.55-81.378 276.875-146.592c79.035-63.378 138.329-143.063 153.41-244.375zm-236.158 9.344l-8.5 27.813l40.688 73.06l-6.875-85.31l-25.313-15.564zm114.688 87.813C223.39 227.47 112.257 302.862 19.812 355.905V388c65.917-27.914 142.58-68.51 203.844-115.938c49.83-38.574 88.822-81.513 104.97-124.843zm-144.563 2.155c7.35 18.89 19.03 37.68 34 56.063c7.03-4.98 14.056-10.03 21.094-15.094c-18.444-13.456-36.863-27.12-55.094-40.97zM352.656 269.72c-9.573 9.472-19.58 18.588-29.906 27.405c54.914 37.294 117.228 69.156 171.906 92.156V358.19c-43.86-24.988-92.103-55.13-142-88.47m-44.906 39.81c-11.65 9.32-23.696 18.253-36.03 26.845c70.326 45.135 149.33 79.775 222.935 106.375v-33.22c-58.858-24.223-127.1-58.727-186.906-100zm-58.625 52.033l-46.188 78.25l7.813 23.593l27.75-11.344zm15.844.812L316.343 467l36.47 10.28l-3.533-31.967z"/>'};
const GIC=(d,sz=22)=>`<svg class="ico" viewBox="0 0 512 512" width="${sz}" height="${sz}" fill="currentColor" aria-hidden="true">${d}</svg>`;
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
  <div class="top"><span class="av" id="avatar" aria-hidden="true"></span><div class="uname" id="uName"></div>
    <div class="res"><span title="Oro" aria-label="Oro">${ICON.gold}<b id="rGold"></b></span>
    <span title="Tokens (comprados + ganados)" aria-label="Tokens">${ICON.tok}<b id="rTok"></b></span>
    <span title="Chatarra" aria-label="Chatarra">${ICON.scrap}<b id="rScrap"></b></span></div></div>
  <div id="battle" class="battle">
  <div class="hero"><div id="evoSlot"></div>
    <div class="hbar"><span>HP</span><div class="bar"><i id="hpBar"></i></div><b id="hpTxt"></b></div><div class="hbar" id="xpRow"><span id="xpLbl">XP</span><div class="bar xp"><i id="xpBar"></i></div><b id="xpTxt"></b></div>
    </div>
  <div class="stage"><canvas id="cv" width="600" height="220"></canvas><div class="tag" id="tag"></div><span class="fasetxt" id="faseTxt"></span><span class="foetxt" id="foeTxt" hidden></span><span class="foetxt cur" id="curseTxt" hidden></span><div class="skbar" id="skBar"></div><div class="sktip" id="skTip" hidden></div><div id="skMode"></div><div class="sidebtns"><button class="calbtn" id="dailyBtn" data-act="dailyOpen" aria-label="Premios diarios" title="Premios diarios"><svg viewBox="0 0 512 512" width="22" height="22" fill="currentColor"><path fill="currentColor" d="M149.518 78.38c-6.55.117-12.45 1.736-17.35 4.91c-7.465 4.84-11.765 12.904-13.063 21.34c-2.595 16.874 4.747 36.355 19.862 52.31C154.08 172.893 177.643 185 208 185h2.438l-9.118-18.234c-22.194-1.554-38.46-10.777-49.287-22.205c-11.885-12.545-16.543-28.064-15.138-37.19c.702-4.564 2.402-7.25 5.062-8.974s7.113-2.875 14.756-1.326c13.078 2.65 34.233 13.948 62.205 39.284L220.27 135h23.408c-35.31-34.8-62.215-51.278-83.39-55.57a52 52 0 0 0-7.925-1.006q-1.441-.068-2.845-.043zm212.964 0q-1.404-.023-2.845.044c-2.562.12-5.21.455-7.924 1.006c-21.176 4.292-48.082 20.77-83.39 55.57h23.406l1.352 1.354c27.972-25.336 49.127-36.633 62.205-39.284c7.643-1.55 12.096-.398 14.756 1.326s4.36 4.41 5.062 8.973c1.405 9.126-3.253 24.645-15.138 37.19c-10.827 11.43-27.093 20.652-49.287 22.206L301.562 185H304c30.357 0 53.92-12.106 69.033-28.06c15.115-15.955 22.457-35.436 19.862-52.31c-1.298-8.436-5.598-16.5-13.063-21.34c-4.9-3.174-10.8-4.793-17.35-4.91M227.73 153l-8.78 8.777L229.564 183h52.875l10.61-21.223l-8.777-8.777h-56.54zM73 201v46h142v-46zm160 0v270h46V201zm64 0v46h142v-46zm-192 64v206h110V265zm192 0v206h110V265z"/></svg><i class="lootn" id="dailyN" hidden>!</i></button><button class="calbtn boostbtn" id="boostBtn" data-act="boostOpen" aria-label="Potenciadores" title="Potenciadores"><svg viewBox="0 0 512 512" width="22" height="22" fill="currentColor"><path fill="currentColor" d="M20.72 19.34v39.72L151.6 132.9l94.9-45.12L151 19.34zm196.98.1L313 76.78C226.5 118 135.1 161.4 57.53 198.3l161.57 86.1l59.6-39.2l-39.4-34.9c82.3-40.6 168.3-83.5 241.8-119.93l-93.6-70.93zM361.9 170.5l-76.5 37.9l44.9 25.3c-54.2 35.6-111.8 73.6-160.6 105.7l325.2 154.8L307.5 347c57.6-32.3 117.5-65.9 168.8-94.6zm13.2 160.1l-33.9 18.9l139.3 74.3c-35.1-31.1-70.3-62.2-105.4-93.2"/></svg></button></div><button class="calbtn grimcorner" id="grimBtn" data-act="grimOpen" aria-label="Grimorio" title="Grimorio" hidden><svg viewBox="0 0 512 512" width="22" height="22" fill="currentColor"><path fill="currentColor" d="M319.61 20.654c13.145 33.114 13.144 33.115-5.46 63.5c33.114-13.145 33.116-13.146 63.5 5.457c-13.145-33.114-13.146-33.113 5.457-63.498c-33.114 13.146-33.113 13.145-63.498-5.459zM113.024 38.021c-11.808 21.04-11.808 21.04-35.724 24.217c21.04 11.809 21.04 11.808 24.217 35.725c11.808-21.04 11.808-21.04 35.724-24.217c-21.04-11.808-21.04-11.808-24.217-35.725m76.55 56.184c-.952 50.588-.95 50.588-41.991 80.18c50.587.95 50.588.95 80.18 41.99c.95-50.588.95-50.588 41.99-80.18c-50.588-.95-50.588-.95-80.18-41.99zm191.177 55.885c-.046 24.127-.048 24.125-19.377 38.564c24.127.047 24.127.046 38.566 19.375c.047-24.126.046-24.125 19.375-38.564c-24.126-.047-24.125-.046-38.564-19.375m-184.086 83.88a96 96 0 0 0-3.492.134c-18.591 1.064-41.868 8.416-77.445 22.556L76.012 433.582c78.487-20.734 132.97-21.909 170.99-4.615V247.71c-18.076-8.813-31.79-13.399-46.707-13.737a91 91 0 0 0-3.629-.002zm122.686 11.42a209 209 0 0 0-8.514.098c-12.81.417-27.638 2.215-45.84 4.522v177.135c43.565-7.825 106.85-4.2 171.244 7.566l-39.78-177.197c-35.904-8.37-56.589-11.91-77.11-12.123zm2.289 16.95c18.889.204 36.852 2.768 53.707 5.02l4.437 16.523c-23.78-3.75-65.966-4.906-92.467-.98l-.636-17.805c11.959-2.154 23.625-2.88 34.959-2.758m-250.483 4.658L60.54 313.002h24.094l10.326-46.004H71.158zm345.881 0l39.742 177.031l2.239 9.973l22.591-.152l-40.855-186.852zm-78.857 57.82c16.993.026 33.67.791 49.146 2.223l3.524 17.174c-32.645-3.08-72.58-2.889-102.995 0l-.709-17.174c16.733-1.533 34.04-2.248 51.034-2.223m-281.793 6.18l-6.924 30.004h24.394l6.735-30.004H56.389zm274.418 27.244c4.656.021 9.487.085 14.716.203l2.555 17.498c-19.97-.471-47.115.56-59.728 1.05l-.7-17.985c16.803-.493 29.189-.828 43.157-.766m41.476.447c8.268.042 16.697.334 24.121.069l2.58 17.74c-8.653-.312-24.87-.83-32.064-.502l-2.807-17.234a257 257 0 0 1 8.17-.073m-326.97 20.309l-17.985 77.928l25.035-.17l17.455-77.758H45.313zm303.164 11.848c19.608-.01 38.66.774 56.449 2.572l2.996 20.787c-34.305-4.244-85.755-7.697-119.1-3.244l-.14-17.922c20.02-1.379 40.186-2.183 59.795-2.193m-166.606 44.05c-30.112.09-67.916 6.25-115.408 19.76l-7.22 2.053l187.759-1.27v-6.347c-16.236-9.206-37.42-14.278-65.13-14.196zm134.41 6.174c-19.63.067-37.112 1.439-51.283 4.182v10.064l177.594-1.203c-44.322-8.634-89.137-13.17-126.31-13.043zM26 475v18h460v-18z"/></svg><i class="lootn" id="grimN" hidden>!</i></button><span class="boosttime" id="boostTime" hidden></span></div>
  </div>
  <div id="tab"></div>`;
  for(const k in NAVL) navSet(k,0);
  $('#nav').hidden=false; { const st=document.querySelector('[data-tab="shop"]'); if(st) st.hidden=!CFG.shopTab; } if(tab==='shop'&&!CFG.shopTab) tab='up'; renderTab();
}
function updateHUD(){
  if(!S||!$('#rGold')) return;
  const h=G.heroStats(), B=G.B;
  const ev=G.inEvent();
  { const tp=document.querySelector('.top'); if(tp) tp.hidden=!(tab==='up'&&!ev); }
  { const xr=$('#xpRow'); if(xr) xr.hidden=ev; }   // el nivel solo cuenta farmeando: en eventos, Torre y PvP no se ve   // retrato, nombre y dinero: solo en Inicio farmeando (en el resto ocupa sitio)
  // abajo a la derecha: la fase (o, en un evento, el tiempo y la puntuación)
  $('#faseTxt').classList.toggle('top',ev);
  { const ft=$('#foeTxt'), tw=ev&&B&&B.kind==='tower', TT=CFG.tower, txt=!tw?'':(B.mech?[['👑 '+MECH[B.mech],TT.bossMech.desc[B.mech]]]:B.node==='elite'?[...new Set(B.enemies.flatMap(e=>e.traits||[]))].map(k=>[TRAIT(k),TT.traits[k].desc]):[]).map(([t,d])=>`<span data-tip="${esc(t)}|${esc(d)}">${t}</span>`).join('');
    if(ft){ ft.hidden=!txt; if(txt) setHTML(ft,txt); } }
  { const ct=$('#curseTxt'), run=ev&&B&&B.kind==='tower'?G.towerState().run:null, cs=run?(run.curses||[]):[], C=CFG.tower.curses;   // maldiciones: abajo en el centro
    if(ct){ ct.hidden=!cs.length; const h=cs.map(c=>`<span data-tip="☠ ${esc(C[c].name)}|${esc(C[c].desc)}">☠ ${C[c].name}</span>`).join(''); if(ct.dataset.h!==h){ ct.dataset.h=h; ct.innerHTML=h; } } }   // Torre: rasgos del élite o mecánica del jefe, arriba a la derecha
  setHTML($('#faseTxt'),ev&&B.kind==='pvp'?`⏱ ${Math.ceil(Math.max(0,CFG.pvp.maxT-B.t))} s`:ev&&B.kind==='tower'?(B.final?`Piso ${G.towerState().run.floor} · Daño ${fmt((G.towerState().run.finalDmg||0)+B.mD)}`:`Piso ${G.towerState().run.floor} · ♥ ${G.towerState().run.lives} · quedan ${B.enemies.filter(e=>!e.dead).length}`):ev&&B.kind==='boss'?`⏱ ${mmss(Math.max(0,CFG.wboss.dur-B.t)*1000)} · Daño ${fmt(B.dmg)}`
    :ev?`⏱ ${mmss(Math.max(0,CFG.event.maxDur-B.t)*1000)} · Nv ${(G.evRamp()||{r:0}).r+1} · ☠ ${B.kills}`:`Fase ${S.fase}${G.streak().mul>1?` · <span class="stk">🔥 +${Math.round((G.streak().mul-1)*100)} %</span>`:''}`);
  setHTML($('#uName'),`<span class="nt">${esc(S.name||'')}</span>`);   // solo el nombre: la clase ya se ve en el retrato
  avatar();   // nombre y, debajo, la clase
  setHTML($('#xpLbl'),`Nv ${S.lvl}${S.lvl>=G.lvlCap()?' máx.':''}`);
  $('#rGold').textContent=fmtG(S.gold); $('#rTok').textContent=fmt(G.tokens()); $('#rScrap').textContent=fmt(S.scrap);
  const sp=!ev&&G.surpriseState(), tag=$('#tag'), tt=ev?(B.kind==='pvp'?'PVP · '+String((B.enemies[0]||{}).name||'').toUpperCase():B.kind==='tower'?'TORRE · PISO '+G.towerState().run.floor:B.kind==='boss'?'JEFE SEMANAL':'MAZMORRA'):B&&B.boss?(B.elite?'JEFE DE ÉLITE':'JEFE'):sp?(sp.k==='horde'?`¡HORDA! ${Math.ceil(sp.left)} s · oro ×${CFG.surprise.horde.gold}`:`JEFE ERRANTE ${Math.ceil(sp.left)} s`):''; // (sin "Avanzando"/"Farmeando")
  tag.textContent=tt; tag.hidden=!tt; tag.className='tag'+(ev?' ev':B&&B.boss?' boss':sp?' boss':'');
  const fab=$('#upFab'); if(fab){ fab.hidden=tab!=='up'||ev; if(!fab.hidden) setHTML(fab,upStrip()); }
  // Grimorio: icono de libro en el combate desde el nivel grimoire.showLvl (o si ya se tiene); brilla cuando se puede evolucionar
  const gb=$('#grimBtn'); if(gb){ const shown=!ev&&(G.grimOwned()||S.lvl>=CFG.grimoire.showLvl||S.evo>=1), evoNow=shown&&!(S.evo>=1)&&G.grimDone()&&G.evoLvlOk();
    gb.hidden=!shown; gb.classList.toggle('on',evoNow); gb.dataset.act=evoNow?'evoOpen':'grimOpen'; gb.setAttribute('aria-label',evoNow?'Evolucionar':'Grimorio'); $('#grimN').hidden=!evoNow; }
  const es=$('#evoSlot'); if(es){ const soon=G.nextEvo()&&G.nextEvo().pending&&S.lvl>=G.lvlCap(); setHTML(es,soon&&!ev?'<span class="pill">Evolución: próximamente</span>':''); }
  const sbs=document.querySelector('.sidebtns'); if(sbs) sbs.hidden=ev;   // en los eventos no se ven los iconos del combate
  const db=$('#dailyBtn'); if(db){ db.hidden=ev; $('#dailyN').hidden=!(G.calState().can||G.wheelState().free); }   // premios diarios: calendario y ruleta
  const hpv=B?Math.max(0,B.hp):h.hp, xpp=Math.min(100,S.xp/G.xpReq(S.lvl)*100);
  $('#hpBar').style.width=hpv/h.hp*100+'%'; $('#hpTxt').textContent=fmt(Math.ceil(hpv));
  $('#xpBar').style.width=xpp+'%'; $('#xpTxt').textContent=Math.floor(xpp)+' %';
  const hs=$('#hStats'); if(hs) hs.innerHTML=`<div class="sl">
      <span>Vida <b>${fmt(h.hp)}</b></span><span>Def <b>${fmt(h.df)}</b></span>${h.ls?`<span>Robo <b>${pct(h.ls)}</b></span>`:''}${h.ev?`<span>Evasión <b>${pct(h.ev)}</b></span>`:''}</div>
    <div class="sl"><span>Daño <b>${fmt(h.atk)}</b></span><span>Vel <b>${h.spd.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})}/s</b></span><span>Crít <b>${pct(h.cr)}</b></span><span>D. crít <b>+${Math.round(h.cd*100)} %</b></span>${h.bd?`<span>Jefes <b>+${pct(h.bd)}</b></span>`:''}</div>`;
  if(S.loot) G.claimLoot();   // el botín de los jefes entra solo en el inventario (sin icono de botín)
  const ep=$('#evPause'); if(ep){ const l=G.evPauseLeft(); if(l>0) ep.textContent=mmss(l); else if(tab==='ev') renderTab(); }
  const bl=G.boostLeft(), bt=$('#boostTime'), bb=$('#boostBtn');
  if(bt){ bt.hidden=!bl||ev; if(bl) bt.textContent='×'+CFG.boosts.speed.mult+' '+mmss(bl); } if(bb) bb.classList.toggle('on',bl>0);
  if(boostModalOpen) updateBoostModal();
  const on=!ev&&G.canAdvanceMode(); if(on&&modeReady===false) toast(`¡${CFG.modes[S.mode+1].name} desbloqueado! Míralo en Modos → Campaña`); modeReady=on;
  // habilidades: solo las desbloqueadas; la recarga se ve con el reloj gris (sin números). En los eventos, botón Auto/Manual
  const sb=$('#skBar'); if(sb){ const L=G.skills().filter(x=>!x.locked), inEv=G.inEvent(), pvp=G.pvpOn(), auto=pvp?!(S.opt&&S.opt.pvpAuto===false):G.towerOn()?!(S.opt&&S.opt.towerAuto===false):inEv&&!!(S.opt&&S.opt.evAuto), key=L.map(x=>x.slot+x.id).join()+inEv+auto;
    if(sb.dataset.k!==key){ sb.dataset.k=key; sb.classList.toggle('many',L.length>4); sb.innerHTML=L.map(x=>`<button class="skb" data-act="skill" data-k="${x.slot}" aria-label="${esc(x.name||'')}">${skIcon(x.id)}<i class="skcd"></i></button>`).join(''); }
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
let upX='1';
const UPS={atk:'Daño',hp:'Vida',df:'Defensa',spd:'Velocidad'};
function upStrip(){ const st=G.heroStats();
  const t=Object.keys(UPS).map(k=>{ const c=G.upCost(k), v=st[k], ok=S.gold>=c;
    const nv=k==='spd'?v.toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}):fmt(v);
    return `<button class="upt${ok?' ok':''}" data-act="upBuy" data-k="${k}" aria-label="Mejorar ${UPS[k]} por ${fmt(c)} oro"><span class="un">${UPS[k]}</span><b>${nv}</b><span class="uc"><i class="dot" style="background:var(--gold)"></i>${fmtG(c)}</span></button>` }).join('');
  return `<button class="upx" data-act="upX" aria-label="Comprar ${upX==='1'?'de uno en uno':'el máximo'}">${upX==='1'?'×1':'MÁX'}</button>${t}` }
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
const BIGSWORD=`<svg viewBox="0 0 64 64" width="92" height="92" aria-hidden="true"><path d="M50 6l8 0 0 8-26 26-8-8z" fill="#dfe4ee"/><path d="M50 6l8 0-30 30-4-4z" fill="#fff" opacity=".55"/><path d="M18 34l12 12-4 4-12-12z" fill="var(--gold)"/><path d="M20 44l-8 8" stroke="#8a5a34" stroke-width="5" stroke-linecap="round"/><circle cx="9" cy="55" r="4" fill="var(--gold)"/></svg>`;
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
  const lvlBody=max?'<p class="hint" style="text-align:center">Nivel máximo</p>':`
      ${row(ICONS.armas,'Daño',m.d,mn.d)}${row(ICSPD,'Velocidad',m.s,mn.s)}
      <div class="fgneed"><span>Armas iguales</span><b style="color:var(--${have>=n?'good':'bad'})">${have}/${n}</b></div>
      <button class="fgcta" data-act="lvl" data-id="${it.id}" ${have<n||S.scrap<sc?'disabled':''}><b>SUBIR A NIVEL ${it.lvl+1}</b><span>${sc?`${ICON.scrap} ${fmt(sc)} chatarra · `:''}${n} arma${n>1?'s':''} igual${n>1?'es':''}</span></button>`;
  const refBody=`${it.sec.map((x,i)=>statRow(it,x,i,{lock:true,imp:true})).join('')}
      <button class="fgcta" data-act="ref" data-id="${it.id}" data-pay="scrap" ${S.scrap<p.scrap?'disabled':''}><b>REFORJAR</b><span>${ICON.scrap} ${fmt(p.scrap)} chatarra</span></button>
      ${pt?`<button class="btn sm" data-act="ref" data-id="${it.id}" data-pay="token">O con token: ${fmt(pt.scrap)} chat. + ${pt.tokens} token</button>`:''}
      <div class="rlegend"><span>${LOCK_SVG(true)} fija un stat (cuesta más)</span><span><b>↑</b> sube solo ese stat</span></div>`;
  return `${scrHead('FORJA',forjaBack)}<section class="fgp">
    <div class="fgframe" style="--rc:var(--r${it.r})">${BIGSWORD.replace('width="92" height="92"','width="120" height="120"')}
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
const scrHead=(t,backV)=>`<div class="scrhd">${backV?`<button class="scrb" data-act="invview" data-v="${backV}" aria-label="Volver">‹</button>`:''}<b>${t}</b><span class="scrg">${ICON.gold}${fmtG(S.gold)}</span></div>`;
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
  const ws=w?`<button class="ibslot" style="--rc:var(--r${w.r})" data-act="forge" data-id="${w.id}" data-from="main" aria-label="Arma: ${wName(w)}">${MINISWORD}<span class="ibl">Nv ${w.lvl}</span></button>`:`<button class="ibslot empty" data-act="invview" data-v="armas" aria-label="Sin arma">—</button>`;
  const gs=gshown?`<button class="ibslot" style="--rc:var(--rE)" data-act="grimOpen" aria-label="Grimorio">${((document.querySelector('#grimBtn svg')||{}).outerHTML||'📖').replace(/width="22" height="22"/,'width="30" height="30"')}${G.grimOwned()?`<span class="ibl">Nv ${G.grimLevel()}</span>`:''}</button>`:`<span class="ibslot empty" aria-label="Grimorio bloqueado">🔒</span>`;
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
const MINISWORD=BIGSWORD.replace('width="92" height="92"','width="38" height="38"');
function itemTile(it){ const eq=it.id===S.equippedId, own=it.cls===S.cls, up=own&&!eq&&betterThanEquipped(it), sel=expandedId===it.id;
  return `<button class="itile${sel?' sel':''}" style="--rc:var(--r${it.r})" data-act="expand" data-id="${it.id}" aria-pressed="${sel}" aria-label="${wName(it)} nivel ${it.lvl}">
    ${MINISWORD}<span class="tl">Nv ${it.lvl}</span>${it.fav?'<span class="tf">★</span>':''}${up?'<span class="tu">▲</span>':''}</button>` }
function itemSheet(it){ const m=G.weaponMain(it), own=it.cls===S.cls;
  return `<div class="isheet fixed" style="--rc:var(--r${it.r})">
    <div class="ishd"><div class="isart">${MINISWORD}</div><div style="min-width:0;flex:1"><b class="isn">${wName(it)}</b> <span class="rar" style="color:var(--r${it.r})">${CFG.rarName[it.r].toUpperCase()}</span>
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
const NODE={fight:['⚔️','Combate','Enemigos normales · +'+CFG.tower.souls.fight+' almas'],elite:['💀','Élite','Con rasgos · eliges 1 de 3 (hasta Épica)'],treasure:['🎁','Cofre','Sin luchar · 1 grimorio al azar'],rest:['🔥','Hoguera','Te curas del todo'],boss:['👑','Jefe','Eliges 1 de 3 grimorios legendarios'],shop:['🛒','Tienda','Cartas y grimorios por almas'],event:['❓','Evento','Algo inesperado'],altar:['🕯️','Altar maldito','1 grimorio legendario y 1 maldición']};
// mapa de la Torre (estilo Slay the Spire): abajo el piso de donde vienes (✓), encima el actual (los caminos que puedes
// tomar brillan y llevan su nombre) y arriba los 3 siguientes. Cada tipo de casilla tiene su color.
const NCOL={shop:'#2fb37a',fight:'#b0644f',elite:'#9b59d6',treasure:'#e8b04a',rest:'#f08a3c',event:'#4f95e6',altar:'#c0392b',boss:'#e5484d'};
function towerMapSvg(run){ const map=G.towerMap(), trail=(run.trail||[]).filter(t=>t.f<run.floor).sort((a,b)=>a.f-b.f);
  // filas de abajo arriba: el camino ya recorrido, el piso actual y los siguientes
  const rows=trail.map(t=>({f:t.f,n:t.row.n,c:t.row.c,pick:t.i,past:true})).concat(map.map((m,k)=>({f:run.floor+k,n:m.n,c:m.c,now:k===0})));
  const W=320, rowH=80, H=rows.length*rowH+24, X=c=>[62,160,258][c], Y=r=>H-40-r*rowH, near=(a,b)=>Math.abs(a-b)<=1;
  const links=(A,B)=>{ const L=[]; A.c.forEach((ca,i)=>{ let t=B.c.map((cb,j)=>near(ca,cb)?j:-1).filter(j=>j>=0); if(!t.length) t=B.c.map((_,j)=>j); t.forEach(j=>L.push([i,j])) }); return L };
  let lines='', nodes=''; const nowR=rows.findIndex(r=>r.now);
  for(let r=0;r<rows.length-1;r++){ const A=rows[r], Bn=rows[r+1];
    for(const [a,b] of links(A,Bn)){
      if(A.past&&Bn.past){ if(a===A.pick&&b===Bn.pick) lines+=`<line x1="${X(A.c[a])}" y1="${Y(r)}" x2="${X(Bn.c[b])}" y2="${Y(r+1)}" class="tml path"/>`; continue }   // camino recorrido
      if(A.past){ if(a===A.pick&&G.towerCanGo(b)) lines+=`<line x1="${X(A.c[a])}" y1="${Y(r)}" x2="${X(Bn.c[b])}" y2="${Y(r+1)}" class="tml on"/>`; continue }   // de dónde vienes a dónde puedes ir
      lines+=`<line x1="${X(A.c[a])}" y1="${Y(r)}" x2="${X(Bn.c[b])}" y2="${Y(r+1)}" class="tml${A.now&&!G.towerCanGo(a)?' off':''}"/>`; } }
  rows.forEach((row,r)=>{ nodes+=`<text x="6" y="${Y(r)+4}" class="tmf${row.now?' cur':''}">${row.f}</text>`;
    row.n.forEach((k,i)=>{ const x=X(row.c[i]), y=Y(r), N=NODE[k], col=NCOL[k]||'#888', ok=row.now&&G.towerCanGo(i), rr=k==='boss'?28:ok?25:19;
      const cls=row.past?(i===row.pick?' done':' gone'):row.now?(ok?' ok':' no'):' fu';
      nodes+=`<g class="tmn${cls}"${ok?` data-act="towerGo" data-k="${i}" role="button" aria-label="${N[1]}"`:''}><circle cx="${x}" cy="${y}" r="${rr}" style="--nc:${col}"/><text x="${x}" y="${y+7}" text-anchor="middle" class="tmi">${row.past&&i===row.pick?'✓':N[0]}</text>${ok?`<text x="${x}" y="${y+rr+15}" text-anchor="middle" class="tmk">${N[1]}</text>`:''}</g>` }) });
  return `<p class="hint" style="text-align:center;margin:6px 0 0">Elige tu camino${trail.length?' · desliza para ver tu ruta':''}</p><div class="tmapbox"><svg class="tmapsvg" viewBox="0 0 ${W} ${H}" width="100%" data-now="${nowR}">${lines}${nodes}</svg></div>` }
const TRAIT=k=>CFG.tower.traits[k].name, MECH={invocador:'Invocador',enfurecido:'Enfurecido',fases:'Escudo de fases',final:'Jefe final'};
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
  const hist=P.hist.map(x=>`<div><span style="color:${x.win?'var(--good)':'var(--bad)'}">${x.win?'V':'D'}</span><span>${esc(x.name)}${x.bot?' (bot)':''}</span><b>${x.d>0?'+':''}${x.d}</b></div>`).join('');
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
  const card=(k,title,sub,tk,line,pend)=>`<button class="evcard" data-act="evOpen" data-k="${k}"><span class="evt">${title}${pend?' <sup class="nb">!</sup>':''}</span><span class="s">${sub}</span>
    <span class="evl"><span>${tk}</span><span>${line}</span></span></button>`;
  // Campaña (Normal, Pesadilla, Infierno), Eventos (Mazmorra, Jefe semanal; la Liga está oculta) y PvP (próximamente)
  const back=`<button class="back" data-act="modview" data-v="">← Modos</button>`;
  if(!modView){ const pend=(G.evPending()?1:0)+(G.wbPending()?1:0)+(CFG.league.show&&G.leaguePending()?1:0), M=G.modeCfg();
    const tw=G.towerState(), tr=tw.run, pv=G.pvpState(), cap=CFG.phaseCap, bg=(z,w,h)=>`background-image:linear-gradient(180deg,rgba(10,10,16,0) 35%,rgba(10,10,16,.8)),url(${sceneImg(z,w,h)})`;
    const modesTxt=CFG.modes.map((x,i)=>`<span class="${i===S.mode?'on':''}">${x.name.toUpperCase()}</span>`).join('');
    return `<div class="scrhd"><b>MODOS</b><span class="scrg">${ICON.gold}${fmtG(S.gold)}</span></div><div class="mgrid2">
      <button class="mcard2 wide" style="${bg(zoneNow(),360,150)}" data-act="modview" data-v="campana">
        <span class="mk">AVENTURA PRINCIPAL</span><b class="mt">Campaña</b><span class="mm">${modesTxt}</span>
        <span class="mp"><small>Progreso</small><b>Fase ${S.best} / ${cap}</b></span><span class="mbar"><i style="width:${S.best/cap*100}%"></i></span></button>
      <button class="mcard2" style="${bg(4,180,170)}" data-act="modview" data-v="eventos">${pend?`<span class="mbadge">${pend} PREMIO${pend>1?'S':''}</span>`:`<span class="mbadge g">${G.evFreeLeft()+G.wbFreeLeft()} GRATIS</span>`}
        <b class="mt">Eventos</b><span class="ms">Mazmorra diaria<br>Jefe semanal</span><span class="mf">⏱ Jefe: ${dhm(G.weekLeft())}</span></button>
      <button class="mcard2" style="${bg('arena',180,170)}" data-act="modview" data-v="pvp"><span class="mbadge g">${G.pvpFreeLeft()} GRATIS</span>
        <b class="mt">PvP</b><span class="ms">Duelos por puntos</span><span class="mf">🛡 ${fmt(pv.rating)} puntos</span></button>
      <button class="mcard2 wide low" style="${bg(3,360,110)}" data-act="modview" data-v="torre"><span class="mico">${GIC(GI.torre,30)}</span>
        <span><b class="mt">Torre</b><span class="ms">${tr?`Piso ${tr.floor} · ♥ ${tr.lives}`:`Roguelike · récord piso ${tw.best}`}</span></span></button>
    </div>` }
  if(modView==='campana') return `${back}<section class="panel"><h3>Campaña</h3><div class="mlist">${modeRows()}</div></section>`;
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
    <div class="evhead"><div><span class="s">Entradas</span><b>${G.evFreeLeft()+S.tickets}</b></div><div><span class="s">${paused?'Total de ayer':'Total hoy'}</span><b>${best||'–'}</b></div><div><span class="s">Puesto</span><b>${pos||'–'}</b></div></div>
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
      ${P.prem?'':`<div class="chest offer"><div><div class="cn">Pase de pago</div><div class="s">Premios dorados</div></div><div class="acts">${payBtn('pass',CFG.stars.pass.stars,'data-act="devPass"')}</div></div>`}
      <button class="btn gold" data-act="passAll" ${G.passReady()?'':'disabled'}>Reclamar todo (${G.passReady()})</button>
      <div class="prow ph"><span class="pl">Nv</span><div class="pc">Gratis</div><div class="pc">De pago</div></div>
      <div class="plist">${rows.join('')}</div>`; }
  if(misView==='soc'){ const R=CFG.referral, inv=inviteRow();
    body=`<p class="hint">Invita a tus amigos: tu amigo recibe ${R.giftSilver} cofre de plata y tú ${R.goalSilver} cofres cuando llegue a la fase ${R.goalFase}.</p>${inv||'<p class="hint">Para invitar, abre el juego desde Telegram.</p>'}`; }
  return `<section class="panel"><h3>Misiones</h3>${chips}<div id="misBox" class="mlist">${body}</div></section>` }
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
  return `<section class="panel"><h3>Ajustes</h3><div class="row"><div><div class="t">Nombre</div><div class="s">${esc(S.name||'—')}</div></div></div><div class="row"><div><div class="t">Habilidades automáticas</div><div class="s">En la campaña</div></div><div class="acts"><button class="btn sm${S.opt&&S.opt.autoSkills===false?'':' on'}" data-act="autoSkills">${S.opt&&S.opt.autoSkills===false?'Desactivadas':'Activadas'}</button></div></div>${canNotify()?`<div class="row"><div><div class="t">Avisos del bot</div><div class="s">Te escribe cuando tu héroe llena el tiempo sin conexión</div></div><div class="acts"><button class="btn sm${S.opt&&S.opt.notify?' on':''}" data-act="notifyAsk">${S.opt&&S.opt.notify?'Activados':'Activar'}</button></div></div>`:''}<div class="row"><div><div class="t">Modo batería</div><div class="s">Menos efectos, gasta menos</div></div><div class="acts"><button class="btn sm${on?' gold':''}" data-act="battery" aria-pressed="${on}">${on?'Activado':'Desactivado'}</button></div></div>
  </section>
  <details class="panel fold"><summary><h3>Créditos</h3></summary><p class="hint">Iconos: <b>game-icons.net</b> (Lorc, Delapouite y colaboradores), licencia CC BY 3.0.</p></details>
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
  upBuy:(b,k)=>{ if(upX==='max'){ if(!G.buyMax(k)) toast('No tienes oro suficiente') } else if(!G.buyUpgrade(k)) toast('No tienes oro suficiente'); updateHUD() },
  upX:()=>{ upX=upX==='1'?'max':'1'; updateHUD() },
  skill:(b,k)=>{ const x=G.skills().find(s=>s.slot===k); if(!x) return; if(x.locked) return toast(`${x.name}: ${(SKI[x.id]||[0,x.desc])[1]}`);
    const r=G.useSkill(k); if(r.ok){ haptic('medium'); toast(x.name) } else if(r.why==='cd') toast(`${x.name}: ${Math.ceil(r.left)} s`); else if(r.why==='nofight') toast('Espera a que empiece el combate') },
  // botón Auto/Manual del combate: en los eventos cambia opt.evAuto; en la campaña, opt.autoSkills
  skAuto:()=>{ if(G.pvpOn()){ G.setOpt('pvpAuto',S.opt&&S.opt.pvpAuto===false); toast(S.opt.pvpAuto?'Habilidades automáticas en PvP':'Habilidades a mano en PvP'); }
    else if(G.towerOn()){ G.setOpt('towerAuto',S.opt&&S.opt.towerAuto===false); toast(S.opt.towerAuto?'Habilidades automáticas en la Torre':'Habilidades a mano en la Torre'); }
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
  modview:b=>{ modView=b.dataset.v||null; evView=null; if(modView==='pvp') pvpLoad(); renderTab(); window.scrollTo({top:0}); },
  lgClaim:()=>{ const p=G.leagueClaim(); if(p){ toast(`+${fmt(p.tok)} tokens de la Liga`); renderTab(); } },
  evClaim:()=>{ const p=G.claimEvent(); if(p){ toast(p.rew?evRewPlain(p.rew):'Sin premio'); renderTab(); } },
  close:()=>{stopSpin();boostModalOpen=false;grimOpen=false;clearInterval(adTimer);adTimer=null;closeModal()},
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
document.addEventListener('contextmenu',e=>{ if(e.target.closest('.skb,[data-tip]')) e.preventDefault() });
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
  const h=G.heroStats(), contact=hx+44, spawnX=W+24;   // los sprites son más anchos que los dibujos: algo más de hueco
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
      const m=e.f?Math.floor((e.f-1)/150):B.kind?0:S.mode; e._k=ART.kindFor(zone,idx,{boss:B.boss&&!e.minion,elite:B.elite,mode:m}); e._hue=modeHue(m); }
    idx++;
    const p=Math.min(1,(B.t-e.spawn)/(e.walk||CFG.enemy.walk));
    const big=B.boss&&!e.minion, r=big?(B.elite?26:21):13, y=gy, cx=contact+(r-13)*2.4;   // los esbirros del jefe, de tamaño normal y sin corona   // los grandes se paran más lejos (no tapan al héroe)
    let x=e.dead?e.x:spawnX-(spawnX-cx)*p; if(!e.dead&&p>=1){x+=q*26;q++}
    e.x=x;
    if(e.dead&&!e._burst){ e._burst=1; if(anim) ART.burst(x,gy-r,'#d9d2c0',8); }
    ART.monster(g,x,y,{kind:e._k,r,hue:e._hue,boss:big,elite:B.elite,t:anim?T+(e.spawn||0):0,walk:p<1&&anim?T:0,atk:pulse(e._atkAt,300),hit:anim&&e._hitAt&&now-e._hitAt<100?1-(now-e._hitAt)/100:0,die:Math.max(0,dieK)});
    if(anim&&!e.dead) ART.status(g,x,gy,r,{frozen:e.frozen>B.t,burn:(e.burn&&e.burn.some(u=>u>B.t))||(e.dot>B.t&&e.dotKind==='fuego'),poison:e.poison&&e.poison.some(p=>p.until>B.t),mark:e.mark>B.t},T);
    if(bars&&!e.immortal&&!e.dead){ const by=gy-r*3.7-6; g.fillStyle='#0009'; g.fillRect(x-18,by,36,4); g.fillStyle='#e2605a'; g.fillRect(x-18,by,36*Math.max(0,e.hp/e.max),4); }
  }
  if(anim) ART.parts(g,dt);
  if(anim){ const foes=B.kind==='pvp'?[]:B.enemies.filter(e=>!e.dead&&e.x!=null).map(e=>({x:e.x}));
    ART.drawFx(g,{W,hx,rx:B.kind==='pvp'?B.enemies[0].x:null,gy,foes,now:now/1000,
      drawClone:(x,side)=>{ if(side==='rival'){ const e=B.enemies[0], rv=G.pvpState().rival||{}; ART.hero(g,x,gy,{cls:e.cls,color:(CFG.classes[e.cls]||c).color,evo:rv.evo,path:rv.path,flip:true,t:T}) } else ART.hero(g,x,gy,{cls:S.cls,color:ART.shade(c.color,0.5),evo:S.evo,path:S.path,ghost:true,t:T+0.5}) }}); }
  fx.floats=fx.floats.filter(f=>(f.life-=dt)>0);
  g.textAlign='center'; g.font='800 13px "Nunito Sans", system-ui, sans-serif';
  for(const f of fx.floats){ const y=(f.hero?gy-58:gy-52)-(0.9-f.life)*50; const x=f.hero?hx:(f.e&&f.e.x)||0;
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
