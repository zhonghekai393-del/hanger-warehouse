import { NextResponse } from "next/server";
import { withTransaction } from "@/src/lib/db";
import { requireAdmin, requireUser } from "@/src/lib/auth/guard";
import { errorResponse, jsonError } from "@/src/lib/api/http";
import { getMovements } from "@/src/lib/queries/movements";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const params = new URL(request.url).searchParams;
    const type = params.get("type");
    const allowedType = type === "IN" || type === "OUT" || type === "ADJUSTMENT" ? type : undefined;
    return NextResponse.json({
      data: await getMovements({
        from: params.get("from") || undefined,
        to: params.get("to") || undefined,
        type: allowedType,
        productId: params.get("productId") || undefined,
        variantId: params.get("variantId") || undefined,
        operatorId: params.get("operatorId") || undefined,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) return jsonError("缺少流水记录编号");

    const result = await withTransaction(async (client) => {
      const movement = await client.query<{
        id: string;
        variant_id: string;
        warehouse_id: string;
        quantity: number;
        before_quantity: number;
        after_quantity: number;
        current_quantity: number;
        inventory_id: string;
      }>(
        `SELECT sm.id, sm.variant_id, sm.warehouse_id, sm.quantity,
                sm.before_quantity, sm.after_quantity,
                i.quantity AS current_quantity, i.id AS inventory_id
         FROM stock_movements sm
         JOIN inventory i ON i.variant_id = sm.variant_id AND i.warehouse_id = sm.warehouse_id
         WHERE sm.id = $1
         FOR UPDATE OF sm, i`,
        [id],
      );
      if (!movement.rowCount) return { kind: "NOT_FOUND" as const };

      const row = movement.rows[0];
      const latest = await client.query<{ id: string }>(
        `SELECT id
         FROM stock_movements
         WHERE variant_id = $1 AND warehouse_id = $2
         ORDER BY created_at DESC, movement_no DESC
         LIMIT 1`,
        [row.variant_id, row.warehouse_id],
      );
      if (latest.rows[0]?.id !== row.id) return { kind: "NOT_LATEST" as const };
      if (row.current_quantity !== row.after_quantity) return { kind: "BALANCE_MISMATCH" as const };

      await client.query("DELETE FROM stock_movements WHERE id = $1", [id]);
      await client.query("UPDATE inventory SET quantity = $1, updated_at = now() WHERE id = $2", [row.before_quantity, row.inventory_id]);
      return { kind: "DELETED" as const, quantity: row.before_quantity };
    });

    if (result.kind === "NOT_FOUND") return jsonError("流水记录不存在", 404, "NOT_FOUND");
    if (result.kind === "NOT_LATEST") return jsonError("为了保持库存余额连续，只能删除该型号最新一条记录", 409, "NOT_LATEST_MOVEMENT");
    if (result.kind === "BALANCE_MISMATCH") return jsonError("当前库存与流水余额不一致，不能删除这条记录", 409, "BALANCE_MISMATCH");
    return NextResponse.json({ data: { id, isDeleted: true, restoredQuantity: result.quantity } });
  } catch (error) {
    return errorResponse(error);
  }
}
