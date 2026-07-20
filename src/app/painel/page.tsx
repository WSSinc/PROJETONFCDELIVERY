'use client'

// Painel do COMÉRCIO — identidade própria, separada do admin.
// Conceito: cada toque na tag é uma onda de energia. O contador central é um
// radar que emite um ping concêntrico a cada acesso novo (realtime Supabase).
// Instrumentos: hoje/7d/média/recorde, onda de 30 dias, mapa de calor por
// horário, balança pedido×avaliação, feed ao vivo, QR da tag e preview do
// que o consumidor vê enquanto o dono edita a configuração.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Space_Grotesk, Inter, JetBrains_Mono } from 'next/font/google'
import { createClient } from '@/lib/supabase-browser'
import { qrMatrix, qrSvgPath } from '@/lib/qr'
import s from './painel.module.css'

const display = Space_Grotesk({ subsets: ['latin'], weight: ['500', '600', '700'] })
const corpo = Inter({ subsets: ['latin'] })
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '600'] })

interface Comercio {
  id: string
  slug: string
  nome: string
  modo_redirecionamento: 'link_unico' | 'dois_botoes'
  link_unico_destino: 'pedido' | 'avaliacao'
  link_pedido: string | null
  link_avaliacao: string | null
  logo_url: string | null
  ativo: boolean
}

interface DiaAgg {
  dia: string
  total: number
  cliques_pedido: number
  cliques_avaliacao: number
}

