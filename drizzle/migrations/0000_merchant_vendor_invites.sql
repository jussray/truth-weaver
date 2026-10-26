CREATE TABLE public.merchant_invites (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text,
  created_by uuid not null,
  redeemed_by uuid,
  redeemed_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days',
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.merchant_invites TO authenticated;
GRANT ALL ON public.merchant_invites TO service_role;
ALTER TABLE public.merchant_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "merchants read invites" ON public.merchant_invites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'merchant'));

CREATE OR REPLACE FUNCTION public.create_merchant_invite(_label text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _code text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'merchant') THEN RAISE EXCEPTION 'merchant role required'; END IF;
  _code := encode(extensions.gen_random_bytes(18), 'hex');
  INSERT INTO public.merchant_invites (code_hash, label, created_by)
    VALUES (encode(extensions.digest(_code, 'sha256'), 'hex'), left(_label, 120), auth.uid());
  INSERT INTO public.merchant_audit_log (actor_id, action, target, requested_state, outcome)
    VALUES (auth.uid(), 'invite.create', 'merchant_invite', jsonb_build_object('label', left(_label,120)), 'succeeded');
  RETURN _code;
END $$;

CREATE OR REPLACE FUNCTION public.redeem_merchant_invite(_code text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sign in required'; END IF;
  UPDATE public.merchant_invites SET redeemed_by = auth.uid(), redeemed_at = now()
    WHERE code_hash = encode(extensions.digest(_code, 'sha256'), 'hex')
      AND redeemed_by IS NULL AND expires_at > now()
    RETURNING id INTO _id;
  IF _id IS NULL THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'merchant') ON CONFLICT DO NOTHING;
  INSERT INTO public.merchant_audit_log (actor_id, action, target, outcome)
    VALUES (auth.uid(), 'invite.redeem', _id::text, 'succeeded');
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.create_merchant_invite(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_merchant_invite(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.create_merchant_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_merchant_invite(text) TO authenticated;

-- No bootstrap merchant account: initial authority must be provisioned explicitly
-- and audited outside automatic schema migrations.