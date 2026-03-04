import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireActor } from "@/lib/server-auth";

export async function GET(request: Request) {
  try {
    const auth = await requireActor(request);
    if (!auth.ok) return auth.response;

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, actor_email, action, entity_type, entity_id, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al listar auditoria";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

