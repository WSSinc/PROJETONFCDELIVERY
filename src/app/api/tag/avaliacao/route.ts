import { fetchComercioBySlug, logAcesso, salvarAvaliacao, uuidOuNull, waSuporte } from '@/lib/redirect'

// POST /api/tag/avaliacao  { slug, estrelas, token? }
// O funil decide o destino no servidor:
//   4-5 estrelas -> Google (registra também um acesso 'avaliacao', mantendo as métricas)
//   1-3 estrelas -> WhatsApp de atendimento do dono (intercepta antes do review público)
export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try { body = await req.json() } catch { return json({ ok: false }, 400) }

  const { slug, estrelas, token } = (body ?? {}) as {
    slug?: unknown; estrelas?: unknown; token?: unknown
  }
  const n = typeof estrelas === 'number' ? Math.round(estrelas) : NaN
  if (typeof slug !== 'string' || !(n >= 1 && n <= 5)) return json({ ok: false }, 400)

  const comercio = await fetchComercioBySlug(slug.toLowerCase().trim())
  if (!comercio || !comercio.ativo) return json({ ok: false }, 404)

  await salvarAvaliacao(comercio.id, n, uuidOuNull(token))

  if (n >= 4) {
    if (comercio.link_avaliacao) {
      await logAcesso(comercio.id, 'avaliacao')
      return json({ ok: true, acao: 'ir', url: comercio.link_avaliacao })
    }
    return json({ ok: true, acao: 'ir', url: '/' })
  }

  // Insatisfeito: rota de resolução privada.
  const numero = waSuporte(comercio)
  const msg = encodeURIComponent(
    `Olá! Acabei de receber meu pedido do ${comercio.nome} e tive um problema. Pode me ajudar?`,
  )
  return json({
    ok: true,
    acao: 'resolver',
    url: numero ? `https://wa.me/${numero}?text=${msg}` : null,
  })
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
