// HTML das páginas do consumidor final (tag). String cru, mobile-first,
// CSS inline, JS mínimo sem framework — carrega em um round-trip.
// É a primeira impressão ao encostar a tag; nada bloqueia a pintura.

import type { Comercio } from './redirect'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SHELL = (title: string, body: string, script = '') => `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:#0f1115;color:#f4f5f7;display:flex;flex-direction:column;
  align-items:center;justify-content:center;min-height:100dvh;padding:24px;gap:18px}
h1{font-size:22px;font-weight:700;text-align:center;line-height:1.3}
.sub{font-size:15px;color:#9aa0aa;text-align:center;margin-top:-6px}
.btns{display:flex;flex-direction:column;gap:14px;width:100%;max-width:420px;margin-top:6px}
a.btn,button.btn{display:flex;align-items:center;justify-content:center;gap:10px;
  min-height:64px;border-radius:16px;font-size:19px;font-weight:700;border:0;cursor:pointer;
  text-decoration:none;color:#fff;-webkit-tap-highlight-color:transparent;width:100%}
a.pedido,button.pedido{background:#e8542b}
a.avaliacao{background:#f5a623;color:#1a1205}
.err{font-size:16px;color:#c7ccd4;text-align:center;max-width:360px;line-height:1.5}
.emoji{font-size:40px}
.logo{width:96px;height:96px;border-radius:22px;object-fit:contain;background:#fff;padding:8px}
/* cupom */
.cupom{width:100%;max-width:420px;border:1.5px dashed #f5a623;border-radius:16px;
  padding:16px;text-align:center;background:rgba(245,166,35,.06)}
.cupom b{color:#f5a623;font-size:17px}
.cupom p{font-size:13px;color:#9aa0aa;margin-top:4px}
.cupom .abrir{margin-top:10px;background:none;border:1.5px solid #f5a623;color:#f5a623;
  border-radius:10px;padding:10px 18px;font-size:15px;font-weight:700;cursor:pointer;width:100%}
.cupom input{width:100%;padding:13px;border-radius:10px;border:1px solid #3a3a45;
  background:#181b22;color:#f4f5f7;font-size:16px;margin-top:10px}
.cupom .lib{margin-top:10px;background:#f5a623;color:#1a1205;border:0;border-radius:10px;
  padding:13px;font-size:16px;font-weight:800;cursor:pointer;width:100%}
.cupom .cod{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:26px;font-weight:800;
  color:#f5a623;letter-spacing:.15em;margin:8px 0 2px}
.cupom .msgerr{color:#e07862;font-size:13px;margin-top:8px}
.oculto{display:none}
/* estrelas */
.estrelas{display:flex;gap:10px;margin-top:8px}
.estrelas button{background:none;border:0;font-size:44px;cursor:pointer;line-height:1;
  filter:grayscale(1);opacity:.45;transition:none;-webkit-tap-highlight-color:transparent}
.estrelas button.on{filter:none;opacity:1}
.resolver{width:100%;max-width:420px;text-align:center;display:flex;flex-direction:column;gap:12px}
.resolver p{font-size:15px;color:#c7ccd4;line-height:1.55}
a.zap{display:flex;align-items:center;justify-content:center;min-height:60px;border-radius:16px;
  font-size:18px;font-weight:700;text-decoration:none;color:#fff;background:#25d366}
</style></head><body>${body}${script ? `<script>${script}</script>` : ''}</body></html>`

// identidade anônima do dispositivo (localStorage) + ping de presença
const JS_IDENTIDADE = `
function lncToken(){try{var t=localStorage.getItem('lnc_token');
if(!t){t=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random());
localStorage.setItem('lnc_token',t)}return t}catch(e){return null}}
function lncPing(slug){var t=lncToken();if(!t)return;
try{fetch('/api/tag/presenca',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({slug:slug,token:t})})}catch(e){}}`

