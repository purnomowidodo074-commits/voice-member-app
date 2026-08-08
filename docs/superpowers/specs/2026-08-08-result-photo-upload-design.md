# Design: Upload Foto untuk Entri Voice Member yang Belum Ada Fotonya

**Date:** 2026-08-08
**Status:** Approved

## Problem

Di halaman `/result`, kolom "Foto" pada tabel dan bagian foto pada modal detail hanya
menampilkan placeholder pasif (ikon `ImageIcon`) ketika sebuah entri `voice_members`
tidak punya `photo_url`. Anggota (role `member`) yang lupa menyertakan foto saat
mengisi form aspirasi tidak punya cara untuk menambahkan foto belakangan ke entri
yang sudah terkirim.

## Scope

- Berlaku di `voice-app/src/app/result/page.tsx`.
- Hanya untuk role **member**, dan hanya untuk entri miliknya sendiri. Karena
  `fetchData()` sudah memfilter baris member dengan `.eq("noreg", user.noreg)`,
  setiap baris yang tampil di tabel member sudah otomatis miliknya sendiri — cukup
  gate fitur ini dengan `!isAdmin`.
- Admin tidak terpengaruh — tetap melihat placeholder pasif seperti sekarang, tidak
  ada tombol upload untuk admin.
- Berlaku di dua tempat: kolom `Foto` pada baris tabel, dan seksi foto pada modal
  detail (baik saat modal dibuka untuk entri yang belum ada foto).

## UX Flow

1. Placeholder foto kosong (baik di sel tabel maupun di modal detail) menjadi tombol
   yang bisa diklik.
2. Klik membuka file picker (`<input type="file" accept="image/*" hidden>`) — satu
   input tersembunyi dipakai bersama oleh seluruh baris, ditarget lewat state
   `uploadTargetId: string | null` yang diset sebelum `fileInputRef.current.click()`.
3. Begitu user memilih file, upload langsung berjalan (tanpa langkah preview/konfirmasi
   terpisah) — konsisten dengan micro-interaction upload avatar yang cepat.
4. Selama proses upload berjalan, kotak foto pada baris/modal yang bersangkutan
   menampilkan spinner kecil, dikontrol lewat state `uploadingId: string | null`.
5. Setelah upload+update DB sukses, state lokal (`data`, `filtered`, dan `selectedRow`
   bila modal sedang terbuka untuk baris yang sama) diperbarui langsung dengan
   `photo_url` baru — tidak perlu refetch penuh dari server.
6. Bila terjadi error (upload storage gagal, atau update DB gagal), tampilkan toast
   error di pojok kanan atas memakai pola yang sama dengan toast `deleteError` yang
   sudah ada di halaman ini (state baru `uploadError`).

## Data Flow / Implementation

Tambahkan fungsi `uploadPhotoForRow(row: VoiceMember, file: File)` di
`result/page.tsx`:

```
1. Validasi file.type.startsWith("image/") — samakan dengan validasi yang sudah
   dipakai di form input utama (src/app/page.tsx handleFile). Tidak menambahkan
   validasi ukuran baru karena form input utama sendiri juga tidak menegakkannya
   di kode (hanya disebut di UI copy) — YAGNI, konsisten dengan pola yang sudah ada.
2. setUploadingId(row.id)
3. Upload ke storage bucket "voice-photos" dengan nama file
   `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
   (pola sama persis dengan src/app/page.tsx handleSubmit).
4. Ambil public URL via supabase.storage.from("voice-photos").getPublicUrl(fileName).
5. supabase.from("voice_members").update({ photo_url }).eq("id", row.id)
6. Update state lokal: data, filtered (map & replace baris dengan id sama),
   dan selectedRow bila selectedRow?.id === row.id.
7. Catch: setUploadError(message) — reuse toast pattern.
8. Finally: setUploadingId(null)
```

UI perubahan:
- Kolom tabel `Foto` (baris `{row.photo_url ? ... : ...}`): cabang "tidak ada foto"
  diganti jadi `<button>` (bukan `<div>` statis) ketika `!isAdmin`, dengan
  `onClick` yang `stopPropagation()` (supaya tidak ikut membuka modal detail),
  set `uploadTargetId`, lalu trigger file input. Tampilkan spinner bila
  `uploadingId === row.id`; jika tidak, tampilkan ikon `ImageIcon` seperti sekarang
  untuk admin, atau ikon `ImagePlus` (import baru dari `lucide-react`, sudah dipakai
  dengan makna sama di `src/app/page.tsx`) untuk member — supaya secara visual
  jelas mana yang bisa diklik.
- Modal detail: seksi foto (`{selectedRow.photo_url && (...)}`) diperluas jadi
  `{selectedRow.photo_url ? (...) : !isAdmin && (<tombol upload>)}` — supaya
  member yang entrinya belum ada foto melihat tombol upload di modal, sementara
  admin tidak melihat apa pun (sama seperti sebelumnya — seksi foto disembunyikan
  total kalau tidak ada foto).

## Database Change

Tabel `public.voice_members` saat ini punya RLS policy `INSERT`, `SELECT`, `DELETE`
(lihat `SUPABASE_SETUP.md`/`DEPLOYMENT_GUIDE.md` + migrasi sebelumnya) tapi **tidak
ada policy `UPDATE`** — default-deny Postgres RLS akan menolak `UPDATE` dengan error
"new row violates row-level security policy", persis seperti kasus upload foto
sebelumnya.

Tambahkan policy baru, konsisten dengan pola tabel ini (keamanan per-user
ditegakkan di level aplikasi lewat filter `noreg` pada query, bukan lewat RLS
per-user di level DB — sama seperti INSERT/DELETE/SELECT yang sudah ada):

```sql
DROP POLICY IF EXISTS "Allow public update" ON public.voice_members;
CREATE POLICY "Allow public update"
  ON public.voice_members FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

Diterapkan langsung ke project live (`hkrdqeauhfloqguojggx`) via migration, dan
dicatat di `voice-app/supabase-migration.sql` sebagai section baru.

## Error Handling

- Upload storage gagal (network, RLS, dsb.) → toast error, `uploadingId` direset,
  tidak ada perubahan state `data`/`filtered`.
- Update DB gagal setelah storage sukses → toast error. (Foto sudah ter-upload ke
  storage tapi `photo_url` di DB belum ter-update — edge case yang sama juga ada
  di form input utama saat ini; tidak butuh rollback storage karena file yatim di
  storage tidak berbahaya, konsisten dengan pola yang sudah ada.)
- File bukan gambar → ditolak diam-diam (return awal), sama seperti
  `handleFile` di form input utama saat ini.

## Testing

- Manual/browser verification (role member, akun dengan entri tanpa foto):
  - Klik placeholder foto di baris tabel → file picker terbuka → pilih gambar →
    spinner muncul → thumbnail baru tampil tanpa refresh manual.
  - Buka modal detail untuk entri yang sama sebelum upload → tombol upload
    muncul di seksi foto; setelah upload dari tabel, buka lagi modal → foto
    baru tampil (state `selectedRow` ikut ter-update kalau modal masih terbuka
    saat upload).
  - Login sebagai admin → placeholder foto entri kosong tetap pasif (tidak ada
    tombol upload).
  - Uji upload gagal (mis. matikan network sesaat) → toast error tampil, tidak
    ada crash.
- `npx tsc --noEmit` untuk memastikan tidak ada regresi type.
