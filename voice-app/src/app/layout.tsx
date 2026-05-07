import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/components/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voice Member | e-Form Aspirasi Anggota",
  description:
    "Platform digital untuk menangkap aspirasi, keluhan, dan masukan dari anggota line secara terorganisir.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main className="flex-1 pt-16 bg-slate-50">
              {children}
            </main>
            <footer className="bg-white border-t border-slate-200 py-4">
              <p className="text-center text-sm text-slate-500">
                © 2026 PT. Toyota Motor Manufacturing Indonesia — E-Form Aspirasi
              </p>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
