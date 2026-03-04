import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { requireActor } from "@/lib/server-auth";
import { writeAuditLog } from "@/lib/audit";

const BUCKET = "products";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    const auth = await requireActor(request);
    if (!auth.ok) return auth.response;

    const { id, imageId } = await params;
    const supabase = createServerClient();

    const { data: image, error: imageError } = await supabase
      .from("product_images")
      .select("id, product_id, path")
      .eq("id", imageId)
      .eq("product_id", id)
      .single();

    if (imageError || !image) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const { error: storageError } = await supabase.storage.from(BUCKET).remove([image.path]);
    if (storageError) {
      return NextResponse.json({ error: storageError.message }, { status: 500 });
    }

    const { error: deleteError } = await supabase
      .from("product_images")
      .delete()
      .eq("id", imageId)
      .eq("product_id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      actor: auth.actor,
      action: "PRODUCT_DELETE_IMAGE",
      entityType: "product",
      entityId: id,
      detail: {
        imageId,
        oldPath: image.path,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al eliminar imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> },
) {
  try {
    const auth = await requireActor(request);
    if (!auth.ok) return auth.response;

    const { id, imageId } = await params;
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Debes seleccionar una imagen valida" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: image, error: imageError } = await supabase
      .from("product_images")
      .select("id, product_id, path")
      .eq("id", imageId)
      .eq("product_id", id)
      .single();

    if (imageError || !image) {
      return NextResponse.json({ error: "Imagen no encontrada" }, { status: 404 });
    }

    const extension = file.name.includes(".")
      ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
      : ".jpg";
    const newPath = `${id}/${randomUUID()}${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(newPath, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { error: updateError } = await supabase
      .from("product_images")
      .update({ path: newPath })
      .eq("id", imageId)
      .eq("product_id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { error: oldDeleteError } = await supabase.storage.from(BUCKET).remove([image.path]);
    if (oldDeleteError) {
      return NextResponse.json({ error: oldDeleteError.message }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      actor: auth.actor,
      action: "PRODUCT_REPLACE_IMAGE",
      entityType: "product",
      entityId: id,
      detail: {
        imageId,
        oldPath: image.path,
        newPath,
      },
    });

    return NextResponse.json({ ok: true, path: newPath });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al reemplazar imagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
