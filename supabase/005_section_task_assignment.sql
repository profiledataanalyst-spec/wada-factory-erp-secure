-- Factory ERP v11.1: Section field, task assignment security and reporting indexes
-- Run after 001_auth_profiles.sql through 004_stability_performance.sql.
-- Existing item records without Section or assignment fields remain valid.

begin;

create or replace function public.validate_erp_item_section_assignment()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_section text;
  v_priority text;
  v_assigned_executive text;
begin
  if new.entity_type <> 'items' then
    return new;
  end if;

  v_section := btrim(coalesce(new.payload ->> 'section', ''));
  if v_section <> '' and v_section not in ('Aluminium', 'Store', 'Fabrication', 'Outsource') then
    raise exception 'Invalid Section %. Allowed values: Aluminium, Store, Fabrication, Outsource.', v_section
      using errcode = '23514';
  end if;

  v_priority := btrim(coalesce(new.payload ->> 'priority', ''));
  if v_priority <> '' and v_priority not in ('Low', 'Medium', 'High', 'Critical') then
    raise exception 'Invalid task priority %.', v_priority using errcode = '23514';
  end if;

  if coalesce(new.payload ->> 'dueDate', '') <> ''
     and (new.payload ->> 'dueDate') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Task dueDate must use YYYY-MM-DD format.' using errcode = '23514';
  end if;

  v_assigned_executive := btrim(coalesce(new.payload ->> 'assignedExecutiveId', ''));
  if v_assigned_executive <> '' and not exists (
    select 1
    from public.profiles p
    where p.id::text = v_assigned_executive
      and p.role = 'EXECUTIVE'
      and p.status = 'ACTIVE'
  ) then
    raise exception 'Assigned Executive is invalid or inactive.' using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_erp_item_section_assignment on public.erp_records;
create trigger trg_validate_erp_item_section_assignment
before insert or update on public.erp_records
for each row execute function public.validate_erp_item_section_assignment();

create index if not exists erp_records_item_section_idx
  on public.erp_records ((payload ->> 'section'))
  where entity_type = 'items';

create index if not exists erp_records_item_assigned_executive_idx
  on public.erp_records ((payload ->> 'assignedExecutiveId'))
  where entity_type = 'items';

create index if not exists erp_records_item_section_status_idx
  on public.erp_records ((payload ->> 'section'), (payload ->> 'status'))
  where entity_type = 'items';

create index if not exists erp_records_item_due_date_idx
  on public.erp_records ((payload ->> 'dueDate'))
  where entity_type = 'items';

create or replace function public.current_erp_role(p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select upper(coalesce((select p.role from public.profiles p where p.id = p_user_id and p.status = 'ACTIVE'), ''));
$$;

create or replace function public.executive_can_read_erp_record(
  p_user_id uuid,
  p_entity_type text,
  p_payload jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  v_user text := p_user_id::text;
  v_item_id text;
  v_project_id text;
begin
  if p_user_id is null then return false; end if;

  if p_entity_type = 'items' then
    return coalesce(p_payload ->> 'assignedExecutiveId', '') = v_user;
  end if;

  if p_entity_type = 'projects' then
    v_project_id := coalesce(p_payload ->> 'id', '');
    return coalesce(p_payload -> 'executiveIds', '[]'::jsonb) ? v_user
      or exists (
        select 1 from public.erp_records r
        where r.entity_type = 'items'
          and r.payload ->> 'projectId' = v_project_id
          and r.payload ->> 'assignedExecutiveId' = v_user
      );
  end if;

  if p_entity_type in ('shortages', 'issues') then
    v_item_id := coalesce(p_payload ->> 'itemId', '');
    v_project_id := coalesce(p_payload ->> 'projectId', '');
    if v_item_id <> '' then
      return exists (
        select 1 from public.erp_records r
        where r.entity_type = 'items'
          and r.record_id = v_item_id
          and r.payload ->> 'assignedExecutiveId' = v_user
      );
    end if;
    return v_project_id <> '' and exists (
      select 1 from public.erp_records r
      where r.entity_type = 'items'
        and r.payload ->> 'projectId' = v_project_id
        and r.payload ->> 'assignedExecutiveId' = v_user
    );
  end if;

  if p_entity_type = 'notifications' then
    return coalesce(p_payload ->> 'userId', '') = v_user;
  end if;

  if p_entity_type = 'audit' then
    v_item_id := coalesce(p_payload ->> 'entityId', '');
    return v_item_id <> '' and exists (
      select 1 from public.erp_records r
      where r.entity_type = 'items'
        and r.record_id = v_item_id
        and r.payload ->> 'assignedExecutiveId' = v_user
    );
  end if;

  return false;
end;
$$;

revoke all on function public.current_erp_role(uuid) from public;
revoke all on function public.executive_can_read_erp_record(uuid, text, jsonb) from public;
grant execute on function public.current_erp_role(uuid) to authenticated;
grant execute on function public.executive_can_read_erp_record(uuid, text, jsonb) to authenticated;

drop policy if exists "Authenticated users read shared ERP data" on public.erp_records;
drop policy if exists "Role scoped ERP record access" on public.erp_records;
create policy "Role scoped ERP record access"
on public.erp_records
for select
to authenticated
using (
  auth.uid() is not null
  and (
    public.current_erp_role(auth.uid()) in ('ADMIN', 'MANAGER')
    or (
      public.current_erp_role(auth.uid()) = 'EXECUTIVE'
      and public.executive_can_read_erp_record(auth.uid(), entity_type, payload)
    )
  )
);

comment on function public.validate_erp_item_section_assignment() is
  'Backward-compatible validation for item Section, task priority, due date and assigned Executive.';
comment on function public.executive_can_read_erp_record(uuid, text, jsonb) is
  'Restricts Executive reads to assigned production tasks and directly related project, shortage, issue, notification and audit records.';

commit;

notify pgrst, 'reload schema';
