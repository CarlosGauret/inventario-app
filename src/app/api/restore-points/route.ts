import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireActor } from "@/lib/server-auth";
import { requireDeleteAuthorization } from "@/lib/delete-guard";
import { writeAuditLog } from "@/lib/audit";

function oneWeekAgoIso() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET(request: Request) {
  try {
    const auth = await requireActor(request);
    if (!auth.ok) return auth.response;
    const guard = await requireDeleteAuthorization(request, auth.actor);
    if (!guard.ok) return guard.response;

    const supabase = createServerClient();
    const cutoff = oneWeekAgoIso();

    // Keep storage small: delete points older than 7 days.
    const pruneByDate = await supabase
      .from("restore_points")
      .delete()
      .lt("created_at", cutoff);
    if (pruneByDate.error) {
      return NextResponse.json({ error: pruneByDate.error.message }, { status: 500 });
    }

    // Keep only the 2 most recent manually-created points.
    const allIdsRes = await supabase
      .from("restore_points")
      .select("id")
      .order("created_at", { ascending: false });
    if (allIdsRes.error) {
      return NextResponse.json({ error: allIdsRes.error.message }, { status: 500 });
    }
    const extraIds = (allIdsRes.data ?? []).slice(2).map((row) => row.id);
    if (extraIds.length) {
      const pruneByCount = await supabase.from("restore_points").delete().in("id", extraIds);
      if (pruneByCount.error) {
        return NextResponse.json({ error: pruneByCount.error.message }, { status: 500 });
      }
    }

    const { data, error } = await supabase
      .from("restore_points")
      .select("id, label, created_at, created_by_email, snapshot")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []).map((row) => {
      const snapshot = (row.snapshot ?? {}) as {
        products?: unknown[];
        product_images?: unknown[];
        movements?: unknown[];
        audit_logs?: unknown[];
      };
      return {
        id: row.id,
        label: row.label,
        created_at: row.created_at,
        created_by_email: row.created_by_email,
        counts: {
          products: Array.isArray(snapshot.products) ? snapshot.products.length : 0,
          product_images: Array.isArray(snapshot.product_images)
            ? snapshot.product_images.length
            : 0,
          movements: Array.isArray(snapshot.movements) ? snapshot.movements.length : 0,
          audit_logs: Array.isArray(snapshot.audit_logs) ? snapshot.audit_logs.length : 0,
        },
      };
    });

    return NextResponse.json({ data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al listar puntos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireActor(request);
    if (!auth.ok) return auth.response;
    const guard = await requireDeleteAuthorization(request, auth.actor);
    if (!guard.ok) return guard.response;

    const supabase = createServerClient();
    const now = new Date();
    const stamp = now.toLocaleString("es-PE");
    const label = `Punto ${stamp}`;

    const [productsRes, imagesRes, movementsRes, auditRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, code, name, category, location, stock, min_stock, active, created_at"),
      supabase
        .from("product_images")
        .select("id, product_id, path, created_at"),
      supabase
        .from("movements")
        .select("id, product_id, type, quantity, reason, requested_by, notes, created_by, created_at"),
      supabase
        .from("audit_logs")
        .select("id, actor_user_id, actor_email, action, entity_type, entity_id, detail, created_at"),
    ]);

    if (productsRes.error) return NextResponse.json({ error: productsRes.error.message }, { status: 500 });
    if (imagesRes.error) return NextResponse.json({ error: imagesRes.error.message }, { status: 500 });
    if (movementsRes.error) return NextResponse.json({ error: movementsRes.error.message }, { status: 500 });
    if (auditRes.error) return NextResponse.json({ error: auditRes.error.message }, { status: 500 });

    const snapshot = {
      products: productsRes.data ?? [],
      product_images: imagesRes.data ?? [],
      movements: movementsRes.data ?? [],
      audit_logs: auditRes.data ?? [],
    };

    const { data: point, error: insertError } = await supabase
      .from("restore_points")
      .insert({
        label,
        created_by_email: auth.actor.email,
        snapshot,
      })
      .select("id, label, created_at, created_by_email")
      .single();

    if (insertError || !point) {
      return NextResponse.json(
        { error: insertError?.message ?? "No se pudo crear el punto" },
        { status: 500 },
      );
    }

    const cutoff = oneWeekAgoIso();
    const { error: pruneError } = await supabase
      .from("restore_points")
      .delete()
      .lt("created_at", cutoff);
    if (pruneError) {
      return NextResponse.json({ error: pruneError.message }, { status: 500 });
    }

    // Keep only latest 2 points.
    const allIdsRes = await supabase
      .from("restore_points")
      .select("id")
      .order("created_at", { ascending: false });
    if (allIdsRes.error) {
      return NextResponse.json({ error: allIdsRes.error.message }, { status: 500 });
    }
    const extraIds = (allIdsRes.data ?? []).slice(2).map((row) => row.id);
    if (extraIds.length) {
      const pruneByCount = await supabase.from("restore_points").delete().in("id", extraIds);
      if (pruneByCount.error) {
        return NextResponse.json({ error: pruneByCount.error.message }, { status: 500 });
      }
    }

    await writeAuditLog(supabase, {
      actor: auth.actor,
      action: "RESTORE_POINT_CREATE",
      entityType: "restore_point",
      entityId: point.id,
      detail: {
        label: point.label,
        created_by_email: point.created_by_email,
      },
    });

    return NextResponse.json({ ok: true, data: point });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al crear punto de restauracion";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
