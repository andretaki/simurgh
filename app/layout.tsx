import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Sidebar from "@/components/navigation/sidebar";
import Providers from "@/components/providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Simurgh - AI-Powered RFQ Processing Platform",
  description: "Transform your RFQ processing with cutting-edge AI technology",
  icons: {
    icon: "/Senmurv.svg",
    shortcut: "/Senmurv.svg",
    apple: "/Senmurv.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {/* Skip to main content link for keyboard navigation */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-1/2 focus:-translate-x-1/2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-purple-600 focus:text-white focus:rounded-lg focus:shadow-lg"
          >
            Skip to main content
          </a>
          <div className="relative min-h-screen">
            <Sidebar />
            <main id="main-content" className="lg:ml-72 transition-all duration-300" tabIndex={-1}>
              {children}
            </main>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
