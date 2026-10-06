import { LocalDataError } from "@/src/lib/local/errors";
import type { ImportSummary, LocalMovement, LocalProduct, LocalSnapshot, LocalVariant } from "@/src/lib/local/types";

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  throw new LocalDataError("LOCAL_INVALID_BACKUP", message);
}

function records(value: unknown, name: string): RecordValue[] {
  if (!Array.isArray(value)) fail(`备份文件缺少 ${name} 数据`);
  if (!value.every(isRecord)) fail(`${name} 数据格式不正确`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) fail(`${label}不能为空`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") fail(`${label}格式不正确`);
  return value;
}

function integer(value: unknown, label: string, allowNegative = false): number {
  if (typeof value !== "number" || !Number.isInteger(value) || (!allowNegative && value < 0)) fail(`${label}${allowNegative ? "格式不正确" : "不能为负数"}`);
  return value;
}

function unique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) fail(`${label}不能重复`);
}

function validateProduct(row: RecordValue): LocalProduct {
  return { id: text(row.id, "商品系列 ID"), name: text(row.name, "商品系列名称"), description: typeof row.description === "string" ? row.description : undefined, isActive: boolean(row.isActive, "商品系列启用状态"), createdAt: text(row.createdAt, "商品系列创建时间"), updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined };
}

function validateVariant(row: RecordValue): LocalVariant {
  return {
    id: text(row.id, "型号 ID"), productId: text(row.productId, "型号商品系列 ID"), model: text(row.model, "型号名称"), sku: text(row.sku, "货号"),
    barcode: typeof row.barcode === "string" ? row.barcode : undefined, color: typeof row.color === "string" ? row.color : undefined, size: typeof row.size === "string" ? row.size : undefined, material: typeof row.material === "string" ? row.material : undefined,
    unit: text(row.unit, "库存单位"), packSize: integer(row.packSize, "包装规格") || fail("包装规格必须大于 0"), minimumStock: integer(row.minimumStock, "最低库存"), remark: typeof row.remark === "string" ? row.remark : undefined,
    isActive: boolean(row.isActive, "型号启用状态"), createdAt: text(row.createdAt, "型号创建时间"), updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : undefined,
  };
}

function validateMovement(row: RecordValue): LocalMovement {
  const beforeQuantity = integer(row.beforeQuantity, "流水操作前库存");
  const quantity = integer(row.quantity, "流水变动数量", true);
  const afterQuantity = integer(row.afterQuantity, "流水操作后库存");
  if (quantity === 0) fail("流水变动数量不能为 0");
  if (afterQuantity !== beforeQuantity + quantity) fail("流水余额不一致");
  return {
    id: text(row.id, "流水 ID"), movementNo: text(row.movementNo, "流水编号"), variantId: text(row.variantId, "流水型号 ID"), warehouseId: text(row.warehouseId, "流水仓库 ID"),
    type: row.type === "IN" || row.type === "OUT" || row.type === "ADJUSTMENT" || row.type === "INITIAL" || row.type === "COUNT" ? row.type : fail("流水类型不正确"),
    quantity, inputQuantity: integer(row.inputQuantity, "流水输入数量"), inputUnit: text(row.inputUnit, "流水输入单位"), beforeQuantity, afterQuantity,
    operator: text(row.operator, "操作人"), remark: typeof row.remark === "string" ? row.remark : undefined, createdAt: text(row.createdAt, "流水创建时间"),
  };
}

export function validateLocalSnapshot(value: unknown): LocalSnapshot {
  if (!isRecord(value)) fail("备份文件格式不正确");
  if (value.format !== "hanger-warehouse-local") fail("不是衣架仓库备份文件");
  if (value.version !== 1) fail("不支持的备份版本");
  const productRows = records(value.products, "products");
  const variantRows = records(value.variants, "variants");
  const warehouseRows = records(value.warehouses, "warehouses");
  const inventoryRows = records(value.inventory, "inventory");
  const movementRows = records(value.movements, "movements");
  const settingRows = records(value.settings, "settings");
  const products = productRows.map(validateProduct);
  const variants = variantRows.map(validateVariant);
  const warehouses = warehouseRows.map((row) => ({ id: text(row.id, "仓库 ID"), name: text(row.name, "仓库名称"), code: text(row.code, "仓库编码"), isActive: boolean(row.isActive, "仓库启用状态") }));
  const inventory = inventoryRows.map((row) => ({ id: text(row.id, "库存 ID"), variantId: text(row.variantId, "库存型号 ID"), warehouseId: text(row.warehouseId, "库存仓库 ID"), quantity: integer(row.quantity, "库存数量"), updatedAt: text(row.updatedAt, "库存更新时间") }));
  const movements = movementRows.map(validateMovement);
  const settings = settingRows.map((row) => ({ key: text(row.key, "设置名称"), value: text(row.value, "设置内容") }));
  unique(products.map((row) => row.id), "商品系列 ID");
  unique(variants.map((row) => row.id), "型号 ID");
  unique(variants.map((row) => row.sku), "货号");
  unique(warehouses.map((row) => row.id), "仓库 ID");
  unique(inventory.map((row) => row.id), "库存 ID");
  unique(movements.map((row) => row.id), "流水 ID");
  unique(movements.map((row) => row.movementNo), "流水编号");
  const productIds = new Set(products.map((row) => row.id));
  const variantIds = new Set(variants.map((row) => row.id));
  const warehouseIds = new Set(warehouses.map((row) => row.id));
  if (variants.some((row) => !productIds.has(row.productId))) fail("型号关联的商品系列不存在");
  if (inventory.some((row) => !variantIds.has(row.variantId))) fail("库存关联的型号不存在");
  if (inventory.some((row) => !warehouseIds.has(row.warehouseId))) fail("库存关联的仓库不存在");
  if (movements.some((row) => !variantIds.has(row.variantId))) fail("流水关联的型号不存在");
  if (movements.some((row) => !warehouseIds.has(row.warehouseId))) fail("流水关联的仓库不存在");
  return { format: "hanger-warehouse-local", version: 1, exportedAt: text(value.exportedAt, "备份导出时间"), products, variants, warehouses, inventory, movements, settings };
}

export function getImportSummary(snapshot: LocalSnapshot): ImportSummary {
  return { products: snapshot.products.length, variants: snapshot.variants.length, inventory: snapshot.inventory.length, movements: snapshot.movements.length };
}
