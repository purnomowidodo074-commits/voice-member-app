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
CREATE POLICY "Allow anon read member_accounts"
  ON public.member_accounts FOR SELECT
  USING (true);

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
CREATE POLICY "Public read profile-photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-photos');

-- Policy: anon upload ke profile-photos
CREATE POLICY "Allow anon upload profile-photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'profile-photos');

-- ============================================================
-- SELESAI. Verifikasi:
-- SELECT * FROM member_accounts;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'voice_members';
-- ============================================================
