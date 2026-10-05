import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { RBACProvider } from "@/components/auth/rbac-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InmoLab Kölbi",
  description: "Gestor inmobiliario",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body className={inter.className}><RBACProvider><AppShell>{children}</AppShell></RBACProvider></body></html>;
}
