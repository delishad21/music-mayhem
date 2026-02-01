import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";
import AuthProvider from "@/components/AuthProvider";
import AuthSync from "@/components/AuthSync";

export const metadata: Metadata = {
  title: "Music Mayhem",
  description: "Multiplayer music guessing and lyric completion game",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Script src="/runtime-config.js" strategy="beforeInteractive" />
        <AuthProvider>
          <ThemeProvider>
            <AuthSync />
            {children}
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
