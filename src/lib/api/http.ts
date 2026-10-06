import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/src/lib/auth/guard";
import { StockMovementError } from "@/src/lib/inventory/errors";

export function jsonError(message: string, status = 400, code = "BAD_REQUEST") {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof AuthError) return jsonError(error.message, error.status, error.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
  if (error instanceof StockMovementError) {
    const status = error.code === "INSUFFICIENT_STOCK" ? 409 : error.code === "INVENTORY_NOT_FOUND" ? 404 : 400;
    return jsonError(error.message, status, error.code);
  }
  if (error instanceof ZodError) return jsonError("提交的数据格式不正确", 400, "VALIDATION_ERROR");
  console.error("API request failed", error instanceof Error ? error.message : "unknown error");
  return jsonError("服务器暂时无法处理请求", 500, "INTERNAL_ERROR");
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "请求体不是有效 JSON" }]);
  }
}
