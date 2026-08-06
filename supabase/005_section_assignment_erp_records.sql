-- Profile Solutions Factory ERP v11.3.1
-- Section Assignment and Dashboard Integration for the existing ERP architecture.
-- Single source of truth: public.erp_records. This migration does NOT require
-- public.project_line_items. Run after 004_stability_performance.sql. Safe to rerun.

begin;

do $$
begin
  if to_regclass('public.erp_records') is null then
    raise exception using errcode = '42P01',
      message = 'public.erp_records is missing. Run 003_shared_operational_data.sql first.';
  end if;
  if to_regclass('public.profiles') is null then
    raise exception using errcode = '42P01',
      message = 'public.profiles is missing. Run 001_auth_profiles.sql first.';
  end if;
  if to_regclass('public.erp_mutation_log') is null then
    raise exception using errcode = '42P01',
      message = 'public.erp_mutation_log is missing. Run 004_stability_performance.sql first.';
  end if;
end
$$;

-- Normalise recognised legacy casing without changing blank or unrelated values.
update public.erp_records
   set payload = jsonb_set(
     payload,
     '{section}',
     to_jsonb(case lower(trim(payload ->> 'section'))
       when 'aluminium' then 'Aluminium'
       when 'store' then 'Store'
       when 'fabrication' then 'Fabrication'
       when 'outsource' then 'Outsource'
     end),
     true
   )
 where entity_type = 'items'
   and lower(trim(coalesce(payload ->> 'section', ''))) in
       ('aluminium', 'store', 'fabrication', 'outsource')
   and payload ->> 'section' not in ('Aluminium', 'Store', 'Fabrication', 'Outsource');

-- Targeted indexes used by Section filters, assignment screens and dashboards.
create index if not exists erp_records_items_section_idx
  on public.erp_records ((payload ->> 'section'), updated_at desc)
  where entity_type = 'items';

create index if not exists erp_records_items_project_section_idx
  on public.erp_records ((payload ->> 'projectId'), (payload ->> 'section'), updated_at desc)
  where entity_type = 'items';

create index if not exists erp_records_items_assigned_executive_idx
  on public.erp_records ((payload ->> 'assignedExecutiveId'), updated_at desc)
  where entity_type = 'items'
    and coalesce(payload ->> 'assignedExecutiveId', '') <> '';

-- Validate Section and assignment metadata whenever a production item is written.
create or replace function public.validate_erp_item_section_assignment()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_section text;
  v_executive_text text;
  v_executive uuid;
begin
  if new.entity_type <> 'items' then
    return new;
  end if;

  v_section := nullif(trim(coalesce(new.payload ->> 'section', '')), '');
  if v_section is not null
     and v_section not in ('Aluminium', 'Store', 'Fabrication', 'Outsource') then
    raise exception using errcode = '23514',
      message = 'Section must be Aluminium, Store, Fabrication or Outsource.';
  end if;

  v_executive_text := nullif(trim(coalesce(new.payload ->> 'assignedExecutiveId', '')), '');
  if v_executive_text is not null then
    begin
      v_executive := v_executive_text::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023',
        message = 'Assigned Executive ID is invalid.';
    end;

    if not exists (
      select 1 from public.profiles p
       where p.id = v_executive
         and upper(coalesce(p.role, '')) = 'EXECUTIVE'
         and upper(coalesce(p.status, '')) = 'ACTIVE'
    ) then
      raise exception using errcode = '42501',
        message = 'Section work can be assigned only to an active Executive.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_erp_item_section_assignment on public.erp_records;
create trigger trg_validate_erp_item_section_assignment
before insert or update of payload on public.erp_records
for each row
when (new.entity_type = 'items')
execute function public.validate_erp_item_section_assignment();

