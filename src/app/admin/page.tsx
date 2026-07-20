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
  logo_url: string | null
  total_acessos: number
  cliques_pedido: number
  cliques_avaliacao: number
  ultimo_acesso: string | null
}

interface EditState {
  id: string
  slug: string
  nome: string
  logo_url: string | null
  logoFile: File | null
  logoPreview: string | null
  link_pedido: string
  link_avaliacao: string
  modo: 'link_unico' | 'dois_botoes'
  link_unico_destino: 'pedido' | 'avaliacao'
  ativo: boolean
}

export default function AdminPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [carregando, setCarregando] = useState(true)
  const [comercios, setComercios] = useState<ComercioTotais[]>([])
  const [erro, setErro] = useState<string | null>(null)

  const [novoNome, setNovoNome] = useState('')
  const [novoPedido, setNovoPedido] = useState('')
  const [novaAvaliacao, setNovaAvaliacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // edição da loja
  const [ed, setEd] = useState<EditState | null>(null)
  const [salvandoEd, setSalvandoEd] = useState(false)
  const [erroEd, setErroEd] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getSession()
    if (!sessao.session) { router.replace('/login'); return }
    const { data: ehAdmin } = await supabase.rpc('is_admin')
    if (!ehAdmin) { router.replace('/painel'); return }
    const { data, error } = await supabase
      .from('comercio_totais')
      .select('*')
      .order('criado_em', { ascending: false })
    if (error) setErro(`Erro ao carregar: ${error.message}`)
    else setComercios((data ?? []) as ComercioTotais[])
    setCarregando(false)
  }, [router, supabase])

  useEffect(() => { void carregar() }, [carregar])

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null); setOkMsg(null); setSalvando(true)

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
      setNovoNome(''); setNovoPedido(''); setNovaAvaliacao('')
      await carregar()
    }
    setSalvando(false)
  }

  async function abrirConfig(c: ComercioTotais) {
    setErroEd(null)
    // Busca os campos completos da loja (a view não traz os links).
    const { data, error } = await supabase
      .from('comercios')
      .select('id,slug,nome,logo_url,link_pedido,link_avaliacao,modo_redirecionamento,link_unico_destino,ativo')
      .eq('id', c.comercio_id)
      .single()
    if (error || !data) { setErroEd('Erro ao abrir a loja.'); return }
    setEd({
      id: data.id,
      slug: data.slug,
      nome: data.nome,
      logo_url: data.logo_url,
      logoFile: null,
      logoPreview: null,
      link_pedido: data.link_pedido ?? '',
      link_avaliacao: data.link_avaliacao ?? '',
      modo: data.modo_redirecionamento === 'dois_botoes' ? 'dois_botoes' : 'link_unico',
      link_unico_destino: data.link_unico_destino === 'avaliacao' ? 'avaliacao' : 'pedido',
      ativo: data.ativo,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !ed) return
    if (file.size > 512 * 1024) { setErroEd('A logo precisa ter no máximo 512 KB.'); return }
    setErroEd(null)
    setEd({ ...ed, logoFile: file, logoPreview: URL.createObjectURL(file) })
  }

  async function salvarConfig(e: React.FormEvent) {
    e.preventDefault()
    if (!ed) return
    setErroEd(null); setSalvandoEd(true)

    let logoUrl = ed.logo_url
    try {
      if (ed.logoFile) {
        const ext = (ed.logoFile.name.split('.').pop() || 'png').toLowerCase()
        const path = `${ed.slug}-${Date.now()}.${ext}`
        const up = await supabase.storage.from('logos').upload(path, ed.logoFile, {
          upsert: true, contentType: ed.logoFile.type,
        })
        if (up.error) throw new Error(up.error.message)
        logoUrl = supabase.storage.from('logos').getPublicUrl(path).data.publicUrl
      }

      const { error } = await supabase.from('comercios').update({
        nome: ed.nome.trim(),
        logo_url: logoUrl,
        link_pedido: ed.link_pedido.trim() || null,
        link_avaliacao: ed.link_avaliacao.trim() || null,
        modo_redirecionamento: ed.modo,
        link_unico_destino: ed.link_unico_destino,
        ativo: ed.ativo,
      }).eq('id', ed.id)
      if (error) throw new Error(error.message)

      setOkMsg(`Loja "${ed.nome.trim()}" atualizada.`)
      setEd(null)
      await carregar()
    } catch (err) {
      setErroEd(`Erro ao salvar: ${err instanceof Error ? err.message : 'desconhecido'}`)
    }
    setSalvandoEd(false)
  }

  function removerLogo() {
    if (!ed) return
    setEd({ ...ed, logo_url: null, logoFile: null, logoPreview: null })
  }

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (carregando) return <main className="container"><p className="sub">Carregando…</p></main>

  const totalAcessos = comercios.reduce((s, c) => s + Number(c.total_acessos), 0)
  const totalPedido = comercios.reduce((s, c) => s + Number(c.cliques_pedido), 0)
  const totalAvaliacao = comercios.reduce((s, c) => s + Number(c.cliques_avaliacao), 0)
  const logoAtual = ed?.logoPreview ?? ed?.logo_url ?? null

  return (
    <main className="container">
      <div className="topbar">
        <div>
          <h1>Admin</h1>
          <p className="sub" style={{ marginBottom: 0 }}>Todos os comércios do sistema</p>
        </div>
        <button className="btn-ghost" onClick={sair}>Sair</button>
      </div>

      {/* PAINEL DE CONFIGURAÇÃO DA LOJA */}
      {ed && (
        <div className="card" style={{ borderColor: 'var(--brand)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginBottom: 0 }}>Configurar loja · <span className="mono">/r/{ed.slug}</span></h2>
            <button className="btn-ghost" onClick={() => setEd(null)}>Fechar</button>
          </div>

          <form onSubmit={salvarConfig} style={{ marginTop: 14 }}>
            {/* Logo */}
            <label>Logo da loja (aparece pro cliente ao encostar a tag)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '6px 0 4px' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 14, flex: '0 0 auto',
                background: logoAtual ? '#fff' : 'var(--surface)',
                border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {logoAtual
                  ? <img src={logoAtual} alt="logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <span className="sub" style={{ margin: 0, fontSize: 22 }}>🏪</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={escolherLogo} />
                {logoAtual && (
                  <button type="button" className="btn-ghost" style={{ fontSize: 13, padding: '6px 12px' }} onClick={removerLogo}>
                    Remover logo
                  </button>
                )}
                <span className="sub" style={{ margin: 0, fontSize: 12 }}>PNG, JPG, WEBP ou SVG · até 512 KB</span>
              </div>
            </div>

            <div className="row" style={{ marginTop: 8 }}>
              <div>
                <label htmlFor="edNome">Nome da loja</label>
                <input id="edNome" required minLength={2} value={ed.nome}
                  onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
              </div>
              <div>
                <label htmlFor="edPedido">Link de pedido</label>
                <input id="edPedido" type="url" value={ed.link_pedido}
                  placeholder="https://wa.me/55..."
                  onChange={(e) => setEd({ ...ed, link_pedido: e.target.value })} />
              </div>
              <div>
                <label htmlFor="edAval">Link de avaliação</label>
                <input id="edAval" type="url" value={ed.link_avaliacao}
                  placeholder="https://g.page/r/..."
                  onChange={(e) => setEd({ ...ed, link_avaliacao: e.target.value })} />
              </div>
            </div>

            <div className="row" style={{ marginTop: 12 }}>
              <div>
                <label htmlFor="edModo">Modo de redirecionamento</label>
                <select id="edModo" value={ed.modo}
                  onChange={(e) => setEd({ ...ed, modo: e.target.value as EditState['modo'] })}>
                  <option value="link_unico">Link único — vai direto</option>
                  <option value="dois_botoes">Dois botões — cliente escolhe</option>
                </select>
              </div>
              {ed.modo === 'link_unico' && (
                <div>
                  <label htmlFor="edDest">Destino do link único</label>
                  <select id="edDest" value={ed.link_unico_destino}
                    onChange={(e) => setEd({ ...ed, link_unico_destino: e.target.value as EditState['link_unico_destino'] })}>
                    <option value="pedido">Link de pedido</option>
                    <option value="avaliacao">Link de avaliação</option>
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="edAtivo">Status</label>
                <select id="edAtivo" value={ed.ativo ? '1' : '0'}
                  onChange={(e) => setEd({ ...ed, ativo: e.target.value === '1' })}>
                  <option value="1">Ativa</option>
                  <option value="0">Pausada</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <button className="btn-primary" type="submit" disabled={salvandoEd}>
                {salvandoEd ? 'Salvando…' : 'Salvar loja'}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setEd(null)}>Cancelar</button>
            </div>
            {erroEd && <p className="msg-err">{erroEd}</p>}
          </form>
        </div>
      )}

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
        <p className="sub" style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>
          Depois de criar, clique em <b>Configurar</b> na lista para definir a logo e os detalhes da loja.
        </p>
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
                  <th>Loja</th><th>Tag</th><th>Ativação</th><th>Modo</th>
                  <th>Acessos</th><th>Pedido</th><th>Avaliação</th><th></th>
                </tr>
              </thead>
              <tbody>
                {comercios.map((c) => (
                  <tr key={c.comercio_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flex: '0 0 auto',
                          background: c.logo_url ? '#fff' : 'var(--surface)',
                          border: '1px solid var(--border)', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {c.logo_url
                            ? <img src={c.logo_url} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                            : <span style={{ fontSize: 14 }}>🏪</span>}
                        </div>
                        <span>{c.nome}{!c.ativo && <> <span className="tag tag-off">pausada</span></>}</span>
                      </div>
                    </td>
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
                    <td>
                      <button className="btn-ghost" style={{ fontSize: 13, padding: '6px 14px' }} onClick={() => abrirConfig(c)}>
                        Configurar
                      </button>
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
