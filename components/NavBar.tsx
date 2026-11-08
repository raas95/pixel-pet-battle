"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePetStore } from "@/store/usePetStore";
import { PetSprite } from "./PetSprite";

const NAV_ITEMS = [
  { href: "/", label: "Beranda" },
  { href: "/pet", label: "Rawat" },
  { href: "/pet/draw", label: "Gambar" },
  { href: "/play", label: "Mini-Game" },
];

export function NavBar() {
  const pathname = usePathname();
  const pet = usePetStore((state) => state.pet);
  const hydrated = usePetStore((state) => state.hydrated);
  const lanStatus = usePetStore((state) => state.lanStatus);
  const lanPeers = usePetStore((state) => state.lanPeers);

  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-[#1e1b2e] bg-[#fffdf7]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[#1e1b2e] no-underline"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-md border-2 border-[#1e1b2e] bg-[#eef2ff]">
            <PetSprite pixels={pet.pixels} size={28} animated={false} />
          </div>
          <div>
            <div className="font-pixel text-sm font-bold leading-tight sm:text-base">
              PixelPet
            </div>
            <div className="text-[11px] font-medium text-slate-600">
              {hydrated ? pet.name : "Memuat..."}
            </div>
          </div>
        </Link>

        {hydrated && (
          <div
            className="flex items-center gap-1.5 rounded-md border-2 border-[#1e1b2e] px-2 py-1 text-[11px] font-bold sm:text-xs"
            title={
              lanStatus === "online"
                ? "Sinkronisasi LAN aktif — monster dibagikan ke semua device di WiFi yang sama."
                : lanStatus === "connecting"
                  ? "Menghubungkan ke server sinkronisasi..."
                  : "Sinkronisasi LAN tidak terhubung. Buka aplikasi lewat IP jaringan (bukan localhost) agar bisa sinkron."
            }
          >
            <span
              aria-hidden
              className={`inline-block h-2 w-2 rounded-full ${
                lanStatus === "online"
                  ? "bg-green-500"
                  : lanStatus === "connecting"
                    ? "animate-pulse bg-yellow-400"
                    : "bg-slate-400"
              }`}
            />
            <span className="text-[#1e1b2e]">
              {lanStatus === "online"
                ? `LAN · ${lanPeers} perangkat`
                : lanStatus === "connecting"
                  ? "LAN…"
                  : "LAN off"}
            </span>
          </div>
        )}

        <nav
          aria-label="Navigasi utama"
          className="flex flex-wrap items-center gap-1.5 sm:gap-2"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : item.href === "/pet"
                  ? pathname === "/pet"
                  : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`font-pixel rounded-md border-2 border-[#1e1b2e] px-2.5 py-1.5 text-xs font-bold transition-transform sm:px-3 sm:text-sm ${
                  isActive
                    ? "bg-[#fde047] text-[#1e1b2e] shadow-[2px_2px_0_#1e1b2e]"
                    : "bg-white text-[#1e1b2e] hover:bg-[#eef2ff]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

