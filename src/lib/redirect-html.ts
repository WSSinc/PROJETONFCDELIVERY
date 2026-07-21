// HTML das páginas do consumidor final (tag). String cru, mobile-first,
// CSS+JS inline, zero asset externo — carrega em um round-trip.
// É o momento "uau" do toque NFC: a página nasce de uma onda de radar,
// os elementos entram em cascata, cupom vira ticket, resgate solta confete.

import type { Comercio } from './redirect'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:#0b0b10;color:#f6f3ee;min-height:100dvh;overflow-x:hidden;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:28px 22px calc(26px + env(safe-area-inset-bottom));position:relative}
/* fundo: brasas de cozinha — dois glows lentos + vinheta */
body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(520px 420px at 18% -8%,rgba(232,84,43,.17),transparent 62%),
    radial-gradient(460px 420px at 92% 108%,rgba(245,166,35,.11),transparent 62%);
  animation:brasa 9s ease-in-out infinite alternate}
body::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:0;
  background:radial-gradient(120% 90% at 50% 50%,transparent 55%,rgba(0,0,0,.5) 100%)}
@keyframes brasa{from{opacity:.75;transform:translateY(0)}to{opacity:1;transform:translateY(-14px)}}

.wrap{position:relative;z-index:1;width:100%;max-width:420px;
  display:flex;flex-direction:column;align-items:center;gap:16px}

/* ---- onda de entrada: a página nasce do toque ---- */
.burst{position:fixed;top:50%;left:50%;z-index:0;pointer-events:none}
.burst i{position:absolute;top:0;left:0;width:120px;height:120px;margin:-60px 0 0 -60px;
  border:1.5px solid rgba(232,84,43,.55);border-radius:50%;opacity:0;
  animation:onda 1.1s cubic-bezier(.2,.6,.3,1) forwards}
.burst i:nth-child(2){animation-delay:.14s;border-color:rgba(245,166,35,.4)}
.burst i:nth-child(3){animation-delay:.28s;border-color:rgba(232,84,43,.25)}
@keyframes onda{0%{transform:scale(.3);opacity:.9}100%{transform:scale(6.5);opacity:0}}

/* ---- marca com halo de radar ---- */
.logoBox{position:relative;width:104px;height:104px;display:flex;align-items:center;
  justify-content:center;animation:pop .55s cubic-bezier(.34,1.56,.64,1) both;animation-delay:.08s}
.logoBox .halo{position:absolute;inset:0;border-radius:32px;pointer-events:none}
.logoBox .halo::before,.logoBox .halo::after{content:"";position:absolute;inset:0;
  border-radius:32px;border:1.5px solid rgba(232,84,43,.35);
  animation:radar 3.4s ease-out infinite}
.logoBox .halo::after{animation-delay:1.7s}
@keyframes radar{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.65);opacity:0}}
.logo{width:100%;height:100%;border-radius:26px;object-fit:contain;background:#fff;
  padding:10px;box-shadow:0 14px 40px -10px rgba(232,84,43,.45)}
