import { NextResponse } from "next/server";
import type { Actor } from "./server-auth";

export async function requireDeleteAuthorization(
  _request: Request,
  actor: Actor,
): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse<{ error: string }> }
> {
  const adminEmail = process.env.DELETE_ADMIN_EMAIL;

  if (!adminEmail) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Falta configurar DELETE_ADMIN_EMAIL" },
        { status: 500 },
      ),
    };
  }

  if ((actor.email ?? "").toLowerCase() !== adminEmail.toLowerCase()) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No tienes permiso para eliminar" },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}

