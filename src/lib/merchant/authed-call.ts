import { supabase } from "@/integrations/supabase/client";

/** Calls a protected server function with the signed-in user's bearer token. */
export async function authed<F extends (opts: never) => Promise<unknown>>(
  fn: F,
  data?: unknown,
): Promise<Awaited<ReturnType<F>>> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  return fn({ data, headers: { Authorization: `Bearer ${token}` } } as Parameters<F>[0]) as Promise<Awaited<ReturnType<F>>>;
}
