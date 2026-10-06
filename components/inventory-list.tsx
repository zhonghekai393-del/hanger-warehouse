import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { getStockStatus } from "@/src/lib/inventory/rules";
import type { InventoryRow } from "@/src/lib/local/types";

export function InventoryList({ rows }: { rows: InventoryRow[] }) {
  if (!rows.length) return <div className="empty-state"><strong>还没有库存型号</strong><span>先去商品型号创建一个货号。</span></div>;
  return (
    <div className="inventory-list">
      {rows.map((row) => {
        const status = getStockStatus(row.quantity, row.minimumStock);
        return <Link className="inventory-row" href={`/products/variant/?id=${row.id}`} key={row.id}>
          <div className="inventory-main"><span className="record-kicker">{row.productName}</span><strong>{row.model}</strong><span className="record-meta">{row.sku}{row.color ? ` · ${row.color}` : ""}{row.size ? ` · ${row.size}` : ""}</span></div>
          <div className="inventory-quantity"><strong>{row.quantity.toLocaleString()}</strong><span>{row.unit}</span><StatusBadge status={status} /></div>
        </Link>;
      })}
    </div>
  );
}
