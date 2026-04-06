import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "Grad Tracker",
  description: "Track your graduation progress",
};

const rootFontVars: CSSProperties = {
  "--font-dm-sans":
    '"DM Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
} as CSSProperties;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning style={rootFontVars}>
      <body suppressHydrationWarning>
        <Provider>
          {children}
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
