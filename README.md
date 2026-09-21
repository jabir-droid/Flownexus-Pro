# ⚡ FlowNexus Pro — Google Flow 2K Batch Automator

> **Ekstensi Chrome Mandiri (Manifest V3)** untuk otomasi 50+ batch prompt dan pengunduhan gambar **2K Asli (2752x1536)** secara otomatis pada Google Flow ([flow.google.com](https://flow.google.com/)).

---

## 🌟 Fitur Utama

- **🚀 50+ Batch Prompt Otomatis**: Masukkan puluhan hingga ratusan prompt (via teks, file `.txt`, atau `.csv`), klik Mulai, dan ekstensi akan mengeksekusinya satu per satu secara stabil.
- **💎 Resolusi 2K Penuh (2752 x 1536)**: Gambar yang diunduh dipastikan beresolusi 2K asli (2752x1536 untuk 16:9, 1536x2752 untuk 9:16, 2048x2048 untuk 1:1), bukan sekadar preview 1K.
- **📁 Subfolder Otomatis di Downloads**: Hasil unduhan langsung tersimpan rapi ke subfolder yang Anda tentukan (misalnya `Downloads/flow-harvest/`).
- **🏷️ Penamaan Berkas Tematis / Custom**: Nama file otomatis menyesuaikan tema inti dari prompt (misal `cozy_farmhouse_harvest_scene_1.jpg`) atau dapat diatur menggunakan awalan (prefix) kustom sendiri dengan nomor urut berurutan.
- **🔒 Auto-Blur saat Pindah Tab**: Jika Anda berpindah ke tab lain, Side Panel ekstensi otomatis menjadi *blur* dan menampilkan kartu pengingat dengan tombol **⚡ Kembali / Buka Tab Flow** agar sinkronisasi kanvas tetap terjaga.
- **⚡ 100% Mandiri (Tanpa Python / Server)**: Berjalan langsung di dalam browser Google Chrome Anda tanpa perlu menginstal Python, NodeJS, atau server lokal.

---

## 📥 Panduan Instalasi (Untuk Pengguna Baru)

### Cara 1: Menggunakan File ZIP (Paling Mudah)
1. Unduh berkas **`FlowNexus-Pro-v2.1.0.zip`** dari menu [Releases](https://github.com/) repository ini.
2. Ekstrak (Unzip) file tersebut ke folder di komputer Anda (misal ke `Documents/FlowNexus-Pro`).
3. Buka browser **Google Chrome** dan buka alamat:
   ```text
   chrome://extensions
   ```
4. Di pojok kanan atas, aktifkan **Developer mode** (Mode pengembang).
5. Klik tombol **Load unpacked** (Muat yang belum dibongkar) di pojok kiri atas.
6. Pilih folder hasil ekstrak tadi (folder yang berisi file `manifest.json`).
7. Selesai! Sematkan (Pin) ikon petir ⚡ **FlowNexus Pro** di toolbar Chrome Anda.

---

### Cara 2: Menggunakan Git Clone (Untuk Developer)
```bash
git clone https://github.com/username/flownexus-pro.git
cd flownexus-pro
```
Lalu buka `chrome://extensions` di Chrome -> aktifkan **Developer mode** -> klik **Load unpacked** -> pilih folder `chrome-extension`.

---

## 🎯 Cara Penggunaan

1. Buka tab **Google Flow** di Chrome:
   ```text
   https://flow.google.com/
   ```
   Pastikan Anda sudah login dan telah membuka salah satu kanvas proyek Anda.
2. Klik ikon ⚡ **FlowNexus Pro** di toolbar Chrome untuk membuka **Side Panel** di sebelah kanan kanvas Flow.
3. Masukkan daftar prompt Anda:
   - Tempel teks langsung, atau
   - Tarik file `.txt` / `.csv`.
4. Atur preferensi Anda:
   - **Variasi**: 1, 2, 3, atau 4 gambar per prompt.
   - **Rasio Aspek**: 16:9, 9:16, 1:1, 4:3, atau 3:4.
   - **Folder Tujuan**: Nama subfolder di dalam folder Downloads.
5. Klik **🚀 Mulai Batch Otomatis**.
6. Ekstensi akan mengetik prompt, menunggu hasil render 2K, dan langsung mengunduhnya ke folder Anda secara otomatis.

---

## ❓ Tanya Jawab (FAQ)

### Apakah perlu dideploy ke Vercel?
> **Jawab: Tidak perlu.**  
> Vercel adalah layanan hosting untuk website online. FlowNexus Pro adalah **Ekstensi Browser (Chrome Extension)** yang berjalan langsung di dalam peramban Google Chrome pengguna untuk mengontrol kanvas Google Flow dan mengunduh file ke komputer lokal. Ekstensi tidak memerlukan server web online.

### Apakah perlu di-push ke GitHub?
> **Jawab: Sangat disarankan!**  
> GitHub adalah tempat terbaik untuk membagikan ekstensi ini ke orang lain. Anda dapat mengunggah kode ke GitHub dan melampirkan berkas `FlowNexus-Pro-v2.1.0.zip` di menu **Releases** sehingga orang lain tinggal mengunduh dan memasangnya dalam 1 menit.

---

## 📄 Lisensi
Didistribusikan di bawah Lisensi MIT. Bebas digunakan dan dikembangkan.