interface AcessoBruto {
  tipo_clique: 'pedido' | 'avaliacao' | null
  criado_em: string
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function chaveDia(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function diasAtras(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function tempoRelativo(iso: string, agora: number): string {
  const seg = Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 1000))
  if (seg < 60) return 'agora'
  const min = Math.floor(seg / 60)
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

function deltaPct(atual: number, anterior: number): { texto: string; sobe: boolean } | null {
  if (anterior === 0 && atual === 0) return null
  if (anterior === 0) return { texto: 'novo', sobe: true }
  const pct = Math.round(((atual - anterior) / anterior) * 100)
  if (pct === 0) return { texto: '0%', sobe: false }
  return { texto: `${pct > 0 ? '+' : ''}${pct}%`, sobe: pct > 0 }
}

function hostnameDe(url: string): string | null {
  try { return new URL(url).hostname } catch { return null }
}

// curva suave (quadráticas passando pelos pontos médios)
function caminhoSuave(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i].x + pts[i + 1].x) / 2
    const yc = (pts[i].y + pts[i + 1].y) / 2
    d += ` Q ${pts[i].x} ${pts[i].y} ${xc} ${yc}`
  }
  d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`
  return d
}

export default function PainelPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  const [comercio, setComercio] = useState<Comercio | null>(null)
  const [viewDias, setViewDias] = useState<DiaAgg[]>([])
  const [recentes, setRecentes] = useState<AcessoBruto[]>([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [aoVivo, setAoVivo] = useState(false)
  const [ripples, setRipples] = useState<number[]>([])
  const [agora, setAgora] = useState(() => Date.now())
  const [selDia, setSelDia] = useState(29)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)

  // campos do form
  const [modo, setModo] = useState<'link_unico' | 'dois_botoes'>('link_unico')
  const [destino, setDestino] = useState<'pedido' | 'avaliacao'>('pedido')
  const [linkPedido, setLinkPedido] = useState('')
  const [linkAvaliacao, setLinkAvaliacao] = useState('')

  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const emitirPing = useCallback(() => {
    const id = Date.now() + Math.random()
    setRipples((r) => [...r, id])
    timeoutsRef.current.push(
      setTimeout(() => setRipples((r) => r.filter((x) => x !== id)), 1700),
    )
  }, [])

  const carregar = useCallback(async () => {
    const { data: sessao } = await supabase.auth.getSession()
    if (!sessao.session) { router.replace('/login'); return }

    const { data: ehAdmin } = await supabase.rpc('is_admin')
    if (ehAdmin) { router.replace('/admin'); return }

    const { data: c } = await supabase
      .from('comercios')
      .select('id,slug,nome,modo_redirecionamento,link_unico_destino,link_pedido,link_avaliacao,logo_url,ativo')
      .limit(1)
      .maybeSingle()

    if (!c) { setErro('Comércio não encontrado. Contate o administrador.'); setCarregando(false); return }

    setComercio(c as Comercio)
    setModo(c.modo_redirecionamento as 'link_unico' | 'dois_botoes')
    setDestino(c.link_unico_destino as 'pedido' | 'avaliacao')
    setLinkPedido(c.link_pedido ?? '')
    setLinkAvaliacao(c.link_avaliacao ?? '')

    // contador central: total histórico (head+count, sem baixar linhas)
    const { count } = await supabase
      .from('acessos')
      .select('id', { count: 'exact', head: true })
      .eq('comercio_id', c.id)
    setTotalGeral(count ?? 0)

    // agregados por dia (histórico p/ recorde, últimos 30 no gráfico)
    const { data: hist } = await supabase
      .from('acessos_por_dia')
      .select('dia,total,cliques_pedido,cliques_avaliacao')
      .eq('comercio_id', c.id)
      .order('dia', { ascending: false })
      .limit(400)
    setViewDias((hist ?? []) as DiaAgg[])

    // brutos dos últimos 14 dias: mapa de calor por hora + feed ao vivo
    const { data: brutos } = await supabase
      .from('acessos')
      .select('tipo_clique,criado_em')
      .eq('comercio_id', c.id)
      .gte('criado_em', diasAtras(14).toISOString())
      .order('criado_em', { ascending: false })
      .limit(4000)
    setRecentes((brutos ?? []) as AcessoBruto[])

    setCarregando(false)
  }, [router, supabase])

  useEffect(() => { void carregar() }, [carregar])
  useEffect(() => () => { timeoutsRef.current.forEach(clearTimeout) }, [])

  // relógio p/ os tempos relativos do feed
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Realtime: INSERT em acessos deste comércio -> contador + feed + ping.
  useEffect(() => {
    if (!comercio) return
    const canal = supabase
      .channel(`acessos-${comercio.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'acessos', filter: `comercio_id=eq.${comercio.id}` },
        (payload) => {
          const novo = payload.new as { tipo_clique: 'pedido' | 'avaliacao' | null; criado_em?: string }
          const tipo = novo.tipo_clique
          const ts = novo.criado_em ?? new Date().toISOString()
          setTotalGeral((t) => t + 1)
          setRecentes((r) => [{ tipo_clique: tipo, criado_em: ts }, ...r])
          const hoje = chaveDia(new Date())
          setViewDias((h) => {
            const i = h.findIndex((d) => d.dia === hoje)
            if (i === -1) {
              return [{
                dia: hoje,
                total: 1,
                cliques_pedido: tipo === 'pedido' ? 1 : 0,
                cliques_avaliacao: tipo === 'avaliacao' ? 1 : 0,
              }, ...h]
            }
            const copia = [...h]
            copia[i] = {
              ...copia[i],
              total: Number(copia[i].total) + 1,
              cliques_pedido: Number(copia[i].cliques_pedido) + (tipo === 'pedido' ? 1 : 0),
              cliques_avaliacao: Number(copia[i].cliques_avaliacao) + (tipo === 'avaliacao' ? 1 : 0),
            }
            return copia
          })
          emitirPing()
        },
      )
      .subscribe((status) => setAoVivo(status === 'SUBSCRIBED'))

    return () => { void supabase.removeChannel(canal) }
  }, [comercio, supabase, emitirPing])

  // ------- derivados -------------------------------------------------------
  const porDia = useMemo(
    () => new Map(viewDias.map((d) => [d.dia, {
      total: Number(d.total),
      pedido: Number(d.cliques_pedido),
      avaliacao: Number(d.cliques_avaliacao),
    }])),
    [viewDias],
  )

  const somaEntre = useCallback((deDias: number, ateDias: number) => {
    // soma toques no intervalo [hoje-deDias, hoje-ateDias)
    let soma = 0
    for (let i = ateDias; i < deDias; i++) {
      soma += porDia.get(chaveDia(diasAtras(i)))?.total ?? 0
    }
    return soma
  }, [porDia])

  const hoje = porDia.get(chaveDia(new Date()))?.total ?? 0
  const ontem = porDia.get(chaveDia(diasAtras(1)))?.total ?? 0
  const semana = somaEntre(7, 0)
  const semanaAnterior = somaEntre(14, 7)
  const total30 = somaEntre(30, 0)
  const dHoje = deltaPct(hoje, ontem)
  const dSemana = deltaPct(semana, semanaAnterior)

  const recorde = useMemo(() => {
    let melhor: { dia: string; total: number } | null = null
    viewDias.forEach((d) => {
      const t = Number(d.total)
      if (!melhor || t > melhor.total) melhor = { dia: d.dia, total: t }
    })
    return melhor as { dia: string; total: number } | null
  }, [viewDias])

  const serie30 = useMemo(() => {
    const out: { dia: string; total: number }[] = []
    for (let i = 29; i >= 0; i--) {
      const key = chaveDia(diasAtras(i))
      out.push({ dia: key, total: porDia.get(key)?.total ?? 0 })
    }
    return out
  }, [porDia])

  const chart = useMemo(() => {
    const W = 600, H = 150, TOPO = 12, BASE = 140
    const max = Math.max(...serie30.map((d) => d.total), 1)
    const pts = serie30.map((d, i) => ({
      x: (i * W) / 29,
      y: BASE - (d.total / max) * (BASE - TOPO),
    }))
    const linha = caminhoSuave(pts)
    const area = `${linha} L ${W} ${H} L 0 ${H} Z`
    return { W, H, pts, linha, area }
  }, [serie30])

  const heat = useMemo(() => {
    const grade: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
    recentes.forEach((a) => {
      const d = new Date(a.criado_em)
      grade[d.getDay()][d.getHours()]++
    })
    let max = 0
    let pico: { dia: number; hora: number } | null = null
    grade.forEach((linha, dia) => linha.forEach((v, hora) => {
      if (v > max) { max = v; pico = { dia, hora } }
    }))
    return { grade, max, pico: pico as { dia: number; hora: number } | null }
  }, [recentes])

  const split30 = useMemo(() => {
    let pedido = 0, avaliacao = 0, total = 0
    for (let i = 0; i < 30; i++) {
      const d = porDia.get(chaveDia(diasAtras(i)))
      if (d) { pedido += d.pedido; avaliacao += d.avaliacao; total += d.total }
    }
    return { pedido, avaliacao, diretos: total - pedido - avaliacao }
  }, [porDia])

  const urlTag = useMemo(() => {
    if (!comercio) return ''
    const origem = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origem}/r/${comercio.slug}`
  }, [comercio])

  const qr = useMemo(() => {
    if (!urlTag) return null
    const m = qrMatrix(urlTag)
    return m ? { size: m.length, path: qrSvgPath(m), matrix: m } : null
  }, [urlTag])

  const sujo = comercio !== null && (
    modo !== comercio.modo_redirecionamento ||
    destino !== comercio.link_unico_destino ||
    (linkPedido.trim() || null) !== comercio.link_pedido ||
    (linkAvaliacao.trim() || null) !== comercio.link_avaliacao
  )

  // ------- ações -----------------------------------------------------------
  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!comercio) return
    setErro(null); setOkMsg(null); setSalvando(true)

    const patch = {
      modo_redirecionamento: modo,
      link_unico_destino: destino,
      link_pedido: linkPedido.trim() || null,
      link_avaliacao: linkAvaliacao.trim() || null,
    }
    const { error } = await supabase.from('comercios').update(patch).eq('id', comercio.id)

    if (error) setErro(`Erro ao salvar: ${error.message}`)
    else {
      setComercio({ ...comercio, ...patch })
      setOkMsg('Salvo. A tag já responde com a nova configuração.')
      timeoutsRef.current.push(setTimeout(() => setOkMsg(null), 4000))
    }
    setSalvando(false)
  }

  function copiarUrl() {
    void navigator.clipboard.writeText(urlTag)
    setCopiado(true)
    timeoutsRef.current.push(setTimeout(() => setCopiado(false), 2000))
  }

  function baixarQr() {
    if (!qr || !comercio) return
    const escala = 8, quieto = 4
    const px = (qr.size + quieto * 2) * escala
    const canvas = document.createElement('canvas')
    canvas.width = px; canvas.height = px
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, px, px)
    ctx.fillStyle = '#000000'
    qr.matrix.forEach((linha, y) => linha.forEach((escuro, x) => {
      if (escuro) ctx.fillRect((x + quieto) * escala, (y + quieto) * escala, escala, escala)
    }))
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `tag-${comercio.slug}-qr.png`
    a.click()
  }

  async function sair() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  // ------- render ----------------------------------------------------------
  if (carregando) {
    return <main className={`${s.wrap} ${corpo.className}`}><p className={s.aviso}>Carregando…</p></main>
  }
  if (!comercio) {
    return <main className={`${s.wrap} ${corpo.className}`}><p className={s.aviso}>{erro ?? 'Erro desconhecido.'}</p></main>
  }

  const diaSel = serie30[selDia]
  const infoSel = porDia.get(diaSel.dia)
  const feed = recentes.slice(0, 12)
  const hostPedido = hostnameDe(linkPedido.trim())
  const hostAvaliacao = hostnameDe(linkAvaliacao.trim())
  const hostDestino = destino === 'pedido' ? hostPedido : hostAvaliacao

  return (
    <main className={`${s.wrap} ${corpo.className}`}>
      <div className={s.col}>

        <header className={s.topo}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {comercio.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={s.logo} src={comercio.logo_url} alt={comercio.nome} />
            )}
            <div>
              <h1 className={`${s.nome} ${display.className}`}>{comercio.nome}</h1>
              <div className={`${s.status} ${mono.className}`}>
                <span className={`${s.dot} ${aoVivo ? '' : s.dotOff}`} />
                {aoVivo ? 'ao vivo' : 'conectando…'}
              </div>
            </div>
          </div>
          <button className={s.sair} onClick={sair}>Sair</button>
        </header>

        {!comercio.ativo && (
          <div className={s.banner}>Sua tag está pausada pelo administrador — os toques não redirecionam.</div>
        )}

        {/* Radar central */}
        <section className={s.hero}>
          <span className={`${s.anel} ${s.anelA}`} />
          <span className={`${s.anel} ${s.anelB}`} />
          <span className={`${s.anel} ${s.anelC}`} />
          {ripples.map((id) => <span key={id} className={s.ripple} />)}
          <div className={`${s.big} ${mono.className}`}>{totalGeral}</div>
          <div className={s.bigLabel}>toques na tag</div>
        </section>

        {/* Régua de instrumentos */}
        <section className={s.grade4}>
          <div className={s.tile}>
            <div className={`${s.tileNum} ${display.className}`}>{hoje}</div>
            <div className={s.tileLabel}>hoje</div>
            {dHoje && (
              <div className={`${s.tileDelta} ${dHoje.sobe ? s.deltaUp : s.deltaDown} ${mono.className}`}>
                {dHoje.sobe ? '↑' : '↓'} {dHoje.texto} vs ontem
              </div>
            )}
          </div>
          <div className={s.tile}>
            <div className={`${s.tileNum} ${display.className}`}>{semana}</div>
            <div className={s.tileLabel}>últimos 7 dias</div>
            {dSemana && (
              <div className={`${s.tileDelta} ${dSemana.sobe ? s.deltaUp : s.deltaDown} ${mono.className}`}>
                {dSemana.sobe ? '↑' : '↓'} {dSemana.texto} vs anterior
              </div>
            )}
          </div>
          <div className={s.tile}>
            <div className={`${s.tileNum} ${display.className}`}>{(total30 / 30).toFixed(1)}</div>
            <div className={s.tileLabel}>média / dia (30d)</div>
          </div>
          <div className={s.tile}>
            <div className={`${s.tileNum} ${display.className}`}>{recorde?.total ?? 0}</div>
            <div className={s.tileLabel}>
              recorde{recorde ? ` · ${new Date(recorde.dia + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}` : ''}
            </div>
          </div>
        </section>

        {/* Onda de 30 dias */}
        <section className={s.card}>
          <div className={s.cardTitulo}>Onda de 30 dias</div>
          <svg
            className={s.chartSvg}
            viewBox={`0 0 ${chart.W} ${chart.H}`}
            role="img"
            aria-label="Toques por dia nos últimos 30 dias"
          >
            <defs>
              <linearGradient id="ondaCobre" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c97b4a" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#c97b4a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={chart.area} fill="url(#ondaCobre)" />
            <path d={chart.linha} fill="none" stroke="#c97b4a" strokeWidth="2" strokeLinecap="round" />
            <line
              x1={chart.pts[selDia].x} y1="8"
              x2={chart.pts[selDia].x} y2="142"
              stroke="#3a3a45" strokeWidth="1"
            />
            <circle cx={chart.pts[selDia].x} cy={chart.pts[selDia].y} r="4.5" fill="#c97b4a" />
            {chart.pts.map((p, i) => (
              <rect
                key={i}
                x={p.x - chart.W / 58} y="0"
                width={chart.W / 29} height={chart.H}
                fill="transparent"
                onMouseEnter={() => setSelDia(i)}
                onClick={() => setSelDia(i)}
              />
            ))}
          </svg>
          <div className={s.chartLegenda}>
            <span>{new Date(serie30[0].dia + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</span>
            <span>hoje</span>
          </div>
          <div className={`${s.chartInfo} ${mono.className}`}>
            <span className={s.chartInfoDia}>
              {new Date(diaSel.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
            </span>
            <span>{diaSel.total} {diaSel.total === 1 ? 'toque' : 'toques'}</span>
            {infoSel && infoSel.pedido > 0 && <span>🍔 {infoSel.pedido}</span>}
            {infoSel && infoSel.avaliacao > 0 && <span>⭐ {infoSel.avaliacao}</span>}
          </div>
        </section>

        {/* Mapa de calor por horário */}
        <section className={s.card}>
          <div className={s.cardTitulo}>Quando tocam sua tag · 14 dias</div>
          <div className={s.heatGrid}>
            {heat.grade.map((linha, dia) => (
              [
                <span key={`r${dia}`} className={`${s.heatRotulo} ${mono.className}`}>{DIAS_SEMANA[dia]}</span>,
                ...linha.map((v, hora) => {
                  const alfa = heat.max === 0 ? 0 : v / heat.max
                  return (
                    <span
                      key={`${dia}-${hora}`}
                      className={s.heatCelula}
                      title={`${DIAS_SEMANA[dia]} ${hora}h — ${v} ${v === 1 ? 'toque' : 'toques'}`}
                      style={{
                        background: v === 0
                          ? 'rgba(58,58,69,0.35)'
                          : `rgba(201,123,74,${0.16 + alfa * 0.84})`,
                      }}
                    />
                  )
                }),
              ]
            ))}
          </div>
          <div className={`${s.heatHoras} ${mono.className}`}>
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h}>{h % 6 === 0 ? `${h}h` : ''}</span>
            ))}
          </div>
          {heat.pico && heat.max > 0 ? (
            <p className={s.heatPico}>
              Pico: <b>{DIAS_SEMANA[heat.pico.dia]} às {heat.pico.hora}h</b> — bom horário pra postar promoção.
            </p>
          ) : (
            <p className={s.cardNota}>Ainda sem toques nos últimos 14 dias — o mapa acende conforme os pedidos saem.</p>
          )}
        </section>

        {/* Balança pedido × avaliação */}
        {(split30.pedido > 0 || split30.avaliacao > 0) && (
          <section className={s.card}>
            <div className={s.cardTitulo}>O que escolhem · 30 dias</div>
            <div className={s.balBar}>
              <span
                className={s.balPedido}
                style={{ width: `${(split30.pedido / (split30.pedido + split30.avaliacao)) * 100}%` }}
              />
              <span
                className={s.balAval}
                style={{ width: `${(split30.avaliacao / (split30.pedido + split30.avaliacao)) * 100}%` }}
              />
            </div>
            <div className={s.balLegenda}>
              <span>🍔 <b>{split30.pedido}</b> pedidos ({Math.round((split30.pedido / (split30.pedido + split30.avaliacao)) * 100)}%)</span>
              <span>⭐ <b>{split30.avaliacao}</b> avaliações ({Math.round((split30.avaliacao / (split30.pedido + split30.avaliacao)) * 100)}%)</span>
            </div>
            {split30.diretos > 0 && (
              <p className={s.cardNota}>+ {split30.diretos} redirecionamentos diretos (modo link único).</p>
            )}
          </section>
        )}

        {/* Feed ao vivo */}
        <section className={s.card}>
          <div className={s.cardTitulo}>Últimos toques</div>
          {feed.length === 0 ? (
            <p className={s.feedVazio}>Nenhum toque nos últimos 14 dias. Encoste um celular na tag — ou abra sua página — e veja aparecer aqui na hora.</p>
          ) : (
            feed.map((a, i) => (
              <div key={`${a.criado_em}-${i}`} className={s.feedItem}>
                <span className={`${s.feedHora} ${mono.className}`}>
                  {new Date(a.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className={s.feedTipo}>
                  {a.tipo_clique === 'pedido' ? '🍔 escolheu pedir' :
                    a.tipo_clique === 'avaliacao' ? '⭐ escolheu avaliar' : '→ redirecionado direto'}
                </span>
                <span className={s.feedRel}>{tempoRelativo(a.criado_em, agora)}</span>
              </div>
            ))
          )}
        </section>

        {/* Sua tag */}
        <section className={s.card}>
          <div className={s.cardTitulo}>Sua tag</div>
          <div className={s.urlRow}>
            <code className={`${s.url} ${mono.className}`}>{urlTag}</code>
            <button className={s.copiar} onClick={copiarUrl}>{copiado ? 'Copiado ✓' : 'Copiar'}</button>
          </div>
          <div className={s.tagAcoes}>
            <a className={s.btnSec} href={`/r/${comercio.slug}`} target="_blank" rel="noreferrer">
              Abrir como cliente ↗
            </a>
            {qr && <button className={s.btnSec} onClick={baixarQr}>Baixar QR em PNG</button>}
          </div>
          {qr && (
            <div className={s.qrArea}>
              <div className={s.qrBox}>
                <svg viewBox={`-2 -2 ${qr.size + 4} ${qr.size + 4}`} aria-label="QR code da sua tag">
                  <path d={qr.path} fill="#14141c" />
                </svg>
              </div>
              <p className={s.qrTexto}>
                Este QR leva pro mesmo endereço da tag NFC. Imprima em panfletos,
                cardápios ou na embalagem — todo escaneio conta nas estatísticas
                igual a um toque.
              </p>
            </div>
          )}
        </section>

        {/* Configuração + preview */}
        <section className={s.card}>
          <div className={s.cardTitulo}>Redirecionamento</div>

          <div className={s.modos} role="radiogroup" aria-label="Modo de redirecionamento">
            <button
              type="button"
              role="radio"
              aria-checked={modo === 'link_unico'}
              className={`${s.modoCard} ${modo === 'link_unico' ? s.modoSel : ''}`}
              onClick={() => setModo('link_unico')}
            >
              <div className={s.modoTitulo}>Link único</div>
              <div className={s.modoDesc}>O cliente é levado direto pro destino, sem tela no meio.</div>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={modo === 'dois_botoes'}
              className={`${s.modoCard} ${modo === 'dois_botoes' ? s.modoSel : ''}`}
              onClick={() => setModo('dois_botoes')}
            >
              <div className={s.modoTitulo}>Dois botões</div>
              <div className={s.modoDesc}>Tela rápida com “Pedir de novo” e “Avaliar” — o cliente escolhe.</div>
            </button>
          </div>

          <div className={s.configGrid}>
            <form className={s.configForm} onSubmit={salvar}>
              <label className={s.label} htmlFor="lp">Link de pedido</label>
              <input id="lp" className={s.input} type="url"
                placeholder="https://wa.me/5511999999999"
                value={linkPedido} onChange={(e) => setLinkPedido(e.target.value)} />

              <label className={s.label} htmlFor="la">Link de avaliação</label>
              <input id="la" className={s.input} type="url"
                placeholder="https://g.page/r/…/review"
                value={linkAvaliacao} onChange={(e) => setLinkAvaliacao(e.target.value)} />

              {modo === 'link_unico' && (
                <>
                  <label className={s.label} htmlFor="destino">Destino do link único</label>
                  <select id="destino" className={s.select} value={destino}
                    onChange={(e) => setDestino(e.target.value as typeof destino)}>
                    <option value="pedido">Link de pedido</option>
                    <option value="avaliacao">Link de avaliação</option>
                  </select>
                </>
              )}

              {modo === 'dois_botoes' && (!linkPedido.trim() || !linkAvaliacao.trim()) && (
                <p className={s.dica}>
                  Com um link vazio, a tela mostra só um botão. Preencha os dois pra dar a escolha completa.
                </p>
              )}
              {modo === 'link_unico' && !((destino === 'pedido' ? linkPedido : linkAvaliacao).trim()) && (
                <p className={s.dica}>O link escolhido como destino está vazio — a tag vai mostrar erro até preencher.</p>
              )}

              <div className={s.salvarRow}>
                <button className={s.salvar} type="submit" disabled={salvando || !sujo}>
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
                {sujo && !salvando && <span className={`${s.chipDirty} ${mono.className}`}>não salvo</span>}
              </div>
              {okMsg && <p className={s.msgOk}>{okMsg}</p>}
              {erro && <p className={s.msgErr}>{erro}</p>}
            </form>

            {/* preview ao vivo do que o consumidor vê */}
            <aside className={s.fone} aria-hidden="true">
              <div className={s.foneRotulo}>o cliente vê</div>
              <div className={s.foneCorpo}>
                <div className={s.foneTela}>
                  {modo === 'dois_botoes' ? (
                    <>
                      {comercio.logo_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={comercio.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain', background: '#fff', padding: 3 }} />
                        : <span className={s.foneEmoji}>📦</span>}
                      <span className={s.foneNome}>{comercio.nome}</span>
                      <span className={s.fonePergunta}>O que você quer fazer?</span>
                      {linkPedido.trim() && <span className={s.foneBtn}>🍔 Pedir de novo</span>}
                      {linkAvaliacao.trim() && <span className={`${s.foneBtn} ${s.foneBtnA}`}>⭐ Avaliar</span>}
                      {!linkPedido.trim() && !linkAvaliacao.trim() && (
                        <span className={s.foneRedir}>nenhum link configurado</span>
                      )}
                    </>
                  ) : (
                    <span className={s.foneRedir}>
                      encostou →<br />vai direto para
                      <br />
                      <span className={s.foneDominio}>{hostDestino ?? 'link não configurado'}</span>
                    </span>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </section>

        {/* Detalhe por dia */}
        {viewDias.length > 0 && (
          <details className={`${s.card} ${s.detalhes}`}>
            <summary>Detalhe por dia</summary>
            <table className={s.tabela}>
              <thead>
                <tr><th>Data</th><th>Toques</th><th>Pedido</th><th>Avaliação</th></tr>
              </thead>
              <tbody>
                {viewDias.slice(0, 30).map((d) => (
                  <tr key={d.dia}>
                    <td>{new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</td>
                    <td className={mono.className}>{Number(d.total)}</td>
                    <td className={mono.className}>{Number(d.cliques_pedido) || '—'}</td>
                    <td className={mono.className}>{Number(d.cliques_avaliacao) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

      </div>
    </main>
  )
}
