"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPublicClient } from "@/lib/supabase";
import type { AuditLog, Movement, MovementType, Product } from "@/lib/types";

type ProductFormState = {
  name: string;
  category: string;
  location: string;
  stock: string;
  min_stock: string;
  images: File[];
};

type EditProductState = {
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
  name: "",
  category: "",
  location: "",
  stock: "0",
  min_stock: "0",
  images: [],
};

const initialEditProduct: EditProductState = {
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
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
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
  const [movementDeleteMode, setMovementDeleteMode] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [selectedAudit, setSelectedAudit] = useState<AuditLog | null>(null);
  const [highlightProductId, setHighlightProductId] = useState<string | null>(null);
  const [highlightMovementId, setHighlightMovementId] = useState<string | null>(null);
  const [managingPhotosProductId, setManagingPhotosProductId] = useState<string | null>(null);
  const [photoBusyImageId, setPhotoBusyImageId] = useState<string | null>(null);
  const productsSectionRef = useRef<HTMLElement | null>(null);
  const movementsSectionRef = useRef<HTMLElement | null>(null);

  const lowStockCount = useMemo(
    () => products.filter((product) => product.stock <= product.min_stock).length,
    [products],
  );

  const categoryOptions = useMemo(() => {
    const unique = new Set(
      products.map((product) => product.category?.trim()).filter((value): value is string => !!value),
    );
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visibleProducts = useMemo(() => {
    if (categoryFilter === "ALL") return products;
    return products.filter((product) => (product.category ?? "") === categoryFilter);
  }, [products, categoryFilter]);

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const movementsById = useMemo(
    () => new Map(movements.map((movement) => [movement.id, movement])),
    [movements],
  );
  const managingPhotosProduct = useMemo(
    () => products.find((product) => product.id === managingPhotosProductId) ?? null,
    [products, managingPhotosProductId],
  );

  function actionLabel(action: string) {
    const map: Record<string, string> = {
      PRODUCT_CREATE: "Se registro producto",
      PRODUCT_UPDATE: "Se modifico producto",
      PRODUCT_DELETE: "Se elimino producto",
      PRODUCT_ADD_IMAGES: "Se agregaron fotos",
      PRODUCT_DELETE_IMAGE: "Se elimino foto",
      PRODUCT_REPLACE_IMAGE: "Se reemplazo foto",
      MOVEMENT_CREATE: "Se registro movimiento",
      MOVEMENT_UPDATE: "Se modifico movimiento",
      MOVEMENT_DELETE: "Se elimino movimiento",
    };
    return map[action] ?? action;
  }

  function movementTypeLabel(type: unknown) {
    if (type === "ENTRY") return "entrada";
    if (type === "EXIT") return "salida";
    return "movimiento";
  }

  function auditSummary(log: AuditLog) {
    const detail = log.detail ?? {};
    if (log.action === "MOVEMENT_CREATE") {
      const qty = detail.quantity ?? "?";
      const type = movementTypeLabel(detail.type);
      const reason = detail.reason ? ` para "${String(detail.reason)}"` : "";
      return `Se registro ${type} de ${qty}${reason}.`;
    }
    if (log.action === "MOVEMENT_UPDATE") {
      const qty = detail.newQuantity ?? "?";
      const type = movementTypeLabel(detail.newType);
      return `Se actualizo movimiento a ${type} con cantidad ${qty}.`;
    }
    if (log.action === "MOVEMENT_DELETE") {
      return "Se elimino el movimiento y se ajusto stock automaticamente.";
    }
    if (log.action === "PRODUCT_CREATE") {
      return `Se creo producto "${String(detail.name ?? "")}" con codigo ${String(detail.code ?? "")}.`;
    }
    if (log.action === "PRODUCT_UPDATE") {
      return "Se modificaron datos del producto.";
    }
    if (log.action === "PRODUCT_ADD_IMAGES") {
      return `Se agregaron ${String(detail.imagesUploaded ?? 0)} imagen(es) al producto.`;
    }
    if (log.action === "PRODUCT_DELETE_IMAGE") {
      return "Se elimino una imagen del producto.";
    }
    if (log.action === "PRODUCT_REPLACE_IMAGE") {
      return "Se reemplazo una imagen del producto.";
    }
    if (log.action === "PRODUCT_DELETE") {
      return "Se elimino el producto del listado activo.";
    }
    return "Accion registrada en auditoria.";
  }

  function getAuditProductId(log: AuditLog): string | null {
    if (log.entity_type === "product" && log.entity_id) return log.entity_id;
    const detail = log.detail ?? {};
    const fromDetail = detail.product_id;
    return typeof fromDetail === "string" ? fromDetail : null;
  }

  function getAuditMovementId(log: AuditLog): string | null {
    if (log.entity_type === "movement" && log.entity_id) return log.entity_id;
    return null;
  }

  async function authFetch(input: RequestInfo | URL, init?: RequestInit) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      throw new Error("Sesion expirada. Vuelve a iniciar sesion.");
    }

    const headers = new Headers(init?.headers ?? {});
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  }

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [productsRes, movementsRes, auditRes] = await Promise.all([
        authFetch("/api/products", { cache: "no-store" }),
        authFetch("/api/movements", { cache: "no-store" }),
        authFetch("/api/audit-logs", { cache: "no-store" }),
      ]);

      const productsPayload = await productsRes.json();
      const movementsPayload = await movementsRes.json();
      const auditPayload = await auditRes.json();

      if (!productsRes.ok) {
        throw new Error(productsPayload.error ?? "No se pudieron cargar productos");
      }
      if (!movementsRes.ok) {
        throw new Error(movementsPayload.error ?? "No se pudieron cargar movimientos");
      }
      if (!auditRes.ok) {
        throw new Error(auditPayload.error ?? "No se pudo cargar auditoria");
      }

      setProducts(productsPayload.data ?? []);
      setMovements(movementsPayload.data ?? []);
      setAuditLogs(auditPayload.data ?? []);
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

  useEffect(() => {
    let armedAt = 0;
    const windowMs = 3000;

    function onKeyDown(event: KeyboardEvent) {
      if (!event.altKey) return;

      if (event.code === "KeyI") {
        armedAt = Date.now();
        return;
      }

      if (event.code === "KeyP" && armedAt && Date.now() - armedAt <= windowMs) {
        setMovementDeleteMode((prev) => !prev);
        armedAt = 0;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function onSubmitProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingProduct(true);
    setMessage("");
    setError("");

    try {
      const payload = new FormData();
      payload.set("name", productForm.name.trim());
      payload.set("category", productForm.category.trim());
      payload.set("location", productForm.location.trim());
      payload.set("stock", productForm.stock.trim());
      payload.set("min_stock", productForm.min_stock.trim());

      for (const image of productForm.images) {
        payload.append("images", image);
      }

      const response = await authFetch("/api/products", {
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
      const response = await authFetch("/api/movements", {
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
      const response = await authFetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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

  async function deleteProduct(productId: string) {
    setMessage("");
    setError("");
    try {
      const response = await authFetch(`/api/products/${productId}`, {
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

      const response = await authFetch(`/api/products/${productId}`, {
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

  async function deleteProductImage(productId: string, imageId: string) {
    setPhotoBusyImageId(imageId);
    setMessage("");
    setError("");
    try {
      const response = await authFetch(`/api/products/${productId}/images/${imageId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo eliminar la imagen");
      }
      setMessage("Imagen eliminada.");
      await loadData();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al eliminar imagen";
      setError(text);
    } finally {
      setPhotoBusyImageId(null);
    }
  }

  async function replaceProductImage(productId: string, imageId: string, file: File | null) {
    if (!file) return;
    setPhotoBusyImageId(imageId);
    setMessage("");
    setError("");
    try {
      const payload = new FormData();
      payload.set("image", file);
      const response = await authFetch(`/api/products/${productId}/images/${imageId}`, {
        method: "PUT",
        body: payload,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo reemplazar la imagen");
      }
      setMessage("Imagen reemplazada.");
      await loadData();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al reemplazar imagen";
      setError(text);
    } finally {
      setPhotoBusyImageId(null);
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
      const response = await authFetch(`/api/movements/${movementId}`, {
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
    setMessage("");
    setError("");
    try {
      const response = await authFetch(`/api/movements/${movementId}`, {
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

  async function deleteAuditLog(logId: string) {
    setMessage("");
    setError("");
    try {
      const response = await authFetch(`/api/audit-logs/${logId}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "No se pudo eliminar el registro de auditoria");
      }

      if (selectedAudit?.id === logId) {
        setSelectedAudit(null);
      }
      setMessage("Registro de auditoria eliminado.");
      await loadData();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : "Error al eliminar auditoria";
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

  function focusProduct(productId: string) {
    setCategoryFilter("ALL");
    setHighlightProductId(productId);
    window.setTimeout(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-product-anchor="${productId}"]`),
      );
      const target = candidates.find((el) => el.offsetParent !== null) ?? candidates[0];
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    window.setTimeout(() => setHighlightProductId(null), 10000);
  }

  function focusMovement(movementId: string) {
    setHighlightMovementId(movementId);
    window.setTimeout(() => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(`[data-movement-anchor="${movementId}"]`),
      );
      const target = candidates.find((el) => el.offsetParent !== null) ?? candidates[0];
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    window.setTimeout(() => setHighlightMovementId(null), 10000);
  }

  function goToAuditTarget(log: AuditLog) {
    const movementId = getAuditMovementId(log);
    if (movementId) {
      focusMovement(movementId);
      return true;
    }

    const productId = getAuditProductId(log);
    if (productId) {
      focusProduct(productId);
      return true;
    }

    return false;
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
    <main className="mx-auto w-full max-w-none p-4 md:p-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Inventario Cloud TLS - Sede Arequipa
          </h1>
          <p className="text-sm text-[var(--muted)]">
            Control de stock con trazabilidad de retiros, usos y cantidades.
          </p>
        </div>
        <div className="panel flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
          <span>Total productos: {products.length}</span>
          <span>Stock bajo: {lowStockCount}</span>
          <span className="text-[var(--muted)]">{userEmail}</span>
          <Link className="btn" href="/catalogo">
            Catalogo/Exportar
          </Link>
          <button type="button" className="btn" onClick={() => void signOut()}>
            Cerrar sesion
          </button>
        </div>
      </header>

      {message ? <p className="mb-3 rounded-lg bg-emerald-100 p-2 text-sm">{message}</p> : null}
      {error ? <p className="mb-3 rounded-lg bg-red-100 p-2 text-sm text-red-800">{error}</p> : null}

      <section className="grid items-stretch gap-5 lg:grid-cols-2">
        <article className="panel h-full p-5">
          <h2 className="mb-3 text-lg font-semibold">Registrar producto</h2>
          <form className="space-y-3" onSubmit={onSubmitProduct}>
            <div className="grid gap-3">
              <label>
                Nombre
                <input
                  className="field mt-1"
                  value={productForm.name}
                  placeholder="Ejemplo: Tomatodos Negros de 500ml"
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
                  placeholder="Ejemplo: Lapiceros"
                  onChange={(event) =>
                    setProductForm((prev) => ({ ...prev, category: event.target.value }))
                  }
                />
              </label>
              <label>
                Ubicación
                <input
                  className="field mt-1"
                  value={productForm.location}
                  placeholder="Ejemplo: 9° Piso o Almacen"
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

            <button className="btn btn-primary w-fit" disabled={submittingProduct} type="submit">
              {submittingProduct ? "Guardando..." : "Guardar producto"}
            </button>
          </form>
        </article>

        <article className="panel h-full p-5">
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
                placeholder="Ejemplo: Explosion Creativa"
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

            <button className="btn btn-primary w-fit" disabled={submittingMovement} type="submit">
              {submittingMovement ? "Registrando..." : "Guardar movimiento"}
            </button>
          </form>
        </article>
      </section>

      <section className="mt-5 grid items-stretch gap-5 lg:grid-cols-2">
        <article
          className="panel flex min-h-[560px] flex-col overflow-hidden"
          ref={productsSectionRef}
        >
          <div className="border-b border-[var(--line)] p-4">
            <h2 className="text-lg font-semibold">Productos</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <label htmlFor="category-filter">Filtrar por categoria:</label>
              <select
                id="category-filter"
                className="field min-w-[13rem] flex-1 md:max-w-sm"
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                <option value="ALL">Todos</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-x-auto">
            <div className="space-y-3 p-3 sm:hidden">
              {visibleProducts.map((product) => {
                const paths = product.product_images?.map((image) => image.path) ?? [];
                const imageUrl = paths[0] ? getImageUrl(paths[0]) : "";
                const low = product.stock <= product.min_stock;
                const isEditing = editingProductId === product.id;

                return (
                  <div
                    key={product.id}
                    data-product-anchor={product.id}
                    className={`rounded-lg border p-3 ${
                      highlightProductId === product.id
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-[var(--line)]"
                    }`}
                  >
                    <div className="mb-2 flex items-start gap-3">
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
                        </button>
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--line)] text-xs text-[var(--muted)]">
                          Sin foto
                        </div>
                      )}
                      <div>
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-xs text-[var(--muted)]">{product.code}</p>
                        <p className="text-xs text-[var(--muted)]">Categoria: {product.category ?? "-"}</p>
                      </div>
                    </div>
                    <p className="text-sm">
                      Stock:{" "}
                      <span
                        className={`inline-flex min-w-[2.7rem] items-center justify-center rounded-full border border-[var(--line)] px-2.5 py-0.5 text-2xl font-bold leading-none ${
                          low ? "bg-red-100 text-red-800" : "bg-white text-[var(--foreground)]"
                        }`}
                      >
                        {product.stock}
                      </span>{" "}
                      <span className="text-xs text-[var(--muted)]">Min: {product.min_stock}</span>
                    </p>
                    <p className="text-sm">Ubicación: {product.location ?? "-"}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn flex h-12 w-12 items-center justify-center p-0"
                        title="Editar"
                        onClick={() => startEditProduct(product)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-7 w-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9"></path>
                          <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger flex h-12 w-12 items-center justify-center p-0"
                        title="Eliminar"
                        onClick={() => void deleteProduct(product.id)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-7 w-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
                          <path d="m19 6-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="btn flex h-12 w-12 items-center justify-center p-0"
                        title="Gestionar fotos"
                        onClick={() => setManagingPhotosProductId(product.id)}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-7 w-7"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <rect x="3" y="6" width="18" height="12" rx="2"></rect>
                          <circle cx="9" cy="12" r="1.5"></circle>
                          <path d="m21 15-4-4-5 5"></path>
                          <path d="M12 10v4"></path>
                          <path d="M10 12h4"></path>
                        </svg>
                      </button>
                    </div>
                    {isEditing ? (
                      <div className="mt-3 space-y-2">
                        <input
                          className="field"
                          value={editProduct.name}
                          onChange={(event) =>
                            setEditProduct((prev) => ({ ...prev, name: event.target.value }))
                          }
                        />
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
                            setEditProduct((prev) => ({ ...prev, min_stock: event.target.value }))
                          }
                        />
                        <input
                          className="field"
                          value={editProduct.location}
                          onChange={(event) =>
                            setEditProduct((prev) => ({ ...prev, location: event.target.value }))
                          }
                          placeholder="Ubicación"
                        />
                        <input
                          className="field"
                          value={editProduct.category}
                          onChange={(event) =>
                            setEditProduct((prev) => ({ ...prev, category: event.target.value }))
                          }
                          placeholder="Categoria"
                        />
                        <div className="flex gap-2">
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
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!visibleProducts.length && !loading ? (
                <p className="text-center text-sm text-[var(--muted)]">
                  No hay productos para el filtro seleccionado.
                </p>
              ) : null}
            </div>

            <table className="hidden min-w-full text-sm sm:table">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-3 py-2 text-left">Imagen</th>
                  <th className="px-3 py-2 text-left">Producto</th>
                  <th className="px-3 py-2 text-left">Categoria</th>
                  <th className="px-3 py-2 text-left">Stock</th>
                  <th className="px-3 py-2 text-center">Ubicación</th>
                  <th className="w-[195px] px-4 py-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleProducts.map((product) => {
                  const paths = product.product_images?.map((image) => image.path) ?? [];
                  const imageUrl = paths[0] ? getImageUrl(paths[0]) : "";
                  const low = product.stock <= product.min_stock;
                  const isEditing = editingProductId === product.id;

                  return (
                    <tr
                      key={product.id}
                      data-product-anchor={product.id}
                      className={`border-t ${
                        highlightProductId === product.id ? "bg-emerald-50" : "border-[var(--line)]"
                      }`}
                    >
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
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold">{product.name}</p>
                            <p className="text-xs text-[var(--muted)]">{product.code}</p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        {isEditing ? (
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
                        ) : (
                          product.category ?? "-"
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
                            <span
                              className={`inline-flex min-w-[2.7rem] items-center justify-center rounded-full border border-[var(--line)] px-2.5 py-0.5 text-2xl font-bold leading-none ${
                                low ? "bg-red-100 text-red-800" : "bg-white text-[var(--foreground)]"
                              }`}
                            >
                              {product.stock}
                            </span>
                            <p className="mt-1 text-xs text-[var(--muted)]">Min: {product.min_stock}</p>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center align-middle whitespace-nowrap">
                        {isEditing ? (
                          <input
                            className="field text-center"
                            value={editProduct.location}
                            onChange={(event) =>
                              setEditProduct((prev) => ({
                                ...prev,
                                location: event.target.value,
                              }))
                            }
                            placeholder="Ubicación"
                          />
                        ) : (
                          product.location ?? "-"
                        )}
                      </td>
                      <td className="px-4 py-2 align-middle">
                        {isEditing ? (
                          <div className="flex flex-col items-center gap-2">
                            <button
                              type="button"
                              className="btn btn-primary min-w-[8rem] text-center"
                              disabled={savingEdit}
                              onClick={() => void saveEditProduct(product.id)}
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              className="btn min-w-[8rem] text-center"
                              onClick={cancelEditProduct}
                            >
                              Cancelar
                            </button>
                            <button
                              type="button"
                              className="btn min-w-[8rem] text-center"
                              onClick={() => setManagingPhotosProductId(product.id)}
                            >
                              Gestionar fotos
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-wrap justify-center gap-2">
                            <button
                              type="button"
                              className="btn flex h-12 w-12 items-center justify-center p-0"
                              title="Editar"
                              onClick={() => startEditProduct(product)}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-7 w-7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M12 20h9"></path>
                                <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"></path>
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger flex h-12 w-12 items-center justify-center p-0"
                              title="Eliminar"
                              onClick={() => void deleteProduct(product.id)}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-7 w-7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"></path>
                                <path d="m19 6-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                            <button
                              type="button"
                              className="btn flex h-12 w-12 items-center justify-center p-0"
                              title="Gestionar fotos"
                              onClick={() => setManagingPhotosProductId(product.id)}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-7 w-7"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <rect x="3" y="6" width="18" height="12" rx="2"></rect>
                                <circle cx="9" cy="12" r="1.5"></circle>
                                <path d="m21 15-4-4-5 5"></path>
                                <path d="M12 10v4"></path>
                                <path d="M10 12h4"></path>
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!visibleProducts.length && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-[var(--muted)]">
                      No hay productos para el filtro seleccionado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </article>

        <article
          className="panel flex min-h-[560px] flex-col overflow-hidden"
          ref={movementsSectionRef}
        >
          <div className="border-b border-[var(--line)] p-4">
            <h2 className="text-lg font-semibold">Historial de movimientos</h2>
          </div>
          <div className="flex-1 overflow-x-auto">
            <div className="space-y-3 p-3 sm:hidden">
              {movements.map((movement) => {
                const isEditing = editingMovementId === movement.id;
                return (
                  <div
                    key={movement.id}
                    data-movement-anchor={movement.id}
                    className={`rounded-lg border p-3 ${
                      highlightMovementId === movement.id
                        ? "border-amber-400 bg-amber-50"
                        : "border-[var(--line)]"
                    }`}
                  >
                    <p className="text-xs text-[var(--muted)]">
                      {new Date(movement.created_at).toLocaleString()}
                    </p>
                    <p className="font-semibold">
                      {movement.products?.code} - {movement.products?.name}
                    </p>
                    <p className="text-sm">Tipo: {movement.type === "EXIT" ? "Salida" : "Entrada"}</p>
                    <p className="text-sm">Cantidad: {movement.quantity}</p>
                    <p className="text-sm">Uso: {movement.reason}</p>
                    <p className="text-sm">Responsable: {movement.requested_by ?? "-"}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
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
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
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
                        <input
                          className="field"
                          value={editMovement.reason}
                          onChange={(event) =>
                            setEditMovement((prev) => ({ ...prev, reason: event.target.value }))
                          }
                        />
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
                        <div className="flex gap-2">
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
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <table className="hidden min-w-full text-sm sm:table">
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
                    <tr
                      key={movement.id}
                      data-movement-anchor={movement.id}
                      className={`border-t ${
                        highlightMovementId === movement.id ? "bg-amber-50" : "border-[var(--line)]"
                      }`}
                    >
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

      <section className="mt-5 panel overflow-hidden">
        <div className="border-b border-[var(--line)] p-4">
          <h2 className="text-lg font-semibold">Auditoria de acciones</h2>
          <p className="text-xs text-[var(--muted)]">
            Registro de quien modifica, elimina o crea datos, con fecha y hora.
          </p>
        </div>
        <div className="overflow-x-auto">
          <div className="space-y-2 p-3 sm:hidden">
            {auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-[var(--line)] p-3">
                <p className="text-xs text-[var(--muted)]">{new Date(log.created_at).toLocaleString()}</p>
                <p className="text-sm">Usuario: {log.actor_email ?? "-"}</p>
                <p className="text-sm">Accion: {actionLabel(log.action)}</p>
                <p className="text-sm">Entidad: {log.entity_type}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{auditSummary(log)}</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const ok = goToAuditTarget(log);
                      if (!ok) {
                        setSelectedAudit(log);
                      }
                    }}
                  >
                    Ver resumen
                  </button>
                  {movementDeleteMode ? (
                    <button
                      type="button"
                      className="btn btn-danger"
                      title="Eliminar registro de auditoria"
                      onClick={() => void deleteAuditLog(log.id)}
                    >
                      Eliminar
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <table className="hidden min-w-full text-sm sm:table">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Usuario</th>
                <th className="px-3 py-2 text-left">Accion</th>
                <th className="px-3 py-2 text-left">Resumen</th>
                <th className="px-3 py-2 text-left">Entidad</th>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Detalle</th>
                {movementDeleteMode ? <th className="px-3 py-2 text-left">Eliminar</th> : null}
              </tr>
            </thead>
            <tbody>
              {auditLogs.map((log) => (
                <tr key={log.id} className="border-t border-[var(--line)]">
                  <td className="px-3 py-2 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{log.actor_email ?? "-"}</td>
                  <td className="px-3 py-2">{actionLabel(log.action)}</td>
                  <td className="px-3 py-2">{auditSummary(log)}</td>
                  <td className="px-3 py-2">{log.entity_type}</td>
                  <td className="px-3 py-2 text-xs">{log.entity_id ?? "-"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        const ok = goToAuditTarget(log);
                        if (!ok) {
                          setSelectedAudit(log);
                        }
                      }}
                    >
                      Ver
                    </button>
                  </td>
                  {movementDeleteMode ? (
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="btn btn-danger"
                        title="Eliminar registro de auditoria"
                        onClick={() => void deleteAuditLog(log.id)}
                      >
                        Eliminar
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
              {!auditLogs.length && !loading ? (
                <tr>
                  <td
                    colSpan={movementDeleteMode ? 8 : 7}
                    className="px-3 py-4 text-center text-[var(--muted)]"
                  >
                    Aun no hay registros de auditoria.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {managingPhotosProduct ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setManagingPhotosProductId(null)}
        >
          <div
            className="panel flex max-h-[88vh] w-full max-w-4xl flex-col bg-white p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">Gestionar fotos</h3>
                <p className="text-sm text-[var(--muted)]">{managingPhotosProduct.name}</p>
              </div>
              <button type="button" className="btn" onClick={() => setManagingPhotosProductId(null)}>
                Cerrar
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1">
              <div className="rounded-lg border border-[var(--line)] p-3">
                <p className="mb-2 text-sm font-semibold">Agregar nuevas fotos</p>
                <label className="btn cursor-pointer">
                  {uploadingImageProductId === managingPhotosProduct.id ? "Subiendo..." : "Seleccionar fotos"}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    multiple
                    disabled={uploadingImageProductId === managingPhotosProduct.id}
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      event.target.value = "";
                      void addImagesToProduct(managingPhotosProduct.id, files);
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(managingPhotosProduct.product_images ?? []).map((image, index) => {
                  const imageUrl = getImageUrl(image.path);
                  const busy = photoBusyImageId === image.id;
                  return (
                    <div key={image.id} className="rounded-lg border border-[var(--line)] p-2">
                      <button
                        type="button"
                        className="group relative block w-full"
                        onClick={() =>
                          openImageViewer(
                            (managingPhotosProduct.product_images ?? []).map((item) => item.path),
                            index,
                          )
                        }
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imageUrl}
                          alt={`${managingPhotosProduct.name} ${index + 1}`}
                          className="h-40 w-full rounded-lg border border-[var(--line)] object-cover"
                        />
                        <span className="absolute inset-0 hidden items-center justify-center rounded-lg bg-black/35 text-white group-hover:flex">
                          Ver
                        </span>
                      </button>
                      <p className="mt-2 truncate text-xs text-[var(--muted)]">{image.path}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <label className="btn cursor-pointer">
                          {busy ? "Procesando..." : "Reemplazar"}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            disabled={busy}
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              event.target.value = "";
                              void replaceProductImage(managingPhotosProduct.id, image.id, file);
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={busy}
                          onClick={() => void deleteProductImage(managingPhotosProduct.id, image.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!(managingPhotosProduct.product_images ?? []).length ? (
                <p className="text-sm text-[var(--muted)]">Este producto todavia no tiene fotos.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedAudit ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"
          onClick={() => setSelectedAudit(null)}
        >
          <div
            className="panel w-full max-w-2xl bg-white p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">Resumen de accion</h3>
                <p className="text-xs text-[var(--muted)]">
                  {new Date(selectedAudit.created_at).toLocaleString()}
                </p>
              </div>
              <button type="button" className="btn" onClick={() => setSelectedAudit(null)}>
                Cerrar
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <p>
                <b>Usuario:</b> {selectedAudit.actor_email ?? "-"}
              </p>
              <p>
                <b>Accion:</b> {actionLabel(selectedAudit.action)}
              </p>
              <p>
                <b>Resumen:</b> {auditSummary(selectedAudit)}
              </p>
              <p>
                <b>Entidad:</b> {selectedAudit.entity_type}
              </p>
              {(() => {
                const productId = getAuditProductId(selectedAudit);
                if (!productId) return null;
                const product = productsById.get(productId);
                return (
                  <p>
                    <b>Producto:</b>{" "}
                    {product ? `${product.code} - ${product.name}` : `ID ${productId}`}
                  </p>
                );
              })()}
              {(() => {
                const movementId = getAuditMovementId(selectedAudit);
                if (!movementId) return null;
                const movement = movementsById.get(movementId);
                return (
                  <p>
                    <b>Movimiento:</b>{" "}
                    {movement
                      ? `${movement.type} (${movement.quantity}) - ${movement.reason}`
                      : `ID ${movementId}`}
                  </p>
                );
              })()}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {getAuditProductId(selectedAudit) ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const productId = getAuditProductId(selectedAudit);
                    if (!productId) return;
                    setSelectedAudit(null);
                    focusProduct(productId);
                  }}
                >
                  Ver producto relacionado
                </button>
              ) : null}
              {getAuditMovementId(selectedAudit) ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const movementId = getAuditMovementId(selectedAudit);
                    if (!movementId) return;
                    setSelectedAudit(null);
                    focusMovement(movementId);
                  }}
                >
                  Ver movimiento relacionado
                </button>
              ) : null}
            </div>

            <div className="mt-4 rounded-lg border border-[var(--line)] bg-slate-50 p-3 text-xs">
              <p className="mb-1 font-semibold">Detalle tecnico (JSON)</p>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap break-words">
                {JSON.stringify(selectedAudit.detail ?? {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      ) : null}

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
