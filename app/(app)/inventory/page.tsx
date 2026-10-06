"use client";

import { useEffect, useState } from "react";
import { InventoryList } from "@/components/inventory-list";
import { getLocalRepository } from "@/src/lib/local/repository";
import type { InventoryRow } from "@/src/lib/local/types";

export default function InventoryPage() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadInventory(value = query) {
    setLoading(true);
    setError("");
    try {
      setRows(await getLocalRepository().listInventory(value));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "库存加载失败");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    let active = true;
    getLocalRepository().listInventory("")
      .then((data) => { if (active) setRows(data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "库存加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">库存查询</p><h1>所有型号</h1><p>搜索商品、型号、货号或条形码。</p></div></div>
    <form className="search-bar" onSubmit={(event) => { event.preventDefault(); void loadInventory(); }}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索型号 / 货号 / 商品名称" /><button className="outline-button" type="submit">搜索</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <div className="loading-state">正在读取库存...</div> : <InventoryList rows={rows} />}
  </div>;
}
