CREATE TABLE IF NOT EXISTS public.tw_snapshot_generation_reservations (
  order_gid text PRIMARY KEY REFERENCES public.tw_snapshot_entitlements(order_gid) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tw_snapshot_generation_owner_fk FOREIGN KEY (order_gid, auth_user_id)
    REFERENCES public.tw_snapshot_entitlements(order_gid, auth_user_id) ON DELETE CASCADE
);
ALTER TABLE public.tw_snapshot_generation_reservations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tw_snapshot_generation_reservations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tw_snapshot_generation_reservations TO service_role;
CREATE OR REPLACE FUNCTION public.tw_reserve_snapshot_generation(
  p_auth_user_id uuid, p_order_gid text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '' AS $$
DECLARE claimed integer;
BEGIN
  INSERT INTO public.tw_snapshot_generation_reservations (order_gid, auth_user_id)
  SELECT e.order_gid, e.auth_user_id
  FROM public.tw_snapshot_entitlements AS e
  WHERE e.order_gid = p_order_gid AND e.auth_user_id = p_auth_user_id
    AND e.offer = 'snapshot' AND e.revoked_at IS NULL
    AND (e.expires_at IS NULL OR e.expires_at > now())
  ON CONFLICT (order_gid) DO NOTHING;
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.tw_reserve_snapshot_generation(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tw_reserve_snapshot_generation(uuid, text) TO service_role;