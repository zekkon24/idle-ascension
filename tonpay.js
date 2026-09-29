/* Idle Ascension · COMPRAR TOKENS CON TON / USDT (red TON)
   1) Conecta la cartera del jugador con TON Connect (Telegram Wallet, Tonkeeper…). La librería se carga solo al usarla.
   2) Pide al servidor (función "crypto") el importe y el mensaje con el código único (memo) y la cartera lo firma.
   3) Pregunta al servidor si ya llegó (cada pocos segundos durante 3 min, y con el botón "Comprobar"). El premio llega
      como los de Stars: el servidor lo deja en "rewards" y el juego lo recoge al enviar datos. Sin retiros. */
(function(root){
'use strict';
const LIB='https://cdn.jsdelivr.net/npm/@tonconnect/ui@2/dist/tonconnect-ui.min.js';
const tgData=()=>{ const tg=root.Telegram&&root.Telegram.WebApp; return tg&&tg.initData||'' };
let ui=null, loading=null;
function on(CFG){ return !!(CFG.crypto&&CFG.crypto.on&&CFG.crypto.url&&tgData()) }
function lib(){ if(root.TON_CONNECT_UI) return Promise.resolve(); if(loading) return loading;
  loading=new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src=LIB; s.onload=ok; s.onerror=()=>{ loading=null; ko(new Error('lib')) }; document.head.appendChild(s) }); return loading }
async function connect(CFG){ await lib();
  if(!ui) ui=new root.TON_CONNECT_UI.TonConnectUI({manifestUrl:CFG.crypto.manifest});
  await ui.connectionRestored;
  if(ui.account) return ui.account.address;
  return new Promise((ok,ko)=>{ const off=ui.onStatusChange(w=>{ if(w&&w.account){ off(); ok(w.account.address) } });
    ui.openModal().catch(e=>{ off(); ko(e) });
    const offM=ui.onModalStateChange&&ui.onModalStateChange(st=>{ if(st&&st.status==='closed'&&!ui.account){ off(); offM&&offM(); ko(new Error('cancel')) } }) }) }
const post=(CFG,body)=>fetch(CFG.crypto.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({initData:tgData(),...body})})
  .then(r=>r.json().catch(()=>({ok:false,error:'net'}))).catch(()=>({ok:false,error:'net'}));
// compra: devuelve {ok} o {error}; onStage(texto) para ir contando al jugador por dónde va
async function buy(CFG,item,coin,onStage){
  let from; try{ onStage('Conectando tu cartera…'); from=await connect(CFG) }catch(e){ return {error:'cancel'} }
  onStage('Preparando el pago…');
  const q=await post(CFG,{action:'quote',item,coin,from});
  if(!q.ok) return {error:q.error||'net'};
  try{ onStage('Confirma el pago en tu cartera…'); await ui.sendTransaction(q.tx) }catch(e){ return {error:'cancel'} }
  onStage('Pago enviado. Esperando confirmación…');
  for(let i=0;i<36;i++){ await new Promise(r=>setTimeout(r,5000)); const c=await check(CFG); if(c.paid) return {ok:true,q} }
  return {ok:false,pending:true,q} }
// ¿han llegado depósitos pendientes? Si sí, se piden los premios al servidor (Telemetry.poke)
async function check(CFG){ const c=await post(CFG,{action:'check'}); if(c.paid&&root.Telemetry&&root.Telemetry.poke) root.Telemetry.poke(); return c }
root.TonPay={on,buy,check,connect};
})(typeof window!=='undefined'?window:globalThis);
