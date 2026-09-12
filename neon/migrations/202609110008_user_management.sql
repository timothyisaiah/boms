create table public.user_access_audits (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.users(id),
  user_id uuid not null references public.users(id),
  action text not null check (action in ('create', 'update')),
  previous_access jsonb,
  new_access jsonb not null,
  password_changed boolean not null,
  created_at timestamptz not null default now()
);
create index user_access_audits_actor_idx on public.user_access_audits(actor_id, created_at);
create index user_access_audits_user_idx on public.user_access_audits(user_id, created_at);

create function public.manage_user(
  p_user_id uuid, p_email text, p_full_name text, p_role public.app_role,
  p_is_active boolean, p_password_hash text
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := nullif(current_setting('boms.actor_id', true), '')::uuid;
  previous_user public.users%rowtype;
  target_id uuid;
begin
  -- Serialize access changes, then recheck the actor: a queued request cannot
  -- keep administrative privileges after an earlier request revokes them.
  perform pg_advisory_xact_lock(721094, 1);
  if not exists(select 1 from public.users where id=actor and is_active and app_role='admin_owner') then
    raise exception 'An active administrator is required.';
  end if;
  if nullif(btrim(p_full_name),'') is null or p_role is null or p_is_active is null then
    raise exception 'A full name, role and account status are required.';
  end if;
  if p_password_hash is not null and p_password_hash !~ '^\$2[aby]\$12\$[./A-Za-z0-9]{53}$' then
    raise exception 'A valid password hash is required.';
  end if;
  if p_user_id is null then
    if nullif(btrim(p_email),'') is null or p_password_hash is null then
      raise exception 'Email and password are required for a new user.';
    end if;
    insert into public.users(email, full_name, app_role, is_active, password_hash)
    values(lower(btrim(p_email)),btrim(p_full_name),p_role,p_is_active,p_password_hash)
    returning id into target_id;
  else
    select * into previous_user from public.users where id=p_user_id for update;
    if not found then raise exception 'This user no longer exists. Refresh the user list.'; end if;
    if previous_user.is_active and previous_user.app_role='admin_owner'
      and (not p_is_active or p_role <> 'admin_owner') then
      if (select count(*) from public.users where is_active and app_role='admin_owner') <= 1 then
        raise exception 'Keep at least one active administrator.';
      end if;
    end if;
    if actor=p_user_id and (not p_is_active or p_role <> 'admin_owner') then
      raise exception 'Ask another administrator to change your own access.';
    end if;
    update public.users set full_name=btrim(p_full_name),app_role=p_role,is_active=p_is_active,
      password_hash=coalesce(p_password_hash,password_hash),updated_at=clock_timestamp()
    where id=p_user_id;
    target_id := p_user_id;
    if not p_is_active or p_password_hash is not null then
      delete from public.sessions where user_id=target_id;
    end if;
  end if;
  insert into public.user_access_audits(actor_id,user_id,action,previous_access,new_access,password_changed)
  values(actor,target_id,case when p_user_id is null then 'create' else 'update' end,
    case when p_user_id is null then null else jsonb_build_object('full_name',previous_user.full_name,'role',previous_user.app_role,'is_active',previous_user.is_active) end,
    jsonb_build_object('full_name',btrim(p_full_name),'role',p_role,'is_active',p_is_active),p_password_hash is not null);
  return target_id;
end; $$;
revoke execute on function public.manage_user(uuid,text,text,public.app_role,boolean,text) from public;
