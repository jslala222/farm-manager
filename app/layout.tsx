import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import AuthProvider from "@/components/AuthProvider";
import QueryProvider from "@/components/QueryProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "농장관리",
  description: "딸기농장 수확·판매·출근 관리 시스템",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#dc2626",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-50`}>
        <AuthProvider>
          <QueryProvider>
            <div className="min-h-screen flex flex-col">
              <NavBar />
              <main className="flex-1 max-w-5xl mx-auto w-full">
                {children}
              </main>
            </div>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

