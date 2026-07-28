-- Factory ERP secure user profiles for Supabase Auth
-- Run this once in Supabase Dashboard > SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) >= 2),
  email text not null,
  role text not null check (role in ('ADMIN', 'MANAGER', 'EXECUTIVE')),
  status text not null default 'INVITED' check (status in ('INVITED', 'ACTIVE', 'INACTIVE')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_unique
  on public.profiles (lower(email));

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

-- Every signed-in ERP user may read the directory. All writes are performed
-- by the protected Netlify Function using the Supabase secret key.
drop policy if exists profiles_authenticated_read on public.profiles;
create policy profiles_authenticated_read
on public.profiles
for select
to authenticated
using (true);

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