-- Atomically assign all items in one Project + Section to an Executive.
create or replace function public.assign_project_sections(
  p_project_id text,
  p_assignments jsonb,
  p_actor uuid,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text;
  v_project jsonb;
  v_assignment jsonb;
  v_section text;
  v_seen_sections text[] := array[]::text[];
  v_executive_text text;
  v_executive uuid;
  v_exec_created_by uuid;
  v_project_exec_ids jsonb;
  v_now timestamptz := clock_timestamp();
  v_rows integer := 0;
  v_total integer := 0;
  v_existing_result jsonb;
  v_result jsonb;
  v_records jsonb;
  v_notification_id text;
begin
  if p_actor is null then
    raise exception using errcode = '22023', message = 'Actor is required.';
  end if;
  if trim(coalesce(p_project_id, '')) = '' then
    raise exception using errcode = '22023', message = 'Project ID is required.';
  end if;
  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception using errcode = '22023', message = 'Section assignments must be an array.';
  end if;
  if jsonb_array_length(p_assignments) > 4 then
    raise exception using errcode = '22023', message = 'A maximum of four Section assignments is allowed.';
  end if;

  select upper(coalesce(role, '')) into v_role
    from public.profiles
   where id = p_actor and upper(coalesce(status, '')) = 'ACTIVE';
  if v_role not in ('ADMIN', 'MANAGER') then
    raise exception using errcode = '42501',
      message = 'Only a Super Admin or Manager can assign Section work.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('section-assignment:' || p_project_id, 0));

  select payload into v_project
    from public.erp_records
   where entity_type = 'projects' and record_id = p_project_id
   for update;
  if not found then
    raise exception using errcode = '23503', message = 'Project was not found.';
  end if;

  if v_role = 'MANAGER'
     and coalesce(v_project ->> 'managerId', '') <> p_actor::text then
    raise exception using errcode = '42501',
      message = 'Managers can assign work only for projects assigned to them.';
  end if;

  if trim(coalesce(p_request_id, '')) <> '' then
    if length(trim(p_request_id)) < 8 or length(p_request_id) > 160 then
      raise exception using errcode = '22023', message = 'Request ID is invalid.';
    end if;
    select result into v_existing_result
      from public.erp_mutation_log
     where request_id = p_request_id;
    if found then
      return v_existing_result || jsonb_build_object('deduplicated', true);
    end if;
  end if;

  v_project_exec_ids := case
    when jsonb_typeof(v_project -> 'executiveIds') = 'array' then v_project -> 'executiveIds'
    else '[]'::jsonb
  end;

  for v_assignment in select value from jsonb_array_elements(p_assignments)
  loop
    v_section := trim(coalesce(v_assignment ->> 'section', ''));
    if v_section not in ('Aluminium', 'Store', 'Fabrication', 'Outsource') then
      raise exception using errcode = '23514',
        message = 'Section must be Aluminium, Store, Fabrication or Outsource.';
    end if;
    if v_section = any(v_seen_sections) then
      raise exception using errcode = '22023',
        message = 'Duplicate Section assignment supplied for ' || v_section || '.';
    end if;
    v_seen_sections := array_append(v_seen_sections, v_section);

    v_executive_text := nullif(trim(coalesce(v_assignment ->> 'executiveId', '')), '');
    v_executive := null;
    v_exec_created_by := null;

    if v_executive_text is not null then
      begin
        v_executive := v_executive_text::uuid;
      exception when invalid_text_representation then
        raise exception using errcode = '22023', message = 'Executive ID is invalid.';
      end;

      select created_by into v_exec_created_by
        from public.profiles
       where id = v_executive
         and upper(coalesce(role, '')) = 'EXECUTIVE'
         and upper(coalesce(status, '')) = 'ACTIVE';
      if not found then
        raise exception using errcode = '42501',
          message = 'Section work can be assigned only to an active Executive.';
      end if;

      if v_role = 'MANAGER'
         and v_exec_created_by is distinct from p_actor
         and not (v_project_exec_ids ? v_executive::text) then
        raise exception using errcode = '42501',
          message = 'Managers may assign only Executives they manage.';
      end if;
    end if;

    update public.erp_records
       set payload = payload || jsonb_build_object(
         'section', v_section,
         'assignedExecutiveId', coalesce(v_executive::text, ''),
         'assignedBy', case when v_executive is null then '' else p_actor::text end,
         'assignedAt', case when v_executive is null then '' else v_now::text end,
         'updatedAt', v_now::text
       ),
           updated_by = p_actor
     where entity_type = 'items'
       and payload ->> 'projectId' = p_project_id
       and payload ->> 'section' = v_section
       and coalesce(payload ->> 'assignedExecutiveId', '')
           is distinct from coalesce(v_executive::text, '');

    get diagnostics v_rows = row_count;
    v_total := v_total + v_rows;

    if v_executive is not null and v_rows > 0 then
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb)
        into v_project_exec_ids
        from (
          select distinct value
            from jsonb_array_elements_text(v_project_exec_ids || jsonb_build_array(v_executive::text))
        ) unique_ids;

      v_notification_id := 'NOT-' || upper(replace(gen_random_uuid()::text, '-', ''));
      insert into public.erp_records(entity_type, record_id, payload, created_by, updated_by)
      values (
        'notifications',
        v_notification_id,
        jsonb_build_object(
          'id', v_notification_id,
          'userId', v_executive::text,
          'title', 'Section work assigned',
          'message', v_section || ' work has been assigned for ' || coalesce(v_project ->> 'name', p_project_id) || '.',
          'type', 'Assignment',
          'entityId', p_project_id,
          'read', false,
          'createdAt', v_now::text
        ),
        p_actor,
        p_actor
      );
    end if;
  end loop;

  v_project := jsonb_set(v_project, '{executiveIds}', v_project_exec_ids, true);
  update public.erp_records
     set payload = v_project || jsonb_build_object('updatedAt', v_now::text),
         updated_by = p_actor
   where entity_type = 'projects' and record_id = p_project_id;

  select coalesce(jsonb_agg(payload order by created_at, record_id), '[]'::jsonb)
    into v_records
    from public.erp_records
   where entity_type = 'items' and payload ->> 'projectId' = p_project_id;

  v_result := jsonb_build_object(
    'ok', true,
    'updatedItems', v_total,
    'productionRecords', v_records,
    'requestId', nullif(trim(coalesce(p_request_id, '')), ''),
    'deduplicated', false
  );

  if trim(coalesce(p_request_id, '')) <> '' then
    insert into public.erp_mutation_log(request_id, actor_id, result)
    values (p_request_id, p_actor, v_result)
    on conflict (request_id) do nothing;
  end if;

  return v_result;
