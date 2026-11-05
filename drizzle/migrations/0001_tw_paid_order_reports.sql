-- Paid report delivery for Truth Weaver catalog orders.
-- Server-written only. A row here never proves payment by itself: every download
-- re-verifies the Shopify order with a fresh Admin read before releasing bytes.

CREATE TABLE public.tw_saved_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  metadata jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tw_saved_analyses_metadata_object CHECK (jsonb_typeof(metadata) = 'object'),
  CONSTRAINT tw_saved_analyses_result_object CHECK (jsonb_typeof(result) = 'object'),
  CONSTRAINT tw_saved_analyses_bounded CHECK (pg_column_size(result) < 262144 AND pg_column_size(metadata) < 8192)
);
CREATE INDEX tw_saved_analyses_owner_idx ON public.tw_saved_analyses (user_id, created_at DESC);
GRANT SELECT, DELETE ON public.tw_saved_analyses TO authenticated;
GRANT ALL ON public.tw_saved_analyses TO service_role;
ALTER TABLE public.tw_saved_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tw_saved_analyses_read_own ON public.tw_saved_analyses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY tw_saved_analyses_delete_own ON public.tw_saved_analyses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- No client INSERT/UPDATE: only genuine server analyzer output is saved, never raw notice text.

CREATE TABLE public.tw_purchase_claims (
  nonce text PRIMARY KEY CHECK (nonce ~ '^[A-Za-z0-9_-]{43}$'),
  user_id uuid NOT NULL,
  analysis_id uuid NOT NULL REFERENCES public.tw_saved_analyses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_order_gid text UNIQUE
    CHECK (consumed_order_gid IS NULL OR consumed_order_gid ~ '^gid://shopify/Order/[1-9][0-9]*$'),
  CONSTRAINT tw_purchase_claims_expiry CHECK (expires_at > created_at)
);
CREATE INDEX tw_purchase_claims_owner_idx ON public.tw_purchase_claims (user_id, created_at DESC);
GRANT ALL ON public.tw_purchase_claims TO service_role;
ALTER TABLE public.tw_purchase_claims ENABLE ROW LEVEL SECURITY;
-- No client policies: claims are issued and consumed only by server code.

CREATE TABLE public.tw_order_reports (
  order_gid text PRIMARY KEY CHECK (order_gid ~ '^gid://shopify/Order/[1-9][0-9]*$'),
  user_id uuid NOT NULL,
  claim_nonce text NOT NULL UNIQUE CHECK (claim_nonce ~ '^[A-Za-z0-9_-]{43}$'),
  analysis_id uuid REFERENCES public.tw_saved_analyses(id) ON DELETE SET NULL,
  order_name text NOT NULL CHECK (char_length(order_name) BETWEEN 1 AND 40),
  offers text[] NOT NULL CHECK (
    cardinality(offers) BETWEEN 1 AND 10 AND
    offers <@ ARRAY['snapshot', 'guide', 'templates', 'course', 'bundle']::text[]
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  private_storage_key text UNIQUE
    CHECK (private_storage_key IS NULL OR char_length(private_storage_key) BETWEEN 12 AND 512),
  byte_size integer CHECK (byte_size IS NULL OR byte_size BETWEEN 1 AND 524288),
  failure_reason text CHECK (failure_reason IS NULL OR char_length(failure_reason) <= 80),
  order_created_at timestamptz NOT NULL,
  shopify_verified_at timestamptz NOT NULL,
  ready_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tw_order_reports_ready_has_file CHECK (
    status <> 'ready' OR (private_storage_key IS NOT NULL AND byte_size IS NOT NULL AND ready_at IS NOT NULL)
  )
);
CREATE INDEX tw_order_reports_owner_idx ON public.tw_order_reports (user_id, created_at DESC);
GRANT ALL ON public.tw_order_reports TO service_role;
ALTER TABLE public.tw_order_reports ENABLE ROW LEVEL SECURITY;
-- No client policies: private object keys never reach the browser.
CREATE TRIGGER tw_order_reports_updated_at BEFORE UPDATE ON public.tw_order_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();