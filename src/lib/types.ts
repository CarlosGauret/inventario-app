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
  product_images?: { path: string }[];
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

