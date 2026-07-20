'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { slugUnico } from '@/lib/slug'

interface ComercioTotais {
  comercio_id: string
  slug: string
  nome: string
  modo_redirecionamento: 'link_unico' | 'dois_botoes' | 'split_percentual'
  ativo: boolean
  criado_em: string
  codigo_ativacao: string
  ativado_em: string | null
  tem_dono: boolean
  total_acessos: number
  cliques_pedido: number
  cliques_avaliacao: number
  ultimo_acesso: string | null
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [comercios, setComercios] = useState<ComercioTotais[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const [novoNome, setNovoNome] = useState('')
  const [novoPedido, setNovoPedido] = useState('')
  const [novaAvaliacao, setNovaAvaliacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getSession()
    if (!sessao.session) {
      router.replace('/login')
      return
    }
    const { data: ehAdmin } = await supabase.rpc('is_admin')
    if (!ehAdmin) {
      router.replace('/painel')
      return
    }
    const { data, error } = await supabase
      .from('comercio_totais')
      .select('*')
      .order('criado_em', { ascending: false })
    if (error) setErro(`Erro ao carregar: ${error.message}`)
    else setComercios((data ?? []) as ComercioTotais[])
    setCarregando(false)
  }, [router, supabase])

  useEffect(() => {
    void carregar()
  }, [carregar])

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setOkMsg(null)
    setSalvando(true)

    const existentes = new Set(comercios.map((c) => c.slug))
    const slug = slugUnico(novoNome, existentes)

    const { data: criado, error } = await supabase.from('comercios').insert({
      slug,
      nome: novoNome.trim(),
      link_pedido: novoPedido.trim() || null,
      link_avaliacao: novaAvaliacao.trim() || null,
    }).select('codigo_ativacao').single()

    if (error) {
      setErro(`Erro ao cadastrar: ${error.message}`)
    } else {
      setOkMsg(`Comércio criado! Tag: /r/${slug} · Código de ativação do cliente: ${criado?.codigo_ativacao ?? '—'}`)
      setNovoNome('')
      setNovoPedido('')
      setNovaAvaliacao('')
      await carregar()
    }
    setSalvando(false)
  }

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (carregando) {
    return <main className="container"><p className="sub">Carregando…</p></main>
  }

  const totalAcessos = comercios.reduce((s, c) => s + Number(c.total_acessos), 0)
  const totalPedido = comercios.reduce((s, c) => s + Number(c.cliques_pedido), 0)
  const totalAvaliacao = comercios.reduce((s, c) => s + Number(c.cliques_avaliacao), 0)

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <h1>Admin</h1>
          <p className="sub" style={{ marginBottom: 0 }}>Todos os comércios do sistema</p>
        </div>
        <button className="btn-ghost" onClick={sair}>Sair</button>
      </div>

      <div className="kpis">
        <div className="kpi"><b>{comercios.length}</b><span>comércios</span></div>
        <div className="kpi"><b>{totalAcessos}</b><span>acessos totais</span></div>
        <div className="kpi"><b>{totalPedido}</b><span>cliques em pedido</span></div>
        <div className="kpi"><b>{totalAvaliacao}</b><span>cliques em avaliação</span></div>
      </div>

      <div className="card">
        <h2>Cadastrar novo comércio</h2>
        <form onSubmit={cadastrar}>
          <div className="row">
            <div>
              <label htmlFor="nome">Nome do comércio</label>
              <input id="nome" required minLength={2} value={novoNome}
                placeholder="Hamburgueria do João"
                onChange={(e) => setNovoNome(e.target.value)} />
            </div>
            <div>
              <label htmlFor="lp">Link de pedido (opcional)</label>
              <input id="lp" type="url" value={novoPedido}
                placeholder="https://wa.me/55..."
                onChange={(e) => setNovoPedido(e.target.value)} />
            </div>
            <div>
              <label htmlFor="la">Link de avaliação (opcional)</label>
              <input id="la" type="url" value={novaAvaliacao}
                placeholder="https://g.page/r/..."
                onChange={(e) => setNovaAvaliacao(e.target.value)} />
            </div>
            <div style={{ flex: '0 0 auto', minWidth: 0 }}>
              <button className="btn-primary" type="submit" disabled={salvando || novoNome.trim().length < 2}>
                {salvando ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </div>
        </form>
        {okMsg && <p className="msg-ok">{okMsg}</p>}
        {erro && <p className="msg-err">{erro}</p>}
      </div>

      <div className="card">
        <h2>Comércios ({comercios.length})</h2>
        {comercios.length === 0 ? (
          <p className="sub">Nenhum comércio ainda. Cadastre o primeiro acima.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th><th>Tag</th><th>Ativação</th><th>Modo</th>
                  <th>Acessos</th><th>Pedido</th><th>Avaliação</th><th>Último acesso</th>
                </tr>
              </thead>
              <tbody>
                {comercios.map((c) => (
                  <tr key={c.comercio_id}>
                    <td>{c.nome}{!c.ativo && <> <span className="tag tag-off">inativo</span></>}</td>
                    <td><a className="mono" href={`/r/${c.slug}`} target="_blank" rel="noreferrer">/r/{c.slug}</a></td>
                    <td>
                      {c.tem_dono ? (
                        <span className="tag tag-uni">✓ ativado</span>
                      ) : (
                        <button
                          className="mono"
                          title="Clique para copiar o código"
                          onClick={() => { void navigator.clipboard.writeText(c.codigo_ativacao) }}
                          style={{ background: '#3a2b14', color: 'var(--brand2)', border: 0, padding: '3px 10px', borderRadius: 8, cursor: 'pointer', letterSpacing: '0.1em' }}
                        >
                          {c.codigo_ativacao} ⧉
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`tag ${c.modo_redirecionamento === 'dois_botoes' ? 'tag-dois' : 'tag-uni'}`}>
                        {c.modo_redirecionamento === 'dois_botoes' ? '2 botões' : 'link único'}
                      </span>
                    </td>
                    <td>{c.total_acessos}</td>
                    <td>{c.cliques_pedido}</td>
                    <td>{c.cliques_avaliacao}</td>
                    <td className="sub" style={{ marginBottom: 0 }}>
                      {c.ultimo_acesso ? new Date(c.ultimo_acesso).toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
