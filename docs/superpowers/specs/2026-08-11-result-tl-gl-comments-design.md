# Design: Komentar TL/GL, Sect. H, Dept H. di Menu Result (Admin)

**Date:** 2026-08-11
**Status:** Approved

## Problem

Di menu "Hasil Voice Member" (`/result`), admin tidak punya cara mencatat tanggapan/tindak
lanjut berjenjang terhadap tiap aspirasi yang masuk. Dibutuhkan 3 kolom komentar independen —
**TL/GL**, **Sect. H**, **Dept H.** — yang bisa diisi admin per entri, dan begitu tersimpan,
langsung terlihat oleh member yang mengirim entri tersebut saat mereka membuka riwayat
aspirasi miliknya sendiri.

## Scope

- 3 kolom komentar independen (bukan alur/workflow berjenjang — tidak ada validasi urutan
  antar level).
- Diisi oleh 1 akun admin yang sama (role `admin` yang sudah ada), bukan akun terpisah per
  level. Tidak ada role baru.
- Berlaku untuk entri yang sudah ada di `voice_members` maupun entri baru — kolom nullable,
  default kosong.

## Approach

**Pilihan: 3 kolom `TEXT` nullable baru di tabel `voice_members`** —
`comment_tl_gl`, `comment_sect_h`, `comment_dept_h`.

Alternatif yang dipertimbangkan dan ditolak:
- **Tabel terpisah `voice_member_comments`** (per-level row dengan author/timestamp) — lebih
  ternormalisasi, tapi berlebihan untuk kebutuhan sekarang karena hanya ada 1 akun admin yang
  mengisi ketiganya, tanpa kebutuhan histori per level. YAGNI.
- **Kolom `jsonb` tunggal** — migrasi lebih ringkas, tapi kurang eksplisit, lebih rumit dipakai
  di `jsPDF`/`autoTable`, dan kurang konsisten dengan pola tipe data yang sudah dipakai di
  codebase ini.

Pendekatan 3 kolom `TEXT` konsisten dengan pola `photo_url` yang sudah ada di tabel yang sama.

**RLS:** tidak ada perubahan RLS baru. Policy `UPDATE` yang sudah ada
(`"Allow public update"` pada `voice_members`, ditambahkan saat fix RLS foto — lihat
`supabase-migration.sql` bagian 8) sudah mengizinkan update kolom apapun di tabel ini. Kontrol
siapa yang boleh mengisi komentar tetap di level UI (pola yang sama seperti tombol hapus/
upload foto: hanya admin yang melihat form editnya).

## Data Model

### Migration (tambahan di `supabase-migration.sql`, section baru)

```sql
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_tl_gl TEXT DEFAULT NULL;
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_sect_h TEXT DEFAULT NULL;
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_dept_h TEXT DEFAULT NULL;
```

Diterapkan ke Supabase project via MCP `apply_migration`, sama seperti perubahan sebelumnya.

### Type (`src/lib/types.ts`)

Tambah ke `VoiceMember`:

```ts
comment_tl_gl: string | null;
comment_sect_h: string | null;
comment_dept_h: string | null;
```

Query `fetchData` sudah `select("*")`, jadi kolom baru otomatis ikut terambil tanpa perubahan
query.

## UI — Admin

### Tabel utama (`/result`, role admin)

Kolom baru **"Tanggapan"**, dirender hanya saat `isAdmin` (header `<th>` dan body `<td>`
dibungkus kondisi, mengikuti pola kondisional yang sudah ada di file ini untuk bagian
admin-only). Isi kolom: badge indikator jumlah komentar terisi dari total 3:

| Kondisi | Tampilan |
|---|---|
| 0 dari 3 terisi | badge abu-abu, teks `0/3` |
| 1 atau 2 dari 3 terisi | badge amber, teks `1/3` / `2/3` |
| 3 dari 3 terisi | badge hijau, teks `3/3` |

Badge murni informatif (bukan tombol) — klik baris tetap membuka modal detail seperti sekarang
(tidak perlu `stopPropagation`). Tambah class CSS baru `.badge-gray` di `globals.css`
mengikuti pola `.badge-blue`/`.badge-green`/`.badge-amber` yang sudah ada; badge amber & hijau
memakai class yang sudah ada.

### Modal detail (admin)

Section baru **"Tanggapan"**, ditempatkan setelah "Isi Voice Member" dan sebelum
"Foto Dokumentasi", dirender hanya saat `isAdmin`. Berisi 3 textarea:

