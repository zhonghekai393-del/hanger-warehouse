"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalRepository } from "@/src/lib/local/repository";
import type { ProductListItem } from "@/src/lib/local/types";

export default function ProductsPage() {
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [name, setName] = useState("");
  const [productId, setProductId] = useState("");
  const [model, setModel] = useState("");
  const [sku, setSku] = useState("");
  const [color, setColor] = useState("");
  const [packSize, setPackSize] = useState("100");
  const [minimumStock, setMinimumStock] = useState("0");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadProducts(nextProductId = productId) {
    const data = await getLocalRepository().listProducts();
    setProducts(data);
    if (!nextProductId && data[0]) setProductId(data[0].id);
  }
  useEffect(() => {
    let active = true;
    getLocalRepository().listProducts()
      .then((data) => { if (!active) return; setProducts(data); if (!productId && data[0]) setProductId(data[0].id); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "商品加载失败"); });
    return () => { active = false; };
  }, [productId]);

  async function createProduct(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try { const product = await getLocalRepository().createProduct({ name }); setName(""); setProductId(product.id); setMessage("商品系列已创建"); await loadProducts(product.id); }
    catch (createError) { setError(createError instanceof Error ? createError.message : "商品创建失败"); }
  }
  async function deleteProduct(product: ProductListItem) {
    if (!window.confirm(`确定删除商品系列“${product.name}”吗？该系列下的型号也会从在用列表中隐藏，历史记录会保留。`)) return;
    setError(""); setMessage("");
    try { await getLocalRepository().disableProduct(product.id); setMessage(`商品系列“${product.name}”已删除`); await loadProducts(productId === product.id ? "" : productId); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "商品系列删除失败"); }
  }
  async function createVariant(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    try { await getLocalRepository().createVariant({ productId, model, sku, color, unit: "个", packSize: Number(packSize), minimumStock: Number(minimumStock) }); setModel(""); setSku(""); setColor(""); setMessage("型号已创建，库存余额从 0 开始"); await loadProducts(); }
    catch (createError) { setError(createError instanceof Error ? createError.message : "型号创建失败"); }
  }

  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">基础资料</p><h1>商品型号</h1><p>先建立商品系列，再为每个独立库存型号分配唯一货号。</p></div></div>
    <div className="two-column"><section className="content-panel"><div className="section-heading"><h2>商品系列</h2><p>例如：塑料衣架、加粗衣架。</p></div><form className="inline-form" onSubmit={createProduct}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="商品系列名称" required /><button className="primary-button" type="submit">新增系列</button></form><div className="record-list">{products.map((product) => <div className="record-item" key={product.id}><Link className="record-item-link" href={`/products/detail/?id=${product.id}`}><div><strong>{product.name}</strong><span>{product.description || "衣架商品系列"}</span></div><span>{product.variantCount} 个型号 →</span></Link><button className="text-button danger-button" type="button" onClick={() => void deleteProduct(product)}>删除</button></div>)}{!products.length && <div className="empty-state compact"><strong>还没有商品系列</strong><span>先创建第一个系列。</span></div>}</div></section>
    <section className="content-panel"><div className="section-heading"><h2>新增型号 / 货号</h2><p>库存需要独立统计的商品必须使用独立货号。</p></div><form className="stack-form" onSubmit={createVariant}><label>商品系列<select value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="">请选择</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><div className="form-grid"><label>型号<input value={model} onChange={(event) => setModel(event.target.value)} placeholder="例如 A01" required /></label><label>货号<input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="例如 YJ-A01" required /></label></div><div className="form-grid"><label>颜色（可选）<input value={color} onChange={(event) => setColor(event.target.value)} placeholder="例如 黑色" /></label><label>包装规格<input inputMode="numeric" type="number" min="1" value={packSize} onChange={(event) => setPackSize(event.target.value)} required /><small className="field-help">个 / 箱</small></label></div><label>最低库存<input inputMode="numeric" type="number" min="0" value={minimumStock} onChange={(event) => setMinimumStock(event.target.value)} required /></label><button className="primary-button" type="submit">保存型号</button></form></section></div>
    {error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}
  </div>;
}
