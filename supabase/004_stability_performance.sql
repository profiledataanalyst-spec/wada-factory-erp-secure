-- Profile Solutions Factory ERP v11
-- Atomic operational mutations, idempotent retries and supporting indexes.
-- Run after 001_auth_profiles.sql, 002_temporary_password_workflow.sql
-- and 003_shared_operational_data.sql.

begin;

create table if not exists public.erp_mutation_log (
  request_id text primary key,
  actor_id uuid null references auth.users(id) on delete set null,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint erp_mutation_log_request_id_check
    check (length(request_id) between 8 and 160),
  constraint erp_mutation_log_result_object_check
    check (jsonb_typeof(result) = 'object')
);

create index if not exists erp_mutation_log_created_at_idx
  on public.erp_mutation_log (created_at desc);

-- Targeted expression indexes used by operational dashboards and notification filters.
create index if not exists erp_records_items_stage_idx
  on public.erp_records ((payload ->> 'currentStage'))
  where entity_type = 'items';

create index if not exists erp_records_items_status_idx
  on public.erp_records ((payload ->> 'status'))
  where entity_type = 'items';

create index if not exists erp_records_notifications_user_read_idx
  on public.erp_records ((payload ->> 'userId'), (payload ->> 'read'), updated_at desc)
  where entity_type = 'notifications';

create index if not exists erp_records_shortages_status_idx
  on public.erp_records ((payload ->> 'status'), updated_at desc)
  where entity_type = 'shortages';

alter table public.erp_mutation_log enable row level security;
alter table public.erp_mutation_log force row level security;
revoke all on table public.erp_mutation_log from anon, authenticated;

