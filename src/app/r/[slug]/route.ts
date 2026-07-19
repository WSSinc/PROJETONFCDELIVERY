import { getCloudflareContext } from '@opennextjs/cloudflare'
import { fetchComercioBySlug, logAcesso, type TipoClique } from '@/lib/redirect'
import { renderDoisBotoes, renderErro } from '@/lib/redirect-html'

const REDIRECT_HEADERS = {
  // Sem cache no destino: a graça do produto é o comércio trocar o link e valer na hora.
  'Cache-Control': 'no-store, max-age=0',
}

function safeWaitUntil(promise: Promise<unknown>) {
  try {
    getCloudflareContext().ctx.waitUntil(promise)
  } catch {
    // Fora do runtime da Cloudflare (ex: dev local) — deixa a promise rodar solta.
    void promise
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { slug: string } },
): Promise<Response> {
  const slug = params.slug?.toLowerCase().trim()
  if (!slug) return renderErro('Tag inválida.', 400)

  const comercio = await fetchComercioBySlug(slug)
  if (!comercio || !comercio.ativo) {
    return renderErro('Esta tag ainda não está configurada.', 404)
  }

  if (comercio.modo_redirecionamento === 'dois_botoes') {
    // Página intermediária: o clique é logado pelo route /ir, não aqui.
    return new Response(renderDoisBotoes(comercio), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...REDIRECT_HEADERS },
    })
  }

  // link_unico (e fallback de split_percentual até o app implementar o sorteio).
  const tipo: TipoClique = comercio.link_unico_destino
  const destino = tipo === 'avaliacao' ? comercio.link_avaliacao : comercio.link_pedido
  if (!destino) {
    return renderErro('Destino ainda não configurado pelo estabelecimento.', 409)
  }

  // Log fire-and-forget: o 302 sai imediatamente, o insert termina em segundo plano.
  safeWaitUntil(logAcesso(comercio.id, null))

  // new Response(...) em vez de Response.redirect(): o header guard "immutable"
  // do Response.redirect() quebra o sandbox de edge runtime do `next dev`.
  return new Response(null, { status: 302, headers: { Location: destino, ...REDIRECT_HEADERS } })
}
