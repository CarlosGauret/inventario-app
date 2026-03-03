import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnv, getServerSupabaseEnv } from "./env";

export function createPublicClient() {
  const { url, anonKey } = getPublicSupabaseEnv();
  return createClient(url, anonKey);
}

export function createServerClient() {
  const { url, serviceRole } = getServerSupabaseEnv();
  return createClient(url, serviceRole, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

