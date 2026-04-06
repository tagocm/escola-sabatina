import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Escola Sabatina",
  description: "Gestão completa para a Escola Sabatina",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col overflow-x-hidden pt-3 md:pt-4">
        {/* Decorative Global Bar */}
        <div className="absolute inset-x-0 top-0 z-[9999] flex h-3 items-center md:h-4">
          <div className="h-full w-1/3 bg-es-lilac" />
          <div className="h-full w-1/3 bg-es-orange" />
          <div className="h-full w-1/3 bg-es-blue" />
        </div>
        {children}
      </body>
    </html>
  );
}
