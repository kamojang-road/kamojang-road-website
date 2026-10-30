# KAMOJANG ROAD — Korwil Kampung Melayu

Website publik statis untuk GitHub Pages. File yang digunakan:
- `index.html` — konten website.
- `style.css` — tampilan responsif.
- `script.js` — menu mobile, tahun otomatis, dan formulir minat KTA via WhatsApp.

## Cara memasang ke GitHub Pages
1. Buka repository `kamojang-road/kamojang-road-website`.
2. Pilih branch `main` dan pastikan sumber GitHub Pages adalah folder root (`/`).
3. Unggah/ganti tiga file di atas pada folder utama repository: `index.html`, `style.css`, `script.js`.
4. Klik **Commit changes**.
5. Buka **Settings → Pages** dan pastikan **Deploy from a branch**, branch `main`, folder `/ (root)`.
6. Tunggu proses deployment selesai di tab **Actions**. Setelah itu buka `https://kamojang-road.github.io/kamojang-road-website/` dan muat ulang.

## Fitur yang aktif pada versi ini
- Halaman publik dan navigasi responsif.
- Tombol kontak WhatsApp pengurus.
- Formulir minat pendaftaran KTA yang menyiapkan pesan WhatsApp untuk diperiksa dan dikirim pengguna.

## Belum tersedia
Login, akun anggota, dashboard admin/sekretaris, database, verifikasi pembayaran, inventaris gelang, dan pemesanan tiket online belum aktif. Fitur tersebut memerlukan backend/database dan aturan akses. Nomor KTA diterbitkan oleh Pengurus Pusat The Jakmania, bukan website ini.

Formulir tidak menyimpan data ke server. Pengguna perlu menekan tombol kirim di WhatsApp setelah pesan terbuka. Jangan mengirim foto KTP atau kata sandi melalui formulir publik.