end;
$$;

revoke all on function public.assign_project_sections(text, jsonb, uuid, text)
from public, anon, authenticated;
grant execute on function public.assign_project_sections(text, jsonb, uuid, text)
to service_role;

-- Lightweight readiness RPC used by /api/config. It does not expose business data.
create or replace function public.section_assignment_status()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ready',
      to_regclass('public.erp_records') is not null
      and to_regclass('public.erp_mutation_log') is not null
      and to_regclass('public.erp_records_items_section_idx') is not null
      and to_regclass('public.erp_records_items_project_section_idx') is not null
      and to_regclass('public.erp_records_items_assigned_executive_idx') is not null
      and to_regprocedure('public.assign_project_sections(text,jsonb,uuid,text)') is not null,
    'storage', 'erp_records',
    'mode', 'erp-records-section-to-executive-single-source',
    'allowedSections', jsonb_build_array('Aluminium', 'Store', 'Fabrication', 'Outsource')
  );
$$;

revoke all on function public.section_assignment_status() from public, anon, authenticated;
grant execute on function public.section_assignment_status() to service_role;

comment on function public.assign_project_sections(text, jsonb, uuid, text) is
  'Atomically assigns Factory ERP production records by Project and Section using public.erp_records.';
comment on function public.section_assignment_status() is
  'Reports readiness of the erp_records-only Section Assignment migration.';

commit;
notify pgrst, 'reload schema';
