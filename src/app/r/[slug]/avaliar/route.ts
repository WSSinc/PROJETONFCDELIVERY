import { fetchComercioBySlug } from '@/lib/redirect'
import { renderAvaliar, renderErro } from '@/lib/redirect-html'

// GET /r/<slug>/avaliar — funil de avaliação (estrelas).
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
  if (!comercio.link_avaliacao) {
    return renderErro('Avaliação ainda não configurada pelo estabelecimento.', 409)
  }

  return new Response(renderAvaliar(comercio), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
    },
  })
}
