import type { MovementCalculation, StockMovementAction } from "@/src/lib/inventory/types";

function assertInteger(value: number, label: string, allowZero = false) {
  if (!Number.isInteger(value) || (allowZero ? value < 0 : value <= 0)) {
    throw new Error(`${label}必须是${allowZero ? "非负" : "正"}整数`);
  }
}

export function convertInputToBaseUnits(input: {
  quantity: number;
  unit: string;
  baseUnit: string;
  packSize: number;
}): number {
  assertInteger(input.quantity, "数量");
  assertInteger(input.packSize, "包装规格");
  if (input.unit === input.baseUnit) return input.quantity;
  if (input.unit !== "箱") throw new Error("不支持的库存单位");
  return input.quantity * input.packSize;
}

export function calculateMovement(input: {
  type: StockMovementAction;
  currentQuantity: number;
  inputQuantity: number;
  inputUnit: string;
  baseUnit: string;
  packSize: number;
  actualQuantity?: number;
}): MovementCalculation {
  assertInteger(input.currentQuantity, "当前库存", true);

  if (input.type === "ADJUSTMENT") {
    if (input.actualQuantity === undefined) throw new Error("调整必须提供实际库存");
    assertInteger(input.actualQuantity, "实际库存", true);
    const delta = input.actualQuantity - input.currentQuantity;
    if (delta === 0) throw new Error("没有库存差异");
    return {
      delta,
      afterQuantity: input.actualQuantity,
      storedInputQuantity: input.actualQuantity,
      storedInputUnit: input.baseUnit,
    };
  }

  const baseQuantity = convertInputToBaseUnits({
    quantity: input.inputQuantity,
    unit: input.inputUnit,
    baseUnit: input.baseUnit,
    packSize: input.packSize,
  });
  const delta = input.type === "IN" ? baseQuantity : -baseQuantity;
  const afterQuantity = input.currentQuantity + delta;
  if (afterQuantity < 0) throw new Error(`库存不足，当前可用库存 ${input.currentQuantity} 个`);
  return {
    delta,
    afterQuantity,
    storedInputQuantity: input.inputQuantity,
    storedInputUnit: input.inputUnit,
  };
}

export function getStockStatus(quantity: number, minimumStock: number): "NORMAL" | "LOW" | "OUT" {
  if (quantity === 0) return "OUT";
  if (quantity <= minimumStock) return "LOW";
  return "NORMAL";
}
