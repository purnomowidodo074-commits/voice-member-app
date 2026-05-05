# Panduan Setup Supabase untuk Voice Member e-Form

## 1. Buat Project Supabase
1. Buka https://supabase.com dan login/daftar
2. Klik **New Project**, isi nama project, password database, dan pilih region

## 2. Buat Tabel `voice_members`
Buka **SQL Editor** di dashboard Supabase dan jalankan query berikut:

```sql
-- Buat tabel voice_members
CREATE TABLE IF NOT EXISTS voice_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  timestamptz DEFAULT now() NOT NULL,
  input_date  date NOT NULL,
  member_name text NOT NULL,
  line_name   text NOT NULL,
  voice_text  text NOT NULL,
  photo_url   text
);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE voice_members ENABLE ROW LEVEL SECURITY;

-- Policy: izinkan semua orang insert (form public)
CREATE POLICY "Allow public insert"
  ON voice_members FOR INSERT
  WITH CHECK (true);

-- Policy: izinkan semua orang read (dashboard public)
CREATE POLICY "Allow public select"
  ON voice_members FOR SELECT
  USING (true);
```

## 3. Buat Storage Bucket `voice-photos`
Buka **Storage** di dashboard Supabase:
1. Klik **New Bucket**
2. Nama bucket: `voice-photos`
3. Centang **Public bucket** agar foto bisa diakses publik
4. Klik **Save**

Lalu di **Policies** untuk bucket `voice-photos`, tambahkan policy:
```sql
-- Izinkan upload file ke bucket
CREATE POLICY "Allow public uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-photos');

-- Izinkan baca file dari bucket
CREATE POLICY "Allow public reads"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-photos');
```

## 4. Ambil API Keys
Di dashboard Supabase → **Settings** → **API**:
- **Project URL** → salin ke `NEXT_PUBLIC_SUPABASE_URL`
- **anon public key** → salin ke `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 5. Isi `.env.local`
Edit file `voice-app/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 6. Jalankan Aplikasi
```bash
cd voice-app
npm run dev
```
Akses di http://localhost:3000
