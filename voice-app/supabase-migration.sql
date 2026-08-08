-- ============================================================
-- MIGRATION: Login Noreg + Member Accounts
-- Jalankan di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabel member_accounts: menyimpan akun yang sudah aktivasi
CREATE TABLE IF NOT EXISTS public.member_accounts (
  noreg       TEXT PRIMARY KEY,
  nama        TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member',  -- 'member' | 'admin'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.member_accounts ENABLE ROW LEVEL SECURITY;

-- Policy: anon bisa SELECT (untuk verifikasi login) dan INSERT (untuk aktivasi)
DROP POLICY IF EXISTS "Allow anon read member_accounts" ON public.member_accounts;
CREATE POLICY "Allow anon read member_accounts"
  ON public.member_accounts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert member_accounts" ON public.member_accounts;
CREATE POLICY "Allow anon insert member_accounts"
  ON public.member_accounts FOR INSERT
  WITH CHECK (true);

-- 2. Tambah kolom noreg ke voice_members (untuk filter result per anggota)
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS noreg TEXT DEFAULT '';

-- 3. Seed akun admin default
-- Ganti password_hash sesuai kebutuhan:
-- Hash di bawah adalah SHA-256 dari "admin123"
-- Bisa generate ulang di: https://emn178.github.io/online-tools/sha256.html
INSERT INTO public.member_accounts (noreg, nama, password_hash, role)
VALUES ('ADMIN', 'Administrator', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', 'admin')
ON CONFLICT (noreg) DO NOTHING;

-- 4. Tambah kolom profile_photo ke member_accounts (untuk foto profil peserta)
ALTER TABLE public.member_accounts
  ADD COLUMN IF NOT EXISTS profile_photo TEXT DEFAULT NULL;

-- 5. Buat storage bucket profile-photos (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: public read bucket profile-photos
DROP POLICY IF EXISTS "Public read profile-photos" ON storage.objects;
CREATE POLICY "Public read profile-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

-- Policy: anon upload ke profile-photos
DROP POLICY IF EXISTS "Allow anon upload profile-photos" ON storage.objects;
CREATE POLICY "Allow anon upload profile-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-photos');

-- ============================================================
-- 6. Tabel app_settings: untuk reset ranking Top Pengirim
-- Menyimpan timestamp kapan ranking terakhir direset.
-- Data voice_members TIDAK dihapus — hanya titik awal penghitungan ranking.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: anon bisa baca/tulis (sama seperti tabel lain di app ini)
DROP POLICY IF EXISTS "Allow anon read app_settings" ON public.app_settings;
CREATE POLICY "Allow anon read app_settings"
  ON public.app_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow anon insert app_settings" ON public.app_settings;
CREATE POLICY "Allow anon insert app_settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update app_settings" ON public.app_settings;
CREATE POLICY "Allow anon update app_settings"
  ON public.app_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 7. Storage bucket voice-photos: policy INSERT/SELECT
-- Bucket dibuat manual di dashboard (lihat SUPABASE_SETUP.md), tapi
-- policy RLS-nya tidak ikut termigrasi ke project Supabase yang baru,
-- sehingga upload foto voice member gagal dengan error
-- "new row violates row-level security policy".
-- ============================================================
DROP POLICY IF EXISTS "Public read voice-photos" ON storage.objects;
CREATE POLICY "Public read voice-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-photos');

DROP POLICY IF EXISTS "Allow anon upload voice-photos" ON storage.objects;
CREATE POLICY "Allow anon upload voice-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-photos');

-- ============================================================
-- SELESAI. Verifikasi:
-- SELECT * FROM member_accounts;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'voice_members';
-- SELECT * FROM app_settings;
-- SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
-- ============================================================
