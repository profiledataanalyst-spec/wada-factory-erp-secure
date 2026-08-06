-- Profile Solutions Factory ERP v11.2
-- Database-confirmed Section assignment with atomic updates, read-back verification,
-- audit logging, notification creation and idempotent retries.
-- Run after 001_auth_profiles.sql through 005_section_task_assignment.sql.

begin;

create or replace function public.assign_erp_section_work(
  p_request_id text,
  p_actor uuid,
  p_section text,
  p_executive_id text,
  p_project_id text default '',
  p_scope text default 'all',
  p_item_id text default '',
  p_due_date text default '',
  p_priority text default 'Medium'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_existing_result jsonb;
  v_result jsonb;
  v_actor_role text;
  v_actor_name text;
  v_executive_uuid uuid;
  v_executive_name text := '';
  v_section text;
  v_scope text := lower(trim(coalesce(p_scope, 'all')));
  v_project_id text := trim(coalesce(p_project_id, ''));
  v_item_id text := trim(coalesce(p_item_id, ''));
  v_executive_id text := trim(coalesce(p_executive_id, ''));
  v_due_date text := trim(coalesce(p_due_date, ''));
  v_priority text := initcap(lower(trim(coalesce(p_priority, 'Medium'))));
  v_now timestamptz := clock_timestamp();
  v_now_iso text;
  v_target_ids text[];
  v_target_count integer := 0;
  v_updated_count integer := 0;
  v_verified_count integer := 0;
  v_first_item text := '';
  v_notification_id text;
  v_audit_id text;
  v_action text;
  v_status text;
  v_message text;
begin
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 160 then
    raise exception using errcode = '22023', message = 'ERP_INVALID_REQUEST_ID';
  end if;
  if p_actor is null then
    raise exception using errcode = '22023', message = 'ERP_ACTOR_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(trim(p_request_id), 0));

  select result
    into v_existing_result
    from public.erp_mutation_log
   where request_id = trim(p_request_id);

  if found then
    return v_existing_result || jsonb_build_object('deduplicated', true);
  end if;

  select upper(p.role), coalesce(nullif(trim(p.full_name), ''), p.email, 'ERP User')
    into v_actor_role, v_actor_name
    from public.profiles p
   where p.id = p_actor
     and upper(p.status) = 'ACTIVE';

  if v_actor_role is null then
    raise exception using errcode = '42501', message = 'ERP_ACTIVE_ACTOR_REQUIRED';
  end if;
  if v_actor_role not in ('ADMIN', 'MANAGER') then
    raise exception using errcode = '42501', message = 'ERP_SECTION_ASSIGNMENT_FORBIDDEN';
  end if;

  v_section := case lower(trim(coalesce(p_section, '')))
    when 'aluminium' then 'Aluminium'
    when 'store' then 'Store'
    when 'fabrication' then 'Fabrication'
    when 'outsource' then 'Outsource'
    else ''
  end;
  if v_section = '' then
    raise exception using errcode = '22023', message = 'ERP_INVALID_SECTION';
  end if;

  if v_scope not in ('all', 'unassigned', 'unsectioned') then
    raise exception using errcode = '22023', message = 'ERP_INVALID_ASSIGNMENT_SCOPE';
  end if;
  if v_item_id = '' and v_executive_id = '' then
    raise exception using errcode = '22023', message = 'ERP_EXECUTIVE_REQUIRED';
  end if;
  if v_item_id = '' and v_scope = 'unsectioned' and v_project_id = '' then
    raise exception using errcode = '22023', message = 'ERP_PROJECT_REQUIRED_FOR_UNSECTIONED_ASSIGNMENT';
  end if;

  if v_executive_id <> '' then
    begin
      v_executive_uuid := v_executive_id::uuid;
    exception when invalid_text_representation then
      raise exception using errcode = '22023', message = 'ERP_INVALID_EXECUTIVE_ID';
    end;

    select coalesce(nullif(trim(p.full_name), ''), p.email, 'Executive')
      into v_executive_name
      from public.profiles p
     where p.id = v_executive_uuid
       and upper(p.role) = 'EXECUTIVE'
       and upper(p.status) = 'ACTIVE';

    if v_executive_name is null then
      raise exception using errcode = '23514', message = 'ERP_EXECUTIVE_INVALID_OR_INACTIVE';
    end if;
  end if;

  if v_due_date <> '' then
    if v_due_date !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception using errcode = '22023', message = 'ERP_INVALID_DUE_DATE';
    end if;
    begin
      perform v_due_date::date;
    exception when others then
      raise exception using errcode = '22023', message = 'ERP_INVALID_DUE_DATE';
    end;
  end if;

  if v_priority not in ('Low', 'Medium', 'High', 'Critical') then
    raise exception using errcode = '22023', message = 'ERP_INVALID_PRIORITY';
  end if;

  -- Select and lock the exact database rows that will be updated. The browser's
  -- current state is intentionally not used as the source of truth.
  select array_agg(candidate.record_id order by candidate.record_id)
    into v_target_ids
    from (
      select r.record_id
        from public.erp_records r
       where r.entity_type = 'items'
         and (
           (v_item_id <> '' and r.record_id = v_item_id)
           or (
             v_item_id = ''
             and (v_project_id = '' or coalesce(r.payload ->> 'projectId', '') = v_project_id)
             and (
               (v_scope = 'unsectioned' and trim(coalesce(r.payload ->> 'section', '')) = '')
               or (
                 v_scope <> 'unsectioned'
                 and lower(trim(coalesce(r.payload ->> 'section', ''))) = lower(v_section)
                 and (v_scope <> 'unassigned' or trim(coalesce(r.payload ->> 'assignedExecutiveId', '')) = '')
               )
             )
           )
         )
       for update
    ) candidate;

  v_target_count := coalesce(cardinality(v_target_ids), 0);
  v_now_iso := to_char(v_now at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');

  if v_target_count = 0 then
    v_message := 'No production items found for the selected section. Please verify the uploaded data and section mapping.';
    v_result := jsonb_build_object(
      'ok', false,
      'requestId', trim(p_request_id),
      'updated', 0,
      'verified', 0,
      'recordIds', '[]'::jsonb,
      'section', v_section,
      'executiveId', v_executive_id,
      'message', v_message,
      'deduplicated', false
    );
    insert into public.erp_mutation_log (request_id, actor_id, result)
    values (trim(p_request_id), p_actor, v_result);
    return v_result;
  end if;

  v_action := case when v_executive_id = '' then 'Task Unassigned' else 'Task Assigned' end;
  v_status := case when v_executive_id = '' then 'Unassigned' else 'Assigned' end;

  update public.erp_records r
     set payload = r.payload
       || jsonb_build_object(
         'section', v_section,
         'assignedExecutiveId', v_executive_id,
         'assignedExecutiveName', coalesce(v_executive_name, ''),
         'assignedById', p_actor::text,
         'assignedByName', v_actor_name,
         'assignedAt', case when v_executive_id = '' then '' else v_now_iso end,
         'dueDate', case when v_due_date <> '' then v_due_date else coalesce(r.payload ->> 'dueDate', r.payload ->> 'targetDate', '') end,
         'priority', case when trim(coalesce(p_priority, '')) <> '' then v_priority else coalesce(nullif(r.payload ->> 'priority', ''), 'Medium') end,
         'updatedAt', v_now_iso
       )
       || jsonb_build_object(
         'history',
         (case when jsonb_typeof(r.payload -> 'history') = 'array' then r.payload -> 'history' else '[]'::jsonb end)
         || jsonb_build_array(jsonb_build_object(
           'id', 'HIS-' || upper(substr(md5(r.record_id || ':' || trim(p_request_id)), 1, 28)),
           'stageIndex', case
             when coalesce(r.payload ->> 'currentStage', '') ~ '^\d+$'
               then least(8, greatest(0, (r.payload ->> 'currentStage')::integer))
             else 0
           end,
           'stageName', coalesce(nullif(r.payload ->> 'currentStageName', ''), 'PLANNING'),
           'action', v_action,
           'status', v_status,
           'updatedBy', p_actor::text,
           'updatedByName', v_actor_name,
           'date', v_now_iso,
           'remarks', case
             when v_executive_id = '' then 'Assignment removed by ' || v_actor_name || '.'
             else 'Assigned to ' || v_executive_name || ' for ' || v_section || '. Due ' || coalesce(nullif(v_due_date, ''), 'not specified') || '; priority ' || v_priority || '.'
           end,
           'attachments', '[]'::jsonb
         ))
       ),
         updated_by = p_actor
   where r.entity_type = 'items'
     and r.record_id = any(v_target_ids);

  get diagnostics v_updated_count = row_count;

  select count(*)
    into v_verified_count
    from public.erp_records r
   where r.entity_type = 'items'
     and r.record_id = any(v_target_ids)
     and coalesce(r.payload ->> 'section', '') = v_section
     and coalesce(r.payload ->> 'assignedExecutiveId', '') = v_executive_id
     and coalesce(r.payload ->> 'assignedById', '') = p_actor::text
     and coalesce(r.payload ->> 'assignedAt', '') = case when v_executive_id = '' then '' else v_now_iso end;

  if v_updated_count <> v_target_count or v_verified_count <> v_target_count then
    raise exception using
      errcode = '40001',
      message = 'ERP_SECTION_ASSIGNMENT_VERIFICATION_FAILED|' || v_target_count || '|' || v_updated_count || '|' || v_verified_count;
  end if;

  v_first_item := v_target_ids[1];
  v_audit_id := 'AUD-' || upper(substr(md5(trim(p_request_id) || ':audit'), 1, 28));

  insert into public.erp_records (entity_type, record_id, payload, created_by, updated_by)
  values (
    'audit',
    v_audit_id,
    jsonb_build_object(
      'id', v_audit_id,
      'action', case when v_executive_id = '' then 'UNASSIGN' else 'ASSIGN' end,
      'module', 'Production',
      'details', case
        when v_executive_id = '' then 'Unassigned ' || v_target_count || ' ' || v_section || ' production task(s).'
        else 'Assigned ' || v_target_count || ' ' || v_section || ' production task(s) to ' || v_executive_name || '.'
      end,
      'entityId', v_first_item,
      'userId', p_actor::text,
      'userName', v_actor_name,
      'createdAt', v_now_iso
    ),
    p_actor,
    p_actor
  )
  on conflict (entity_type, record_id) do nothing;

  if v_executive_id <> '' then
    v_notification_id := 'NOT-' || upper(substr(md5(trim(p_request_id) || ':notification'), 1, 28));
    insert into public.erp_records (entity_type, record_id, payload, created_by, updated_by)
    values (
      'notifications',
      v_notification_id,
      jsonb_build_object(
        'id', v_notification_id,
        'userId', v_executive_id,
        'title', case when v_item_id <> '' then 'Production task assigned' else 'Section work assigned' end,
        'message', case
          when v_item_id <> '' then v_section || ' production task has been assigned to you.'
          else v_target_count || ' ' || v_section || ' production task(s) have been assigned to you.'
        end,
        'type', 'Assignment',
        'entityId', v_first_item,
        'read', false,
        'createdAt', v_now_iso
      ),
      p_actor,
      p_actor
    )
    on conflict (entity_type, record_id) do nothing;
  end if;

  v_message := case
    when v_executive_id = '' then v_target_count || ' production item(s) unassigned and verified.'
    else v_target_count || ' production item(s) assigned and verified in the database.'
  end;

  v_result := jsonb_build_object(
    'ok', true,
    'requestId', trim(p_request_id),
    'updated', v_updated_count,
    'verified', v_verified_count,
    'recordIds', to_jsonb(v_target_ids),
    'section', v_section,
    'executiveId', v_executive_id,
    'assignedAt', case when v_executive_id = '' then '' else v_now_iso end,
    'message', v_message,
    'deduplicated', false
  );

  insert into public.erp_mutation_log (request_id, actor_id, result)
  values (trim(p_request_id), p_actor, v_result);

  delete from public.erp_mutation_log
   where created_at < now() - interval '30 days'
     and request_id <> trim(p_request_id);

  return v_result;
end;
$$;

revoke all on function public.assign_erp_section_work(text, uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.assign_erp_section_work(text, uuid, text, text, text, text, text, text, text)
  to service_role;

comment on function public.assign_erp_section_work(text, uuid, text, text, text, text, text, text, text) is
  'Atomically assigns or unassigns database production items by Section or item ID, verifies every write, and creates audit/notification records.';

commit;

notify pgrst, 'reload schema';
