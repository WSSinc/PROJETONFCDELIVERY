import { fetchComercioBySlug, registrarPresenca, uuidOuNull } from '@/lib/redirect'

// POST /api/tag/presenca  { slug, token }
// Ping do dispositivo já identificado: atualiza toques/último toque do cliente.
export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try { body = await req.json() } catch { return resp204() }

  const { slug, token } = (body ?? {}) as { slug?: unknown; token?: unknown }
  const tok = uuidOuNull(token)
  if (typeof slug !== 'string' || !tok) return resp204()

  const comercio = await fetchComercioBySlug(slug.toLowerCase().trim())
  if (comercio) await registrarPresenca(comercio.id, tok)
  return resp204()
}

function resp204(): Response {
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}
