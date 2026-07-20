import { ativarComercio } from '@/lib/ativar'

// POST /api/ativar  { codigo, email, senha }
// Cria a conta do cliente e vincula ao comércio do código. Roda no worker.
export async function POST(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, erro: 'Requisição inválida.' }, 400)
  }

  const { codigo, email, senha } = (body ?? {}) as {
    codigo?: unknown
    email?: unknown
    senha?: unknown
  }

  if (typeof codigo !== 'string' || typeof email !== 'string' || typeof senha !== 'string') {
    return json({ ok: false, erro: 'Preencha código, e-mail e senha.' }, 400)
  }

  const emailLimpo = email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailLimpo)) {
    return json({ ok: false, erro: 'E-mail inválido.' }, 400)
  }
  if (senha.length < 8) {
    return json({ ok: false, erro: 'A senha precisa de ao menos 8 caracteres.' }, 400)
  }

  const r = await ativarComercio(codigo, emailLimpo, senha)
  return json(r, r.ok ? 200 : 400)
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
