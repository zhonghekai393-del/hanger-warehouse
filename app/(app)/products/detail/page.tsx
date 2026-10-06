"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { getLocalRepository } from "@/src/lib/local/repository";
import type { VariantDetail } from "@/src/lib/local/types";

export default function ProductDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [product, setProduct] = useState<{ name: string; description?: string } | null>(null);
  const [variants, setVariants] = useState<VariantDetail[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!id) return;
    const data = await getLocalRepository().getProductWithVariants(id);
    if (!data) throw new Error("商品系列不存在");
    setProduct(data.product);
    setVariants(data.variants);
  }

  useEffect(() => {
    let active = true;
    if (!id) return () => { active = false; };
    getLocalRepository().getProductWithVariants(id)
      .then((data) => {
        if (!active) return;
        if (!data) { setError("商品系列不存在"); return; }
        setProduct(data.product);
        setVariants(data.variants);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "商品详情加载失败"); });
    return () => { active = false; };
  }, [id]);

  async function deleteVariant(variant: VariantDetail) {
    if (!window.confirm(`确定删除型号“${variant.model}（${variant.sku}）”吗？历史出入库记录会保留。`)) return;
    setError(""); setMessage("");
    try { await getLocalRepository().disableVariant(variant.id); setMessage(`型号“${variant.model}（${variant.sku}）”已删除`); await load(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "型号删除失败"); }
  }

  return (
    <div className="page-stack">
      <Link className="back-link" href="/products/">← 返回商品型号</Link>
      {product && <div className="page-heading"><div><p className="eyebrow">商品系列</p><h1>{product.name}</h1><p>{product.description || "该系列下的库存型号"}</p></div></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {!product && !error && <div className="loading-state">正在读取商品详情...</div>}
      <div className="variant-grid">{variants.map((variant) => <div className="variant-card" key={variant.id}><Link className="variant-card-link" href={`/products/variant/?id=${variant.id}`}><div><span className="record-kicker">{variant.sku}</span><h2>{variant.model}</h2><p>{variant.color || "未设置颜色"}{variant.size ? ` · ${variant.size}` : ""}</p></div><div className="variant-stock"><strong>{variant.quantity.toLocaleString()}</strong><span>{variant.unit} · {variant.packSize}个/箱</span></div></Link><button className="text-button danger-button" type="button" onClick={() => void deleteVariant(variant)}>删除</button></div>)}{product && !variants.length && <div className="empty-state"><strong>这个系列还没有型号</strong><span>回到商品型号页新增 SKU。</span></div>}</div>
    </div>
  );
}
