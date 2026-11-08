-- Source-only hardening for merchant audit provenance.
-- Apply ONLY after independent migration review and production authorization.
-- An authenticated merchant browser must not be able to forge a succeeded
-- provider write receipt by inserting directly into merchant_audit_log.
BEGIN;

DROP POLICY IF EXISTS "merchants append own audit" ON public.merchant_audit_log;
REVOKE INSERT, UPDATE, DELETE ON public.merchant_audit_log FROM PUBLIC, anon, authenticated;

-- Merchants may read authorized operational audit history, but only a
-- separately authorized trusted server may append immutable audit events.
GRANT SELECT ON public.merchant_audit_log TO authenticated;
GRANT ALL ON public.merchant_audit_log TO service_role;

-- A role lookup must not become a public enumeration tool. The existing
-- policies call this with auth.uid() for the requesting merchant.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$function$;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

COMMIT;
