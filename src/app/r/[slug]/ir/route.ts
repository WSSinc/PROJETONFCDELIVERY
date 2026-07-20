import { getCloudflareContext } from '@opennextjs/cloudflare'
import { fetchComercioBySlug, logAcesso, type TipoClique } from '@/lib/redirect'
import { renderErro } from '@/lib/redirect-html'

function safeWaitUntil(promise: Promise<unknown>) {
  try {
    getCloudflareContext().ctx.waitUntil(promise)
  } catch {
    void promise
  }
}

// GET /r/<slug>/ir?tipo=pedido|avaliacao
// Chamado pelos botões da página intermediária. Loga o clique e redireciona.
export async function GET(
  req: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const slug = params.slug?.toLowerCase().trim()
  const tipoParam = new URL(req.url).searchParams.get('tipo')

  if (tipoParam !== 'pedido' && tipoParam !== 'avaliacao') {
    return renderErro('Opção inválida.', 400)
  }
  const tipo: TipoClique = tipoParam

  const comercio = await fetchComercioBySlug(slug)
  if (!comercio || !comercio.ativo) {
    return renderErro('Esta tag ainda não está configurada.', 404)
  }

  let destino = tipo === 'avaliacao' ? comercio.link_avaliacao : comercio.link_pedido
  if (!destino) {
    return renderErro('Destino ainda não configurado pelo estabelecimento.', 409)
  }

  // Pedido com cupom resgatado: se o destino é wa.me, já manda a mensagem pronta
  // com o código — o cliente só aperta enviar.
  const comCupom = new URL(req.url).searchParams.get('cupom') === '1'
  if (
    comCupom && tipo === 'pedido' &&
    comercio.cupom_ativo && comercio.cupom_codigo &&
    /^https:\/\/wa\.me\/\d+/.test(destino) && !destino.includes('text=')
  ) {
    const msg = encodeURIComponent(`Oi! Quero fazer um pedido com meu cupom ${comercio.cupom_codigo} 🎁`)
    destino += `${destino.includes('?') ? '&' : '?'}text=${msg}`
  }

  safeWaitUntil(logAcesso(comercio.id, tipo))
  // new Response(...) em vez de Response.redirect(): o header guard "immutable"
  // do Response.redirect() quebra o sandbox de edge runtime do `next dev`.
  return new Response(null, { status: 302, headers: { Location: destino } })
}
