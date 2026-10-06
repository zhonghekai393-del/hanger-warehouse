"use client";

import { useEffect, useState } from "react";
import { MovementTable } from "@/components/movement-table";
import { getLocalRepository } from "@/src/lib/local/repository";
import type { MovementRow } from "@/src/lib/local/types";

export default function MovementsPage() {
  const [type, setType] = useState<"" | "IN" | "OUT" | "ADJUSTMENT">("");
  const [rows, setRows] = useState<MovementRow[]>([]);
  const [error, setError] = useState("");
  async function load() { setRows(await getLocalRepository().listMovements(type || undefined)); }
  async function deleteMovement(row: MovementRow) {
    const movementNo = row.movementNo;
    if (!window.confirm(`确定删除流水“${movementNo}”吗？库存会回退到上一笔余额。`)) return;
    setError("");
    try { await getLocalRepository().deleteMovement(row.id); await load(); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "流水删除失败"); }
  }
  useEffect(() => {
    let active = true;
    getLocalRepository().listMovements(type || undefined)
      .then((data) => { if (active) setRows(data); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "流水加载失败"); });
    return () => { active = false; };
  }, [type]);
  return <div className="page-stack"><div className="page-heading"><div><p className="eyebrow">可追溯记录</p><h1>出入库记录</h1><p>库存每一次变化都在这里留下前后余额。</p></div></div><div className="filter-bar"><label>类型<select value={type} onChange={(event) => setType(event.target.value as typeof type)}><option value="">全部</option><option value="IN">入库</option><option value="OUT">出库</option><option value="ADJUSTMENT">调整</option></select></label></div>{error && <p className="form-error" role="alert">{error}</p>}<MovementTable rows={rows} onDelete={deleteMovement} /></div>;
}
