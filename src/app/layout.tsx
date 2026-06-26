import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/ToastProvider";
import Image
 from "next/image";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BATTLESHIP | 2 0 4 9",
  description: "Multiplayer Battleship. Real-time. No registration.",
  viewport: "width=device-width, initial-scale=1",
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
      <Image
                src="/logo-light-transparent.png"
                alt=""
                height={320}
                width={320}
                priority
                className="object-cover fixed inset-0 z-20"
              />
      <body className="min-h-screen bg-deep-navy text-mist antialiased">
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to main content
        </a>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}