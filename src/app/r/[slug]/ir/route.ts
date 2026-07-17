import { getRequestContext } from '@cloudflare/next-on-pages'
import { fetchComercioBySlug, logAcesso, type TipoClique } from '@/lib/redirect'
import { renderErro } from '@/lib/redirect-html'

export const runtime = 'edge'

function safeWaitUntil(promise: Promise<unknown>) {
  try {
    getRequestContext().ctx.waitUntil(promise)
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

  const destino = tipo === 'avaliacao' ? comercio.link_avaliacao : comercio.link_pedido
  if (!destino) {
    return renderErro('Destino ainda não configurado pelo estabelecimento.', 409)
  }

  safeWaitUntil(logAcesso(comercio.id, tipo))
  return Response.redirect(destino, 302)
}
