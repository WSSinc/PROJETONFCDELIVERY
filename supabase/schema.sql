-- =============================================================================
-- Projeto NFC — Schema Multi-Tenant (Supabase / Postgres)
-- =============================================================================
-- Modelo:
--   admin (dono do sistema) -> cadastra comércios
--   comércio (tenant)       -> loga, edita os próprios links, vê as próprias estatísticas
--   consumidor final        -> encosta a tag, cai no redirect público (sem auth)
--
-- O redirect público NÃO usa este RLS: ele roda no edge com a service_role key
-- (bypass de RLS, chave secreta, server-side). O RLS abaixo protege o painel:
-- garante que um comércio autenticado jamais leia/edite dados de outro.
-- =============================================================================

create extension if not exists pgcrypto;

-- Gerador de código de ativação legível (sem caracteres ambíguos: O/0, I/L/1).
-- Usado como default de comercios.codigo_ativacao; o cliente ativa a conta com ele.
create or replace function public.gerar_codigo_ativacao()
returns text
language sql
volatile
set search_path = public
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1),
    ''
  )
  from generate_series(1, 8);
$$;

-- modo_redirecionamento:
--   'link_unico'       -> redireciona direto para um destino
--   'dois_botoes'      -> página intermediária com 2 botões
--   'split_percentual' -> reservado para o futuro, não implementado no app ainda
-- link_unico_destino: qual link o modo 'link_unico' usa ('pedido' | 'avaliacao')

-- -----------------------------------------------------------------------------
-- Tabela: comercios
-- -----------------------------------------------------------------------------
create table if not exists public.comercios (
  id                     uuid primary key default gen_random_uuid(),
  owner_id               uuid references auth.users (id) on delete set null,
  slug                   text not null unique
                           check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  nome                   text not null check (char_length(nome) between 1 and 120),
  modo_redirecionamento  text not null default 'link_unico'
                           check (modo_redirecionamento in
                                  ('link_unico','dois_botoes','split_percentual')),
  link_unico_destino     text not null default 'pedido'
                           check (link_unico_destino in ('pedido','avaliacao')),
  link_pedido            text check (link_pedido is null or link_pedido ~ '^https?://'),
  link_avaliacao         text check (link_avaliacao is null or link_avaliacao ~ '^https?://'),
  split_pedido_pct       smallint not null default 50
                           check (split_pedido_pct between 0 and 100),
  codigo_ativacao        text not null unique default public.gerar_codigo_ativacao(),
  ativado_em             timestamptz,
  logo_url               text check (logo_url is null or logo_url ~ '^https?://'),
  cupom_ativo            boolean not null default false,
  cupom_texto            text,          -- ex: "15% OFF pedindo direto"
  cupom_codigo           text,          -- ex: "VOLTA15"
  whatsapp_suporte       text,          -- só dígitos; fallback: extrai do link_pedido
  avaliacao_inteligente  boolean not null default true,
  ativo                  boolean not null default true,
  criado_em              timestamptz not null default now(),
  atualizado_em          timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Tabela: clientes_finais (base capturada pela tag — o ativo que o iFood não dá)
-- -----------------------------------------------------------------------------
create table if not exists public.clientes_finais (
  id            uuid primary key default gen_random_uuid(),
  comercio_id   uuid not null references public.comercios (id) on delete cascade,
  whatsapp      text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  nome          text,
  token         uuid,               -- identidade do dispositivo (localStorage)
  toques        integer not null default 1,
  criado_em     timestamptz not null default now(),
  ultimo_toque  timestamptz not null default now(),
  unique (comercio_id, whatsapp)
);
create index if not exists clientes_finais_comercio_idx
  on public.clientes_finais (comercio_id, ultimo_toque desc);

-- -----------------------------------------------------------------------------
-- Tabela: avaliacoes (funil: 4-5 vão pro Google; 1-3 interceptadas no WhatsApp)
-- -----------------------------------------------------------------------------
create table if not exists public.avaliacoes (
  id           bigint generated always as identity primary key,
  comercio_id  uuid not null references public.comercios (id) on delete cascade,
  estrelas     smallint not null check (estrelas between 1 and 5),
  token        uuid,
  criado_em    timestamptz not null default now()
);
create index if not exists avaliacoes_comercio_idx
  on public.avaliacoes (comercio_id, criado_em desc);

-- Presença: incrementa toques do cliente identificado (só o worker chama, service_role)
create or replace function public.registrar_presenca(p_comercio uuid, p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.clientes_finais
     set toques = toques + 1, ultimo_toque = now()
   where comercio_id = p_comercio and token = p_token;
$$;
revoke execute on function public.registrar_presenca(uuid, uuid) from public;
revoke execute on function public.registrar_presenca(uuid, uuid) from anon;
revoke execute on function public.registrar_presenca(uuid, uuid) from authenticated;

comment on column public.comercios.owner_id is 'auth.users que loga como este comércio; null enquanto só o admin gerencia.';
comment on column public.comercios.slug is 'usado na URL da tag: dominio.com/r/<slug>. minúsculas, hífens.';
comment on column public.comercios.split_pedido_pct is 'reservado p/ modo split_percentual (futuro): % do tráfego p/ link_pedido.';

create index if not exists comercios_owner_idx on public.comercios (owner_id);
-- slug já tem índice único; é o lookup crítico do redirect.

-- -----------------------------------------------------------------------------
-- Tabela: acessos (append-only, alto volume)
-- -----------------------------------------------------------------------------
create table if not exists public.acessos (
  id           bigint generated always as identity primary key,
  comercio_id  uuid not null references public.comercios (id) on delete cascade,
  tipo_clique  text check (tipo_clique in ('pedido','avaliacao')),  -- null = link_unico
  criado_em    timestamptz not null default now()
);

create index if not exists acessos_comercio_data_idx
  on public.acessos (comercio_id, criado_em desc);
create index if not exists acessos_comercio_tipo_idx
  on public.acessos (comercio_id, tipo_clique);

-- -----------------------------------------------------------------------------
-- Tabela: admins (quem enxerga tudo)
-- -----------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  criado_em  timestamptz not null default now()
);

-- is_admin(): SECURITY DEFINER para não recair no RLS da própria admins
-- (evita recursão de política). search_path fixo por segurança.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- is_admin() é usada dentro das políticas RLS pelo role 'authenticated'.
-- Tira o EXECUTE do PUBLIC/anon (não precisam) e mantém só authenticated.
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_admin() from anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.touch_atualizado_em()
returns trigger
language plpgsql
set search_path = ''  -- evita search_path mutável (hardening do linter)
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists trg_comercios_touch on public.comercios;
create trigger trg_comercios_touch
  before update on public.comercios
  for each row execute function public.touch_atualizado_em();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.comercios enable row level security;
alter table public.acessos   enable row level security;
alter table public.admins    enable row level security;

-- --- comercios -------------------------------------------------------------
drop policy if exists comercios_select on public.comercios;
create policy comercios_select on public.comercios
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

drop policy if exists comercios_update on public.comercios;
create policy comercios_update on public.comercios
  for update to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

drop policy if exists comercios_insert on public.comercios;
create policy comercios_insert on public.comercios
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists comercios_delete on public.comercios;
create policy comercios_delete on public.comercios
  for delete to authenticated
  using (public.is_admin());

-- --- acessos ---------------------------------------------------------------
drop policy if exists acessos_select on public.acessos;
create policy acessos_select on public.acessos
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.comercios c
      where c.id = acessos.comercio_id and c.owner_id = auth.uid()
    )
  );
