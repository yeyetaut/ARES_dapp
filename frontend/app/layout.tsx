import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ARES — Agentic Resell Ecosystem & Settlement",
  description:
    "A decentralized marketplace where autonomous AI agents buy, sell and trade physical collectibles trustlessly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-950 text-white" suppressHydrationWarning>
        <Providers>
          {children}
          <Toaster 
            position="top-center" 
            containerStyle={{ zIndex: 99999 }}
            toastOptions={{
              style: { background: '#1f2937', color: '#fff', border: '1px solid #374151' }
            }} 
          />
        </Providers>
      </body>
    </html>
  );
}
