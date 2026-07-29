-- Factory ERP v9: shared operational data and realtime synchronization
-- Run once in Supabase SQL Editor after 001_auth_profiles.sql and
-- 002_temporary_password_workflow.sql.

begin;

create table if not exists public.erp_records (
  entity_type text not null,
  record_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint erp_records_pkey primary key (entity_type, record_id),
  constraint erp_records_entity_type_check check (
    entity_type in ('projects', 'items', 'shortages', 'issues', 'audit', 'notifications')
  ),
  constraint erp_records_payload_object_check check (jsonb_typeof(payload) = 'object')
);

create or replace function public.set_erp_record_metadata()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' and new.created_by is null then
    new.created_by := new.updated_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_erp_record_metadata on public.erp_records;
create trigger trg_set_erp_record_metadata
before insert or update on public.erp_records
for each row execute function public.set_erp_record_metadata();

create index if not exists erp_records_updated_at_idx
  on public.erp_records (updated_at desc);
create index if not exists erp_records_entity_updated_idx
  on public.erp_records (entity_type, updated_at desc);
create index if not exists erp_records_project_id_idx
  on public.erp_records (entity_type, ((payload ->> 'projectId')));
create index if not exists erp_records_payload_gin_idx
  on public.erp_records using gin (payload jsonb_path_ops);

alter table public.erp_records enable row level security;
alter table public.erp_records force row level security;

revoke all on table public.erp_records from anon;
revoke insert, update, delete, truncate, references, trigger on table public.erp_records from authenticated;
grant select on table public.erp_records to authenticated;

-- Every active authenticated ERP user reads the same shared operational dataset.
-- Writes are intentionally routed through the protected Netlify Function, where
-- the caller's Supabase session and ERP role are checked before the secret key is used.
drop policy if exists "Authenticated users read shared ERP data" on public.erp_records;
create policy "Authenticated users read shared ERP data"
on public.erp_records
for select
to authenticated
using (
  auth.uid() is not null
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and upper(p.status) = 'ACTIVE'
  )
);

alter table public.erp_records replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'erp_records'
  ) then
    alter publication supabase_realtime add table public.erp_records;
  end if;
end
$$;

comment on table public.erp_records is
  'Central source of truth for Factory ERP projects, production items, shortages, issues, audit entries and notifications.';
comment on column public.erp_records.payload is
  'Application-compatible JSON document for one operational record. Authentication profiles remain normalized in public.profiles.';

commit;

notify pgrst, 'reload schema';
