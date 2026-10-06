"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Variant = { id: string; model: string; sku: string; color?: string; size?: string; quantity: number; unit: string; packSize: number; minimumStock: number };

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<{ name: string; description?: string } | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { Promise.all([fetch(`/api/products/${params.id}`).then((response) => response.json()), fetch(`/api/variants?productId=${params.id}`).then((response) => response.json())]).then(([productBody, variantBody]) => { setProduct(productBody.data); setVariants(variantBody.data || []); }).catch(() => setError("商品详情加载失败")); }, [params.id]);
  return <div className="page-stack"><Link className="back-link" href="/products">← 返回商品型号</Link>{product && <div className="page-heading"><div><p className="eyebrow">商品系列</p><h1>{product.name}</h1><p>{product.description || "该系列下的库存型号"}</p></div></div>}{error && <p className="form-error">{error}</p>}<div className="variant-grid">{variants.map((variant) => <Link className="variant-card" href={`/products/variant/${variant.id}`} key={variant.id}><div><span className="record-kicker">{variant.sku}</span><h2>{variant.model}</h2><p>{variant.color || "未设置颜色"}{variant.size ? ` · ${variant.size}` : ""}</p></div><div className="variant-stock"><strong>{variant.quantity.toLocaleString()}</strong><span>{variant.unit} · {variant.packSize}个/箱</span></div></Link>)}{!variants.length && <div className="empty-state"><strong>这个系列还没有型号</strong><span>回到商品型号页新增 SKU。</span></div>}</div></div>;
}
