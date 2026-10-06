const labels: Record<string, string> = { IN: "入库", OUT: "出库", ADJUSTMENT: "调整", INITIAL: "初始化", COUNT: "盘点" };

export function MovementTable({ rows }: { rows: Array<Record<string, string | number | null>> }) {
  if (!rows.length) return <div className="empty-state"><strong>暂时没有流水</strong><span>完成一次入库或出库后，记录会出现在这里。</span></div>;
  return <div className="movement-list">
    {rows.map((row) => <article className="movement-row" key={String(row.id)}>
      <div className="movement-title"><strong>{labels[String(row.type)] || String(row.type)}</strong><span>{String(row.createdAt || "").replace("T", " ").slice(0, 16)}</span></div>
      <div className="movement-main"><strong>{String(row.product_name || "")} · {String(row.model || "")}</strong><span>{String(row.sku || "")} · {String(row.movementNo || "")}</span></div>
      <div className={`movement-delta ${Number(row.quantity) >= 0 ? "positive" : "negative"}`}>{Number(row.quantity) >= 0 ? "+" : ""}{Number(row.quantity).toLocaleString()}</div>
      <div className="movement-meta"><span>{String(row.beforeQuantity)} → {String(row.afterQuantity)}</span><span>{String(row.operator || "")}</span></div>
      {row.remark && <p className="movement-remark">{String(row.remark)}</p>}
    </article>)}
  </div>;
}
