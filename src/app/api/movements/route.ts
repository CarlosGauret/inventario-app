import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

type MovementInput = {
  product_id: string;
  type: "ENTRY" | "EXIT";
  quantity: number;
  reason: string;
  requested_by?: string;
  notes?: string;
};

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("movements")
      .select(
        "id, product_id, type, quantity, reason, requested_by, notes, created_at, products(code, name)",
      )
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al listar movimientos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MovementInput;

    if (!body.product_id || !body.type || !body.reason || !(body.quantity > 0)) {
      return NextResponse.json(
        { error: "product_id, type, quantity y reason son obligatorios" },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const { error } = await supabase.rpc("register_movement", {
      p_product_id: body.product_id,
      p_type: body.type,
      p_quantity: body.quantity,
      p_reason: body.reason.trim(),
      p_requested_by: body.requested_by?.trim() || null,
      p_notes: body.notes?.trim() || null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al registrar movimiento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

