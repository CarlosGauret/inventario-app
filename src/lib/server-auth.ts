import { NextResponse } from "next/server";
import { createServerClient } from "./supabase";

export type Actor = {
  id: string;
  email: string | null;
};

function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireActor(request: Request): Promise<
  | { ok: true; actor: Actor }
  | { ok: false; response: NextResponse<{ error: string }> }
> {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 }),
    };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sesion invalida" }, { status: 401 }),
    };
  }

  return {
    ok: true,
    actor: {
      id: data.user.id,
      email: data.user.email ?? null,
    },
  };
}

