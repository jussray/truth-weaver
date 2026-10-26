/** Keep in sync with public.merchant_audit_log.outcome in the Supabase migration. */
export const MERCHANT_AUDIT_OUTCOMES = [
  "attempted",
  "succeeded",
  "failed",
  "denied",
] as const;

export type MerchantAuditOutcome = (typeof MERCHANT_AUDIT_OUTCOMES)[number];
