"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";
import type { Movement, MovementType, Product } from "@/lib/types";

type ProductFormState = {
  code: string;
  name: string;
  category: string;
  location: string;
  stock: string;
  min_stock: string;
  images: File[];
};

type EditProductState = {
  code: string;
  name: string;
  category: string;
  location: string;
  stock: string;
  min_stock: string;
};

type MovementFormState = {
  product_id: string;
  type: MovementType;
  quantity: string;
  reason: string;
  requested_by: string;
  notes: string;
};

type EditMovementState = {
  type: MovementType;
  quantity: string;
  reason: string;
  requested_by: string;
};

const initialProductForm: ProductFormState = {
  code: "",
  name: "",
  category: "",
  location: "",
  stock: "0",
  min_stock: "0",
  images: [],
};

const initialEditProduct: EditProductState = {
  code: "",
  name: "",
  category: "",
  location: "",
  stock: "0",
  min_stock: "0",
};

const initialMovementForm: MovementFormState = {
  product_id: "",
  type: "EXIT",
  quantity: "1",
  reason: "",
  requested_by: "",
  notes: "",
};

const initialEditMovement: EditMovementState = {
  type: "EXIT",
  quantity: "1",
  reason: "",
  requested_by: "",
};

function getImageUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    return "";
  }
  return `${base}/storage/v1/object/public/products/${path}`;
}