create or replace function public.apply_erp_changes(
  p_request_id text,
  p_actor uuid,
  p_changes jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing_result jsonb;
  v_result jsonb;
  v_versions jsonb := '{}'::jsonb;
  v_entity_versions jsonb;
  v_entity text;
  v_change jsonb;
  v_entry jsonb;
  v_record_id text;
  v_payload jsonb;
  v_expected_text text;
  v_updated_at timestamptz;
  v_deleted_count integer;
begin
  if p_request_id is null or length(trim(p_request_id)) < 8 or length(p_request_id) > 160 then
    raise exception using errcode = '22023', message = 'ERP_INVALID_REQUEST_ID';
  end if;
  if p_actor is null then
    raise exception using errcode = '22023', message = 'ERP_ACTOR_REQUIRED';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception using errcode = '22023', message = 'ERP_CHANGES_MUST_BE_OBJECT';
  end if;

  -- Serialises duplicate retries of the same browser request.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id, 0));

  select result
    into v_existing_result
    from public.erp_mutation_log
   where request_id = p_request_id;

  if found then
    return v_existing_result || jsonb_build_object('deduplicated', true);
  end if;

  for v_entity, v_change in
    select key, value from jsonb_each(p_changes)
  loop
    if v_entity not in ('projects', 'items', 'shortages', 'issues', 'audit', 'notifications') then
      raise exception using errcode = '22023', message = 'ERP_UNSUPPORTED_ENTITY|' || coalesce(v_entity, '');
    end if;

    if jsonb_typeof(coalesce(v_change -> 'upsert', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(v_change -> 'delete', '[]'::jsonb)) <> 'array' then
      raise exception using errcode = '22023', message = 'ERP_INVALID_CHANGE_SET|' || v_entity;
    end if;

    for v_entry in
      select value from jsonb_array_elements(coalesce(v_change -> 'upsert', '[]'::jsonb))
    loop
      v_record_id := trim(coalesce(v_entry ->> 'recordId', ''));
      v_payload := v_entry -> 'payload';
      v_expected_text := trim(coalesce(v_entry ->> 'expectedVersion', ''));

      if v_record_id = '' or length(v_record_id) > 160 then
        raise exception using errcode = '22023', message = 'ERP_INVALID_RECORD_ID|' || v_entity;
      end if;
      if v_payload is null or jsonb_typeof(v_payload) <> 'object' then
        raise exception using errcode = '22023', message = 'ERP_INVALID_PAYLOAD|' || v_entity || '|' || v_record_id;
      end if;

      if v_expected_text <> '' then
        begin
          update public.erp_records
             set payload = v_payload,
                 updated_by = p_actor
           where entity_type = v_entity
             and record_id = v_record_id
             and updated_at = v_expected_text::timestamptz
          returning updated_at into v_updated_at;
        exception when invalid_datetime_format then
          raise exception using errcode = '22023', message = 'ERP_INVALID_VERSION|' || v_entity || '|' || v_record_id;
        end;

        if not found then
          raise exception using errcode = '40001', message = 'ERP_CONFLICT|' || v_entity || '|' || v_record_id;
        end if;
      else
        insert into public.erp_records (
          entity_type, record_id, payload, created_by, updated_by
        ) values (
          v_entity, v_record_id, v_payload, p_actor, p_actor
        )
        on conflict (entity_type, record_id) do update
          set payload = excluded.payload,
              updated_by = excluded.updated_by
        returning updated_at into v_updated_at;
      end if;

      v_entity_versions := coalesce(v_versions -> v_entity, '{}'::jsonb);
      v_entity_versions := jsonb_set(
        v_entity_versions,
        array[v_record_id],
        to_jsonb(v_updated_at::text),
        true
      );
      v_versions := jsonb_set(v_versions, array[v_entity], v_entity_versions, true);
    end loop;

    for v_entry in
      select value from jsonb_array_elements(coalesce(v_change -> 'delete', '[]'::jsonb))
    loop
      if jsonb_typeof(v_entry) = 'string' then
        v_record_id := trim(v_entry #>> '{}');
        v_expected_text := '';
      else
        v_record_id := trim(coalesce(v_entry ->> 'recordId', v_entry ->> 'id', ''));
        v_expected_text := trim(coalesce(v_entry ->> 'expectedVersion', ''));
      end if;

      if v_record_id = '' or length(v_record_id) > 160 then
        raise exception using errcode = '22023', message = 'ERP_INVALID_RECORD_ID|' || v_entity;
      end if;

      if v_expected_text <> '' then
        begin
          delete from public.erp_records
           where entity_type = v_entity
             and record_id = v_record_id
             and updated_at = v_expected_text::timestamptz;
          get diagnostics v_deleted_count = row_count;
        exception when invalid_datetime_format then
          raise exception using errcode = '22023', message = 'ERP_INVALID_VERSION|' || v_entity || '|' || v_record_id;
        end;

        if v_deleted_count = 0 and exists (
          select 1 from public.erp_records
           where entity_type = v_entity and record_id = v_record_id
        ) then
          raise exception using errcode = '40001', message = 'ERP_CONFLICT|' || v_entity || '|' || v_record_id;
        end if;
      else
        delete from public.erp_records
         where entity_type = v_entity
           and record_id = v_record_id;
      end if;
    end loop;
  end loop;

  v_result := jsonb_build_object(
    'ok', true,
    'requestId', p_request_id,
    'versions', v_versions,
    'deduplicated', false
  );

  insert into public.erp_mutation_log (request_id, actor_id, result)
  values (p_request_id, p_actor, v_result);

  -- Keep the idempotency table bounded without requiring a scheduled extension.
  delete from public.erp_mutation_log
   where created_at < now() - interval '30 days'
     and request_id <> p_request_id;

  return v_result;
end;
$$;

revoke all on function public.apply_erp_changes(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_erp_changes(text, uuid, jsonb) to service_role;

comment on table public.erp_mutation_log is
  'Short idempotency history for server-side ERP mutations. Prevents duplicate writes when a network request is retried.';
comment on function public.apply_erp_changes(text, uuid, jsonb) is
  'Atomically applies validated ERP upserts/deletes with optimistic concurrency and idempotent request IDs.';

commit;

notify pgrst, 'reload schema';
