import { supabase } from "@/integrations/supabase/client";

/** Options shape every TanStack server function accepts when called with a bearer header. */
export type AuthedCallOptions<TData> = { data: TData; headers: Record<string, string> };

/** Calls a protected server function with the signed-in user's bearer token. */
export async function authed<TResult, TData = undefined>(
  fn: (opts: AuthedCallOptions<TData>) => Promise<TResult>,
  data?: TData,
): Promise<TResult> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  return fn({ data: data as TData, headers: { Authorization: `Bearer ${token}` } });
}
