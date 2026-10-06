import { calculateDashboardMetrics, applyMovementToState, deleteLatestMovementFromState } from "@/src/lib/local/domain";
import { getImportSummary, validateLocalSnapshot } from "@/src/lib/local/backup";
import { defaultWarehouse } from "@/src/lib/local/config";
import { LocalDataError } from "@/src/lib/local/errors";
import { openLocalDatabase, readLocalState, replaceLocalState, runLocalStateTransaction } from "@/src/lib/local/indexed-db";
import type { ApplyMovementInput, AppliedMovement, CreateVariantInput, DashboardMetrics, ImportSummary, InventoryRow, LocalMovementType, LocalProduct, LocalSnapshot, LocalState, LocalVariant, MovementRow, ProductListItem, VariantDetail } from "@/src/lib/local/types";

export interface LocalRepository {
  initialize(): Promise<void>;
  listProducts(): Promise<ProductListItem[]>;
  getProductWithVariants(id: string): Promise<{ product: LocalProduct; variants: VariantDetail[] } | null>;
  createProduct(input: { name: string; description?: string }): Promise<LocalProduct>;
  disableProduct(id: string): Promise<void>;
  listVariants(productId?: string, includeInactive?: boolean): Promise<LocalVariant[]>;
  createVariant(input: CreateVariantInput): Promise<LocalVariant>;
  disableVariant(id: string): Promise<void>;
  listWarehouses(): Promise<LocalState["warehouses"]>;
  listInventory(query?: string): Promise<InventoryRow[]>;
  getVariantDetail(id: string): Promise<VariantDetail | null>;
  getDashboardMetrics(now?: Date): Promise<DashboardMetrics>;
  applyMovement(input: ApplyMovementInput): Promise<AppliedMovement>;
  listMovements(type?: Extract<LocalMovementType, "IN" | "OUT" | "ADJUSTMENT">): Promise<MovementRow[]>;
  deleteMovement(id: string): Promise<void>;
  exportSnapshot(): Promise<LocalSnapshot>;
  importSnapshot(value: unknown): Promise<ImportSummary>;
}

let repository: LocalRepository | null = null;

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureName(name: string): string {
  const value = name.trim();
  if (!value) throw new LocalDataError("LOCAL_STORAGE_ERROR", "名称不能为空");
  return value;
}

