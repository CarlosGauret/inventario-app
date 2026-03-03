import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { randomUUID } from "crypto";

const BUCKET = "products";

type ProductUpdateInput = {
  code?: string;
  name?: string;
  category?: string;
  location?: string;
  stock?: number;
  min_stock?: number;
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = (await request.json()) as ProductUpdateInput;

    const updateData: ProductUpdateInput = {};
    if (typeof body.code === "string") updateData.code = body.code.trim();
    if (typeof body.name === "string") updateData.name = body.name.trim();
    if (typeof body.category === "string") updateData.category = body.category.trim();
    if (typeof body.location === "string") updateData.location = body.location.trim();
    if (typeof body.stock === "number" && !Number.isNaN(body.stock)) updateData.stock = body.stock;
    if (typeof body.min_stock === "number" && !Number.isNaN(body.min_stock)) {
      updateData.min_stock = body.min_stock;
    }

    if (!Object.keys(updateData).length) {
      return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 });
    }

    if (updateData.code === "" || updateData.name === "") {
      return NextResponse.json({ error: "Codigo y nombre no pueden estar vacios" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", id)
      .eq("active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al actualizar producto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const rawFiles = formData.getAll("images");
    const files = rawFiles.filter(
      (value): value is File => value instanceof File && value.size > 0,
    );

    if (!files.length) {
      return NextResponse.json({ error: "No se enviaron imagenes" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("id", id)
      .eq("active", true)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: productError?.message ?? "Producto no encontrado" },
        { status: 404 },
      );
    }

    const insertedImages: { product_id: string; path: string }[] = [];
    for (const file of files) {
      const extension = file.name.includes(".")
        ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
        : ".jpg";
      const storagePath = `${product.id}/${randomUUID()}${extension}`;
      const bytes = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, bytes, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }

      insertedImages.push({
        product_id: product.id,
        path: storagePath,
      });
    }

    const { error: imageError } = await supabase.from("product_images").insert(insertedImages);
    if (imageError) {
      return NextResponse.json({ error: imageError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al subir imagenes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { error } = await supabase
      .from("products")
      .update({ active: false })
      .eq("id", id)
      .eq("active", true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al eliminar producto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
