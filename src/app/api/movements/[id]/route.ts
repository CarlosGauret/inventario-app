import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireActor } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";
import { requireDeleteAuthorization } from "@/lib/delete-guard";

type MovementUpdateInput = {
  type?: "ENTRY" | "EXIT";
  quantity?: number;
  reason?: string;
  requested_by?: string;
  notes?: string;
};

function signedQuantity(type: "ENTRY" | "EXIT", quantity: number) {
  return type === "ENTRY" ? quantity : -quantity;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireActor(request);
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const body = (await request.json()) as MovementUpdateInput;
    const supabase = createServerClient();

    const { data: movement, error: movementError } = await supabase
      .from("movements")
      .select("id, product_id, type, quantity")
      .eq("id", id)
      .single();

    if (movementError || !movement) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    const newType = body.type ?? movement.type;
    const newQuantity =
      typeof body.quantity === "number" && !Number.isNaN(body.quantity)
        ? body.quantity
        : movement.quantity;
    const newReason = typeof body.reason === "string" ? body.reason.trim() : undefined;
    const newRequestedBy =
      typeof body.requested_by === "string" ? body.requested_by.trim() : undefined;
    const newNotes = typeof body.notes === "string" ? body.notes.trim() : undefined;

    if (!(newQuantity > 0)) {
      return NextResponse.json({ error: "La cantidad debe ser mayor a 0" }, { status: 400 });
    }
    if (newReason !== undefined && !newReason) {
      return NextResponse.json({ error: "El motivo es obligatorio" }, { status: 400 });
    }

    const oldEffect = signedQuantity(movement.type, movement.quantity);
    const newEffect = signedQuantity(newType, newQuantity);
    const stockDelta = newEffect - oldEffect;

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", movement.product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    const newStock = Number(product.stock) + Number(stockDelta);
    if (newStock < 0) {
      return NextResponse.json(
        { error: "No hay stock suficiente para editar este movimiento" },
        { status: 400 },
      );
    }

    const { error: stockUpdateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", movement.product_id);

    if (stockUpdateError) {
      return NextResponse.json({ error: stockUpdateError.message }, { status: 500 });
    }

    const updateData: Record<string, unknown> = {
      type: newType,
      quantity: newQuantity,
    };
    if (newReason !== undefined) updateData.reason = newReason;
    if (newRequestedBy !== undefined) updateData.requested_by = newRequestedBy || null;
    if (newNotes !== undefined) updateData.notes = newNotes || null;

    const { error: updateError } = await supabase
      .from("movements")
      .update(updateData)
      .eq("id", movement.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      actor: auth.actor,
      action: "MOVEMENT_UPDATE",
      entityType: "movement",
      entityId: id,
      detail: {
        newType,
        newQuantity,
        newReason,
        newRequestedBy,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al editar movimiento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const { data: movement, error: movementError } = await supabase
      .from("movements")
      .select("id, product_id, type, quantity")
      .eq("id", id)
      .single();

    if (movementError || !movement) {
      return NextResponse.json({ error: "Movimiento no encontrado" }, { status: 404 });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", movement.product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    // Revert movement effect on stock before deleting it.
    const revertDelta = movement.type === "ENTRY" ? -movement.quantity : movement.quantity;
    const newStock = Number(product.stock) + Number(revertDelta);
    if (newStock < 0) {
      return NextResponse.json(
        { error: "No hay stock suficiente para eliminar este movimiento" },
        { status: 400 },
      );
    }

    const { error: stockUpdateError } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", movement.product_id);

    if (stockUpdateError) {
      return NextResponse.json({ error: stockUpdateError.message }, { status: 500 });
    }

    const { error: deleteError } = await supabase.from("movements").delete().eq("id", movement.id);
    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      actor: auth.actor,
      action: "MOVEMENT_DELETE",
      entityType: "movement",
      entityId: id,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al eliminar movimiento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
