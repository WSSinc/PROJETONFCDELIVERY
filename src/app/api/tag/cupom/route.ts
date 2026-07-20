import { fetchComercioBySlug, salvarCliente, uuidOuNull } from '@/lib/redirect'

// POST /api/tag/cupom  { slug, whatsapp, nome?, token? }
// Captura o cliente na base do comércio e libera o código do cupom.
export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try { body = await req.json() } catch { return json({ ok: false, erro: 'Requisição inválida.' }, 400) }

  const { slug, whatsapp, nome, token } = (body ?? {}) as {
    slug?: unknown; whatsapp?: unknown; nome?: unknown; token?: unknown
  }
  if (typeof slug !== 'string' || typeof whatsapp !== 'string') {
    return json({ ok: false, erro: 'Dados incompletos.' }, 400)
  }

  const wa = whatsapp.replace(/\D/g, '')
  if (wa.length < 10 || wa.length > 13) {
    return json({ ok: false, erro: 'WhatsApp inválido — use DDD + número.' }, 400)
  }

  const comercio = await fetchComercioBySlug(slug.toLowerCase().trim())
  if (!comercio || !comercio.ativo) return json({ ok: false, erro: 'Tag não encontrada.' }, 404)
  if (!comercio.cupom_ativo || !comercio.cupom_codigo) {
    return json({ ok: false, erro: 'Cupom indisponível no momento.' }, 409)
  }

  const salvo = await salvarCliente(
    comercio.id,
    wa,
    typeof nome === 'string' && nome.trim() ? nome.trim().slice(0, 80) : null,
    uuidOuNull(token),
  )
  if (!salvo) return json({ ok: false, erro: 'Não deu certo, tenta de novo.' }, 500)

  return json({ ok: true, codigo: comercio.cupom_codigo })
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
