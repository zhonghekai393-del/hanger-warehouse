import { withTransaction } from "@/src/lib/db";
import { getStockStatus, calculateMovement } from "@/src/lib/inventory/rules";
import type { StockMovementAction } from "@/src/lib/inventory/types";
import { StockMovementError } from "@/src/lib/inventory/errors";

export type ApplyStockMovementInput = {
  variantId: string;
  warehouseId: string;
  type: StockMovementAction;
  inputQuantity: number;
  inputUnit: string;
  actualQuantity?: number;
  operatorId: string;
  remark?: string;
};

export type StockMovementResult = {
  movementId: string;
  movementNo: string;
  beforeQuantity: number;
  delta: number;
  afterQuantity: number;
  status: "NORMAL" | "LOW" | "OUT";
};

export async function applyStockMovement(input: ApplyStockMovementInput): Promise<StockMovementResult> {
  return withTransaction(async (client) => {
    const inventory = await client.query<{
      inventory_id: string;
      current_quantity: number;
      unit: string;
      pack_size: number;
      minimum_stock: number;
    }>(
      `SELECT i.id AS inventory_id, i.quantity AS current_quantity,
              pv.unit, pv.pack_size, pv.minimum_stock
       FROM inventory i
       JOIN product_variants pv ON pv.id = i.variant_id
       WHERE i.variant_id = $1 AND i.warehouse_id = $2 AND pv.is_active = true
       FOR UPDATE OF i`,
      [input.variantId, input.warehouseId],
    );
    if (!inventory.rowCount) {
      throw new StockMovementError("INVENTORY_NOT_FOUND", "找不到启用的 SKU 库存记录");
    }

    const row = inventory.rows[0];
    let calculation;
    try {
      calculation = calculateMovement({
        type: input.type,
        currentQuantity: row.current_quantity,
        inputQuantity: input.inputQuantity,
        inputUnit: input.inputUnit,
        baseUnit: row.unit,
        packSize: row.pack_size,
        actualQuantity: input.actualQuantity,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("库存不足")) {
        throw new StockMovementError("INSUFFICIENT_STOCK", error.message);
      }
      throw new StockMovementError("INVALID_MOVEMENT", error instanceof Error ? error.message : "库存操作无效");
    }

    const movementNoResult = await client.query<{ movement_no: string }>(
      `SELECT 'MOV' || to_char(now() AT TIME ZONE 'Asia/Shanghai', 'YYYYMMDD') ||
              lpad(nextval('movement_no_seq')::text, 6, '0') AS movement_no`,
    );
    const movementNo = movementNoResult.rows[0].movement_no;
    const movement = await client.query<{ id: string }>(
      `INSERT INTO stock_movements
         (movement_no, variant_id, warehouse_id, type, quantity, input_quantity,
          input_unit, before_quantity, after_quantity, operator_id, remark)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        movementNo,
        input.variantId,
        input.warehouseId,
        input.type,
        calculation.delta,
        calculation.storedInputQuantity,
        calculation.storedInputUnit,
        row.current_quantity,
        calculation.afterQuantity,
        input.operatorId,
        input.remark?.trim() || null,
      ],
    );
    await client.query(
      "UPDATE inventory SET quantity = $1, updated_at = now() WHERE id = $2",
      [calculation.afterQuantity, row.inventory_id],
    );

    return {
      movementId: movement.rows[0].id,
      movementNo,
      beforeQuantity: row.current_quantity,
      delta: calculation.delta,
      afterQuantity: calculation.afterQuantity,
      status: getStockStatus(calculation.afterQuantity, row.minimum_stock),
    };
  });
}
