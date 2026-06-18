import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NavPrincipal } from './_componentes/nav-principal'
import { usuarioActual } from '@/auth/sesion'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cronograma Ayurá",
  description: "Cronograma semanal y seguimiento de cumplimiento — Ayurá S.A.S",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const u = await usuarioActual()
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavPrincipal usuario={u ? { nombre: u.nombre, rol: u.rol } : null} />
        {children}
      </body>
    </html>
  );
}
