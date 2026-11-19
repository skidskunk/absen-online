import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase Admin Client using SUPABASE_SERVICE_ROLE_KEY.
 * NEVER import or invoke this function on the client-side.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY ERROR: createAdminClient cannot be executed on the client side!"
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL belum dikonfigurasi.");
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SECURITY ERROR: SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di environment server."
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
