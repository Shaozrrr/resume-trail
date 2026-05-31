-- Give every account 1 trial by default and grant registered accounts 1 extra bonus try.
create or replace function public.rt_get_or_create_account(
  input_guest_id text default null::text,
  input_display_name text default null::text,
  input_email text default null::text,
  input_source_channel text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_uid uuid := auth.uid();
  v_email text := nullif(coalesce(input_email, auth.jwt() ->> 'email', ''), '');
  v_guest_id text := nullif(trim(coalesce(input_guest_id, '')), '');
  v_display_name text := nullif(trim(coalesce(input_display_name, '')), '');
  v_source text := nullif(trim(coalesce(input_source_channel, '')), '');
  v_account public.rt_accounts;
  v_guest_account public.rt_accounts;
  v_merged_expiry timestamptz;
  v_merged_notes text;
begin
  if v_uid is null and v_guest_id is null then
    raise exception 'guest id required for anonymous account';
  end if;

  if v_uid is not null then
    select *
      into v_account
      from public.rt_accounts
     where auth_user_id = v_uid
     limit 1;
  end if;

  if v_guest_id is not null then
    select *
      into v_guest_account
      from public.rt_accounts
     where guest_id = v_guest_id
     limit 1;

    if v_account.id is null and v_guest_account.id is not null then
      v_account := v_guest_account;
    end if;
  end if;

  if v_account.id is not null
     and v_guest_account.id is not null
     and v_guest_account.id <> v_account.id then
    update public.rt_activity_events
       set account_id = v_account.id,
           auth_user_id = coalesce(auth_user_id, v_uid),
           guest_id = coalesce(guest_id, v_guest_id),
           actor_key = 'account:' || v_account.id::text
     where account_id = v_guest_account.id;

    insert into public.rt_prepare_access_claims (account_id, session_key, grant_type)
    select v_account.id, claims.session_key, claims.grant_type
      from public.rt_prepare_access_claims claims
     where claims.account_id = v_guest_account.id
    on conflict (account_id, session_key) do update
      set grant_type = excluded.grant_type;

    delete from public.rt_prepare_access_claims
     where account_id = v_guest_account.id;

    update public.rt_billing_orders
       set account_id = v_account.id,
           auth_user_id = coalesce(auth_user_id, v_uid)
     where account_id = v_guest_account.id;

    v_merged_expiry := case
      when v_account.membership_expires_at is null then v_guest_account.membership_expires_at
      when v_guest_account.membership_expires_at is null then v_account.membership_expires_at
      else greatest(v_account.membership_expires_at, v_guest_account.membership_expires_at)
    end;

    v_merged_notes := concat_ws(E'\n', nullif(v_account.notes, ''), nullif(v_guest_account.notes, ''));

    update public.rt_accounts
       set guest_id = v_guest_id,
           auth_user_id = coalesce(public.rt_accounts.auth_user_id, v_uid),
           email = coalesce(v_email, public.rt_accounts.email, v_guest_account.email),
           display_name = coalesce(v_display_name, public.rt_accounts.display_name, v_guest_account.display_name),
           auth_mode = 'registered',
           membership_tier = case
             when coalesce(public.rt_accounts.is_lifetime, false)
               or coalesce(v_guest_account.is_lifetime, false)
               or public.rt_accounts.membership_tier = 'lifetime'
               or v_guest_account.membership_tier = 'lifetime'
               then 'lifetime'
             when public.rt_accounts.membership_tier = 'monthly'
               or v_guest_account.membership_tier = 'monthly'
               then 'monthly'
             else coalesce(public.rt_accounts.membership_tier, v_guest_account.membership_tier, 'trial')
           end,
           is_admin = false,
           is_lifetime = coalesce(public.rt_accounts.is_lifetime, false)
             or coalesce(v_guest_account.is_lifetime, false),
           trial_prepare_limit = greatest(
             coalesce(public.rt_accounts.trial_prepare_limit, 1),
             coalesce(v_guest_account.trial_prepare_limit, 1),
             1
           ),
           bonus_prepare_credits = greatest(
             coalesce(public.rt_accounts.bonus_prepare_credits, 0)
               + coalesce(v_guest_account.bonus_prepare_credits, 0),
             1
           ),
           used_prepare_credits = coalesce(public.rt_accounts.used_prepare_credits, 0)
             + coalesce(v_guest_account.used_prepare_credits, 0),
           membership_expires_at = case
             when coalesce(public.rt_accounts.is_lifetime, false)
               or coalesce(v_guest_account.is_lifetime, false)
               or public.rt_accounts.membership_tier = 'lifetime'
               or v_guest_account.membership_tier = 'lifetime'
               then null
             else v_merged_expiry
           end,
           status = case
             when public.rt_accounts.status = 'active' or v_guest_account.status = 'active' then 'active'
             else coalesce(public.rt_accounts.status, v_guest_account.status, 'active')
           end,
           source_channel = coalesce(v_source, public.rt_accounts.source_channel, v_guest_account.source_channel),
           notes = nullif(v_merged_notes, ''),
           last_seen_at = greatest(
             coalesce(public.rt_accounts.last_seen_at, now()),
             coalesce(v_guest_account.last_seen_at, now())
           ),
           updated_at = now()
     where public.rt_accounts.id = v_account.id
    returning * into v_account;

    delete from public.rt_accounts
     where id = v_guest_account.id;
  end if;

  if v_account.id is null then
    insert into public.rt_accounts (
      guest_id,
      auth_user_id,
      email,
      display_name,
      auth_mode,
      membership_tier,
      is_admin,
      source_channel,
      trial_prepare_limit,
      bonus_prepare_credits,
      last_seen_at
    ) values (
      v_guest_id,
      v_uid,
      v_email,
      coalesce(v_display_name, split_part(coalesce(v_email, ''), '@', 1), '履迹用户'),
      case when v_uid is null then 'guest' else 'registered' end,
      'trial',
      false,
      v_source,
      1,
      case when v_uid is null then 0 else 1 end,
      now()
    )
    returning * into v_account;
  else
    update public.rt_accounts
       set guest_id = case
             when public.rt_accounts.guest_id is null then v_guest_id
             else public.rt_accounts.guest_id
           end,
           auth_user_id = coalesce(public.rt_accounts.auth_user_id, v_uid),
           email = coalesce(v_email, public.rt_accounts.email),
           display_name = coalesce(v_display_name, public.rt_accounts.display_name),
           auth_mode = case
             when coalesce(public.rt_accounts.auth_user_id, v_uid) is null then 'guest'
             else 'registered'
           end,
           source_channel = coalesce(v_source, public.rt_accounts.source_channel),
           is_admin = false,
           trial_prepare_limit = greatest(coalesce(public.rt_accounts.trial_prepare_limit, 1), 1),
           bonus_prepare_credits = case
             when coalesce(public.rt_accounts.auth_user_id, v_uid) is null
               then coalesce(public.rt_accounts.bonus_prepare_credits, 0)
             else greatest(coalesce(public.rt_accounts.bonus_prepare_credits, 0), 1)
           end,
           last_seen_at = now()
     where id = v_account.id
    returning * into v_account;
  end if;

  return public.rt_account_json(v_account);
end;
$function$;

update public.rt_accounts
   set trial_prepare_limit = greatest(coalesce(trial_prepare_limit, 0), 1),
       bonus_prepare_credits = greatest(
         coalesce(bonus_prepare_credits, 0),
         case when coalesce(auth_mode, 'guest') = 'registered' then 1 else 0 end
       ),
       updated_at = now()
 where coalesce(trial_prepare_limit, 0) < 1
    or coalesce(bonus_prepare_credits, 0) < case when coalesce(auth_mode, 'guest') = 'registered' then 1 else 0 end;
