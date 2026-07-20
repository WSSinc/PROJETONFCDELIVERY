// HTML da página intermediária e de erro. String cru, mobile-first, zero JS,
// zero fonte externa, CSS inline — carrega em um round-trip. É a primeira
// impressão do consumidor ao encostar a tag; nada bloqueia a pintura.

import type { Comercio } from './redirect'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SHELL = (title: string, body: string) => `<!doctype html>
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
  align-items:center;justify-content:center;min-height:100dvh;padding:24px;gap:20px}
h1{font-size:22px;font-weight:700;text-align:center;line-height:1.3}
.sub{font-size:15px;color:#9aa0aa;text-align:center;margin-top:-8px}
.btns{display:flex;flex-direction:column;gap:14px;width:100%;max-width:420px;margin-top:8px}
a.btn{display:flex;align-items:center;justify-content:center;gap:10px;
  min-height:64px;border-radius:16px;font-size:19px;font-weight:700;
  text-decoration:none;color:#fff;-webkit-tap-highlight-color:transparent}
a.pedido{background:#e8542b}
a.avaliacao{background:#f5a623;color:#1a1205}
.err{font-size:16px;color:#c7ccd4;text-align:center;max-width:360px;line-height:1.5}
.emoji{font-size:40px}
.logo{width:96px;height:96px;border-radius:22px;object-fit:contain;background:#fff;padding:8px}
</style></head><body>${body}</body></html>`

export function renderDoisBotoes(c: Comercio): string {
  const base = `/r/${encodeURIComponent(c.slug)}/ir`
  const temPedido = !!c.link_pedido
  const temAvaliacao = !!c.link_avaliacao

  const botoes = [
    temPedido
      ? `<a class="btn pedido" href="${base}?tipo=pedido">🍔 Pedir de novo</a>`
      : '',
    temAvaliacao
      ? `<a class="btn avaliacao" href="${base}?tipo=avaliacao">⭐ Avaliar</a>`
      : '',
  ].join('')

  const marca = c.logo_url
    ? `<img class="logo" src="${esc(c.logo_url)}" alt="${esc(c.nome)}">`
    : `<div class="emoji">📦</div>`

  const body = `
${marca}
<h1>${esc(c.nome)}</h1>
<p class="sub">O que você quer fazer?</p>
<div class="btns">${botoes}</div>`

  return SHELL(c.nome, body)
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
