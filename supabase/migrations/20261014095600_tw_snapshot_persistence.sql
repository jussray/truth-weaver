-- Trust boundary for Truth Weaver $10 Snapshot purchases.
-- This migration never marks an order paid, publishes a Shopify product or authorizes a download.
-- Only server-side, verified Shopify identity and paid-order processing may write these records.

CREATE TABLE public.tw_shopify_customer_bindings (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shopify_customer_gid text NOT NULL UNIQUE
    CHECK (shopify_customer_gid ~ '^gid://shopify/Customer/[1-9][0-9]*$'),
  verification_method text NOT NULL CHECK (verification_method = 'verified_customer_account'),
  verified_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tw_shopify_customer_bindings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tw_shopify_customer_bindings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tw_shopify_customer_bindings TO service_role;
-- No client-facing policies: buyer linking may be written only with separately verified authority.

CREATE TABLE public.tw_snapshot_entitlements (
  order_gid text PRIMARY KEY CHECK (order_gid ~ '^gid://shopify/Order/[1-9][0-9]*$'),
  auth_user_id uuid NOT NULL REFERENCES public.tw_shopify_customer_bindings(auth_user_id) ON DELETE CASCADE,
  variant_gid text NOT NULL CHECK (variant_gid = 'gid://shopify/ProductVariant/68176830562525'),
  offer text NOT NULL DEFAULT 'snapshot' CHECK (offer = 'snapshot'),
  shopify_verified_at timestamptz NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tw_snapshot_expiry_after_grant CHECK (expires_at IS NULL OR expires_at > granted_at),
  CONSTRAINT tw_snapshot_order_owner_unique UNIQUE (order_gid, auth_user_id)
);
CREATE INDEX tw_snapshot_entitlements_owner_idx ON public.tw_snapshot_entitlements (auth_user_id);
ALTER TABLE public.tw_snapshot_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tw_snapshot_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tw_snapshot_entitlements TO authenticated;
GRANT ALL ON public.tw_snapshot_entitlements TO service_role;
CREATE POLICY tw_snapshot_read_own_entitlements ON public.tw_snapshot_entitlements
  FOR SELECT TO authenticated USING (auth.uid() = auth_user_id);
-- Authenticated clients cannot insert, modify or delete grants, including their own.

CREATE TABLE public.tw_snapshot_report_locations (
  order_gid text PRIMARY KEY,
  auth_user_id uuid NOT NULL,
  CONSTRAINT tw_snapshot_report_owner_fk FOREIGN KEY (order_gid, auth_user_id)
    REFERENCES public.tw_snapshot_entitlements (order_gid, auth_user_id) ON DELETE CASCADE,
  private_storage_key text NOT NULL UNIQUE CHECK (char_length(private_storage_key) BETWEEN 12 AND 512),
  media_type text NOT NULL CHECK (media_type IN ('application/pdf', 'text/plain;charset=utf-8')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tw_snapshot_report_locations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tw_snapshot_report_locations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tw_snapshot_report_locations TO service_role;
-- No client read of private object keys. Short-lived report access must be server-issued,
-- after a fresh Shopify order verification, identity binding, entitlement and owner check.
