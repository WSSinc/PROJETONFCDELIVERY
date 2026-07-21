'use client'

// Central de comando do ADMIN — identidade da marca linknacaixa (tinta + fogo).
// Mesmas funcionalidades de antes (cadastro, config da loja com logo, códigos
// de ativação), agora com o acabamento do resto do produto.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import { createClient } from '@/lib/supabase-browser'
import { slugUnico } from '@/lib/slug'
import s from './admin.module.css'

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'] })
const corpo = Inter({ subsets: ['latin'] })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600', '700'] })

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
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  const [ed, setEd] = useState<EditState | null>(null)
  const [salvandoEd, setSalvandoEd] = useState(false)
  const [erroEd, setErroEd] = useState<string | null>(null)

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout) }, [])

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
      setOkMsg(`Loja criada! Tag: /r/${slug} · Código de ativação: ${criado?.codigo_ativacao ?? '—'}`)
      setNovoNome(''); setNovoPedido(''); setNovaAvaliacao('')
      await carregar()
    }
    setSalvando(false)
  }

  async function abrirConfig(c: ComercioTotais) {
    setErroEd(null)
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

  function copiarCodigo(c: ComercioTotais) {
    void navigator.clipboard.writeText(c.codigo_ativacao)
    setCopiadoId(c.comercio_id)
    timeoutsRef.current.push(setTimeout(() => setCopiadoId(null), 1800))
  }

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  if (carregando) {
    return (
      <main className={`${s.wrap} ${corpo.className}`}>
        <p className={s.aviso}>Carregando…</p>
      </main>
    )
  }

  const totalAcessos = comercios.reduce((t, c) => t + Number(c.total_acessos), 0)
  const totalPedido = comercios.reduce((t, c) => t + Number(c.cliques_pedido), 0)
  const totalAvaliacao = comercios.reduce((t, c) => t + Number(c.cliques_avaliacao), 0)
  const logoAtual = ed?.logoPreview ?? ed?.logo_url ?? null

  return (
    <main className={`${s.wrap} ${corpo.className}`}>
      <div className={s.col}>

        <header className={s.topo}>
          <div className={s.marca}>
            <svg width="30" height="30" viewBox="0 0 34 34" fill="none" aria-hidden="true">
              <circle cx="11" cy="23" r="3.2" fill="#e8542b" />
              <path d="M11 14.5 A8.5 8.5 0 0 1 19.5 23" stroke="#e8542b" strokeWidth="2.4" strokeLinecap="round" />
              <path d="M11 7.5 A15.5 15.5 0 0 1 26.5 23" stroke="#f5a623" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            <span className={`${s.marcaNome} ${display.className}`}>link<em>na</em>caixa</span>
            <span className={`${s.chipAdmin} ${mono.className}`}>admin</span>
          </div>
          <button className={s.sair} onClick={sair}>Sair</button>
        </header>

        {/* Config da loja (aberta pelo botão Configurar) */}
        {ed && (
          <section className={`${s.card} ${s.configCard}`}>
            <div className={s.configTopo}>
              <span className={`${s.configTitulo} ${display.className}`}>
                Configurar loja · <span className={mono.className} style={{ fontSize: 14, color: 'var(--ambar)' }}>/r/{ed.slug}</span>
              </span>
              <button className={s.btnGhost} onClick={() => setEd(null)}>Fechar</button>
            </div>

            <form onSubmit={salvarConfig}>
              <label className={s.label}>Logo da loja (aparece pro cliente ao encostar a tag)</label>
              <div className={s.logoRow}>
                <div className={`${s.logoPreview} ${logoAtual ? '' : s.logoPreviewVazio}`}>
                  {logoAtual
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={logoAtual} alt="logo" />
                    : <span>🏪</span>}
                </div>
                <div className={s.fileCol}>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={escolherLogo} />
                  {logoAtual && (
                    <button type="button" className={s.btnGhost} onClick={removerLogo}>Remover logo</button>
                  )}
                  <span style={{ color: 'var(--apagado)', fontSize: 12 }}>PNG, JPG, WEBP ou SVG · até 512 KB</span>
                </div>
              </div>

              <div className={s.row}>
                <div className={s.campo}>
                  <label className={s.label} htmlFor="edNome">Nome da loja</label>
                  <input id="edNome" className={s.input} required minLength={2} value={ed.nome}
                    onChange={(e) => setEd({ ...ed, nome: e.target.value })} />
                </div>
                <div className={s.campo}>
                  <label className={s.label} htmlFor="edPedido">Link de pedido</label>
                  <input id="edPedido" className={s.input} type="url" value={ed.link_pedido}
                    placeholder="https://wa.me/55..."
                    onChange={(e) => setEd({ ...ed, link_pedido: e.target.value })} />
                </div>
                <div className={s.campo}>
                  <label className={s.label} htmlFor="edAval">Link de avaliação</label>
                  <input id="edAval" className={s.input} type="url" value={ed.link_avaliacao}
                    placeholder="https://g.page/r/..."
                    onChange={(e) => setEd({ ...ed, link_avaliacao: e.target.value })} />
                </div>
              </div>

              <div className={s.row}>
                <div className={s.campo}>
                  <label className={s.label} htmlFor="edModo">Modo de redirecionamento</label>
                  <select id="edModo" className={s.select} value={ed.modo}
                    onChange={(e) => setEd({ ...ed, modo: e.target.value as EditState['modo'] })}>
                    <option value="link_unico">Link único — vai direto</option>
                    <option value="dois_botoes">Dois botões — cliente escolhe</option>
                  </select>
                </div>
                {ed.modo === 'link_unico' && (
                  <div className={s.campo}>
                    <label className={s.label} htmlFor="edDest">Destino do link único</label>
                    <select id="edDest" className={s.select} value={ed.link_unico_destino}
                      onChange={(e) => setEd({ ...ed, link_unico_destino: e.target.value as EditState['link_unico_destino'] })}>
                      <option value="pedido">Link de pedido</option>
                      <option value="avaliacao">Link de avaliação</option>
                    </select>
                  </div>
                )}
                <div className={s.campo}>
                  <label className={s.label} htmlFor="edAtivo">Status</label>
                  <select id="edAtivo" className={s.select} value={ed.ativo ? '1' : '0'}
                    onChange={(e) => setEd({ ...ed, ativo: e.target.value === '1' })}>
                    <option value="1">Ativa</option>
                    <option value="0">Pausada</option>
                  </select>
                </div>
              </div>

              <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
                <button className={s.btnPrimario} type="submit" disabled={salvandoEd}>
                  {salvandoEd ? 'Salvando…' : 'Salvar loja'}
                </button>
                <button type="button" className={s.btnGhost} onClick={() => setEd(null)}>Cancelar</button>
              </div>
              {erroEd && <p className={s.msgErr}>{erroEd}</p>}
            </form>
          </section>
        )}

        {/* KPIs */}
        <section className={s.kpis}>
          <div className={s.kpi}>
            <div className={`${s.kpiNum} ${display.className}`}>{comercios.length}</div>
            <div className={s.kpiLabel}>lojas</div>
          </div>
          <div className={s.kpi}>
            <div className={`${s.kpiNum} ${display.className}`}>{totalAcessos}</div>
            <div className={s.kpiLabel}>toques totais</div>
          </div>
          <div className={s.kpi}>
            <div className={`${s.kpiNum} ${display.className}`}>{totalPedido}</div>
            <div className={s.kpiLabel}>cliques em pedido</div>
          </div>
          <div className={s.kpi}>
            <div className={`${s.kpiNum} ${display.className}`}>{totalAvaliacao}</div>
            <div className={s.kpiLabel}>cliques em avaliação</div>
          </div>
        </section>

        {/* Nova loja */}
        <section className={s.card}>
          <div className={s.cardTitulo}>Nova loja</div>
          <form onSubmit={cadastrar}>
            <div className={s.row}>
              <div className={s.campo}>
                <label className={s.label} htmlFor="nome">Nome do comércio</label>
                <input id="nome" className={s.input} required minLength={2} value={novoNome}
                  placeholder="Hamburgueria do João"
                  onChange={(e) => setNovoNome(e.target.value)} />
              </div>
              <div className={s.campo}>
                <label className={s.label} htmlFor="lp">Link de pedido (opcional)</label>
                <input id="lp" className={s.input} type="url" value={novoPedido}
                  placeholder="https://wa.me/55..."
                  onChange={(e) => setNovoPedido(e.target.value)} />
              </div>
              <div className={s.campo}>
                <label className={s.label} htmlFor="la">Link de avaliação (opcional)</label>
                <input id="la" className={s.input} type="url" value={novaAvaliacao}
                  placeholder="https://g.page/r/..."
                  onChange={(e) => setNovaAvaliacao(e.target.value)} />
              </div>
              <div style={{ flex: '0 0 auto' }}>
                <button className={s.btnPrimario} type="submit" disabled={salvando || novoNome.trim().length < 2}>
                  {salvando ? 'Criando…' : 'Criar loja'}
                </button>
              </div>
            </div>
          </form>
          <p className={s.cardNota}>
            Depois de criar, clique em <b>Configurar</b> na lista pra logo e detalhes.
            O código de ativação vai pro cliente junto com o kit.
          </p>
          {okMsg && <p className={`${s.msgOk} ${mono.className}`}>{okMsg}</p>}
          {erro && <p className={s.msgErr}>{erro}</p>}
        </section>

        {/* Lojas */}
        <section className={s.card}>
          <div className={s.cardTitulo}>Lojas ({comercios.length})</div>
          {comercios.length === 0 ? (
            <p className={s.vazio}>Nenhuma loja ainda. Cadastre a primeira acima.</p>
          ) : (
            <div className={s.tabelaWrap}>
              <table className={s.tabela}>
                <thead>
                  <tr>
                    <th>Loja</th><th>Tag</th><th>Ativação</th><th>Modo</th>
                    <th>Toques</th><th>Pedido</th><th>Avaliação</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {comercios.map((c) => (
                    <tr key={c.comercio_id}>
                      <td>
                        <div className={s.lojaCell}>
                          <div className={`${s.logoMini} ${c.logo_url ? '' : s.logoMiniVazio}`}>
                            {c.logo_url
                              // eslint-disable-next-line @next/next/no-img-element
                              ? <img src={c.logo_url} alt="" />
                              : <span>🏪</span>}
                          </div>
                          <span>
                            {c.nome}
                            {!c.ativo && <> <span className={`${s.pill} ${s.pillOff}`}>pausada</span></>}
                          </span>
                        </div>
                      </td>
                      <td>
                        <a className={`${s.tagLink} ${mono.className}`} href={`/r/${c.slug}`} target="_blank" rel="noreferrer">
                          /r/{c.slug}
                        </a>
                      </td>
                      <td>
                        {c.tem_dono ? (
                          <span className={`${s.pill} ${s.pillOn}`}>✓ ativado</span>
                        ) : (
                          <button
                            className={`${s.codigoBtn} ${mono.className}`}
                            title="Clique para copiar o código"
                            onClick={() => copiarCodigo(c)}
                          >
                            {copiadoId === c.comercio_id ? 'copiado ✓' : `${c.codigo_ativacao} ⧉`}
                          </button>
                        )}
                      </td>
                      <td>
                        <span className={`${s.pill} ${c.modo_redirecionamento === 'dois_botoes' ? s.pillDois : s.pillUni}`}>
                          {c.modo_redirecionamento === 'dois_botoes' ? '2 botões' : 'link único'}
                        </span>
                      </td>
                      <td className={mono.className}>{c.total_acessos}</td>
                      <td className={mono.className}>{c.cliques_pedido}</td>
                      <td className={mono.className}>{c.cliques_avaliacao}</td>
                      <td>
                        <button className={s.btnGhost} onClick={() => abrirConfig(c)}>Configurar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
