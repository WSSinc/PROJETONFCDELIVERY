# Projeto NFC — Fase 1 (core do redirect)

Sistema multi-tenant de tags NFC para comércio local. Esta fase entrega:
**schema Supabase + RLS**, e a **página de redirect no edge** já funcional
(`dominio.com/r/<slug>`). Painel do comércio e admin vêm na próxima fase.

## Arquitetura

- **Redirect** (`/r/[slug]`): route handler Next.js em **runtime edge**. Fala
  PostgREST direto com `fetch` usando a **service_role key** (bypass de RLS,
  server-side). `link_unico` → `302`. `dois_botoes` → HTML mínimo, sem JS.
  O log de acesso é **fire-and-forget** via `waitUntil` — o `302` nunca espera o insert.
- **Painel** (próxima fase): Next.js + `@supabase/ssr` com a **anon key** + RLS.
- Hospedagem: **Cloudflare Pages** via `@cloudflare/next-on-pages`.

```
src/
  app/
    r/[slug]/route.ts        # 302 (link_unico) ou página de 2 botões
    r/[slug]/ir/route.ts     # loga o clique do botão e redireciona
    page.tsx  layout.tsx     # placeholder até o painel
  lib/
    redirect.ts              # PostgREST via fetch (service_role) — hot path
    redirect-html.ts         # HTML dos 2 botões e da tela de erro
    supabase-browser.ts      # client anon do painel (RLS)
supabase/schema.sql          # tabelas + RLS + view de stats
```

## Subir do zero

### 1. Banco (Supabase)
1. Crie um projeto em supabase.com.
2. SQL Editor → cole e rode `supabase/schema.sql`.
3. Authentication → Users → crie seu usuário admin (o e-mail que você usa).
4. Rode o bootstrap do admin (final do `schema.sql`):
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'pharma.atestados@gmail.com'
   on conflict do nothing;
   ```
5. Cadastre um comércio de teste:
   ```sql
   insert into public.comercios (slug, nome, modo_redirecionamento, link_unico_destino, link_pedido, link_avaliacao)
   values ('joao123', 'Hamburgueria do João', 'dois_botoes', 'pedido',
           'https://wa.me/5599999999999', 'https://g.page/r/exemplo/review');
   ```

### 2. App
```bash
npm install
cp .env.example .env.local   # preencha as 4 variáveis (Settings > API no Supabase)
npm run dev                  # http://localhost:3000/r/joao123
```

### 3. Deploy (Cloudflare Pages)
```bash
npm run deploy               # build next-on-pages + wrangler pages deploy
```
No painel da Cloudflare Pages → Settings → Environment variables, defina as 4
variáveis do `.env.example`. **`SUPABASE_SERVICE_ROLE_KEY` é secreta** — só existe
no ambiente do edge, nunca no cliente.

## Testar o core
- `/r/joao123` com `modo=dois_botoes` → tela com 2 botões; clicar loga em `acessos` com `tipo_clique`.
- Troque para `link_unico` no banco → mesma URL passa a dar `302` direto.
- Slug inexistente → tela de erro amigável, sem quebrar.
- Confira o log: `select * from acessos order by criado_em desc;`

## Segurança (o que o RLS garante)
- Comércio autenticado só lê/edita o **próprio** registro e os **próprios** acessos.
- Só admin cadastra/remove comércios.
- Nenhum comércio consegue inserir `acessos` (evita inflar métricas) — o log só
  entra pela service_role do edge.

## Próxima fase
Painel do comércio (login, editar links, escolher modo, stats por dia) e painel
admin (listar comércios, cadastrar, stats agregadas). O schema e o client anon já
estão prontos para isso. O modo `split_percentual` já está reservado no schema.
