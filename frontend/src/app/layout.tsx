import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { ThemedToaster, themeInitScript } from "@/components/Theme";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BookLeaf Author Support",
  description: "Author support and communication portal for BookLeaf Publishing",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // suppressHydrationWarning: the theme script adds the "dark" class before React hydrates.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <ThemedToaster />
      </body>
    </html>
  );
}
