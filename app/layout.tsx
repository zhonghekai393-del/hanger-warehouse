import type { Metadata } from "next";
import { appName } from "@/src/lib/config";
import "./globals.css";

export const metadata: Metadata = {
  title: appName,
  description: "衣架型号库存与出入库管理系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
