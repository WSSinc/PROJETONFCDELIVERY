// Camada de dados do redirect. Fala PostgREST direto (fetch), sem supabase-js,
// para manter o caminho crítico leve no edge. Usa a service_role key: a leitura
// ignora RLS e busca só o que o redirect precisa.

export type TipoClique = 'pedido' | 'avaliacao'

export interface Comercio {
  id: string
  slug: string
  nome: string
  modo_redirecionamento: 'link_unico' | 'dois_botoes' | 'split_percentual'
  link_unico_destino: TipoClique
  link_pedido: string | null
  link_avaliacao: string | null
  ativo: boolean
}

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Env ausente: ${name}`)
  return v
}

const SELECT_COLS =
  'id,slug,nome,modo_redirecionamento,link_unico_destino,link_pedido,link_avaliacao,ativo'

export async function fetchComercioBySlug(slug: string): Promise<Comercio | null> {
  const base = env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const url =
    `${base}/rest/v1/comercios?slug=eq.${encodeURIComponent(slug)}` +
    `&select=${SELECT_COLS}&limit=1`

  const res = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/vnd.pgrst.object+json', // devolve objeto único ou 406
    },
  })

  if (res.status === 406 || res.status === 404) return null
  if (!res.ok) throw new Error(`comercios lookup ${res.status}`)
  return (await res.json()) as Comercio
}

export async function logAcesso(
  comercioId: string,
  tipoClique: TipoClique | null,
): Promise<void> {
  const base = env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')

  const res = await fetch(`${base}/rest/v1/acessos`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal', // não devolve a linha; insert mais barato
    },
    body: JSON.stringify({ comercio_id: comercioId, tipo_clique: tipoClique }),
  })

  if (!res.ok) {
    // Roda em waitUntil: não dá pra travar o usuário, mas deixa rastro no log do Worker.
    console.error(`logAcesso falhou ${res.status} comercio=${comercioId}`)
  }
}
