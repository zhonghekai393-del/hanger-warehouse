import { StockForm } from "@/components/stock-form";

export default function StockOutPage() {
  return <div className="page-stack narrow-page"><div className="page-heading"><div><p className="eyebrow">库存操作</p><h1>出库</h1><p>系统会在提交时再次校验可用库存。</p></div></div><StockForm type="OUT" /></div>;
}
