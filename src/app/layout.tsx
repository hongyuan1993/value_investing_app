import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DCF 估值 | 内在价值计算",
  description: "基于现金流折现法（DCF）估算股票内在价值",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="dark">
      <body className="font-sans min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
