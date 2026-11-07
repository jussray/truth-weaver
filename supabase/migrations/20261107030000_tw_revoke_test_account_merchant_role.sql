-- Security: drizzle/migrations/0000_merchant_vendor_invites.sql granted the merchant role
-- unconditionally to the account test-user-tw@jussco.company. Merchant access must come only
-- from a redeemed invite (redeem_merchant_invite). Idempotent: removes only that grant.
DELETE FROM public.user_roles ur
USING auth.users u
WHERE ur.user_id = u.id
  AND lower(u.email) = 'test-user-tw@jussco.company'
  AND ur.role = 'merchant'::public.app_role;
