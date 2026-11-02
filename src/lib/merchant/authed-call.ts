import { supabase } from "@/integrations/supabase/client";

/** Calls a protected server function with the signed-in user's bearer token. */
export async function authed<Options, Result>(
  fn: (opts: Options) => Promise<Result>,
  data?: Options extends { data?: infer Payload } ? Payload : unknown,
): Promise<Result> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error("Please sign in again.");
  // Server functions enforce their own input validators; this helper only attaches the bearer transport.
  return fn({ data, headers: { Authorization: `Bearer ${token}` } } as unknown as Options);
}
