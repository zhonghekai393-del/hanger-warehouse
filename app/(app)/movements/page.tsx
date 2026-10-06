"use client";

import { useEffect, useState } from "react";
import { MovementTable } from "@/components/movement-table";

export default function MovementsPage() {
  const [type, setType] = useState("");
  const [rows, setRows] = useState<Array<Record<string, string | number | null>>>([]);
  const [error, setError] = useState("");
  async function load() { const query = type ? `?type=${type}` : ""; const response = await fetch(`/api/movements${query}`); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || "流水加载失败"); setRows(body.data); }
  async function deleteMovement(row: Record<string, string | number | null>) {
    const movementNo = String(row.movementNo || "");
    if (!window.confirm(`确定删除流水“${movementNo}”吗？库存会回退到上一笔余额。`)) return;
    setError("");
    const response = await fetch(`/api/movements?id=${encodeURIComponent(String(row.id))}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) { setError(body.error?.message || "流水删除失败"); return; }
    setRows((current) => current.filter((item) => item.id !== row.id));
  }
  useEffect(() => {
    let active = true;
    const query = type ? `?type=${type}` : "";
    fetch(`/api/movements${query}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error?.message || "流水加载失败");
        if (active) setRows(body.data);
      })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "流水加载失败"); });
    return () => { active = false; };
  }, [type]);
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">可追溯记录</p><h1>出入库记录</h1><p>库存每一次变化都在这里留下前后余额。</p></div></div><div className="filter-bar"><label>类型<select value={type} onChange={(event) => setType(event.target.value)}><option value="">全部</option><option value="IN">入库</option><option value="OUT">出库</option><option value="ADJUSTMENT">调整</option></select></label></div>{error && <p className="form-error" role="alert">{error}</p>}<MovementTable rows={rows} onDelete={deleteMovement} /></div>;
}
