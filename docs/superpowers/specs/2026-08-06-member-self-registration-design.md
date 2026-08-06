# Member Self-Registration Design

**Date:** 2026-08-06
**Status:** Approved

## Problem

The activation flow (`voice-app/src/app/login/page.tsx`, backed by `AuthProvider.tsx`) only lets a person create a `member_accounts` row if their `noreg` exists in the static, Excel-derived `MEMBERS` roster (`voice-app/src/lib/members.ts`, "Auto-generated from data-login.xlsx — jangan edit manual"). New employees who aren't yet in that frozen roster get a flat "Noreg tidak ditemukan" error and cannot create an account at all.

## Goal

Let a genuinely new member (noreg absent from both `MEMBERS` and `member_accounts`) self-register by supplying their own nama, noreg, and password — landing in `member_accounts` immediately activated, able to log in right away. No admin approval step. Preserve the existing Excel-verified flow unchanged.

## Design

### 1. Data layer (Supabase)

Add one column to `public.member_accounts` on the current project (`voice-member`, ref `hkrdqeauhfloqguojggx`):

```sql
alter table public.member_accounts
  add column is_self_registered boolean not null default false;
```

- `false` (default): activated via the Excel-verified roster (existing flow, untouched).
- `true`: created via this new self-registration flow.

No RLS policy changes needed — existing `member_accounts` insert/select policies already allow the anon role to insert and read (matching the existing `activate()` usage).

### 2. Auth logic (`voice-app/src/components/AuthProvider.tsx`)

**`verifyNoreg` — add a `notInRoster` flag**

Current signature returns `{ valid, nama?, message }`. Extend to:

```ts
verifyNoreg: (noreg: string) => Promise<{
  valid: boolean;
  nama?: string;
  notInRoster?: boolean;
  message: string;
}>
```

Behavior (only the "not found" branch changes):
- Found in `MEMBERS`, not yet in `member_accounts` → `valid: true` (unchanged).
- Found in `MEMBERS`, already in `member_accounts` → `valid: false`, "Akun dengan Noreg ini sudah aktif. Silakan langsung login." (unchanged).
- **Not found in `MEMBERS`** → `valid: false, notInRoster: true`, message changes to: *"Noreg tidak ditemukan di daftar karyawan terdaftar. Jika Anda member baru, silakan daftar mandiri."*

**New function: `registerNew`**

```ts
registerNew: (noreg: string, nama: string, password: string) => Promise<ActivateResult>
```

Validation before insert:
- `noreg` must match `/^\d{7}$/` (same 7-digit format as the official roster) → else `{ success: false, message: "Noreg harus berupa 7 digit angka." }`
- `nama` must be non-empty after trim → else `{ success: false, message: "Nama wajib diisi." }`
- `nama` is trimmed and uppercased before storage (matches the all-caps convention of the existing `MEMBERS` data)
- Password length/confirmation is validated in the UI layer, same as the existing `activate()` caller does — `registerNew` itself just hashes and inserts

Insert into `member_accounts` with `role: "member"`, `is_self_registered: true`. On unique-violation (`error.code === "23505"`, i.e. noreg already taken — race condition or someone re-submitting) return `{ success: false, message: "Noreg sudah terdaftar. Silakan login." }`, mirroring `activate()`'s existing error handling exactly.

`login()` is unchanged — once a row exists in `member_accounts`, login works identically regardless of `is_self_registered`.

`AuthContextType` and the default context value both gain `registerNew`.

### 3. UI — Activation page (`voice-app/src/app/login/page.tsx`)

Step 1 (enter noreg, submit) is unchanged in markup. Only the handling of a failed `verifyNoreg` result changes:

- `notInRoster` false (i.e., noreg exists but already activated) → show the error message as today, no new button.
- `notInRoster` true → show the message plus a new button **"Daftar sebagai Anggota Baru"**.

Clicking that button sets a new piece of state, e.g. `isNewMember: boolean` (default `false`), to `true`, pre-fills `aktiNoreg` with what was typed (still editable), clears `aktiNama`, and advances to `aktiStep = 2`.

Step 2 rendering branches on `isNewMember`:

| | Verified (existing) | New member (this feature) |
|---|---|---|
| Nama | Read-only card showing name pulled from `MEMBERS` | Free-text input, required |
| Noreg | Read-only, shown in the verified card | Editable text input, pattern-validated to 7 digits |
| Step label | "Buat Password" | "Lengkapi Data Anggota Baru" |
| Extra banner | none | Info banner: "Data Anda akan disimpan sebagai member baru (di luar daftar resmi)." |
| Password / confirm fields | unchanged | unchanged |
| Submit handler | calls `activate(aktiNoreg, aktiNama, aktiPassword)` | calls `registerNew(aktiNoreg, aktiNama, aktiPassword)` |

Success handling (both paths): show success message, reset all aktivasi state including `isNewMember`, switch to the "Masuk" tab after 2s with noreg pre-filled — same as today.

`handleBackToStep1` and `handleTabChange` also reset `isNewMember` to `false`.

### 4. UI — Admin page (`voice-app/src/app/members/page.tsx`)

- `fetchData`'s select query adds `is_self_registered` to the selected columns.
- `ActivatedAccount` interface gains `is_self_registered: boolean`.
- New derived list: `memberBaru = accounts.filter(a => a.is_self_registered)`.
- New stat tile (4th, alongside Total/Sudah/Belum): **"Member Baru (Mandiri)"** showing `memberBaru.length`, clicking it sets `tab = "baru"`.
- `tab` state type extends from `"belum" | "sudah"` to `"belum" | "sudah" | "baru"`.
- New table view for `tab === "baru"`: columns Noreg, Nama, Waktu Daftar (reuses `formatDateTime`), filtered by the existing `search` box the same way `filteredBelum`/`filteredSudah` are.
- Empty state: "Belum ada member yang daftar mandiri" (mirrors the existing empty-state pattern).

No changes to `Navbar.tsx` or route guards — `/members` access is already admin-only.

## Out of scope

- Admin approval/moderation of self-registered accounts (explicitly rejected — immediate activation was chosen).
- Editing/deleting self-registered accounts from the admin page.
- Syncing self-registered members back into the `MEMBERS` Excel-derived list.
- Any changes to `login()` or password hashing.

## Testing

- New member with unregistered noreg → sees "Daftar sebagai Anggota Baru" button → completes form → can log in immediately.
- Noreg format rejected if not exactly 7 digits.
- Duplicate noreg (two people submitting the same new noreg concurrently) → second submission gets "Noreg sudah terdaftar."
- Existing Excel-verified flow (noreg in `MEMBERS`) unaffected — no regression in `activate()`/`verifyNoreg()` happy path.
- Admin `/members` page: self-registered accounts appear only in the new "Member Baru" tab/tile, not in "Sudah Aktivasi" (which stays scoped to the Excel roster).
