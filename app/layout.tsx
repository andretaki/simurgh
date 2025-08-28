import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Sidebar from "@/components/navigation/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Simurgh - AI-Powered RFQ Processing Platform",
  description: "Transform your RFQ processing with cutting-edge AI technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <div className="relative min-h-screen">
          <Sidebar />
          <main className="lg:ml-72 transition-all duration-300">
            {children}
          </main>
        </div>
        <Toaster />
      </body>
    </html>
  );
}
