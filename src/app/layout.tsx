import type { Metadata, Viewport } from "next";
import { Dancing_Script } from "next/font/google";
import "./globals.css";

const script = Dancing_Script({ subsets: ["latin"], variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  title: { default: "E-Sign", template: "%s - E-Sign" },
  description: "Self-hosted electronic signatures",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const dynamic = "force-dynamic"; // every response carries a per-request CSP nonce

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={script.variable}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
