import { NextResponse } from "next/server";
import type { Actor } from "./server-auth";

type DeletePayload = {
  confirmation?: string;
  secret?: string;
};

export async function requireDeleteAuthorization(
  request: Request,
  actor: Actor,
): Promise<
  | { ok: true }
  | { ok: false; response: NextResponse<{ error: string }> }
> {
  const adminEmail = process.env.DELETE_ADMIN_EMAIL;
  const deleteSecret = process.env.DELETE_SECRET_KEY;

  if (!adminEmail || !deleteSecret) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Falta configurar DELETE_ADMIN_EMAIL y DELETE_SECRET_KEY" },
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

  let payload: DeletePayload = {};
  try {
    payload = (await request.json()) as DeletePayload;
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solicitud invalida para eliminar" },
        { status: 400 },
      ),
    };
  }

  if (payload.confirmation !== "ELIMINAR") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Debes escribir ELIMINAR para confirmar" },
        { status: 400 },
      ),
    };
  }

  if (payload.secret !== deleteSecret) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Clave secreta invalida" }, { status: 403 }),
    };
  }

  return { ok: true };
}

