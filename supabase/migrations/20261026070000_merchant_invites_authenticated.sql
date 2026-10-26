-- Provision merchant invite RPCs using the Supabase migration chain.
-- No user or email is automatically granted the merchant role.
-- Execute against the *declared* Truth Weaver project only after verifying
-- the project binding and reviewing the existing schema.

create table if not exists public.merchant_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text,
  created_by uuid not null,
  redeemed_by uuid,
  redeemed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);

alter table public.merchant_invites enable row level security;
revoke all on public.merchant_invites from public, anon, authenticated;
grant select on public.merchant_invites to authenticated;
grant all on public.merchant_invites to service_role;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'merchant_invites'
      and policyname = 'merchants read invites'
  ) then
    create policy "merchants read invites" on public.merchant_invites
      for select to authenticated
      using (public.has_role((select auth.uid()), 'merchant'::public.app_role));
  end if;
end
$policy$;

-- Privileged functions can write an invite/role only for the bound caller.
-- Empty search_path prevents callers from controlling function resolution.
create or replace function public.create_merchant_invite(_label text)
returns text language plpgsql security definer set search_path = '' as $fn$
declare
  _code text;
begin
  if auth.uid() is null
    or not public.has_role(auth.uid(), 'merchant'::public.app_role) then
    raise exception 'merchant role required';
  end if;
  if _label is null or length(btrim(_label)) < 2 or length(_label) > 120 then
    raise exception 'invalid invite label';
  end if;

  _code := encode(extensions.gen_random_bytes(18), 'hex');
  insert into public.merchant_invites (code_hash, label, created_by)
    values (encode(extensions.digest(_code, 'sha256'), 'hex'), _label, auth.uid());
  insert into public.merchant_audit_log (actor_id, action, target, requested_state, outcome)
    values (auth.uid(), 'invite.create', 'merchant_invite', jsonb_build_object('label', _label), 'succeeded');
  return _code;
end
$fn$;

create or replace function public.redeem_merchant_invite(_code text)
returns boolean language plpgsql security definer set search_path = '' as $fn$
declare
  _id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in required';
  end if;
  if _code is null or _code !~ '^[0-9a-f]{36}$' then
    return false;
  end if;
  update public.merchant_invites
    set redeemed_by = auth.uid(), redeemed_at = now()
    where code_hash = encode(extensions.digest(_code, 'sha256'), 'hex')
      and redeemed_by is null and expires_at > now()
    returning id into _id;
  if _id is null then
    return false;
  end if;
  insert into public.user_roles (user_id, role)
    values (auth.uid(), 'merchant'::public.app_role)
    on conflict (user_id, role) do nothing;
  insert into public.merchant_audit_log (actor_id, action, target, outcome)
    values (auth.uid(), 'invite.redeem', _id::text, 'succeeded');
  return true;
end
$fn$;

revoke execute on function public.create_merchant_invite(text) from public, anon;
revoke execute on function public.redeem_merchant_invite(text) from public, anon;
grant execute on function public.create_merchant_invite(text) to authenticated;
grant execute on function public.redeem_merchant_invite(text) to authenticated;
