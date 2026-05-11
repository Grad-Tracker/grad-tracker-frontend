import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

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
    <html lang="en" suppressHydrationWarning className={dmSans.variable}>
      <body suppressHydrationWarning>
        <Provider>
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <main id="main-content" role="main">
            {children}
          </main>
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
