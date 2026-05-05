# Panduan Lengkap: Database Supabase -> GitHub -> Netlify

Karena aplikasi kita saat ini sudah diubah agar menggunakan struktur database berbasis cloud (bukan lokal), berikut adalah urutan pasti agar website Anda dapat online secara publik dan bisa diisi datanya secara aman:

---

## TAHAP 1: Konfigurasi Database (Supabase)

Supabase adalah layanan database berbasis cloud (PostgreSQL). Kita menggunakannya untuk menyimpan teks form dan foto yang di-upload.

1. Buka browser dan pergi ke **[Supabase.com](https://supabase.com)**
2. Lakukan pendaftaran / login.
3. Klik tombol **New Project**.
   - Beri nama (misal: `voice-member-db`)
   - Buat password database yang aman (simpan password ini jika diperlukan nanti).
   - Pilih region server (pilih `Singapore` agar cepat dari Indonesia).
   - Klik **Create new project**. Tunggu beberapa menit hingga database siap.

### 1.A Membuat Tabel Database

1. Di dashboard Supabase Anda, cari menu **SQL Editor** di sidebar sebelah kiri (ikon terminal).
2. Klik **New Query**.
3. _Copy_ kode SQL di bawah ini dan _Paste_ ke dalam editor:

```sql
CREATE TABLE IF NOT EXISTS voice_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,
  input_date  date NOT NULL,
  member_name text NOT NULL,
  line_name   text NOT NULL,
  voice_text  text NOT NULL,
  photo_url   text
);

ALTER TABLE voice_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert" ON voice_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select" ON voice_members FOR SELECT USING (true);
```

4. Klik tombol **Run** (di kanan bawah). Jika berhasil, akan ada tulisan _Success_.

### 1.B Membuat Storage (Untuk Foto)

1. Pergi ke menu **Storage** (ikon folder di sidebar kiri).
2. Klik **New Bucket**.
3. Beri nama persis seperti ini: `voice-photos`
4. **PENTING:** Centang kotak **Public bucket** (agar foto bisa dilihat publik di dashboard).
5. Klik **Save**.
6. Di menu Storage, pilih tab **Policies**.
7. Di bagian `voice-photos`, klik tombol **New Policy** -> pilih **For Full Customization**.
8. Buat **Policy 1** (Untuk Upload):
   - Policy Name: `Allow public uploads`
   - Allowed Operations: Centang **INSERT**
   - Taruh ini di kolom **WITH CHECK expression**: `bucket_id = 'voice-photos'`
   - Klik **Save**.
9. Buat **Policy 2** (Untuk Baca):
   - Policy Name: `Allow public reads`
   - Allowed Operations: Centang **SELECT**
   - Taruh ini di kolom **USING expression**: `bucket_id = 'voice-photos'`
   - Klik **Save**.

### 1.C Mengambil API Key Supabase

1. Masuk ke menu **Project Settings** (ikon gerigi / roda gigi di kiri bawah).
2. Pilih menu **API**.
3. Di halaman ini, Anda akan melihat bagian **Project URL** dan **Project API Keys** (`anon` `public`).
4. Buka file `.env.local` yang ada di dalam folder `voice-app` (di komputer Anda).
5. Ubah isinya dengan _URL_ dan _Key_ yang ada di layar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<KODE-PROJECT-ANDA>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh...<KODE-PANJANG-ANDA>...
```

---

## TAHAP 2: Upload Kode ke GitHub

Netlify membutuhkan sumber kode (source code) Anda untuk dipublikasikan. GitHub adalah tempat terbaik untuk menyimpannya.

1. Buka browser dan pergi ke **[GitHub.com](https://github.com)** (Login / Daftar).
2. Klik tombol hijau **New** di kanan atas (untuk membuat _Repository_).
3. Beri nama _repository_ Anda (misal: `voice-member-app`).
4. Biarkan pengaturan lainnya (Public/Private bebas), lalu klik **Create repository**.
5. Buka Terminal (Command Prompt / PowerShell / VS Code Terminal) di komputer Anda, pastikan Anda berada di dalam folder `voice-app`:
   ```bash
   cd C:\Users\El\Documents\voice-member-form\voice-app
   ```
6. Jalankan perintah ini satu-per-satu di terminal Anda (jangan lupa ganti `<URL-GITHUB-ANDA>` di baris ke-4 dengan link repository GitHub yang baru saja Anda buat):

```bash
git init
git add .
git commit -m "Upload pertama aplikasi Voice Member"
git remote add origin <URL-GITHUB-ANDA>.git
git branch -M main
git push -u origin main
```

_Jika muncul jendela login GitHub, silakan login dan izinkan akses._

---

## TAHAP 3: Deploy Publikasi ke Netlify

Netlify akan mengambil kode dari GitHub Anda dan membuatnya menjadi website online yang bisa diakses siapapun dengan URL.

1. Buka browser dan pergi ke **[Netlify.com](https://www.netlify.com/)** (Login / Daftar menggunakan akun GitHub Anda).
2. Di dashboard Netlify, klik **Add new site** -> pilih **Import an existing project**.
3. Klik ikon **GitHub** (Authorize / berikan izin jika ditanya).
4. Pilih _repository_ `voice-member-app` yang tadi Anda upload.
5. Anda akan masuk ke halaman pengaturan deploy. Gulir (scroll) ke bawah, pastikan pengaturannya seperti ini:
   - **Base directory:** (biarkan kosong)
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
6. **SANGAT PENTING (Environment Variables):**
   - Klik tombol **Add environment variables**
   - Masukkan 2 variabel yang sama dengan yang ada di file `.env.local` Anda:
     - _Key 1_: `NEXT_PUBLIC_SUPABASE_URL` | _Value 1_: (URL Supabase Anda)
     - _Key 2_: `NEXT_PUBLIC_SUPABASE_ANON_KEY` | _Value 2_: (Anon Key Supabase Anda)
7. Klik tombol **Deploy site**.

### Selesai! 🎉

Tunggu proses Build berlangsung (sekitar 1-3 menit). Jika sudah selesai (statusnya hijau / _Published_), Netlify akan memberikan sebuah _link/URL_.
Klik URL tersebut, dan aplikasi **Voice Member e-Form** Anda kini sudah live dan terhubung ke database asli!

_(Anda juga bisa mengubah URL Netlify yang acak menjadi nama yang lebih rapi melalui menu **Domain Management** -> **Options** -> **Edit site name**)._
