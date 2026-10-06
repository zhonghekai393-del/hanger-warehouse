"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";

type Detail = { id: string; product_name: string; model: string; sku: string; color?: string; size?: string; unit: string; packSize: number; minimumStock: number; quantity: number; movements: Array<Record<string, string | number | null>> };

export default function VariantDetailPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => { fetch(`/api/variants/${params.id}/detail`).then((response) => response.json()).then((body) => setDetail(body.data)).catch(() => undefined); }, [params.id]);
  if (!detail) return <div className="loading-state">正在读取型号...</div>;
  const status = detail.quantity === 0 ? "OUT" : detail.quantity <= detail.minimumStock ? "LOW" : "NORMAL";
  return <div className="page-stack"><Link className="back-link" href="/inventory">← 返回库存</Link><div className="detail-header"><div><p className="eyebrow">{detail.product_name}</p><h1>{detail.model}</h1><p>{detail.sku}{detail.color ? ` · ${detail.color}` : ""}{detail.size ? ` · ${detail.size}` : ""}</p></div><StatusBadge status={status} /></div><section className="stock-hero"><span>当前库存</span><strong>{detail.quantity.toLocaleString()} <small>{detail.unit}</small></strong><p>约 {Math.floor(detail.quantity / detail.packSize).toLocaleString()} 箱 · {detail.packSize} 个/箱</p></section><div className="action-grid compact-actions"><Link className="action-button action-in" href="/stock/in"><span>＋</span><strong>入库</strong></Link><Link className="action-button action-out" href="/stock/out"><span>−</span><strong>出库</strong></Link><Link className="action-button action-adjust" href="/stock/adjust"><span>≠</span><strong>调整</strong></Link></div><section className="content-panel"><div className="section-heading"><h2>最近流水</h2><Link href="/movements">查看全部</Link></div>{!detail.movements.length ? <div className="empty-state compact"><span>还没有流水记录。</span></div> : <div className="movement-list">{detail.movements.map((movement) => <div className="movement-row" key={String(movement.id)}><div className="movement-title"><strong>{movement.type === "IN" ? "入库" : movement.type === "OUT" ? "出库" : "调整"}</strong><span>{String(movement.createdAt || "").slice(0, 16).replace("T", " ")}</span></div><div className="movement-delta">{Number(movement.quantity) >= 0 ? "+" : ""}{Number(movement.quantity).toLocaleString()}</div><div className="movement-meta"><span>{String(movement.beforeQuantity)} → {String(movement.afterQuantity)}</span><span>{String(movement.operator || "")}</span></div></div>)}</div>}</section></div>;
}
