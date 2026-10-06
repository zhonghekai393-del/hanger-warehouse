"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type StockType = "IN" | "OUT" | "ADJUSTMENT";
type Variant = { id: string; product_name: string; model: string; sku: string; unit: string; packSize: number; quantity: number };
type Warehouse = { id: string; name: string };

export function StockForm({ type }: { type: StockType }) {
  const isAdjustment = type === "ADJUSTMENT";
  const [variants, setVariants] = useState<Variant[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [variantId, setVariantId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("个");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([fetch("/api/variants").then((response) => response.json()), fetch("/api/warehouses").then((response) => response.json())]).then(([variantBody, warehouseBody]) => {
      setVariants(variantBody.data || []);
      setWarehouses(warehouseBody.data || []);
      if (warehouseBody.data?.[0]) setWarehouseId(warehouseBody.data[0].id);
    }).catch(() => setError("基础数据加载失败"));
  }, []);

  const selected = variants.find((variant) => variant.id === variantId);
  const preview = useMemo(() => {
    if (!selected || !quantity || !/^\d+$/.test(quantity)) return null;
    const entered = Number(quantity);
    const actual = isAdjustment ? entered : entered * (unit === "箱" ? selected.packSize : 1);
    const delta = type === "OUT" ? -actual : isAdjustment ? actual - selected.quantity : actual;
    return { actual, delta, after: selected.quantity + delta };
  }, [isAdjustment, quantity, selected, type, unit]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(""); setSuccess("");
    if (!selected || !warehouseId) { setError("请选择商品型号和仓库"); return; }
    if (isAdjustment && !remark.trim()) { setError("库存调整必须填写原因"); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/stock/movements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ variantId, warehouseId, type, inputQuantity: Number(quantity) || 0, inputUnit: isAdjustment ? selected.unit : unit, actualQuantity: isAdjustment ? Number(quantity) : undefined, remark }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "库存操作失败");
      setSuccess(`操作成功：${body.data.beforeQuantity.toLocaleString()} → ${body.data.afterQuantity.toLocaleString()} ${selected.unit}`);
      setQuantity(""); setRemark("");
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "库存操作失败"); }
    finally { setSubmitting(false); }
  }

  return <form className="stock-form" onSubmit={submit}>
    <div className="form-section"><label>商品型号<select value={variantId} onChange={(event) => setVariantId(event.target.value)} required><option value="">请选择 SKU</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.product_name} · {variant.model} · {variant.sku}</option>)}</select></label>{selected && <div className="selected-stock"><span>当前库存</span><strong>{selected.quantity.toLocaleString()} {selected.unit}</strong><small>{selected.packSize} 个/箱</small></div>}</div>
    <div className="form-grid"><label>{isAdjustment ? "实际盘点库存" : "数量"}<input inputMode="numeric" min="0" step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="请输入整数" required /></label>{!isAdjustment && <label>单位<select value={unit} onChange={(event) => setUnit(event.target.value)}><option value="个">个</option><option value="箱">箱</option></select></label>}</div>
    {!isAdjustment && selected && <p className="conversion-note">本次{type === "IN" ? "入库" : "出库"}：{preview?.actual?.toLocaleString() || 0} {selected.unit}</p>}
    {preview && <div className={`preview-box ${preview.after < 0 ? "preview-danger" : ""}`}><span>{isAdjustment ? "调整后库存" : type === "IN" ? "入库后库存" : "预计剩余"}</span><strong>{preview.after.toLocaleString()} {selected?.unit}</strong></div>}
    {isAdjustment && <label>调整原因<textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="例如：盘点差异、损耗、损坏" rows={3} required /></label>}
    {!isAdjustment && <label>备注（可选）<textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="例如：门店出货" rows={3} /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
    <div className="form-actions"><button className="primary-button" disabled={submitting} type="submit">{submitting ? "提交中..." : isAdjustment ? "确认调整" : type === "IN" ? "确认入库" : "确认出库"}</button><Link className="outline-button" href="/inventory">取消</Link></div>
  </form>;
}
