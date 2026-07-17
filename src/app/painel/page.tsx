'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function PainelPage() {
  const router = useRouter()
  const [pronto, setPronto] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/login')
      else setPronto(true)
    })
  }, [router])

  if (!pronto) return <main className="container"><p className="sub">Carregando…</p></main>

  return (
    <main className="container">
      <h1>Painel do comércio</h1>
      <p className="sub">Em construção — próxima fase: editar links, modo e estatísticas.</p>
    </main>
  )
}
