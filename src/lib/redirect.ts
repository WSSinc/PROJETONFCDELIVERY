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
  logo_url: string | null
  ativo: boolean
  cupom_ativo: boolean
  cupom_texto: string | null
  cupom_codigo: string | null
  whatsapp_suporte: string | null
  avaliacao_inteligente: boolean
}

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Env ausente: ${name}`)
  return v
}

const SELECT_COLS =
  'id,slug,nome,modo_redirecionamento,link_unico_destino,link_pedido,link_avaliacao,logo_url,ativo,' +
  'cupom_ativo,cupom_texto,cupom_codigo,whatsapp_suporte,avaliacao_inteligente'

export async function fetchComercioBySlug(slug: string): Promise<Comercio | null> {
  const base = env('SUPABASE_URL')
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  const url =
    `${base}/rest/v1/comercios?slug=eq.${encodeURIComponent(slug)}` +
    `&select=${SELECT_COLS}&limit=1`

  const res = await fetch(url, {
    // Next cacheia fetch() por padrão no App Router. Sem isso, o comércio troca o
    // link no painel e o redirect continua servindo o destino antigo — quebra a
    // premissa central do produto ("vale na hora, sem regravar a tag").
    cache: 'no-store',
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

// ---------------------------------------------------------------------------
// Base de clientes + funil de avaliação (escrita só pelo worker, service_role)
// ---------------------------------------------------------------------------

function svcHeaders(): Record<string, string> {
  const key = env('SUPABASE_SERVICE_ROLE_KEY')
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

// As colunas token são uuid; navegador sem crypto.randomUUID manda string solta — descarta.
export function uuidOuNull(v: unknown): string | null {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
    ? v
    : null
}

// Extrai o número do WhatsApp de atendimento: campo dedicado ou o wa.me do link de pedido.
export function waSuporte(c: Comercio): string | null {
  const dedicado = c.whatsapp_suporte?.replace(/\D/g, '')
  if (dedicado && dedicado.length >= 10) return dedicado
  const m = c.link_pedido?.match(/wa\.me\/(\d{10,15})/)
  return m ? m[1] : null
}

// Upsert do cliente capturado pelo cupom (chave: comercio+whatsapp).
export async function salvarCliente(
  comercioId: string,
  whatsapp: string,
  nome: string | null,
  token: string | null,
): Promise<boolean> {
  const base = env('SUPABASE_URL')
  const res = await fetch(
    `${base}/rest/v1/clientes_finais?on_conflict=comercio_id,whatsapp`,
    {
      method: 'POST',
      headers: {
        ...svcHeaders(),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ comercio_id: comercioId, whatsapp, nome, token }),
    },
  )
  if (!res.ok) console.error(`salvarCliente falhou ${res.status} comercio=${comercioId}`)
  return res.ok
}

// Toque de um dispositivo já identificado: incrementa contador/último toque.
export async function registrarPresenca(comercioId: string, token: string): Promise<void> {
  const base = env('SUPABASE_URL')
  const res = await fetch(`${base}/rest/v1/rpc/registrar_presenca`, {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({ p_comercio: comercioId, p_token: token }),
  })
  if (!res.ok) console.error(`registrarPresenca falhou ${res.status}`)
}

export async function salvarAvaliacao(
  comercioId: string,
  estrelas: number,
  token: string | null,
): Promise<void> {
  const base = env('SUPABASE_URL')
  const res = await fetch(`${base}/rest/v1/avaliacoes`, {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=minimal' },
    body: JSON.stringify({ comercio_id: comercioId, estrelas, token }),
  })
  if (!res.ok) console.error(`salvarAvaliacao falhou ${res.status}`)
}