.logoEmoji{width:100%;height:100%;border-radius:26px;display:flex;align-items:center;
  justify-content:center;font-size:46px;
  background:linear-gradient(150deg,#241a16,#191219);
  border:1px solid rgba(245,166,35,.25);
  box-shadow:0 14px 40px -10px rgba(232,84,43,.35)}
@keyframes pop{0%{transform:scale(.55);opacity:0}100%{transform:scale(1);opacity:1}}

h1{font-size:27px;font-weight:800;text-align:center;line-height:1.2;
  letter-spacing:-.02em;animation:sobe .5s ease-out both;animation-delay:.22s}
.sub{font-size:15px;color:#a8a29a;text-align:center;margin-top:-6px;
  animation:sobe .5s ease-out both;animation-delay:.32s}
@keyframes sobe{0%{transform:translateY(14px);opacity:0}100%{transform:none;opacity:1}}

/* ---- botões ---- */
.btns{display:flex;flex-direction:column;gap:13px;width:100%;margin-top:4px}
.btns>*:nth-child(1){animation:sobe .5s ease-out both;animation-delay:.52s}
.btns>*:nth-child(2){animation:sobe .5s ease-out both;animation-delay:.62s}
a.btn,button.btn{position:relative;overflow:hidden;display:flex;align-items:center;
  justify-content:center;gap:10px;min-height:66px;border-radius:18px;width:100%;
  font-size:18.5px;font-weight:800;border:0;cursor:pointer;text-decoration:none;
  color:#fff;-webkit-tap-highlight-color:transparent;
  transition:transform .12s ease;letter-spacing:-.01em}
a.btn:active,button.btn:active{transform:scale(.965)}
.pedido{background:linear-gradient(135deg,#ff7a45,#e8542b 55%,#d43d1e);
  box-shadow:0 12px 34px -8px rgba(232,84,43,.6)}
.pedido::after{content:"";position:absolute;inset:0;
  background:linear-gradient(115deg,transparent 42%,rgba(255,255,255,.28) 50%,transparent 58%);
  background-size:260% 100%;animation:brilho 3.2s ease-in-out infinite}
@keyframes brilho{0%,25%{background-position:130% 0}60%,100%{background-position:-130% 0}}
.avaliacao{background:linear-gradient(135deg,#ffcd68,#f5a623 60%,#e29113);color:#241703;
  box-shadow:0 12px 30px -10px rgba(245,166,35,.5)}

/* ---- cupom ticket ---- */
.cupom{position:relative;width:100%;border-radius:18px;padding:18px 18px 16px;
  text-align:center;background:linear-gradient(160deg,#1d1a25,#141119);
  border:1px solid rgba(245,166,35,.4);
  box-shadow:0 10px 34px -14px rgba(245,166,35,.35);
  animation:sobe .5s ease-out both;animation-delay:.42s}
.cupom::before,.cupom::after{content:"";position:absolute;top:50%;width:18px;height:18px;
  margin-top:-9px;border-radius:50%;background:#0b0b10}
.cupom::before{left:-10px;border-right:1px solid rgba(245,166,35,.4)}
.cupom::after{right:-10px;border-left:1px solid rgba(245,166,35,.4)}
.cupom b{color:#ffc95e;font-size:17.5px;letter-spacing:-.01em}
.cupom p{font-size:13px;color:#a8a29a;margin-top:5px;line-height:1.45}
.cupom .abrir{margin-top:12px;width:100%;background:rgba(245,166,35,.13);
  border:1.5px solid rgba(245,166,35,.65);color:#ffc95e;border-radius:12px;
  padding:12px 18px;font-size:15.5px;font-weight:800;cursor:pointer;
  -webkit-tap-highlight-color:transparent;transition:transform .12s}
.cupom .abrir:active{transform:scale(.97)}
.cupom input{width:100%;padding:14px;border-radius:12px;border:1px solid #2e2b38;
  background:#100e15;color:#f6f3ee;font-size:16px;margin-top:10px;outline:none;
  transition:border-color .15s}
.cupom input:focus{border-color:#f5a623}
.cupom .lib{margin-top:12px;width:100%;border:0;border-radius:12px;padding:14px;
  font-size:16.5px;font-weight:800;cursor:pointer;color:#241703;
  background:linear-gradient(135deg,#ffcd68,#f5a623);
  box-shadow:0 10px 26px -10px rgba(245,166,35,.55);
  -webkit-tap-highlight-color:transparent;transition:transform .12s}
.cupom .lib:active{transform:scale(.97)}
.cupom .lib:disabled{opacity:.6}
.cod{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:28px;font-weight:800;
  color:#ffc95e;letter-spacing:.18em;margin:10px 0 2px;padding:10px 6px;
  border:1.5px dashed rgba(245,166,35,.55);border-radius:12px;cursor:pointer;
  -webkit-tap-highlight-color:transparent;animation:pop .5s cubic-bezier(.34,1.56,.64,1) both}
.copiado{font-size:11.5px;color:#7fd9a8;min-height:15px;margin-top:3px}
.msgerr{color:#ff8a70;font-size:13px;margin-top:9px}
/* !important: vence qualquer display definido depois (ex: .resolver{display:flex}) */
.oculto{display:none!important}

/* ---- avaliação ---- */
.estrelas{display:flex;gap:8px;margin-top:10px;animation:sobe .5s ease-out both;animation-delay:.42s}
.estrelas button{background:none;border:0;width:56px;height:56px;cursor:pointer;
  -webkit-tap-highlight-color:transparent;padding:4px}
.estrelas svg{width:100%;height:100%;fill:#2c2a35;stroke:rgba(255,255,255,.07);
  stroke-width:1;transition:fill .15s}
.estrelas button.on svg{fill:url(#gs);
  filter:drop-shadow(0 5px 16px rgba(245,166,35,.55));
  animation:starPop .38s cubic-bezier(.34,1.56,.64,1)}
@keyframes starPop{0%{transform:scale(.6)}60%{transform:scale(1.25)}100%{transform:scale(1)}}
.nota{min-height:26px;font-size:16.5px;font-weight:700;color:#ffc95e;text-align:center;
  margin-top:6px}
.resolver{width:100%;text-align:center;display:flex;flex-direction:column;gap:14px;
  align-items:center;animation:sobe .45s ease-out both}
.resolver .carinha{font-size:52px;animation:pop .5s cubic-bezier(.34,1.56,.64,1) both}
.resolver p{font-size:15.5px;color:#cfc9c0;line-height:1.6;max-width:320px}
a.zap{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;
  min-height:64px;border-radius:18px;font-size:18px;font-weight:800;
  text-decoration:none;color:#062e18;background:linear-gradient(135deg,#4ae08a,#25d366);
  box-shadow:0 12px 32px -10px rgba(37,211,102,.55);
  -webkit-tap-highlight-color:transparent;transition:transform .12s}
a.zap:active{transform:scale(.965)}

/* ---- erro ---- */
.err{font-size:16px;color:#cfc9c0;text-align:center;max-width:340px;line-height:1.55}
.flutua{font-size:46px;animation:flutuar 3s ease-in-out infinite}
@keyframes flutuar{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}

.assinatura{margin-top:14px;font-size:11px;letter-spacing:.08em;color:#5a564f;
  animation:sobe .6s ease-out both;animation-delay:.85s}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
}`

const SHELL = (title: string, body: string, script = '') => `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0b0b10">
<title>${esc(title)}</title>
<style>${CSS}</style></head><body>
<div class="burst" aria-hidden="true"><i></i><i></i><i></i></div>
${body}${script ? `<script>${script}</script>` : ''}</body></html>`

// identidade anônima (localStorage) + ping de presença + helpers sensoriais
const JS_BASE = `
function lncToken(){try{var t=localStorage.getItem('lnc_token');
if(!t){t=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());
localStorage.setItem('lnc_token',t)}return t}catch(e){return null}}
function lncPing(slug){var t=lncToken();if(!t)return;
try{fetch('/api/tag/presenca',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({slug:slug,token:t})})}catch(e){}}
function vib(ms){try{navigator.vibrate&&navigator.vibrate(ms)}catch(e){}}
function festa(){try{
if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
var cv=document.createElement('canvas');
cv.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:99';
document.body.appendChild(cv);
cv.width=innerWidth;cv.height=innerHeight;var cx=cv.getContext('2d');
var C=['#ff7a45','#f5a623','#ffd98a','#7fd9a8','#ffffff'],P=[],i;
for(i=0;i<90;i++)P.push({x:innerWidth/2,y:innerHeight*.42,
vx:(Math.random()-.5)*11,vy:Math.random()*-11-4,s:Math.random()*7+4,
c:C[i%5],r:Math.random()*6.28,vr:(Math.random()-.5)*.3});
var t0=Date.now();(function f(){
cx.clearRect(0,0,cv.width,cv.height);
for(var j=0;j<P.length;j++){var p=P[j];p.x+=p.vx;p.y+=p.vy;p.vy+=.35;p.r+=p.vr;
cx.save();cx.translate(p.x,p.y);cx.rotate(p.r);cx.fillStyle=p.c;
cx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.62);cx.restore()}
if(Date.now()-t0<1800)requestAnimationFrame(f);else cv.remove()})()}catch(e){}}`

function marcaHtml(c: Comercio): string {
  const miolo = c.logo_url
    ? `<img class="logo" src="${esc(c.logo_url)}" alt="${esc(c.nome)}">`
    : `<div class="logoEmoji">🍽️</div>`
  return `<div class="logoBox"><span class="halo"></span>${miolo}</div>`
}

// ---------------------------------------------------------------------------
// Página principal da tag (modo dois botões) — com cupom de resgate opcional
// ---------------------------------------------------------------------------
export function renderDoisBotoes(c: Comercio): string {
  const base = `/r/${encodeURIComponent(c.slug)}/ir`
  const temPedido = !!c.link_pedido
  const temAvaliacao = !!c.link_avaliacao

  const hrefAvaliar = c.avaliacao_inteligente
    ? `/r/${encodeURIComponent(c.slug)}/avaliar`
    : `${base}?tipo=avaliacao`

  const botoes = [
    temPedido ? `<a class="btn pedido" href="${base}?tipo=pedido">🍔 Pedir de novo</a>` : '',
    temAvaliacao ? `<a class="btn avaliacao" href="${hrefAvaliar}">⭐ Avaliar</a>` : '',
  ].join('')

  const temCupom = c.cupom_ativo && !!c.cupom_texto && !!c.cupom_codigo && temPedido
  const cupom = temCupom ? `
<div class="cupom" id="cupom">
  <div id="cupomFechado">
    <b>🎁 ${esc(c.cupom_texto as string)}</b>
    <p>Cupom exclusivo pra quem pede direto</p>
    <button class="abrir" onclick="abrirCupom()">Resgatar meu cupom</button>
  </div>
  <div id="cupomForm" class="oculto">
    <b>🎁 ${esc(c.cupom_texto as string)}</b>
    <p>Deixa seu WhatsApp pra liberar o cupom:</p>
    <input id="cWa" type="tel" inputmode="numeric" placeholder="(11) 99999-9999" autocomplete="tel">
    <input id="cNome" type="text" placeholder="Seu nome (opcional)" autocomplete="name">
    <button class="lib" onclick="liberarCupom()" id="cBtn">Liberar cupom</button>
    <div class="msgerr oculto" id="cErr"></div>
  </div>
  <div id="cupomOk" class="oculto">
    <b>🎉 Cupom liberado!</b>
    <div class="cod" onclick="copiarCod()" title="Toque para copiar">${esc(c.cupom_codigo as string)}</div>
    <div class="copiado" id="cCop">toque no código pra copiar</div>
    <p>Mostra ou fala esse código no pedido</p>
    <a class="btn pedido" style="margin-top:12px" href="${base}?tipo=pedido&cupom=1">🍔 Pedir agora com desconto</a>
  </div>
</div>` : ''

  const script = `${JS_BASE}
lncPing(${JSON.stringify(c.slug)});
function abrirCupom(){vib(12);
document.getElementById('cupomFechado').classList.add('oculto');
document.getElementById('cupomForm').classList.remove('oculto');
document.getElementById('cWa').focus()}
function copiarCod(){try{navigator.clipboard.writeText(${JSON.stringify(c.cupom_codigo ?? '')});
document.getElementById('cCop').textContent='copiado ✓';vib(10)}catch(e){}}
function liberarCupom(){var wa=(document.getElementById('cWa').value||'').replace(/\\D/g,'');
var err=document.getElementById('cErr');err.classList.add('oculto');
if(wa.length<10||wa.length>13){err.textContent='Digite um WhatsApp válido com DDD.';err.classList.remove('oculto');return}
var b=document.getElementById('cBtn');b.disabled=true;b.textContent='Liberando…';
fetch('/api/tag/cupom',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({slug:${JSON.stringify(c.slug)},whatsapp:wa,
nome:(document.getElementById('cNome').value||'').trim()||null,token:lncToken()})})
.then(function(r){return r.json()}).then(function(d){
if(d.ok){document.getElementById('cupomForm').classList.add('oculto');
document.getElementById('cupomOk').classList.remove('oculto');festa();vib(35)}
else{err.textContent=d.erro||'Não deu certo, tenta de novo.';err.classList.remove('oculto');
b.disabled=false;b.textContent='Liberar cupom'}})
.catch(function(){err.textContent='Sem conexão, tenta de novo.';err.classList.remove('oculto');
b.disabled=false;b.textContent='Liberar cupom'})}`

  const body = `
<div class="wrap">
${marcaHtml(c)}
<h1>${esc(c.nome)}</h1>
<p class="sub">O que você quer fazer?</p>
${cupom}
<div class="btns">${botoes}</div>
<div class="assinatura">linknacaixa.click</div>
</div>`

  return SHELL(c.nome, body, script)
}

// ---------------------------------------------------------------------------
// Página do funil de avaliação: 4-5⭐ → Google; 1-3⭐ → resolver no WhatsApp
// ---------------------------------------------------------------------------
export function renderAvaliar(c: Comercio): string {
  const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9.2l7.1-.6z"/></svg>'

  const script = `${JS_BASE}
var enviado=false;
var MSGS=['Eita… 😞','Podia ser melhor 😕','Ok, mas dá pra melhorar 😐','Muito bom! 😋','Perfeito! 🧡'];
function pinta(n){if(enviado)return;enviado=true;vib(15);
var bs=document.querySelectorAll('.estrelas button');
for(var i=0;i<bs.length;i++){(function(b,i){
setTimeout(function(){b.classList.toggle('on',i<n)},i*70)})(bs[i],i)}
document.getElementById('nota').textContent=MSGS[n-1];
setTimeout(function(){enviar(n)},700)}
function enviar(n){
fetch('/api/tag/avaliacao',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({slug:${JSON.stringify(c.slug)},estrelas:n,token:lncToken()})})
.then(function(r){return r.json()}).then(function(d){
if(d.acao==='ir'&&d.url){location.href=d.url;return}
document.getElementById('passo1').classList.add('oculto');
var box=document.getElementById('resolver');box.classList.remove('oculto');
if(d.url){document.getElementById('zap').setAttribute('href',d.url)}
else{document.getElementById('zap').classList.add('oculto')}})
.catch(function(){location.href=${JSON.stringify(c.link_avaliacao ?? '/')}})}`

  const body = `
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">
<stop offset="0%" stop-color="#ffd98a"/><stop offset="100%" stop-color="#f5a623"/>
</linearGradient></defs></svg>
<div class="wrap">
<div id="passo1" style="display:flex;flex-direction:column;align-items:center;gap:8px;width:100%">
  ${marcaHtml(c)}
  <h1>Como foi seu pedido?</h1>
  <p class="sub">Toque nas estrelas</p>
  <div class="estrelas">
    <button aria-label="1 estrela" onclick="pinta(1)">${STAR}</button>
    <button aria-label="2 estrelas" onclick="pinta(2)">${STAR}</button>
    <button aria-label="3 estrelas" onclick="pinta(3)">${STAR}</button>
    <button aria-label="4 estrelas" onclick="pinta(4)">${STAR}</button>
    <button aria-label="5 estrelas" onclick="pinta(5)">${STAR}</button>
  </div>
  <div class="nota" id="nota"></div>
</div>
<div id="resolver" class="resolver oculto">
  <div class="carinha">😔</div>
  <h1>Poxa, sentimos muito.</h1>
  <p>Queremos resolver isso <b>agora</b>. Chama a gente no WhatsApp
  que damos um jeito no seu pedido.</p>
  <a class="zap" id="zap" href="#" onclick="vib(15)">💬 Resolver no WhatsApp</a>
</div>
<div class="assinatura">linknacaixa.click</div>
</div>`

  return SHELL(`Avaliar — ${c.nome}`, body, script)
}

export function renderErro(mensagem: string, status: number): Response {
  const body = `
<div class="wrap">
<div class="flutua">😕</div>
<h1>Ops</h1>
<p class="err">${esc(mensagem)}</p>
</div>`
  return new Response(SHELL('Ops', body), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
