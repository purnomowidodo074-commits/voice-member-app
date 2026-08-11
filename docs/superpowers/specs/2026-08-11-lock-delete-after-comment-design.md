# Design: Kunci Tombol Hapus Member Setelah Ada Komentar

**Date:** 2026-08-11
**Status:** Approved

## Problem

Di `/result`, member bisa menghapus entri aspirasinya sendiri kapan saja, termasuk
setelah admin sudah menanggapinya lewat komentar TL/GL / Sect. H / Dept H. (lihat
[[2026-08-11-result-tl-gl-comments-design]]). Ini berisiko menghilangkan data yang
sudah ditanggapi. Begitu minimal satu komentar terisi, member tidak boleh lagi bisa
menghapus entri itu.

## Scope

- Berlaku **hanya untuk member** (`!isAdmin`). Admin tetap bisa menghapus entri
  kapan saja, terlepas dari status komentar — admin butuh kemampuan ini untuk
  koreksi data.
- Ambang batas: **minimal 1 dari 3** kolom komentar terisi (`comment_tl_gl`,
  `comment_sect_h`, `comment_dept_h`) — sama seperti aturan "kapan section
  Tanggapan muncul di modal member" pada fitur sebelumnya.
- Perubahan murni di UI (kolom "Aksi" tabel `/result`). Tidak ada perubahan skema
  DB atau RLS — konsisten dengan pola keamanan yang sudah dipakai di seluruh
  halaman ini (kontrol peran selalu di level client, bukan RLS).

## Approach

Reuse helper `filledComments(row)` yang sudah ada (dari fitur komentar
sebelumnya) — tidak perlu logika penghitungan baru. Di kolom "Aksi" tabel,
bungkus konten tombol hapus (baik state ikon "Hapus data" maupun state
konfirmasi "Yakin?") dengan kondisi:

```tsx
!isAdmin && filledComments(row).length > 0
```

Ketika kondisi ini benar, sel "Aksi" untuk baris itu dikosongkan total (tidak ada
elemen apa pun) — bukan ditampilkan nonaktif/abu-abu. Untuk admin, atau untuk
member pada entri yang belum ada komentarnya sama sekali, tombol hapus tetap
tampil dan berfungsi seperti sekarang, tanpa perubahan.

## Testing / Verification (manual)

1. Sebagai member: buka entri yang belum ada komentarnya — tombol hapus (ikon
   tempat sampah) tetap muncul dan berfungsi seperti biasa.
2. Sebagai member: buka entri yang sudah punya minimal 1 komentar (isi salah
   satu dulu lewat akun admin, lalu reload sebagai member) — kolom Aksi untuk
   baris itu kosong, tidak ada ikon hapus sama sekali.
3. Sebagai admin: baris manapun (dengan atau tanpa komentar) tetap punya tombol
   hapus yang berfungsi normal.
