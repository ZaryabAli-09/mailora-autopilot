import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-geist-sans'});

export const metadata: Metadata = {
  title: "Mailora Autopilot",
  description: "An AI agent that organizes your inbox and handles the busywork",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={cn("font-sans", geist.variable)}><body className="min-h-screen antialiased">{children}</body></html>;
}
