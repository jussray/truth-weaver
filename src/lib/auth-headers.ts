import { supabase } from "@/integrations/supabase/client";

/** Bearer header for protected server functions, or null when nobody is signed in. */
export async function bearerHeaders(): Promise<Record<string, string> | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : null;
}
