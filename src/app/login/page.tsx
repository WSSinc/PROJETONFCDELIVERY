'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setCarregando(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) {
      setErro(
        error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos.'
          : `Erro ao entrar: ${error.message}`,
      )
      setCarregando(false)
      return
    }
    // Admin cai no /admin; comércio cai no /painel. Decide pelo is_admin().
    const { data: ehAdmin } = await supabase.rpc('is_admin')
    router.replace(ehAdmin ? '/admin' : '/painel')
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <div className="card">
        <h1>Entrar</h1>
        <p className="sub">Painel do Projeto NFC</p>
        <form onSubmit={entrar}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <div style={{ marginTop: 18 }}>
            <button className="btn-primary" type="submit" disabled={carregando} style={{ width: '100%' }}>
              {carregando ? 'Entrando…' : 'Entrar'}
            </button>
          </div>
          {erro && <p className="msg-err">{erro}</p>}
        </form>
      </div>
    </main>
  )
}
