# PixelPet — Game Virtual Pet Pixel dengan Next.js & Phaser

Game browser interaktif yang menggabungkan perawatan virtual pet, editor sprite pixel 32 × 32, dan mini-game refleks huruf A–Z berbasis suara.

## Fitur Utama (MVP)

- **Beranda (`/`)**: Ringkasan kondisi monster aktif, navigasi cepat, dan tombol reset data lokal.
- **Perawatan Monster (`/pet`)**: Memberi makan, mengajak bermain, menidurkan monster, mengubah nama, serta pembaruan status otomatis (0–100) dengan batas penurunan offline.
- **Editor Pixel (`/pet/draw`)**: Kanvas 32 × 32 dengan pensil, penghapus, fill area, pengambil warna, palet + color picker, undo/redo, pratinjau animasi nearest-neighbor, dukungan mouse & layar sentuh, serta validasi gambar kosong.
- **Mini-Game Suara (`/play`)**: Phaser canvas dengan instruksi suara *"Tekan [huruf]"* (`public/audio/letters/a.mp3`–`z.mp3`), 4 pilihan huruf acak unik, dukungan tombol layar & keyboard, animasi berlari/jatuh, 3 nyawa, 10 ronde menang, serta hadiah ke status monster.
- **Sinkronisasi LAN**: Setiap device punya monster sendiri yang tidak saling menimpa. Device yang online di jaringan yang sama bisa saling melihat monster satu sama lain: monster tetangga berkeliaran di panggung ruang perawatan sambil jalan-jalan, dan tercantum di panel "Monster Tetangga" (tersedia di Beranda dan halaman Rawat) lengkap dengan nama dan kondisinya, diperbarui otomatis tiap ±3 detik.

## Main Bersama di Satu WiFi

1. Jalankan server di satu komputer (komputer tuan):
   ```bash
   npm run dev
   ```
2. Perhatikan baris **Network** yang muncul, misalnya `http://192.168.1.5:3000`.
3. Dari device lain yang terhubung ke WiFi yang sama, buka alamat Network tersebut (bukan `localhost`).
4. Indikator di bilah navigasi akan berubah menjadi hijau `LAN · N perangkat`. Di **Beranda** maupun halaman **Rawat** (`/pet`), bagian **Monster Tetangga** akan menampilkan monster milik device lain yang sedang online, lengkap dengan kondisinya.

Catatan:
- Data sinkronisasi disimpan server di `.data/pet-sync.json` (tak termasuk git), jadi tetap ada selama server tuan tidak direset.
- Kalau suatu device dibuka lewat `localhost`, ia tetap jalan normal tetapi tidak ikut sinkronisasi (ditandai `LAN off`).

## Menjalankan Proyek

```bash
npm install
npm run dev
```

Buka `http://localhost:3000` di browser.

## Pengujian

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

