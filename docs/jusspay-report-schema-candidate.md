# JussPay paid report schema candidate — HOLD

The existing checked-in migration `drizzle/migrations/0001_tw_paid_order_reports.sql` constrains both order GIDs to Shopify and requires `shopify_verified_at`. The production schema inspection returned a permission error; this is a proposed migration only, **not an applied migration**. Do not enable `TW_JUSSPAY_REPORTS_ENABLED` or deploy this feature until the exact production schema, RLS, privileges, migration history and private `tw-snapshot-reports` bucket are independently verified.

Candidate SQL, to review against actual constraint names before applying through the repository's authorized migration process:

```sql
BEGIN;
ALTER TABLE public.tw_purchase_claims
  DROP CONSTRAINT tw_purchase_claims_consumed_order_gid_check,
  ADD CONSTRAINT tw_purchase_claims_consumed_order_gid_check
  CHECK (consumed_order_gid IS NULL OR consumed_order_gid ~ '^(gid://shopify/Order/[1-9][0-9]*|gid://stripe/CheckoutSession/cs_live_[A-Za-z0-9_]{1,180})$');
ALTER TABLE public.tw_order_reports
  ADD COLUMN jusspay_verified_at timestamptz,
  ALTER COLUMN shopify_verified_at DROP NOT NULL,
  DROP CONSTRAINT tw_order_reports_order_gid_check,
  ADD CONSTRAINT tw_order_reports_order_gid_check
  CHECK (order_gid ~ '^(gid://shopify/Order/[1-9][0-9]*|gid://stripe/CheckoutSession/cs_live_[A-Za-z0-9_]{1,180})$'),
  ADD CONSTRAINT tw_order_reports_payment_source_check CHECK (
    (order_gid LIKE 'gid://shopify/Order/%' AND shopify_verified_at IS NOT NULL AND jusspay_verified_at IS NULL)
    OR (order_gid LIKE 'gid://stripe/CheckoutSession/%' AND shopify_verified_at IS NULL AND jusspay_verified_at IS NOT NULL)
  );
COMMIT;
```

Preserve existing service-role-only writes, RLS and ready-has-file constraints. Do not mark a historical Stripe record as paid or ready as part of the migration. Validate on a disposable database against the actual baseline; check both provider identifier types, uniqueness, cross-owner claims, ready-has-file, invalid/test identifiers, and privileges. Verify new source fields using generated database types before release. Verify that Shopify inserts still work without the new field.

Runtime gate: exact JussPay production release, dedicated restricted read credential, distinct server-to-server credential configured on both services, signed webhook, buyer/analysis claim, verified private PDF upload, and a fresh payment check on download. No direct Stripe fallback for the new proof path. Existing checkout creation is not migrated by this candidate; no live purchase is authorized by it. Before activation, implement and test the central checkout path and measure webhook completion time or introduce a durable accepted-job queue.
