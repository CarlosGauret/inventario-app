import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireActor } from "@/lib/server-auth";
import { requireDeleteAuthorization } from "@/lib/delete-guard";
import { writeAuditLog } from "@/lib/audit";

type Snapshot = {
  products?: Record<string, unknown>[];
  product_images?: Record<string, unknown>[];
  movements?: Record<string, unknown>[];
  audit_logs?: Record<string, unknown>[];
};

export async function POST(
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

    const { data: point, error: pointError } = await supabase
      .from("restore_points")
      .select("id, label, snapshot, created_at")
      .eq("id", id)
      .single();

    if (pointError || !point) {
      return NextResponse.json({ error: "Punto de restauracion no encontrado" }, { status: 404 });
    }

    const snapshot = (point.snapshot ?? {}) as Snapshot;
    const products = Array.isArray(snapshot.products) ? snapshot.products : [];
    const productImages = Array.isArray(snapshot.product_images) ? snapshot.product_images : [];
    const movements = Array.isArray(snapshot.movements) ? snapshot.movements : [];
    const auditLogs = Array.isArray(snapshot.audit_logs) ? snapshot.audit_logs : [];
    const isEmptyPoint = products.length === 0 && movements.length === 0;

    if (isEmptyPoint) {
      return NextResponse.json(
        {
          error:
            "Este punto de restauracion esta vacio (sin productos ni movimientos). Elige otro punto.",
        },
        { status: 400 },
      );
    }

    // Reset data and restore from selected point.
    const wipeMovements = await supabase.from("movements").delete().not("id", "is", null);
    if (wipeMovements.error) return NextResponse.json({ error: wipeMovements.error.message }, { status: 500 });

    const wipeImages = await supabase.from("product_images").delete().not("id", "is", null);
    if (wipeImages.error) return NextResponse.json({ error: wipeImages.error.message }, { status: 500 });

    const wipeProducts = await supabase.from("products").delete().not("id", "is", null);
    if (wipeProducts.error) return NextResponse.json({ error: wipeProducts.error.message }, { status: 500 });

    const wipeAudit = await supabase.from("audit_logs").delete().not("id", "is", null);
    if (wipeAudit.error) return NextResponse.json({ error: wipeAudit.error.message }, { status: 500 });

    if (products.length) {
      const insertProducts = await supabase.from("products").insert(products);
      if (insertProducts.error) return NextResponse.json({ error: insertProducts.error.message }, { status: 500 });
    }
    if (productImages.length) {
      const insertImages = await supabase.from("product_images").insert(productImages);
      if (insertImages.error) return NextResponse.json({ error: insertImages.error.message }, { status: 500 });
    }
    if (movements.length) {
      const insertMovements = await supabase.from("movements").insert(movements);
      if (insertMovements.error) return NextResponse.json({ error: insertMovements.error.message }, { status: 500 });
    }
    if (auditLogs.length) {
      const insertAudit = await supabase.from("audit_logs").insert(auditLogs);
      if (insertAudit.error) return NextResponse.json({ error: insertAudit.error.message }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      actor: auth.actor,
      action: "RESTORE_POINT_APPLY",
      entityType: "restore_point",
      entityId: point.id,
      detail: {
        label: point.label,
        created_at: point.created_at,
      },
    });

    return NextResponse.json({
      ok: true,
      restored: {
        products: products.length,
        product_images: productImages.length,
        movements: movements.length,
        audit_logs: auditLogs.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al restaurar punto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
