-- =====================================================
-- Cognitive Training App — Supabase Schema
-- =====================================================
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- =====================================================

-- Tabla de sesiones de entrenamiento
create table if not exists public.cognitive_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade not null,
  day text not null,
  date timestamptz default now() not null,
  results jsonb not null default '[]'::jsonb,
  total_correct int not null default 0,
  total_answered int not null default 0,
  avg_time_ms double precision not null default 0,
  duration_ms bigint not null default 0
);

-- Índice para consultar sesiones de un usuario ordenadas por fecha
create index if not exists idx_cognitive_sessions_user_date
  on public.cognitive_sessions (user_id, date desc);

-- Habilitar RLS
alter table public.cognitive_sessions enable row level security;

-- Política: usuarios solo pueden ver sus sesiones
drop policy if exists "Users can view own cognitive_sessions" on public.cognitive_sessions;
create policy "Users can view own cognitive_sessions"
  on public.cognitive_sessions
  for select
  using (auth.uid() = user_id);

-- Política: usuarios solo pueden insertar sus sesiones
drop policy if exists "Users can insert own cognitive_sessions" on public.cognitive_sessions;
create policy "Users can insert own cognitive_sessions"
  on public.cognitive_sessions
  for insert
  with check (auth.uid() = user_id);

-- Política: usuarios solo pueden borrar sus sesiones
drop policy if exists "Users can delete own cognitive_sessions" on public.cognitive_sessions;
create policy "Users can delete own cognitive_sessions"
  on public.cognitive_sessions
  for delete
  using (auth.uid() = user_id);

-- Política: usuarios solo pueden actualizar sus sesiones
drop policy if exists "Users can update own cognitive_sessions" on public.cognitive_sessions;
create policy "Users can update own cognitive_sessions"
  on public.cognitive_sessions
  for update
  using (auth.uid() = user_id);

-- Comentario
comment on table public.cognitive_sessions is
  'Sesiones de entrenamiento cognitivo. Una fila por sesión completada.';
