import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireActor } from "@/lib/server-auth";
import { requireDeleteAuthorization } from "@/lib/delete-guard";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireActor(request);
    if (!auth.ok) return auth.response;

    const guard = await requireDeleteAuthorization(request, auth.actor);
    if (!guard.ok) return guard.response;

    const { id } = await params;
    const supabase = createServerClient();

    const { error } = await supabase.from("audit_logs").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al eliminar auditoria";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

