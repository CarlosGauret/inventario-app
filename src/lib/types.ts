export type MovementType = "ENTRY" | "EXIT";

export type Product = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  location: string | null;
  stock: number;
  min_stock: number;
  active: boolean;
  created_at: string;
  product_images?: { id: string; path: string; created_at?: string }[];
};

export type Movement = {
  id: string;
  product_id: string;
  type: MovementType;
  quantity: number;
  reason: string;
  requested_by: string | null;
  notes: string | null;
  created_at: string;
  products?: {
    code: string;
    name: string;
  } | null;
};

export type AuditLog = {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};
