import type { Metadata, Viewport } from "next";
import { appName } from "@/src/lib/config";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import "./globals.css";

export const metadata: Metadata = {
  title: appName,
  description: "衣架型号库存与出入库管理系统",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#2f6f4e" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body><ServiceWorkerRegister />{children}</body>
    </html>
  );
}
