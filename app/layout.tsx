import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { MetisProvider } from "@/providers/metis-provider";
import { MetisWidget } from "@/components/metis/metis-widget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Accurate Sales Dashboard",
  description: "Zuma Indonesia · Accurate Sales Analytics Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <MetisProvider>
          {children}
          <MetisWidget />
        </MetisProvider>
      </body>
    </html>
  );
}
