import { supabase } from "@/integrations/supabase/client";

/** Calls a protected server function with the signed-in user's bearer token. */
export async function authed<T>(fn: (opts: any) => Promise<T>, data?: unknown): Promise<T> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  return fn({ data, headers: { Authorization: `Bearer ${token}` } });
}
