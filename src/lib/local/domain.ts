import { calculateMovement, getStockStatus } from "@/src/lib/inventory/rules";
import { LocalDataError } from "@/src/lib/local/errors";
import type { ApplyMovementInput, AppliedMovement, DashboardMetrics, LocalMovement, LocalState } from "@/src/lib/local/types";

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function movementSort(a: LocalMovement, b: LocalMovement): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function dayInShanghai(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function applyMovementToState(state: LocalState, input: ApplyMovementInput): AppliedMovement {
  const variant = state.variants.find((item) => item.id === input.variantId);
  if (!variant) throw new LocalDataError("LOCAL_VARIANT_NOT_FOUND", "商品型号不存在");
  if (!variant.isActive) throw new LocalDataError("LOCAL_VARIANT_NOT_FOUND", "型号已停用");
  const warehouse = state.warehouses.find((item) => item.id === input.warehouseId);
  if (!warehouse) throw new LocalDataError("LOCAL_WAREHOUSE_NOT_FOUND", "仓库不存在");
  if (!warehouse.isActive) throw new LocalDataError("LOCAL_WAREHOUSE_NOT_FOUND", "仓库已停用");

  const current = state.inventory.find((item) => item.variantId === input.variantId && item.warehouseId === input.warehouseId);
  const beforeQuantity = current?.quantity ?? 0;
  const calculation = calculateMovement({
    type: input.type,
    currentQuantity: beforeQuantity,
    inputQuantity: input.inputQuantity,
    inputUnit: input.inputUnit,
    baseUnit: variant.unit,
    packSize: variant.packSize,
    actualQuantity: input.actualQuantity,
  });
  const id = createId();
  const movement: LocalMovement = {
    id,
    movementNo: `MOV${id.replaceAll("-", "").slice(0, 18).toUpperCase()}`,
    variantId: input.variantId,
    warehouseId: input.warehouseId,
    type: input.type,
    quantity: calculation.delta,
    inputQuantity: calculation.storedInputQuantity,
    inputUnit: calculation.storedInputUnit,
    beforeQuantity,
    afterQuantity: calculation.afterQuantity,
    operator: input.operator,
    remark: input.remark?.trim() || undefined,
    createdAt: input.createdAt,
  };
  const inventory = current
    ? state.inventory.map((item) => item.id === current.id ? { ...item, quantity: calculation.afterQuantity, updatedAt: input.createdAt } : item)
    : [...state.inventory, { id: createId(), variantId: input.variantId, warehouseId: input.warehouseId, quantity: calculation.afterQuantity, updatedAt: input.createdAt }];
  return { state: { ...state, inventory, movements: [...state.movements, movement] }, movement };
}

export function deleteLatestMovementFromState(state: LocalState, movementId: string): LocalState {
  const target = state.movements.find((item) => item.id === movementId);
  if (!target) throw new LocalDataError("LOCAL_VARIANT_NOT_FOUND", "流水不存在");
  const related = state.movements.filter((item) => item.variantId === target.variantId && item.warehouseId === target.warehouseId).sort(movementSort);
  if (related.at(-1)?.id !== target.id) throw new LocalDataError("LOCAL_MOVEMENT_NOT_LATEST", "只能删除最新一条记录，请先删除后面的记录");
  const inventory = state.inventory.map((item) => item.variantId === target.variantId && item.warehouseId === target.warehouseId ? { ...item, quantity: target.beforeQuantity, updatedAt: new Date().toISOString() } : item);
  return { ...state, inventory, movements: state.movements.filter((item) => item.id !== target.id) };
}

export function calculateDashboardMetrics(state: LocalState, now: Date): DashboardMetrics {
  const activeVariants = state.variants.filter((item) => item.isActive);
  const quantities = activeVariants.map((variant) => state.inventory.find((item) => item.variantId === variant.id)?.quantity ?? 0);
  const today = dayInShanghai(now);
  const todayMovements = state.movements.filter((movement) => dayInShanghai(new Date(movement.createdAt)) === today);
  return {
    skuCount: activeVariants.length,
    totalQuantity: quantities.reduce((sum, quantity) => sum + quantity, 0),
    todayIn: todayMovements.filter((movement) => movement.type === "IN").reduce((sum, movement) => sum + movement.quantity, 0),
    todayOut: todayMovements.filter((movement) => movement.type === "OUT").reduce((sum, movement) => sum + Math.abs(movement.quantity), 0),
    lowCount: activeVariants.filter((variant) => {
      const quantity = state.inventory.find((item) => item.variantId === variant.id)?.quantity ?? 0;
      return getStockStatus(quantity, variant.minimumStock) === "LOW";
    }).length,
    outCount: activeVariants.filter((variant) => (state.inventory.find((item) => item.variantId === variant.id)?.quantity ?? 0) === 0).length,
  };
}
