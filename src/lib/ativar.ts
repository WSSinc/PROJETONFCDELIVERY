// Ativação de conta por código (server-side, roda no worker com a service_role).
// Valida o código, cria o usuário já confirmado e vincula ao comércio — de forma
// atômica contra corrida (dois cadastros com o mesmo código ao mesmo tempo).

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Env ausente: ${name}`)
  return v
}

export interface AtivarResult {
  ok: boolean
  erro?: string
  slug?: string
  nome?: string
}

// Normaliza o que o cliente digita: maiúsculas, só letras/números do alfabeto do código.
export function normalizarCodigo(bruto: string): string {
  return bruto.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function ativarComercio(
  codigoBruto: string,
  email: string,
  senha: string,
): Promise<AtivarResult> {
  const base = env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const auth = { apikey: key, Authorization: `Bearer ${key}` }

  const codigo = normalizarCodigo(codigoBruto)
  if (codigo.length !== 8) return { ok: false, erro: 'Código de ativação inválido.' }

  // 1) Localiza o comércio pelo código.
  const busca = await fetch(
    `${base}/rest/v1/comercios?codigo_ativacao=eq.${encodeURIComponent(codigo)}` +
      `&select=id,slug,nome,owner_id&limit=1`,
    { headers: { ...auth, Accept: 'application/vnd.pgrst.object+json' } },
  )
  if (busca.status === 406 || busca.status === 404) {
    return { ok: false, erro: 'Código não encontrado. Confira com quem te vendeu o kit.' }
  }
  if (!busca.ok) return { ok: false, erro: 'Não foi possível validar o código agora.' }

  const comercio = (await busca.json()) as { id: string; slug: string; nome: string; owner_id: string | null }
  if (comercio.owner_id) {
    return { ok: false, erro: 'Este código já foi ativado. Se a conta é sua, faça login.' }
  }

  // 2) Cria o usuário já confirmado (não depende de e-mail de confirmação).
  const criar = await fetch(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: senha, email_confirm: true }),
  })
  if (!criar.ok) {
    const corpo = await criar.text()
    if (criar.status === 422 || /already|exist|registered/i.test(corpo)) {
      return { ok: false, erro: 'Este e-mail já tem conta. Faça login em vez de ativar.' }
    }
    return { ok: false, erro: 'Não foi possível criar a conta. Tente outro e-mail.' }
  }
  const usuario = (await criar.json()) as { id: string }

  // 3) Vincula o comércio — só se ainda estiver órfão (owner_id is null).
  //    O filtro is.null torna o UPDATE atômico contra duas ativações simultâneas.
  const vincular = await fetch(
    `${base}/rest/v1/comercios?id=eq.${comercio.id}&owner_id=is.null`,
    {
      method: 'PATCH',
      headers: { ...auth, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ owner_id: usuario.id, ativado_em: new Date().toISOString() }),
    },
  )
  if (!vincular.ok) return { ok: false, erro: 'Erro ao vincular a conta ao comércio.' }

  const atualizados = (await vincular.json()) as unknown[]
  if (!Array.isArray(atualizados) || atualizados.length === 0) {
    // Corrida: alguém ativou entre a busca e o update.
    return { ok: false, erro: 'Este código acabou de ser ativado por outra conta.' }
  }

  return { ok: true, slug: comercio.slug, nome: comercio.nome }
}
