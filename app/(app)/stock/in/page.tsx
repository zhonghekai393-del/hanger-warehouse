import { StockForm } from "@/components/stock-form";

export default function StockInPage() {
  return <div className="page-stack narrow-page"><div className="page-heading"><div><p className="eyebrow">库存操作</p><h1>入库</h1><p>收货或补货会增加当前库存。</p></div></div><StockForm type="IN" /></div>;
}
