// web/src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getUserFromCookie } from "@/lib/auth";
import SiteHeader from "@/components/SiteHeader";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flytte & Fragttilbud",
  description: "Få 3 tilbud – nemt og hurtigt.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <SiteHeader /> {/* ← brug komponenten her */}
        <main className="container py-6">{children}</main>
      </body>
    </html>
  );
}