-- Sem policy de INSERT p/ authenticated/anon: o log só entra via service_role
-- (edge do redirect), que ignora RLS. Impede um comércio inflar as próprias métricas.

-- --- clientes_finais / avaliacoes ------------------------------------------
-- Dono vê os próprios; escrita só via service_role (worker) — sem policy de insert.
alter table public.clientes_finais enable row level security;
alter table public.avaliacoes enable row level security;

drop policy if exists clientes_finais_select on public.clientes_finais;
create policy clientes_finais_select on public.clientes_finais
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.comercios c
               where c.id = clientes_finais.comercio_id and c.owner_id = auth.uid())
  );

drop policy if exists avaliacoes_select on public.avaliacoes;
create policy avaliacoes_select on public.avaliacoes
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.comercios c
               where c.id = avaliacoes.comercio_id and c.owner_id = auth.uid())
  );

-- --- admins ----------------------------------------------------------------
drop policy if exists admins_select on public.admins;
create policy admins_select on public.admins
  for select to authenticated
  using (public.is_admin());

-- =============================================================================
-- View de estatísticas por dia (usada pelo painel; herda o RLS de acessos)
-- =============================================================================
create or replace view public.acessos_por_dia
with (security_invoker = true) as
select
  comercio_id,
  date_trunc('day', criado_em)::date as dia,
  count(*)                                            as total,
  count(*) filter (where tipo_clique = 'pedido')     as cliques_pedido,
  count(*) filter (where tipo_clique = 'avaliacao')  as cliques_avaliacao
from public.acessos
group by comercio_id, date_trunc('day', criado_em)::date;

-- =============================================================================
-- View agregada por comércio (usada pelo admin; herda o RLS de acessos)
-- =============================================================================
create or replace view public.comercio_totais
with (security_invoker = true) as
select
  c.id                                                        as comercio_id,
  c.slug,
  c.nome,
  c.modo_redirecionamento,
  c.ativo,
  c.criado_em,
  c.codigo_ativacao,
  c.ativado_em,
  c.logo_url,
  (c.owner_id is not null)                                                       as tem_dono,
  coalesce(sum(1)           filter (where a.id is not null), 0)               as total_acessos,
  coalesce(sum(1)           filter (where a.tipo_clique = 'pedido'), 0)        as cliques_pedido,
  coalesce(sum(1)           filter (where a.tipo_clique = 'avaliacao'), 0)     as cliques_avaliacao,
  max(a.criado_em)                                                              as ultimo_acesso
from public.comercios c
left join public.acessos a on a.comercio_id = c.id
group by c.id, c.slug, c.nome, c.modo_redirecionamento, c.ativo, c.criado_em,
         c.codigo_ativacao, c.ativado_em, c.logo_url, c.owner_id;

-- =============================================================================
-- Bootstrap do primeiro admin (rode UMA vez, após criar seu usuário no Auth)
-- =============================================================================
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'pharma.atestados@gmail.com'
--    on conflict do nothing;
-- =============================================================================
