import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { StoreHydrator } from "@/components/StoreHydrator";

export const metadata: Metadata = {
  title: "PixelPet — Virtual Pet & Mini-Game Suara",
  description:
    "Gambar monster pixel buatanmu sendiri, rawat setiap hari, dan mainkan mini-game refleks huruf berbasis suara!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        <StoreHydrator />
        <NavBar />
        <main className="mx-auto max-w-4xl px-3 py-5 sm:px-6 sm:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}

