// One-pager de vendas em linknacaixa.click/vendas.
// HTML cru e auto-contido (mesmo padrão do redirect): zero JS, uma viagem só,
// estilizado pra tela e pra impressão em A4 (Ctrl+P vira o PDF de vendas).

const HTML = `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Adesivo NFC na embalagem do seu delivery: o cliente encosta o celular e volta a pedir direto no seu WhatsApp, sem comissão. Teste 30 dias grátis.">
<title>LinkNaCaixa — sua embalagem trazendo o cliente de volta</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #e6e2d8;
    font-family: "Segoe UI", -apple-system, Roboto, sans-serif;
    color: #14141c;
    display: flex;
    justify-content: center;
    padding: 32px 12px;
  }
  .folha {
    background: #f3f0e8;
    width: 100%;
    max-width: 794px;
    padding: 46px 52px 40px;
    box-shadow: 0 10px 40px rgba(0,0,0,.25);
  }
  header {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    padding-bottom: 18px; border-bottom: 2px solid #14141c;
  }
  .marca { display: flex; align-items: center; gap: 12px; }
  .marca-nome { font-size: 21px; font-weight: 800; letter-spacing: -0.02em; }
  .marca-nome span { color: #a35f35; }
  .marca-tag {
    font-family: ui-monospace, Consolas, monospace; font-size: 11px;
    color: #3a3a45; text-align: right; line-height: 1.5;
  }
  .gancho { padding: 30px 0 8px; }
  h1 {
    font-size: 33px; font-weight: 800; line-height: 1.12;
    letter-spacing: -0.025em; text-wrap: balance; max-width: 20ch;
  }
  h1 em { font-style: normal; color: #a35f35; }
  .gancho p { margin-top: 12px; font-size: 15px; color: #3a3a45; max-width: 58ch; line-height: 1.55; }
  .rotulo {
    font-family: ui-monospace, Consolas, monospace; font-size: 11px; font-weight: 600;
    letter-spacing: 0.18em; text-transform: uppercase; color: #a35f35; margin: 26px 0 12px;
  }
  .passos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .passo { border: 1px solid #d8d2c4; background: #faf8f3; padding: 14px 15px 16px; }
  .passo b { display: block; font-size: 14.5px; margin: 8px 0 5px; letter-spacing: -0.01em; }
  .passo p { font-size: 12.5px; color: #3a3a45; line-height: 1.5; }
  .passo-n {
    font-family: ui-monospace, Consolas, monospace; font-size: 12px; font-weight: 700;
    color: #f3f0e8; background: #14141c; width: 22px; height: 22px;
    display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;
  }
  .ganhos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 26px; }
  .ganho { display: flex; gap: 9px; align-items: baseline; font-size: 13.5px; line-height: 1.5; }
  .ganho::before { content: "✓"; color: #2e8f5f; font-weight: 800; flex: 0 0 auto; }
  .conta {
    margin-top: 6px; background: #14141c; color: #f3f0e8; padding: 18px 22px;
    display: flex; align-items: center; gap: 22px; flex-wrap: wrap;
  }
  .conta-num {
    font-family: ui-monospace, Consolas, monospace; font-size: 30px; font-weight: 700;
    color: #c97b4a; white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .conta p { font-size: 13px; line-height: 1.55; max-width: 46ch; opacity: .92; }
  .conta p b { color: #fff; }
  .oferta { margin-top: 26px; border: 2px solid #a35f35; padding: 20px 22px 18px; position: relative; }
  .oferta-selo {
    position: absolute; top: -11px; left: 18px; background: #a35f35; color: #f3f0e8;
    font-family: ui-monospace, Consolas, monospace; font-size: 10.5px; font-weight: 700;
    letter-spacing: 0.14em; text-transform: uppercase; padding: 4px 10px;
  }
  .oferta h2 { font-size: 19px; font-weight: 800; letter-spacing: -0.015em; margin-bottom: 8px; }
  .oferta > p { font-size: 13.5px; line-height: 1.6; color: #3a3a45; max-width: 66ch; }
  .oferta-itens { display: flex; gap: 8px 22px; flex-wrap: wrap; margin-top: 12px; }
  .oferta-item { font-size: 12.5px; font-weight: 600; display: flex; gap: 7px; align-items: baseline; }
  .oferta-item::before { content: "→"; color: #a35f35; font-weight: 800; }
  footer {
    margin-top: 28px; padding-top: 16px; border-top: 1px solid #d8d2c4;
    display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap;
  }
  .contato b { display: block; font-size: 15px; }
  .contato a {
    font-family: ui-monospace, Consolas, monospace; font-size: 13px;
    color: #a35f35; text-decoration: none; font-weight: 700;
  }
  .site { font-family: ui-monospace, Consolas, monospace; font-size: 12px; color: #3a3a45; text-align: right; line-height: 1.6; }
  .site b { color: #14141c; }
  @media (max-width: 640px) {
    .folha { padding: 30px 22px; }
    .passos, .ganhos { grid-template-columns: 1fr; }
    h1 { font-size: 27px; }
  }
  @media print {
    body { background: #fff; padding: 0; }
    .folha { box-shadow: none; max-width: none; padding: 24px 34px; }
    .conta { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style></head><body>
<div class="folha">
  <header>
    <div class="marca">
      <svg width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true">
        <circle cx="11" cy="23" r="3.2" fill="#c97b4a"/>
        <path d="M11 14.5 A8.5 8.5 0 0 1 19.5 23" stroke="#c97b4a" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M11 7.5 A15.5 15.5 0 0 1 26.5 23" stroke="#14141c" stroke-width="2.4" stroke-linecap="round"/>
      </svg>
      <div class="marca-nome">link<span>na</span>caixa</div>
    </div>
    <div class="marca-tag">tag NFC na embalagem<br>linknacaixa.click</div>
  </header>

  <section class="gancho">
    <h1>Sua embalagem morre no lixo. <em>E se ela trouxesse o cliente de volta?</em></h1>
    <p>Um adesivo inteligente colado na caixa do seu delivery. O cliente encosta o
    celular e cai direto no seu WhatsApp para pedir de novo — ou avalia você no
    Google. Sem aplicativo, sem comissão, sem mudar nada na sua operação.</p>
  </section>

  <div class="rotulo">Como funciona</div>
  <section class="passos">
    <div class="passo">
      <span class="passo-n">1</span>
      <b>A gente cola, você despacha</b>
      <p>Instalamos os adesivos NFC. Sua equipe só cola um em cada embalagem, junto com o lacre. Nada muda na cozinha.</p>
    </div>
    <div class="passo">
      <span class="passo-n">2</span>
      <b>O cliente encosta o celular</b>
      <p>Ao receber o pedido, ele aproxima o celular do adesivo — abre na hora uma página com a sua marca. Funciona em iPhone e Android, sem app.</p>
    </div>
    <div class="passo">
      <span class="passo-n">3</span>
      <b>Ele volta a pedir — direto de você</b>
      <p>Um toque leva pro seu WhatsApp de pedidos ou pra sua avaliação no Google. Você acompanha cada toque num painel em tempo real.</p>
    </div>
  </section>

  <div class="rotulo">O que você ganha</div>
  <section class="ganhos">
    <div class="ganho"><span><b>Pedidos direto no seu WhatsApp</b> — sem pagar comissão de aplicativo</span></div>
    <div class="ganho"><span><b>Mais avaliações no Google</b> — quem amou avalia na hora, com um toque</span></div>
    <div class="ganho"><span><b>Painel em tempo real</b> — veja quantos clientes tocaram, por dia e por horário</span></div>
    <div class="ganho"><span><b>Troque o destino quando quiser</b> — promoção nova? Muda o link na hora, sem trocar adesivo</span></div>
  </section>

  <div class="rotulo">A conta que importa</div>
  <section class="conta">
    <div class="conta-num">R$ 150/mês</div>
    <p>É o que você economiza se apenas <b>10 pedidos por mês</b> (ticket de R$ 60)
    migrarem do aplicativo — que cobra ~25% — para o seu WhatsApp.
    <b>O kit se paga no primeiro mês.</b></p>
  </section>

  <section class="oferta">
    <span class="oferta-selo">Teste sem risco</span>
    <h2>30 dias grátis. Eu instalo tudo. Você não paga nada.</h2>
    <p>Deixo 50 adesivos prontos com a sua marca e o painel configurado. Em 30 dias
    volto e te mostro os números reais. Não gostou? Retiro tudo e a conversa acaba
    aí — sem custo, sem fidelidade, sem pegadinha.</p>
    <div class="oferta-itens">
      <span class="oferta-item">Instalação por minha conta</span>
      <span class="oferta-item">Sem mensalidade no teste</span>
      <span class="oferta-item">Cancelou, acabou</span>
    </div>
  </section>

  <footer>
    <div class="contato">
      <b>Quer ver funcionando na sua caixa?</b>
      <a href="https://wa.me/5547996402819?text=Oi!%20Quero%20ver%20o%20LinkNaCaixa%20funcionando.">WhatsApp: (47) 99640-2819</a>
    </div>
    <div class="site">
      demonstração ao vivo em 30 segundos<br>
      <b>linknacaixa.click</b>
    </div>
  </footer>
</div>
</body></html>`

export function GET(): Response {
  return new Response(HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // página estática de vendas: pode cachear no edge por 1h
      'Cache-Control': 'public, max-age=300, s-maxage=3600',
    },
  })
}
