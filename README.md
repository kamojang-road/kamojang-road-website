# KAMOJANG ROAD — Website publik + login anggota (v2)

File: `index.html`, `style.css`, `script.js`, `README.md`.

## Yang tersedia
- Website publik responsif dan kontak WhatsApp.
- Formulir minat KTA via WhatsApp.
- Login email/kata sandi melalui Supabase Auth.
- Pemulihan kata sandi melalui email (mengikuti konfigurasi Supabase).
- Keluar akun.

## Penting sebelum login dipakai
Login terhubung ke proyek Supabase yang telah dikonfigurasi di `script.js`. Login hanya dapat digunakan oleh akun yang sudah dibuat/diaktifkan pengurus di Supabase Authentication. Pendaftaran akun publik sengaja tidak dibuka. Jangan masukkan service-role key ke file website.

Jika proyek Supabase berbeda, ganti `SUPABASE_URL` dan `SUPABASE_PUBLISHABLE_KEY` dengan URL dan publishable/anon key milik proyek yang benar. Publishable key boleh digunakan di browser; service-role key tidak boleh.

## Pasang ke GitHub Pages
1. Ekstrak ZIP.
2. Unggah dan timpa `index.html`, `style.css`, `script.js`, `README.md` di root repository `kamojang-road/kamojang-road-website`, branch `main`.
3. Commit langsung ke `main`.
4. Tunggu GitHub Pages selesai deploy, lalu muat ulang website.

## Batasan versi ini
Login memverifikasi identitas akun Supabase. Dashboard anggota/admin/sekretaris, data profil dan tiket online belum dibuat. Keberhasilan login tidak otomatis berarti akun memiliki status anggota atau hak admin. Hak akses harus ditetapkan dan dilindungi melalui database/RLS sebelum dashboard diaktifkan. Nomor KTA tetap diterbitkan Pengurus Pusat The Jakmania.
