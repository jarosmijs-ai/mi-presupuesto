# Activar cuenta y sincronización en la nube

La aplicación funciona sin Supabase. Para activar cuenta, respaldo y restauración entre dispositivos:

## 1. Crear proyecto

Crea un proyecto en Supabase y copia:

- Project URL
- anon public key

## 2. Crear tabla

Ejecuta este SQL en Supabase:

```sql
create table public.user_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_backups enable row level security;

create policy "Users can read their own backup"
on public.user_backups for select
using (auth.uid() = user_id);

create policy "Users can insert their own backup"
on public.user_backups for insert
with check (auth.uid() = user_id);

create policy "Users can update their own backup"
on public.user_backups for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 3. Configurar Vercel

En **Project Settings → Environment Variables**, agrega:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Usa los valores del proyecto de Supabase y vuelve a desplegar.

## Privacidad

La política RLS garantiza que cada usuario autenticado solo pueda leer y modificar su propio respaldo. La clave `anon` es pública por diseño; nunca uses la `service_role` en Vercel ni en el navegador.
