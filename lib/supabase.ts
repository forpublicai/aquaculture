import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — server-side only, bypasses RLS. Never
 * import this into a Client Component or expose it to the browser.
 */
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