- Label "Komentar TL/GL" → `comment_tl_gl`
- Label "Komentar Sect. H" → `comment_sect_h`
- Label "Komentar Dept H." → `comment_dept_h`

State lokal `commentDraft` (`{ tlGl, sectH, deptH }`) disinkronkan dari `selectedRow` setiap
kali modal dibuka/baris berganti (via `useEffect` yang mengamati `selectedRow?.id`), supaya
draft tidak "bocor" antar entri saat admin membuka baris berbeda tanpa menyimpan.

1 tombol **"Simpan Komentar"** menyimpan ketiga kolom sekaligus:

- `saveComments(row)` — pola sama seperti `uploadPhotoForRow`: `supabase.from("voice_members")
  .update({...}).eq("id", row.id)`, lalu update `data`, `filtered`, dan `selectedRow` di state
  lokal supaya UI langsung reflect tanpa refetch.
- State `savingComment: boolean` untuk loading spinner di tombol.
- State `commentError: string | null` untuk toast error, mengikuti pola `uploadError`/
  `deleteError` yang sudah ada (toast di posisi tetap, auto-dismiss via tombol X). Jika gagal,
  isi textarea (draft) **tidak** direset, supaya admin bisa coba simpan lagi tanpa mengetik
  ulang.

## UI — Member

### Modal detail (member, `!isAdmin`)

Section **"Tanggapan"** ditempatkan di posisi yang sama (setelah "Isi Voice Member", sebelum
"Foto Dokumentasi"), tapi:

- Read-only (bukan textarea — teks biasa, mengikuti gaya blok "Isi Voice Member").
- Hanya muncul jika **minimal 1 dari 3** kolom terisi (non-null & non-empty setelah `trim()`).
- Hanya menampilkan komentar yang terisi — kolom yang masih kosong disembunyikan sepenuhnya
  (bukan ditampilkan dengan placeholder "Belum ada komentar").
- Tidak ada perubahan di tabel utama member (tidak ada kolom "Tanggapan" baru di tabel milik
  member — sesuai keputusan, cukup di modal).

## PDF Export

### `exportSingleDetailPDF` (PDF per-entri, tombol "Download PDF" di modal — dipakai admin & member)

Tambah section **"Tanggapan"** setelah blok "Isi Voice Member" dan sebelum foto dokumentasi
(jika ada foto). Hanya komentar yang terisi yang dicetak (skip yang kosong) — aturan yang sama
dengan tampilan modal member, dan berlaku juga saat admin yang mengekspor (konsisten, sederhana).
Format: label bold diikuti isi komentar, mengikuti gaya blok "Isi Voice Member" yang sudah ada
(word-wrap via `doc.splitTextToSize`, page-break check yang sama).

### `exportPDF` (export PDF rekap tabel keseluruhan)

**Tidak berubah.** Tidak menambah kolom komentar di rekap tabel, supaya tidak terlalu padat.

## Error Handling

- Gagal simpan komentar → toast error (pola sama seperti upload foto), draft tidak hilang,
  admin bisa klik "Simpan Komentar" lagi.
- Gagal fetch (kolom baru ikut di `select("*")` yang sudah ada) → sudah tercover oleh error
  handling `fetchData` yang sudah ada, tidak perlu perubahan.

## Testing / Verification (manual)

1. Sebagai admin: buka salah satu entri, isi ketiga komentar, klik "Simpan Komentar" →
   toast sukses tidak error, badge di tabel berubah jadi `3/3` (hijau) tanpa perlu refresh.
2. Reopen modal entri yang sama → ketiga textarea terisi ulang dengan nilai yang baru
   disimpan (bukti persist ke DB, bukan cuma state lokal).
3. Isi sebagian (1-2 dari 3) → badge tabel berubah jadi `1/3`/`2/3` (amber).
4. Logout admin, login sebagai member pemilik entri tersebut → buka `/result` →
   klik entri yang sama → modal menampilkan section "Tanggapan" berisi hanya komentar yang
   terisi, read-only.
5. Entri lain milik member yang sama tapi belum ada komentar sama sekali → modal member
   **tidak** menampilkan section "Tanggapan" sama sekali.
6. Download PDF dari modal (baik sebagai admin maupun member) pada entri yang punya komentar
   → section "Tanggapan" muncul di PDF, hanya yang terisi.
7. Export PDF rekap tabel keseluruhan → pastikan tidak berubah (tidak ada kolom komentar baru).
8. Gagal simpan (mis. matikan koneksi sesaat) → toast error muncul, teks yang sudah diketik di
   textarea tidak hilang.
