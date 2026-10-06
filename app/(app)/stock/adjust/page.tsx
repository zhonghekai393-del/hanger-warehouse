import { StockForm } from "@/components/stock-form";

export default function StockAdjustPage() {
  return <div className="page-stack narrow-page"><div className="page-heading"><div><p className="eyebrow">库存操作</p><h1>库存调整</h1><p>输入实际盘点数量，系统自动生成差异流水。</p></div></div><StockForm type="ADJUSTMENT" /></div>;
}
