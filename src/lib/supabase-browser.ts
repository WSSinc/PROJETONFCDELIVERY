// Client do navegador para o PAINEL (comércio e admin). Usa a anon key + RLS.
// Nunca importe a service_role key aqui — ela vive só no edge do redirect.
'use client'

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
