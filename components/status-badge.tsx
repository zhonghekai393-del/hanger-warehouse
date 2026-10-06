const labels = { NORMAL: "正常", LOW: "库存不足", OUT: "缺货" } as const;

export function StatusBadge({ status }: { status: "NORMAL" | "LOW" | "OUT" }) {
  return <span className={`status-badge status-${status.toLowerCase()}`}>{labels[status]}</span>;
}
