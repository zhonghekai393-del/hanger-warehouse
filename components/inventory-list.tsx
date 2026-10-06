import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";

type InventoryRow = {
  id: string;
  product_name: string;
  model: string;
  sku: string;
  color?: string;
  size?: string;
  unit: string;
  packSize: number;
  minimumStock: number;
  quantity: number;
};

function getStatus(quantity: number, minimumStock: number): "NORMAL" | "LOW" | "OUT" {
  if (quantity === 0) return "OUT";
  return quantity <= minimumStock ? "LOW" : "NORMAL";
}

export function InventoryList({ rows }: { rows: InventoryRow[] }) {
  if (!rows.length) return <div className="empty-state"><strong>还没有库存型号</strong><span>先去商品型号创建一个 SKU。</span></div>;
  return (
    <div className="inventory-list">
      {rows.map((row) => {
        const status = getStatus(row.quantity, row.minimumStock);
        return <Link className="inventory-row" href={`/products/variant/${row.id}`} key={row.id}>
          <div className="inventory-main"><span className="record-kicker">{row.product_name}</span><strong>{row.model}</strong><span className="record-meta">{row.sku}{row.color ? ` · ${row.color}` : ""}{row.size ? ` · ${row.size}` : ""}</span></div>
          <div className="inventory-quantity"><strong>{row.quantity.toLocaleString()}</strong><span>{row.unit}</span><StatusBadge status={status} /></div>
        </Link>;
      })}
    </div>
  );
}
