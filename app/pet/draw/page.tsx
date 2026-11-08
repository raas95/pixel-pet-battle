import Link from "next/link";
import { PixelEditor } from "@/components/PixelEditor";

export default function DrawPetPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/pet"
          className="font-pixel text-xs font-bold text-[#1e1b2e] underline hover:text-[#4338ca] sm:text-sm"
        >
          ← Kembali ke Perawatan Monster
        </Link>
      </div>

      <PixelEditor />
    </div>
  );
}

