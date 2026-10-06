import type { StockMovementAction } from "@/src/lib/inventory/types";

export type LocalMovementType = StockMovementAction | "INITIAL" | "COUNT";

export type LocalProduct = {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type ProductListItem = LocalProduct & { variantCount: number };

export type LocalVariant = {
  id: string;
  productId: string;
  model: string;
  sku: string;
  barcode?: string;
  color?: string;
  size?: string;
  material?: string;
  unit: string;
  packSize: number;
  minimumStock: number;
  remark?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
};

export type LocalWarehouse = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type LocalInventory = {
  id: string;
  variantId: string;
  warehouseId: string;
  quantity: number;
  updatedAt: string;
};

export type LocalMovement = {
  id: string;
  movementNo: string;
  variantId: string;
  warehouseId: string;
  type: LocalMovementType;
  quantity: number;
  inputQuantity: number;
  inputUnit: string;
  beforeQuantity: number;
  afterQuantity: number;
  operator: string;
  remark?: string;
  createdAt: string;
};

export type LocalSetting = { key: string; value: string };

export type LocalState = {
  products: LocalProduct[];
  variants: LocalVariant[];
  warehouses: LocalWarehouse[];
  inventory: LocalInventory[];
  movements: LocalMovement[];
  settings: LocalSetting[];
};

export type ApplyMovementInput = {
  variantId: string;
  warehouseId: string;
  type: StockMovementAction;
  inputQuantity: number;
  inputUnit: string;
  actualQuantity?: number;
  remark?: string;
  operator: string;
  createdAt: string;
};

export type AppliedMovement = { state: LocalState; movement: LocalMovement };

export type CreateVariantInput = {
  productId: string;
  model: string;
  sku: string;
  barcode?: string;
  color?: string;
  size?: string;
  material?: string;
  unit?: string;
  packSize: number;
  minimumStock: number;
  remark?: string;
};

export type InventoryRow = {
  id: string;
  productId: string;
  productName: string;
  model: string;
  sku: string;
  barcode?: string;
  color?: string;
  size?: string;
  unit: string;
  packSize: number;
  minimumStock: number;
  quantity: number;
};

export type MovementRow = LocalMovement & {
  productName: string;
  model: string;
  sku: string;
};

export type VariantDetail = LocalVariant & {
  productName: string;
  quantity: number;
  movements: MovementRow[];
};

export type DashboardMetrics = {
  skuCount: number;
  totalQuantity: number;
  todayIn: number;
  todayOut: number;
  lowCount: number;
  outCount: number;
};

export type LocalSnapshot = LocalState & {
  format: "hanger-warehouse-local";
  version: 1;
  exportedAt: string;
};

export type ImportSummary = {
  products: number;
  variants: number;
  inventory: number;
  movements: number;
};