function rowsForMovements(state: LocalState, movements = state.movements): MovementRow[] {
  return movements
    .map((movement) => {
      const variant = state.variants.find((item) => item.id === movement.variantId);
      const product = variant ? state.products.find((item) => item.id === variant.productId) : undefined;
      if (!variant || !product) return null;
      return { ...movement, productName: product.name, model: variant.model, sku: variant.sku };
    })
    .filter((row): row is MovementRow => Boolean(row))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

function detailForVariant(state: LocalState, variant: LocalVariant): VariantDetail | null {
  const product = state.products.find((item) => item.id === variant.productId);
  if (!product) return null;
  const inventory = state.inventory.find((item) => item.variantId === variant.id && item.warehouseId === defaultWarehouse.id);
  return { ...variant, productName: product.name, quantity: inventory?.quantity ?? 0, movements: rowsForMovements(state, state.movements.filter((item) => item.variantId === variant.id)) };
}

function createRepository(): LocalRepository {
  return {
    async initialize() {
      const database = await openLocalDatabase();
      const state = await readLocalState(database);
      if (state.warehouses.length) return;
      await replaceLocalState(database, { ...state, warehouses: [defaultWarehouse] });
    },

    async listProducts() {
      const state = await readLocalState();
      return state.products.filter((product) => product.isActive).map((product) => ({ ...product, variantCount: state.variants.filter((variant) => variant.productId === product.id && variant.isActive).length }));
    },

    async getProductWithVariants(productId) {
      const state = await readLocalState();
      const product = state.products.find((item) => item.id === productId);
      if (!product) return null;
      return { product, variants: state.variants.filter((variant) => variant.productId === productId && variant.isActive).map((variant) => detailForVariant(state, variant)).filter((row): row is VariantDetail => Boolean(row)) };
    },

    async createProduct(input) {
      const product: LocalProduct = { id: id(), name: ensureName(input.name), description: input.description?.trim() || undefined, isActive: true, createdAt: now() };
      await runLocalStateTransaction((state) => ({ state: { ...state, products: [...state.products, product] }, result: product }));
      return product;
    },

    async disableProduct(productId) {
      await runLocalStateTransaction((state) => {
        if (!state.products.some((product) => product.id === productId)) throw new LocalDataError("LOCAL_PRODUCT_NOT_FOUND", "商品系列不存在");
        return { state: { ...state, products: state.products.map((product) => product.id === productId ? { ...product, isActive: false, updatedAt: now() } : product), variants: state.variants.map((variant) => variant.productId === productId ? { ...variant, isActive: false, updatedAt: now() } : variant) }, result: undefined };
      });
    },

    async listVariants(productId, includeInactive = false) {
      const state = await readLocalState();
      return state.variants.filter((variant) => (!productId || variant.productId === productId) && (includeInactive || variant.isActive));
    },

    async createVariant(input) {
      const variant: LocalVariant = { id: id(), productId: input.productId, model: ensureName(input.model), sku: ensureName(input.sku), barcode: input.barcode?.trim() || undefined, color: input.color?.trim() || undefined, size: input.size?.trim() || undefined, material: input.material?.trim() || undefined, unit: input.unit?.trim() || "个", packSize: input.packSize, minimumStock: input.minimumStock, remark: input.remark?.trim() || undefined, isActive: true, createdAt: now() };
      await runLocalStateTransaction((state) => {
        if (!state.products.some((product) => product.id === input.productId && product.isActive)) throw new LocalDataError("LOCAL_PRODUCT_NOT_FOUND", "商品系列不存在或已停用");
        if (state.variants.some((item) => item.sku === variant.sku)) throw new LocalDataError("LOCAL_STORAGE_ERROR", "货号已存在");
        const timestamp = now();
        return { state: { ...state, variants: [...state.variants, variant], inventory: [...state.inventory, ...state.warehouses.filter((warehouse) => warehouse.isActive).map((warehouse) => ({ id: id(), variantId: variant.id, warehouseId: warehouse.id, quantity: 0, updatedAt: timestamp }))] }, result: variant };
      });
      return variant;
    },

    async disableVariant(variantId) {
      await runLocalStateTransaction((state) => {
        if (!state.variants.some((variant) => variant.id === variantId)) throw new LocalDataError("LOCAL_VARIANT_NOT_FOUND", "商品型号不存在");
        return { state: { ...state, variants: state.variants.map((variant) => variant.id === variantId ? { ...variant, isActive: false, updatedAt: now() } : variant) }, result: undefined };
      });
    },

    async listWarehouses() {
      const state = await readLocalState();
      return state.warehouses.filter((warehouse) => warehouse.isActive);
    },

    async listInventory(query = "") {
      const state = await readLocalState();
      const needle = query.trim().toLowerCase();
      return state.variants.filter((variant) => variant.isActive).flatMap((variant) => {
        const product = state.products.find((item) => item.id === variant.productId);
        if (!product?.isActive) return [];
        const row: InventoryRow = { id: variant.id, productId: product.id, productName: product.name, model: variant.model, sku: variant.sku, barcode: variant.barcode, color: variant.color, size: variant.size, unit: variant.unit, packSize: variant.packSize, minimumStock: variant.minimumStock, quantity: state.inventory.find((item) => item.variantId === variant.id && item.warehouseId === defaultWarehouse.id)?.quantity ?? 0 };
        const searchable = `${row.productName} ${row.model} ${row.sku} ${row.barcode ?? ""}`.toLowerCase();
        return !needle || searchable.includes(needle) ? [row] : [];
      });
    },

    async getVariantDetail(variantId) {
      const state = await readLocalState();
      const variant = state.variants.find((item) => item.id === variantId);
      return variant ? detailForVariant(state, variant) : null;
    },

    async getDashboardMetrics(currentDate = new Date()) {
      return calculateDashboardMetrics(await readLocalState(), currentDate);
    },

    async applyMovement(input) {
      return runLocalStateTransaction((state) => {
        const applied = applyMovementToState(state, input);
        return { state: applied.state, result: applied };
      });
    },

    async listMovements(type) {
      const state = await readLocalState();
      return rowsForMovements(state, type ? state.movements.filter((movement) => movement.type === type) : state.movements);
    },

    async deleteMovement(movementId) {
      await runLocalStateTransaction((state) => ({ state: deleteLatestMovementFromState(state, movementId), result: undefined }));
    },

    async exportSnapshot() {
      return { ...(await readLocalState()), format: "hanger-warehouse-local", version: 1, exportedAt: now() };
    },

    async importSnapshot(value) {
      const snapshot = validateLocalSnapshot(value);
      await replaceLocalState(await openLocalDatabase(), snapshot);
      return getImportSummary(snapshot);
    },
  };
}

export function getLocalRepository(): LocalRepository {
  repository ??= createRepository();
  return repository;
}
