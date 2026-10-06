"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getStockStatus } from "@/src/lib/inventory/rules";
import { getLocalRepository } from "@/src/lib/local/repository";
import type { VariantDetail } from "@/src/lib/local/types";
import { StatusBadge } from "@/components/status-badge";

export default function VariantDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [detail, setDetail] = useState<VariantDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    getLocalRepository().getVariantDetail(id).then((data) => { if (data) setDetail(data); else setError("商品型号不存在"); }).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "型号详情加载失败"));
  }, [id]);

  if (error) return <div className="page-stack"><Link className="back-link" href="/inventory/">← 返回库存</Link><p className="form-error" role="alert">{error}</p></div>;
  if (!detail) return <div className="loading-state">正在读取型号...</div>;
  const status = getStockStatus(detail.quantity, detail.minimumStock);

  return (
    <div className="page-stack">
      <Link className="back-link" href="/inventory/">← 返回库存</Link>
      <div className="detail-header"><div><p className="eyebrow">{detail.productName}</p><h1>{detail.model}</h1><p>{detail.sku}{detail.color ? ` · ${detail.color}` : ""}{detail.size ? ` · ${detail.size}` : ""}</p></div><StatusBadge status={status} /></div>
      <section className="stock-hero"><span>当前库存</span><strong>{detail.quantity.toLocaleString()} <small>{detail.unit}</small></strong><p>约 {Math.floor(detail.quantity / detail.packSize).toLocaleString()} 箱 · {detail.packSize} 个/箱</p></section>
      <div className="action-grid compact-actions"><Link className="action-button action-in" href="/stock/in/"><span>＋</span><strong>入库</strong></Link><Link className="action-button action-out" href="/stock/out/"><span>−</span><strong>出库</strong></Link><Link className="action-button action-adjust" href="/stock/adjust/"><span>≠</span><strong>调整</strong></Link></div>
      <section className="content-panel"><div className="section-heading"><h2>最近流水</h2><Link href="/movements/">查看全部</Link></div>{!detail.movements.length ? <div className="empty-state compact"><span>还没有流水记录。</span></div> : <div className="movement-list">{detail.movements.map((movement) => <div className="movement-row" key={movement.id}><div className="movement-title"><strong>{movement.type === "IN" ? "入库" : movement.type === "OUT" ? "出库" : "调整"}</strong><span>{movement.createdAt.slice(0, 16).replace("T", " ")}</span></div><div className="movement-delta">{movement.quantity >= 0 ? "+" : ""}{movement.quantity.toLocaleString()}</div><div className="movement-meta"><span>{movement.beforeQuantity} → {movement.afterQuantity}</span><span>{movement.operator}</span></div></div>)}</div>}</section>
    </div>
  );
}
