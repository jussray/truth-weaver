revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant all on public.user_roles, public.merchant_audit_log to service_role;