export function getPublicSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) {
    throw new Error("Falta la variable de entorno: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!anonKey) {
    throw new Error("Falta la variable de entorno: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return {
    url,
    anonKey,
  };
}

export function getServerSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("Falta la variable de entorno: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!serviceRole) {
    throw new Error("Falta la variable de entorno: SUPABASE_SERVICE_ROLE_KEY");
  }

  return {
    url,
    serviceRole,
  };
}
