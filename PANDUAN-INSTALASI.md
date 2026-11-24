# Panduan Instalasi: PDF Converter

## A. Backend (Google Apps Script)
1. Buka https://script.google.com → **Proyek baru**.
2. Ganti isi `Code.gs` dengan isi berkas **Kode.gs** (rename file menjadi `Kode`).
3. Pilih fungsi `setupAppEnvironment` → ▶ **Run** → izinkan akses Drive dan Sheets. **Jalankan SEKALI saja.**
4. Buka Execution Log: harus muncul "✅ Setup selesai" dan tautan Spreadsheet.
5. **Deploy → New deployment → Web app** · Execute as: **Me** · Who has access: **Anyone** → Deploy.
6. Salin URL yang berakhiran `/exec`.

Akun dengan email yang sama dengan pemilik script otomatis menjadi **admin** saat mendaftar.

## B. Frontend (GitHub Pages)
1. Ekstrak ZIP. Folder hasil ekstraksi **`pdf-converter-web`** adalah folder kerja Anda (tempat `git init`).
2. Buka `js/config.js`, ganti `GAS_URL` dengan URL `/exec` dari langkah A6. Simpan.
3. Buka PowerShell di folder itu (File Explorer → klik address bar → ketik `powershell` → Enter), lalu cek:
   ```
   dir
   ```
   Harus terlihat **index.html**, folder **css** dan **js**. Jika yang terlihat folder lain, Anda salah folder.
4. Buat repository **Public** baru di github.com (jangan centang README).
5. Jalankan satu per satu:
   ```
   git init
   git add .
   git commit -m "Upload pertama"
   git branch -M main
   git remote add origin https://github.com/USERNAME/NAMA-REPO.git
   git push -u origin main
   ```
   Saat diminta password, tempel **Personal Access Token** (scope `repo`); layar tidak menampilkan apa pun, itu normal.
6. Repo → **Settings → Pages** → Deploy from a branch → `main` / `(root)` → Save. Tunggu 1-2 menit.

## C. Uji
- Buka `https://USERNAME.github.io/NAMA-REPO/`, coba **Gabung PDF**.
- Daftar akun → masuk → buka **Riwayat** → pastikan pekerjaan tercatat di sheet `Jobs`.
- Update file: `git add .` → `git commit -m "..."` → `git push`, lalu Ctrl+Shift+R.
- Setiap mengubah `Kode.gs`, buat **New deployment** baru dan perbarui `GAS_URL`.
