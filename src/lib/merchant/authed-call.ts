import { supabase } from "@/integrations/supabase/client";

/** Calls a protected server function with the signed-in user's bearer token. */
export async function authed<TOptions, TResult>(
  fn: (opts: TOptions) => Promise<TResult>,
  data?: TOptions extends { data: infer D } ? D : never,
): Promise<TResult> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  // Derive the function's input and result types without bypassing caller-side validation.
  return fn({ data, headers: { Authorization: `Bearer ${token}` } } as TOptions);
}
