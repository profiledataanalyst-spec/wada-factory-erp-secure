-- Factory ERP upgrade: administrator-created temporary passwords.
-- Run this once on an existing Supabase project that already used 001_auth_profiles.sql.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.profiles
  add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists profiles_created_by_idx
  on public.profiles (created_by);

-- Existing Super Admin accounts must not be forced through the temporary-password screen.
update public.profiles
set must_change_password = false
where role = 'ADMIN';
