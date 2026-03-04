"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";
import type { Product } from "@/lib/types";

function getImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return "";
  return `${base}/storage/v1/object/public/products/${path}`;
}

export default function CatalogoPage() {
  const router = useRouter();
  const supabase = useMemo(() => createPublicClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  const categories = useMemo(() => {
    const unique = new Set(
      products.map((item) => item.category?.trim()).filter((value): value is string => !!value),
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visible = useMemo(() => {
    if (categoryFilter === "ALL") return products;
    return products.filter((item) => (item.category ?? "") === categoryFilter);
  }, [products, categoryFilter]);

  async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Sesion expirada");
    }
    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session?.user) {
          router.replace("/login");
          return;
        }

        const response = await authFetch("/api/products", { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "No se pudo cargar catalogo");
        }
        if (mounted) {
          setProducts(payload.data ?? []);
        }
      } catch (cause) {
        const text = cause instanceof Error ? cause.message : "Error al cargar catalogo";
        if (mounted) setError(text);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  function exportCsv() {
    const rows = [
      ["Codigo", "Nombre", "Categoria", "Ubicacion", "Stock", "Stock Minimo", "Fotos"],
      ...visible.map((item) => [
        item.code,
        item.name,
        item.category ?? "",
        item.location ?? "",
        String(item.stock),
        String(item.min_stock),
        String(item.product_images?.length ?? 0),
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `catalogo_inventario_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportHtml() {
    const cards = visible
      .map((item) => {
        const imagePath = item.product_images?.[0]?.path;
        const imageUrl = imagePath ? getImageUrl(imagePath) : "";
        return `
          <article class="card">
            ${imageUrl ? `<img src="${imageUrl}" alt="${item.name}" />` : `<div class="placeholder">Sin foto</div>`}
            <h3>${item.name}</h3>
            <p><b>Codigo:</b> ${item.code}</p>
            <p><b>Categoria:</b> ${item.category ?? "-"}</p>
            <p><b>Ubicacion:</b> ${item.location ?? "-"}</p>
            <p><b>Stock:</b> ${item.stock} (min ${item.min_stock})</p>
          </article>
        `;
      })
      .join("");

    const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Catalogo Inventario</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f2f6fb; }
    h1 { margin: 0 0 6px; }
    p.meta { color: #54657a; margin: 0 0 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(220px,1fr)); gap: 14px; }
    .card { background: #fff; border: 1px solid #d8e2ec; border-radius: 10px; padding: 10px; }
    img { width: 100%; height: 150px; object-fit: cover; border-radius: 8px; border: 1px solid #d8e2ec; }
    .placeholder { width: 100%; height: 150px; border-radius: 8px; border: 1px dashed #d8e2ec; display:flex; align-items:center; justify-content:center; color:#6e7e90; }
    @media print { body { background: #fff; } }
  </style>
</head>
<body>
  <h1>Inventario Cloud TLS - Sede Arequipa</h1>
  <p class="meta">Catalogo exportado el ${new Date().toLocaleString()}</p>
  <section class="grid">${cards}</section>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `catalogo_visual_${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Catalogo y Exportar</h1>
          <p className="text-sm text-[var(--muted)]">
            Vista visual del inventario con imagenes y opciones de exportacion.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={exportCsv} type="button">
            Exportar CSV
          </button>
          <button className="btn" onClick={exportHtml} type="button">
            Exportar HTML
          </button>
          <button className="btn" onClick={() => window.print()} type="button">
            Imprimir
          </button>
          <Link className="btn" href="/">
            Volver
          </Link>
        </div>
      </header>

      <section className="panel mb-4 p-4">
        <label className="text-sm">
          Categoria:
          <select
            className="field mt-1 max-w-sm"
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
          >
            <option value="ALL">Todos</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error ? <p className="mb-3 rounded-lg bg-red-100 p-2 text-sm text-red-800">{error}</p> : null}
      {loading ? (
        <section className="panel p-6 text-center">Cargando catalogo...</section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((item) => {
            const imagePath = item.product_images?.[0]?.path;
            const imageUrl = imagePath ? getImageUrl(imagePath) : "";
            const low = item.stock <= item.min_stock;
            return (
              <article key={item.id} className="panel p-3">
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrl}
                    alt={item.name}
                    className="mb-3 h-44 w-full rounded-lg border border-[var(--line)] object-cover"
                  />
                ) : (
                  <div className="mb-3 flex h-44 items-center justify-center rounded-lg border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
                    Sin foto
                  </div>
                )}
                <h3 className="text-lg font-semibold">{item.name}</h3>
                <p className="text-xs text-[var(--muted)]">{item.code}</p>
                <p className="mt-1 text-sm">Categoria: {item.category ?? "-"}</p>
                <p className="text-sm">Ubicacion: {item.location ?? "-"}</p>
                <p className="text-sm">
                  Stock:{" "}
                  <span className={`badge ${low ? "bg-red-100 text-red-800" : ""}`}>{item.stock}</span>{" "}
                  <span className="text-xs text-[var(--muted)]">min {item.min_stock}</span>
                </p>
              </article>
            );
          })}
          {!visible.length ? (
            <div className="panel p-6 text-center text-[var(--muted)] sm:col-span-2 lg:col-span-3">
              No hay productos para ese filtro.
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}

