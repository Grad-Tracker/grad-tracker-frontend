import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grad Tracker",
  description: "Track your graduation progress",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      style={
        {
          "--font-outfit": '"Avenir Next", "Segoe UI", sans-serif',
          "--font-plus-jakarta":
            '"Avenir Next", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif',
        } as CSSProperties
      }
    >
      <body suppressHydrationWarning>
        <Provider>
          {children}
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