function marcaHtml(c: Comercio): string {
  return c.logo_url
    ? `<img class="logo" src="${esc(c.logo_url)}" alt="${esc(c.nome)}">`
    : `<div class="emoji">📦</div>`
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
    <p>Seu cupom:</p>
    <div class="cod">${esc(c.cupom_codigo as string)}</div>
    <p>Mostra ou fala esse código no pedido</p>
    <a class="btn pedido" style="margin-top:10px" href="${base}?tipo=pedido&cupom=1">🍔 Pedir agora com desconto</a>
  </div>
</div>` : ''

  const script = `${JS_IDENTIDADE}
lncPing(${JSON.stringify(c.slug)});
function abrirCupom(){document.getElementById('cupomFechado').classList.add('oculto');
document.getElementById('cupomForm').classList.remove('oculto');
document.getElementById('cWa').focus()}
function liberarCupom(){var wa=(document.getElementById('cWa').value||'').replace(/\\D/g,'');
var err=document.getElementById('cErr');err.classList.add('oculto');
if(wa.length<10||wa.length>13){err.textContent='Digite um WhatsApp válido com DDD.';err.classList.remove('oculto');return}
var b=document.getElementById('cBtn');b.disabled=true;b.textContent='Liberando…';
fetch('/api/tag/cupom',{method:'POST',headers:{'Content-Type':'application/json'},
body:JSON.stringify({slug:${JSON.stringify(c.slug)},whatsapp:wa,
nome:(document.getElementById('cNome').value||'').trim()||null,token:lncToken()})})
.then(function(r){return r.json()}).then(function(d){
if(d.ok){document.getElementById('cupomForm').classList.add('oculto');
document.getElementById('cupomOk').classList.remove('oculto')}
else{err.textContent=d.erro||'Não deu certo, tenta de novo.';err.classList.remove('oculto');
b.disabled=false;b.textContent='Liberar cupom'}})
.catch(function(){err.textContent='Sem conexão, tenta de novo.';err.classList.remove('oculto');
b.disabled=false;b.textContent='Liberar cupom'})}`

  const body = `
${marcaHtml(c)}
<h1>${esc(c.nome)}</h1>
<p class="sub">O que você quer fazer?</p>
${cupom}
<div class="btns">${botoes}</div>`

  return SHELL(c.nome, body, script)
}

// ---------------------------------------------------------------------------
// Página do funil de avaliação: 4-5⭐ → Google; 1-3⭐ → resolver no WhatsApp
// ---------------------------------------------------------------------------
export function renderAvaliar(c: Comercio): string {
  const script = `${JS_IDENTIDADE}
var sel=0;
function pinta(n){sel=n;var bs=document.querySelectorAll('.estrelas button');
for(var i=0;i<bs.length;i++){bs[i].classList.toggle('on',i<n)}
setTimeout(function(){enviar(n)},250)}
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
${marcaHtml(c)}
<div id="passo1" style="display:flex;flex-direction:column;align-items:center;gap:10px">
  <h1>Como foi seu pedido?</h1>
  <p class="sub">Toque nas estrelas</p>
  <div class="estrelas">
    <button aria-label="1 estrela" onclick="pinta(1)">⭐</button>
    <button aria-label="2 estrelas" onclick="pinta(2)">⭐</button>
    <button aria-label="3 estrelas" onclick="pinta(3)">⭐</button>
    <button aria-label="4 estrelas" onclick="pinta(4)">⭐</button>
    <button aria-label="5 estrelas" onclick="pinta(5)">⭐</button>
  </div>
</div>
<div id="resolver" class="resolver oculto">
  <div class="emoji">😔</div>
  <h1>Poxa, sentimos muito.</h1>
  <p>Queremos resolver isso <b>agora</b>. Chama a gente no WhatsApp
  que damos um jeito no seu pedido.</p>
  <a class="zap" id="zap" href="#">💬 Resolver no WhatsApp</a>
</div>`

  return SHELL(`Avaliar — ${c.nome}`, body, script)
}

export function renderErro(mensagem: string, status: number): Response {
  const body = `
<div class="emoji">😕</div>
<h1>Ops</h1>
<p class="err">${esc(mensagem)}</p>`
  return new Response(SHELL('Ops', body), {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
