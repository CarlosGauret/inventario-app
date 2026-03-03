import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

const BUCKET = "products";

export async function GET() {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, code, name, category, location, stock, min_stock, active, created_at, product_images(path)",
      )
      .eq("active", true)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al listar productos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const code = String(formData.get("code") ?? "").trim();
    const name = String(formData.get("name") ?? "").trim();
    const category = String(formData.get("category") ?? "").trim() || null;
    const location = String(formData.get("location") ?? "").trim() || null;
    const stock = Number(formData.get("stock") ?? 0);
    const minStock = Number(formData.get("min_stock") ?? 0);
    const rawFiles = formData.getAll("images");
    const files = rawFiles.filter(
      (value): value is File => value instanceof File && value.size > 0,
    );
    const legacyFile = formData.get("image");
    if (!files.length && legacyFile instanceof File && legacyFile.size > 0) {
      files.push(legacyFile);
    }

    if (!code || !name || Number.isNaN(stock) || Number.isNaN(minStock)) {
      return NextResponse.json(
        { error: "Datos invalidos: codigo, nombre, stock y stock minimo son obligatorios" },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        code,
        name,
        category,
        location,
        stock,
        min_stock: minStock,
      })
      .select("id")
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: productError?.message ?? "No se pudo crear el producto" },
        { status: 500 },
      );
    }

    if (files.length) {
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
    }

    return NextResponse.json({ ok: true, productId: product.id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido al crear producto";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
