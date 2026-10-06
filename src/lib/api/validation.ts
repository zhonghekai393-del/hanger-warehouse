import { z } from "zod";

const optionalText = z.string().trim().max(200).optional();

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
}).strict();

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  categoryId: z.string().min(1).nullable().optional(),
  description: optionalText,
}).strict();

export const productVariantInputSchema = z.object({
  productId: z.string().min(1),
  model: z.string().trim().min(1).max(100),
  sku: z.string().trim().min(1).max(100),
  barcode: optionalText,
  color: optionalText,
  size: optionalText,
  material: optionalText,
  unit: z.string().trim().min(1).max(20).default("个"),
  packSize: z.number().int().positive(),
  minimumStock: z.number().int().nonnegative(),
  remark: optionalText,
}).strict();

export const movementRequestSchema = z.object({
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  inputQuantity: z.number().int().nonnegative(),
  inputUnit: z.string().trim().min(1).max(20),
  actualQuantity: z.number().int().nonnegative().optional(),
  remark: optionalText,
}).strict().superRefine((value, context) => {
  if (value.type !== "ADJUSTMENT" && value.inputQuantity <= 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["inputQuantity"], message: "数量必须大于 0" });
  }
  if (value.type === "ADJUSTMENT" && value.actualQuantity === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["actualQuantity"], message: "调整必须提供实际库存" });
  }
});
