import type { Metadata } from "next";
import { Outfit, Plus_Jakarta_Sans } from "next/font/google";
import { Provider } from "@/components/ui/provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
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
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${plusJakarta.variable}`}>
      <body suppressHydrationWarning>
        <Provider>
          {children}
          <Toaster />
        </Provider>
      </body>
    </html>
  );
}
