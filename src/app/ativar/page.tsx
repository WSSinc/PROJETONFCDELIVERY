'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function AtivarPage() {
  const router = useRouter()
  const [codigo, setCodigo] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [senha2, setSenha2] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function ativar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)

    if (senha !== senha2) {
      setErro('As senhas não conferem.')
      return
    }
    if (senha.length < 8) {
      setErro('A senha precisa de ao menos 8 caracteres.')
      return
    }

    setCarregando(true)
    try {
      const res = await fetch('/api/ativar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, email, senha }),
      })
      const data = (await res.json()) as { ok: boolean; erro?: string }

      if (!data.ok) {
        setErro(data.erro ?? 'Não foi possível ativar a conta.')
        setCarregando(false)
        return
      }

      // Conta criada e vinculada — loga automático e vai pro painel.
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: senha,
      })
      if (error) {
        // Ativou mas o login falhou por algum motivo — manda pro login manual.
        router.replace('/login')
        return
      }
      router.replace('/painel')
    } catch {
      setErro('Erro de conexão. Tente de novo.')
      setCarregando(false)
    }
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 60 }}>
      <div className="card">
        <h1>Ativar sua conta</h1>
        <p className="sub">Use o código que veio com o seu kit de tags.</p>
        <form onSubmit={ativar}>
          <label htmlFor="codigo">Código de ativação</label>
          <input
            id="codigo"
            required
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="Ex: K7M2PXQ9"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            style={{ letterSpacing: '0.15em', fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}
          />

          <label htmlFor="email">Seu e-mail</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <label htmlFor="senha">Crie uma senha</label>
          <input
            id="senha"
            type="password"
            required
            autoComplete="new-password"
            placeholder="mínimo 8 caracteres"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          <label htmlFor="senha2">Repita a senha</label>
          <input
            id="senha2"
            type="password"
            required
            autoComplete="new-password"
            value={senha2}
            onChange={(e) => setSenha2(e.target.value)}
          />

          <div style={{ marginTop: 18 }}>
            <button className="btn-primary" type="submit" disabled={carregando} style={{ width: '100%' }}>
              {carregando ? 'Ativando…' : 'Ativar e entrar'}
            </button>
          </div>
          {erro && <p className="msg-err">{erro}</p>}
        </form>
        <p className="sub" style={{ marginTop: 18, marginBottom: 0 }}>
          Já tem conta? <a href="/login">Entrar</a>
        </p>
      </div>
    </main>
  )
}
