import { defineCloudflareConfig } from '@opennextjs/cloudflare'

// App é 100% dinâmico (redirect no-store, painel client-side com Supabase):
// não usamos ISR/cache incremental, então a config default basta.
export default defineCloudflareConfig()