export default function Home() {
  const router = useRouter();
  const supabase = useMemo(() => createPublicClient(), []);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [submittingMovement, setSubmittingMovement] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingImageProductId, setUploadingImageProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<ProductFormState>(initialProductForm);
  const [movementForm, setMovementForm] = useState<MovementFormState>(initialMovementForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingMovementId, setEditingMovementId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<EditProductState>(initialEditProduct);
  const [editMovement, setEditMovement] = useState<EditMovementState>(initialEditMovement);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");

  const lowStockCount = useMemo(
    () => products.filter((product) => product.stock <= product.min_stock).length,
    [products],
  );

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [productsRes, movementsRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/movements", { cache: "no-store" }),
      ]);

      const productsPayload = await productsRes.json();
      const movementsPayload = await movementsRes.json();

      if (!productsRes.ok) {
        throw new Error(productsPayload.error ?? "No se pudieron cargar productos");
      }
      if (!movementsRes.ok) {
        throw new Error(movementsPayload.error ?? "No se pudieron cargar movimientos");
      }

      setProducts(productsPayload.data ?? []);
      setMovements(movementsPayload.data ?? []);
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al cargar datos";
      setError(text);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;

      if (sessionError || !data.session?.user) {
        router.replace("/login");
        setAuthLoading(false);
        return;
      }

      setUserEmail(data.session.user.email ?? "");
      await loadData();
      if (mounted) {
        setAuthLoading(false);
      }
    }

    void bootstrap();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.replace("/login");
        return;
      }
      setUserEmail(session.user.email ?? "");
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [router, supabase]);

  async function onSubmitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingProduct(true);
    setMessage("");
    setError("");

    try {
      const payload = new FormData();
      payload.set("code", productForm.code.trim());
      payload.set("name", productForm.name.trim());
      payload.set("category", productForm.category.trim());
      payload.set("location", productForm.location.trim());
      payload.set("stock", productForm.stock.trim());
      payload.set("min_stock", productForm.min_stock.trim());

      for (const image of productForm.images) {
        payload.append("images", image);
      }

      const response = await fetch("/api/products", {
        method: "POST",
        body: payload,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo registrar el producto");
      }

      setProductForm(initialProductForm);
      setMessage("Producto registrado correctamente.");
      await loadData();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al registrar producto";
      setError(text);
    } finally {
      setSubmittingProduct(false);
    }
  }

  async function onSubmitMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingMovement(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: movementForm.product_id,
          type: movementForm.type,
          quantity: Number(movementForm.quantity),
          reason: movementForm.reason.trim(),
          requested_by: movementForm.requested_by.trim(),
          notes: movementForm.notes.trim(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo registrar el movimiento");
      }

      setMovementForm(initialMovementForm);
      setMessage("Movimiento registrado y stock actualizado.");
      await loadData();
    } catch (cause) {
      const text =
        cause instanceof Error ? cause.message : "Error al registrar movimiento";
      setError(text);
    } finally {
      setSubmittingMovement(false);
    }
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setEditProduct({
      code: product.code,
      name: product.name,
      category: product.category ?? "",
      location: product.location ?? "",
      stock: String(product.stock),
      min_stock: String(product.min_stock),
    });
    setMessage("");
    setError("");
  }

  function cancelEditProduct() {
    setEditingProductId(null);
    setEditProduct(initialEditProduct);
  }

  async function saveEditProduct(productId: string) {
    setSavingEdit(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editProduct.code.trim(),
          name: editProduct.name.trim(),
          category: editProduct.category.trim(),
          location: editProduct.location.trim(),
          stock: Number(editProduct.stock),
          min_stock: Number(editProduct.min_stock),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo actualizar el producto");
      }

      setEditingProductId(null);
      setEditProduct(initialEditProduct);
      setMessage("Producto actualizado.");
      await loadData();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al editar producto";
      setError(text);
    } finally {
      setSavingEdit(false);
    }
  }

  async function deleteProduct(productId: string, productName: string) {
    const accepted = window.confirm(
      `Seguro que quieres eliminar "${productName}"? Se ocultara del listado.`,
    );
    if (!accepted) return;

    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo eliminar el producto");
      }

      if (editingProductId === productId) {
        cancelEditProduct();
      }
      setMessage("Producto eliminado del listado.");
      await loadData();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al eliminar producto";
      setError(text);
    }
  }

  async function addImagesToProduct(productId: string, files: File[]) {
    if (!files.length) return;
    setUploadingImageProductId(productId);
    setMessage("");
    setError("");
    try {
      const payload = new FormData();
      for (const file of files) {
        payload.append("images", file);
      }

      const response = await fetch(`/api/products/${productId}`, {
        method: "POST",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudieron subir imagenes");
      }

      setMessage("Imagenes agregadas al producto.");
      await loadData();
    } catch (cause) {
      const text =
        cause instanceof Error ? cause.message : "Error al agregar imagenes";
      setError(text);
    } finally {
      setUploadingImageProductId(null);
    }
  }

  function startEditMovement(movement: Movement) {
    setEditingMovementId(movement.id);
    setEditMovement({
      type: movement.type,
      quantity: String(movement.quantity),
      reason: movement.reason,
      requested_by: movement.requested_by ?? "",
    });
    setMessage("");
    setError("");
  }

  function cancelEditMovement() {
    setEditingMovementId(null);
    setEditMovement(initialEditMovement);
  }

  async function saveEditMovement(movementId: string) {
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/movements/${movementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: editMovement.type,
          quantity: Number(editMovement.quantity),
          reason: editMovement.reason.trim(),
          requested_by: editMovement.requested_by.trim(),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo actualizar el movimiento");
      }

      setEditingMovementId(null);
      setEditMovement(initialEditMovement);
      setMessage("Movimiento actualizado.");
      await loadData();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al editar movimiento";
      setError(text);
    }
  }

  async function deleteMovement(movementId: string) {
    const accepted = window.confirm(
      "Seguro que quieres eliminar este movimiento? El stock se ajustara automaticamente.",
    );
    if (!accepted) return;

    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/movements/${movementId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo eliminar el movimiento");
      }

      if (editingMovementId === movementId) {
        cancelEditMovement();
      }
      setMessage("Movimiento eliminado y stock corregido.");
      await loadData();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al eliminar movimiento";
      setError(text);
    }
  }

  function openImageViewer(paths: string[], startAt: number) {
    const urls = paths.map((path) => getImageUrl(path)).filter(Boolean);
    if (!urls.length) return;
    setViewerImages(urls);
    setViewerIndex(startAt);
  }

  function closeImageViewer() {
    setViewerImages([]);
    setViewerIndex(0);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <div className="panel p-6 text-center">
          <p>Cargando sesion...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventario Cloud TLS - Sede Arequipa</h1>
          <p className="text-sm text-[var(--muted)]">
            Control de stock con trazabilidad de retiros, usos y cantidades.
          </p>
        </div>
        <div className="panel flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <span>Total productos: {products.length}</span>
          <span>Stock bajo: {lowStockCount}</span>
          <span className="text-[var(--muted)]">{userEmail}</span>
          <button type="button" className="btn" onClick={() => void signOut()}>
            Cerrar sesion
          </button>
        </div>
      </header>

      {message ? <p className="mb-3 rounded-lg bg-emerald-100 p-2 text-sm">{message}</p> : null}
      {error ? <p className="mb-3 rounded-lg bg-red-100 p-2 text-sm text-red-800">{error}</p> : null}

      <section className="grid gap-4 md:grid-cols-2">
        <article className="panel p-4">
          <h2 className="mb-3 text-lg font-semibold">Registrar producto</h2>
          <form className="space-y-3" onSubmit={onSubmitProduct}>
            <div className="grid gap-3 md:grid-cols-2">
              <label>
                Codigo
                <input
                  className="field mt-1"
                  value={productForm.code}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, code: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Nombre
                <input
                  className="field mt-1"
                  value={productForm.name}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                Categoria
                <input
                  className="field mt-1"
                  value={productForm.category}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                />
              </label>
              <label>
                Ubicacion
                <input
                  className="field mt-1"
                  value={productForm.location}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, location: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                Stock inicial
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  step="0.01"
                  value={productForm.stock}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, stock: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Stock minimo
                <input
                  className="field mt-1"
                  type="number"
                  min={0}
                  step="0.01"
                  value={productForm.min_stock}
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, min_stock: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <label className="block text-sm">
              Imagenes del producto (puedes seleccionar varias)
              <input
                className="field mt-1"
                type="file"
                accept="image/*"
                multiple
                onChange={(event) =>
                  setProductForm((prev) => ({
                    ...prev,
                    images: Array.from(event.target.files ?? []),
                  }))
                }
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                {productForm.images.length
                  ? `${productForm.images.length} imagen(es) seleccionada(s)`
                  : "Sin imagenes seleccionadas"}
              </p>
            </label>

            <button className="btn btn-primary" disabled={submittingProduct} type="submit">
              {submittingProduct ? "Guardando..." : "Guardar producto"}
            </button>
          </form>
        </article>

        <article className="panel p-4">
          <h2 className="mb-3 text-lg font-semibold">Registrar movimiento</h2>
          <form className="space-y-3" onSubmit={onSubmitMovement}>
            <label>
              Producto
              <select
                className="field mt-1"
                value={movementForm.product_id}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, product_id: event.target.value }))
                }
                required
              >
                <option value="">Seleccionar...</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} - {product.name} (stock: {product.stock})
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-3 md:grid-cols-2">
              <label>
                Tipo
                <select
                  className="field mt-1"
                  value={movementForm.type}
                  onChange={(event) =>
                    setMovementForm((prev) => ({
                      ...prev,
                      type: event.target.value as MovementType,
                    }))
                  }
                >
                  <option value="ENTRY">Entrada</option>
                  <option value="EXIT">Salida</option>
                </select>
              </label>
              <label>
                Cantidad
                <input
                  className="field mt-1"
                  type="number"
                  min={0.01}
                  step="0.01"
                  value={movementForm.quantity}
                  onChange={(event) =>
                    setMovementForm((prev) => ({ ...prev, quantity: event.target.value }))
                  }
                  required
                />
              </label>
            </div>

            <label>
              Para que se uso / motivo
              <input
                className="field mt-1"
                value={movementForm.reason}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                placeholder="Ejemplo: mantenimiento de bomba"
                required
              />
            </label>

            <label>
              Quien retiro o solicito
              <input
                className="field mt-1"
                value={movementForm.requested_by}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, requested_by: event.target.value }))
                }
                placeholder="Nombre de responsable"
              />
            </label>

            <label>
              Observaciones
              <textarea
                className="field mt-1"
                rows={3}
                value={movementForm.notes}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </label>

            <button className="btn btn-primary" disabled={submittingMovement} type="submit">
              {submittingMovement ? "Registrando..." : "Guardar movimiento"}
            </button>
          </form>
        </article>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] p-4">
            <h2 className="text-lg font-semibold">Productos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Imagen</th>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">Stock</th>
                  <th className="px-3 py-2 text-left">Ubicacion</th>
                  <th className="px-3 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const paths = product.product_images?.map((image) => image.path) ?? [];
                  const imageUrl = paths[0] ? getImageUrl(paths[0]) : "";
                  const low = product.stock <= product.min_stock;
                  const isEditing = editingProductId === product.id;

                  return (
                    <tr key={product.id} className="border-t border-[var(--line)]">
                      <td className="px-3 py-2">
                        {imageUrl ? (
                          <button
                            type="button"
                            className="group relative block"
                            onClick={() => openImageViewer(paths, 0)}
                            title="Ampliar fotos"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={imageUrl}
                              alt={product.name}
                              className="h-12 w-12 rounded-lg border border-[var(--line)] object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
                              <svg
                                viewBox="0 0 24 24"
                                className="h-5 w-5 text-white"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <circle cx="11" cy="11" r="7"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                <line x1="11" y1="8" x2="11" y2="14"></line>
                                <line x1="8" y1="11" x2="14" y2="11"></line>
                              </svg>
                            </span>
                            {paths.length > 1 ? (
                              <span className="badge absolute -right-3 -top-2 bg-sky-100 text-sky-900">
                                +{paths.length - 1}
                              </span>
                            ) : null}
                          </button>
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--line)] text-xs text-[var(--muted)]">
                            Sin foto
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              className="field"
                              value={editProduct.name}
                              onChange={(event) =>
                                setEditProduct((prev) => ({ ...prev, name: event.target.value }))
                              }
                            />
                            <input
                              className="field"
                              value={editProduct.code}
                              onChange={(event) =>
                                setEditProduct((prev) => ({ ...prev, code: event.target.value }))
                              }
                            />
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold">{product.name}</p>
                            <p className="text-xs text-[var(--muted)]">{product.code}</p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              className="field"
                              type="number"
                              min={0}
                              step="0.01"
                              value={editProduct.stock}
                              onChange={(event) =>
                                setEditProduct((prev) => ({ ...prev, stock: event.target.value }))
                              }
                            />
                            <input
                              className="field"
                              type="number"
                              min={0}
                              step="0.01"
                              value={editProduct.min_stock}
                              onChange={(event) =>
                                setEditProduct((prev) => ({
                                  ...prev,
                                  min_stock: event.target.value,
                                }))
                              }
                            />
                          </div>
                        ) : (
                          <>
                            <span className={`badge ${low ? "bg-red-100 text-red-800" : ""}`}>
                              {product.stock}
                            </span>
                            <p className="mt-1 text-xs text-[var(--muted)]">Min: {product.min_stock}</p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              className="field"
                              value={editProduct.location}
                              onChange={(event) =>
                                setEditProduct((prev) => ({
                                  ...prev,
                                  location: event.target.value,
                                }))
                              }
                              placeholder="Ubicacion"
                            />
                            <input
                              className="field"
                              value={editProduct.category}
                              onChange={(event) =>
                                setEditProduct((prev) => ({
                                  ...prev,
                                  category: event.target.value,
                                }))
                              }
                              placeholder="Categoria"
                            />
                          </div>
                        ) : (
                          product.location ?? "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary"
                              disabled={savingEdit}
                              onClick={() => void saveEditProduct(product.id)}
                            >
                              Guardar
                            </button>
                            <button type="button" className="btn" onClick={cancelEditProduct}>
                              Cancelar
                            </button>
                            <label className="btn cursor-pointer">
                              {uploadingImageProductId === product.id ? "Subiendo..." : "Agregar fotos"}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                multiple
                                disabled={uploadingImageProductId === product.id}
                                onChange={(event) => {
                                  const files = Array.from(event.target.files ?? []);
                                  event.target.value = "";
                                  void addImagesToProduct(product.id, files);
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => startEditProduct(product)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => void deleteProduct(product.id, product.name)}
                            >
                              Eliminar
                            </button>
                            <label className="btn cursor-pointer">
                              {uploadingImageProductId === product.id ? "Subiendo..." : "Agregar fotos"}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                multiple
                                disabled={uploadingImageProductId === product.id}
                                onChange={(event) => {
                                  const files = Array.from(event.target.files ?? []);
                                  event.target.value = "";
                                  void addImagesToProduct(product.id, files);
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!products.length && !loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-[var(--muted)]">
                      No hay productos registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel overflow-hidden">
          <div className="border-b border-[var(--line)] p-4">
            <h2 className="text-lg font-semibold">Historial de movimientos</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-left">Cantidad</th>
                  <th className="px-3 py-2 text-left">Uso</th>
                  <th className="px-3 py-2 text-left">Responsable</th>
                  <th className="px-3 py-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => {
                  const isEditing = editingMovementId === movement.id;
                  return (
                    <tr key={movement.id} className="border-t border-[var(--line)]">
                      <td className="px-3 py-2 text-xs">
                        {new Date(movement.created_at).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        {movement.products?.code} - {movement.products?.name}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <select
                            className="field"
                            value={editMovement.type}
                            onChange={(event) =>
                              setEditMovement((prev) => ({
                                ...prev,
                                type: event.target.value as MovementType,
                              }))
                            }
                          >
                            <option value="ENTRY">Entrada</option>
                            <option value="EXIT">Salida</option>
                          </select>
                        ) : (
                          <span
                            className={`badge ${
                              movement.type === "EXIT"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            {movement.type === "EXIT" ? "Salida" : "Entrada"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className="field"
                            type="number"
                            min={0.01}
                            step="0.01"
                            value={editMovement.quantity}
                            onChange={(event) =>
                              setEditMovement((prev) => ({
                                ...prev,
                                quantity: event.target.value,
                              }))
                            }
                          />
                        ) : (
                          movement.quantity
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className="field"
                            value={editMovement.reason}
                            onChange={(event) =>
                              setEditMovement((prev) => ({
                                ...prev,
                                reason: event.target.value,
                              }))
                            }
                          />
                        ) : (
                          movement.reason
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            className="field"
                            value={editMovement.requested_by}
                            onChange={(event) =>
                              setEditMovement((prev) => ({
                                ...prev,
                                requested_by: event.target.value,
                              }))
                            }
                          />
                        ) : (
                          movement.requested_by ?? "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-primary"
                              onClick={() => void saveEditMovement(movement.id)}
                            >
                              Guardar
                            </button>
                            <button type="button" className="btn" onClick={cancelEditMovement}>
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn"
                              onClick={() => startEditMovement(movement)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => void deleteMovement(movement.id)}
                            >
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!movements.length && !loading ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-[var(--muted)]">
                      No hay movimientos registrados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      {viewerImages.length ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3"
          onClick={closeImageViewer}
        >
          <div
            className="panel relative w-full max-w-3xl overflow-hidden bg-white"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] p-3">
              <p className="text-sm font-semibold">
                Imagen {viewerIndex + 1} de {viewerImages.length}
              </p>
              <button type="button" className="btn" onClick={closeImageViewer}>
                Cerrar
              </button>
            </div>
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={viewerImages[viewerIndex]}
                alt="Vista ampliada de producto"
                className="max-h-[70vh] w-full object-contain bg-slate-100"
              />
              {viewerImages.length > 1 ? (
                <>
                  <button
                    type="button"
                    className="btn absolute left-2 top-1/2 -translate-y-1/2 bg-white/90"
                    onClick={() =>
                      setViewerIndex((prev) =>
                        prev === 0 ? viewerImages.length - 1 : prev - 1,
                      )
                    }
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    className="btn absolute right-2 top-1/2 -translate-y-1/2 bg-white/90"
                    onClick={() =>
                      setViewerIndex((prev) =>
                        prev === viewerImages.length - 1 ? 0 : prev + 1,
                      )
                    }
                  >
                    Siguiente
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
