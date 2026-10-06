"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getLocalRepository } from "@/src/lib/local/repository";
import type { InventoryRow } from "@/src/lib/local/types";

type StockType = "IN" | "OUT" | "ADJUSTMENT";
type Warehouse = { id: string; name: string };

export function StockForm({ type }: { type: StockType }) {
  const isAdjustment = type === "ADJUSTMENT";
  const [variants, setVariants] = useState<InventoryRow[]>([]);
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
    let active = true;
    Promise.all([getLocalRepository().listInventory(), getLocalRepository().listWarehouses()]).then(([inventory, warehouseData]) => {
      if (!active) return;
      setVariants(inventory);
      setWarehouses(warehouseData);
      if (warehouseData[0]) setWarehouseId(warehouseData[0].id);
    }).catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "基础数据加载失败"); });
    return () => { active = false; };
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
      const result = await getLocalRepository().applyMovement({ variantId, warehouseId, type, inputQuantity: Number(quantity) || 0, inputUnit: isAdjustment ? selected.unit : unit, actualQuantity: isAdjustment ? Number(quantity) : undefined, remark, operator: "本机用户", createdAt: new Date().toISOString() });
      setSuccess(`操作成功：${result.movement.beforeQuantity.toLocaleString()} → ${result.movement.afterQuantity.toLocaleString()} ${selected.unit}`);
      setVariants(await getLocalRepository().listInventory());
      setQuantity(""); setRemark("");
    } catch (submitError) { setError(submitError instanceof Error ? submitError.message : "库存操作失败"); }
    finally { setSubmitting(false); }
  }

  return <form className="stock-form" onSubmit={submit}>
    <div className="form-section"><label>商品型号<select value={variantId} onChange={(event) => setVariantId(event.target.value)} required><option value="">请选择商品型号</option>{variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.productName} · {variant.model} · {variant.sku}</option>)}</select></label>{selected && <div className="selected-stock"><span>当前库存</span><strong>{selected.quantity.toLocaleString()} {selected.unit}</strong><small>{selected.packSize} 个/箱</small></div>}</div>
    <div className="form-grid"><label>{isAdjustment ? "实际盘点库存" : "数量"}<input inputMode="numeric" min="0" step="1" type="number" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="请输入整数" required /></label>{!isAdjustment && <label>单位<select value={unit} onChange={(event) => setUnit(event.target.value)}><option value="个">个</option><option value="箱">箱</option></select></label>}</div>
    {!isAdjustment && selected && <p className="conversion-note">本次{type === "IN" ? "入库" : "出库"}：{preview?.actual?.toLocaleString() || 0} {selected.unit}</p>}
    {preview && <div className={`preview-box ${preview.after < 0 ? "preview-danger" : ""}`}><span>{isAdjustment ? "调整后库存" : type === "IN" ? "入库后库存" : "预计剩余"}</span><strong>{preview.after.toLocaleString()} {selected?.unit}</strong></div>}
    {isAdjustment && <label>调整原因<textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="例如：盘点差异、损耗、损坏" rows={3} required /></label>}
    {!isAdjustment && <label>备注（可选）<textarea value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="例如：门店出货" rows={3} /></label>}
    {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="form-success" role="status">{success}</p>}
    <div className="form-actions"><button className="primary-button" disabled={submitting} type="submit">{submitting ? "提交中..." : isAdjustment ? "确认调整" : type === "IN" ? "确认入库" : "确认出库"}</button><Link className="outline-button" href="/inventory">取消</Link></div>
  </form>;
}
