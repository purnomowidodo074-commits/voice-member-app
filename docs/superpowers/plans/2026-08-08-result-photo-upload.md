# Result-Page Missing-Photo Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member upload a photo, from the `/result` page, to a `voice_members`
entry they submitted without one — from both the results table and the detail
modal.

**Architecture:** All UI/state changes live in `voice-app/src/app/result/page.tsx`
(no new files — this page already owns the table, detail modal, and photo
lightbox). A single hidden `<input type="file">` and one `uploadPhotoForRow`
handler are shared by both trigger points (table cell + modal). Uploads reuse
the exact upload pattern already used in `src/app/page.tsx`'s `handleSubmit`
(same bucket, same filename scheme), then `UPDATE` the row's `photo_url` and
patch local state — no refetch. A new Postgres RLS policy on `voice_members`
(`UPDATE`) is required first, or every upload will fail with "new row violates
row-level security policy", the same failure mode fixed earlier for the
`voice-photos` storage bucket.

**Tech Stack:** Next.js 16 (App Router, client components), Supabase JS client
(`@supabase/supabase-js`), `lucide-react` icons, Tailwind utility classes. No
test runner is configured in this repo (`package.json` has no `test` script) —
verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus manual
browser verification.

## Global Constraints

- Feature applies **only** to role `member` (`!isAdmin`), and only to entries
  already scoped to that member (table rows are pre-filtered by `noreg` in
  `fetchData()` for non-admins — see `voice-app/src/app/result/page.tsx:250-251`).
- No new file validation beyond `file.type.startsWith("image/")` — matches
  `src/app/page.tsx`'s existing `handleFile` (no size limit enforced there
  either; do not add one here).
- Upload happens immediately on file selection — no preview/confirm step.
- Storage bucket, filename scheme, and public-URL retrieval must match
  `src/app/page.tsx:88-101` exactly (bucket `"voice-photos"`, filename
  `` `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}` ``).
- RLS policy naming/style must match the existing pattern in
  `voice-app/supabase-migration.sql` (`DROP POLICY IF EXISTS ...; CREATE POLICY
  ... USING (true) WITH CHECK (true);`).
- Supabase project id for all DB operations: `hkrdqeauhfloqguojggx` (confirmed
  against `voice-app/.env.local`'s `NEXT_PUBLIC_SUPABASE_URL` in the prior
  session — do not re-derive from a different project).

---

### Task 1: Add missing `UPDATE` RLS policy on `voice_members`

**Files:**
- Modify: `voice-app/supabase-migration.sql` (append new section at end, before
  the closing `-- SELESAI. Verifikasi:` comment block)

**Interfaces:**
- Produces: a live `UPDATE` policy named `"Allow public update"` on
  `public.voice_members`, required by Task 2's `uploadPhotoForRow`'s
  `.update({ photo_url })` call.

- [ ] **Step 1: Confirm the policy is currently missing**

Use the `mcp__claude_ai_Supabase__execute_sql` tool (project_id
`hkrdqeauhfloqguojggx`):

```sql
select policyname, cmd from pg_policies where schemaname='public' and tablename='voice_members';
```

Expected: rows for `INSERT`, `SELECT`, `DELETE` only — no `UPDATE` row.

- [ ] **Step 2: Apply the policy to the live database**

Use the `mcp__claude_ai_Supabase__apply_migration` tool (project_id
`hkrdqeauhfloqguojggx`, name `add_voice_members_update_policy`):

```sql
DROP POLICY IF EXISTS "Allow public update" ON public.voice_members;
CREATE POLICY "Allow public update"
  ON public.voice_members FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

- [ ] **Step 3: Verify the policy now exists**

Re-run the query from Step 1. Expected: a fourth row with `cmd = 'UPDATE'` and
`policyname = 'Allow public update'`.

- [ ] **Step 4: Record the policy in the migration file**

Edit `voice-app/supabase-migration.sql`. Find this block near the end of the
file:

```sql
-- ============================================================
-- SELESAI. Verifikasi:
-- SELECT * FROM member_accounts;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'voice_members';
-- SELECT * FROM app_settings;
-- SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
-- ============================================================
```

Replace it with:

```sql
-- ============================================================
-- 8. voice_members: policy UPDATE
-- Dibutuhkan agar member bisa menambahkan foto ke entri yang sudah
-- terkirim tanpa foto (lihat docs/superpowers/specs/2026-08-08-result-photo-upload-design.md).
-- Tanpa ini, UPDATE ditolak dengan error "new row violates row-level
-- security policy" — pola yang sama seperti kasus bucket voice-photos.
-- ============================================================
DROP POLICY IF EXISTS "Allow public update" ON public.voice_members;
CREATE POLICY "Allow public update"
  ON public.voice_members FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- SELESAI. Verifikasi:
-- SELECT * FROM member_accounts;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'voice_members';
-- SELECT * FROM app_settings;
-- SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
-- SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='voice_members';
-- ============================================================
```

- [ ] **Step 5: Commit**

```bash
git add voice-app/supabase-migration.sql
git commit -m "fix: add missing UPDATE RLS policy for voice_members

Members had no way to add a photo to an already-submitted entry —
any UPDATE was rejected by RLS since only INSERT/SELECT/DELETE
policies existed. Applied the matching UPDATE policy to the live DB
and recorded it here.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Upload handler, hidden input, error toast, and table wiring

**Files:**
- Modify: `voice-app/src/app/result/page.tsx`

**Interfaces:**
- Consumes: `supabase` client from `@/lib/supabase` (already imported);
  `VoiceMember` type from `@/lib/types` (already imported); the `UPDATE` RLS
  policy from Task 1.
- Produces:
  - `uploadPhotoForRow(row: VoiceMember, file: File): Promise<void>` — used
    again by Task 3's modal wiring.
  - `triggerPhotoUpload(rowId: string): void` — used again by Task 3.
  - State `uploadingId: string | null` — read again by Task 3 to show the
    modal's spinner.

- [ ] **Step 1: Add `useRef` to the React import and `ImagePlus` to the lucide-react import**

In `voice-app/src/app/result/page.tsx`, change line 3 from:

```tsx
import { useState, useEffect, useCallback, useMemo } from "react";
```

to:

```tsx
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
```

Change the lucide-react import block (lines 4-15) from:

```tsx
import {
  RefreshCw,
  Search,
  ImageIcon,
  FileText,
  Inbox,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  X,
  Download,
} from "lucide-react";
```

to:

```tsx
import {
  RefreshCw,
  Search,
  ImageIcon,
  ImagePlus,
  FileText,
  Inbox,
  ExternalLink,
  RotateCcw,
  AlertTriangle,
  X,
  Download,
} from "lucide-react";
```

- [ ] **Step 2: Add upload state and a ref for the hidden file input**

Find this line inside `ResultPage` (currently the last state declaration):

```tsx
  const [selectedRow, setSelectedRow] = useState<VoiceMember | null>(null);
```

Add immediately after it:

```tsx
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: Add the upload handler functions**

Find the end of the existing `deleteRow` function:

```tsx
  const deleteRow = async (id: string) => {
    setDeletingId(id);
    setDeleteError(null);
    try {
      const { data: deleted, error } = await supabase
        .from("voice_members")
        .delete()
        .eq("id", id)
        .select();
      if (error) throw error;
      if (!deleted || deleted.length === 0) {
        throw new Error("Hapus gagal — tambahkan policy DELETE di Supabase RLS.");
      }
      setData((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Gagal menghapus data");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };
```

Add immediately after it (before `const resetRanking = async () => {`):

```tsx
  const uploadPhotoForRow = async (row: VoiceMember, file: File) => {
    if (!file.type.startsWith("image/")) return;

    setUploadingId(row.id);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("voice-photos")
        .upload(fileName, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("voice-photos")
        .getPublicUrl(fileName);
      const photo_url = urlData.publicUrl;

      const { error: updateErr } = await supabase
        .from("voice_members")
        .update({ photo_url })
        .eq("id", row.id);
      if (updateErr) throw updateErr;

      setData((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, photo_url } : r))
      );
      setFiltered((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, photo_url } : r))
      );
      setSelectedRow((prev) =>
        prev && prev.id === row.id ? { ...prev, photo_url } : prev
      );
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Gagal mengunggah foto");
    } finally {
      setUploadingId(null);
    }
  };

  const triggerPhotoUpload = (rowId: string) => {
    setUploadTargetId(rowId);
    uploadInputRef.current?.click();
  };

  const handleUploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file || !uploadTargetId) return;
    const row = data.find((r) => r.id === uploadTargetId);
    if (row) uploadPhotoForRow(row, file);
  };
```

- [ ] **Step 4: Render the hidden file input and the upload error toast**

Find the start of the component's returned JSX:

```tsx
  return (
    <div className="min-h-screen py-10 px-4">
      {/* Delete Error Toast */}
```

Change to:

```tsx
  return (
    <div className="min-h-screen py-10 px-4">
      {/* Hidden input untuk upload foto entri yang belum ada fotonya */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUploadInputChange}
      />

      {/* Delete Error Toast */}
```

Find the end of the existing Delete Error Toast block:

```tsx
      {deleteError && (
        <div className="fixed top-5 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border border-red-200 bg-white max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm font-medium text-slate-700">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="ml-auto text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
```

Add immediately after it (before `{/* Photo Modal */}`):

```tsx
      {/* Upload Error Toast */}
      {uploadError && (
        <div className="fixed top-20 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border border-red-200 bg-white max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm font-medium text-slate-700">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="ml-auto text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
```

(It's placed at `top-20` rather than `top-5` so it doesn't overlap the Delete
Error Toast if both happen to fire close together.)

- [ ] **Step 5: Wire the table's Foto column empty state**

Find the table cell's empty-photo branch:

```tsx
                      <td className="text-center">
                        {row.photo_url ? (
                          <button
                            id={`btn-photo-${row.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoto(row.photo_url!);
                            }}
                            className="inline-block relative overflow-hidden rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all p-0 bg-slate-50"
                            style={{ width: "48px", height: "48px" }}
                            title="Lihat foto"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={row.photo_url}
                              alt="thumb"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : (
                          <div
                            className="flex items-center justify-center rounded-lg mx-auto bg-slate-50 border border-slate-200"
                            style={{ width: "48px", height: "48px" }}
                          >
                            <ImageIcon size={18} className="text-slate-300" />
                          </div>
                        )}
                      </td>
```

Replace the `) : (` ... `)}` else-branch so the full cell becomes:

```tsx
                      <td className="text-center">
                        {row.photo_url ? (
                          <button
                            id={`btn-photo-${row.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPhoto(row.photo_url!);
                            }}
                            className="inline-block relative overflow-hidden rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all p-0 bg-slate-50"
                            style={{ width: "48px", height: "48px" }}
                            title="Lihat foto"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={row.photo_url}
                              alt="thumb"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : !isAdmin ? (
                          <button
                            id={`btn-upload-photo-${row.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerPhotoUpload(row.id);
                            }}
                            disabled={uploadingId === row.id}
                            className="flex items-center justify-center rounded-lg mx-auto bg-slate-50 border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all disabled:opacity-60"
                            style={{ width: "48px", height: "48px" }}
                            title="Unggah foto"
                          >
                            {uploadingId === row.id ? (
                              <span className="spinner" style={{ width: "16px", height: "16px", borderWidth: "2px" }} />
                            ) : (
                              <ImagePlus size={18} className="text-slate-400" />
                            )}
                          </button>
                        ) : (
                          <div
                            className="flex items-center justify-center rounded-lg mx-auto bg-slate-50 border border-slate-200"
                            style={{ width: "48px", height: "48px" }}
                          >
                            <ImageIcon size={18} className="text-slate-300" />
                          </div>
                        )}
                      </td>
```

- [ ] **Step 6: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual browser verification (table only)**

Requires a `member`-role login whose account has at least one `voice_members`
entry with `photo_url IS NULL`. If no such test account/entry is available in
this environment, skip to Step 8 and note the gap explicitly instead of
claiming this was verified — do not fabricate a passing manual test.

If credentials are available:
1. Log in as that member, go to `/result`.
2. Confirm the entry without a photo shows a dashed upload box (not the plain
   gray icon) in the Foto column.
3. Click it → OS file picker opens.
4. Select an image file → box shows a spinner, then the uploaded thumbnail,
   without a page refresh.
5. Refresh the page → thumbnail persists (confirms the DB `UPDATE` landed, not
   just local state).

- [ ] **Step 8: Commit**

```bash
git add voice-app/src/app/result/page.tsx
git commit -m "feat: let members upload a photo to entries missing one (table)

Empty photo cells in the results table are now clickable for members
(their own entries only) and upload straight to the voice-photos
bucket, then update photo_url in place.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Wire the detail modal's photo section

**Files:**
- Modify: `voice-app/src/app/result/page.tsx`

**Interfaces:**
- Consumes: `uploadPhotoForRow`, `triggerPhotoUpload`, `uploadingId` from
  Task 2 (same file, no new exports needed since everything lives in one
  component).

- [ ] **Step 1: Wire the modal's empty-photo branch**

Find the detail modal's photo section:

```tsx
              {selectedRow.photo_url && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Foto Dokumentasi
                  </p>
                  <button
                    onClick={() => setSelectedPhoto(selectedRow!.photo_url!)}
                    className="block rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all p-0 w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedRow.photo_url}
                      alt="Foto dokumentasi"
                      className="w-full max-h-64 object-cover"
                    />
                  </button>
                </div>
              )}
```

Replace it with:

```tsx
              {selectedRow.photo_url ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Foto Dokumentasi
                  </p>
                  <button
                    onClick={() => setSelectedPhoto(selectedRow!.photo_url!)}
                    className="block rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all p-0 w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedRow.photo_url}
                      alt="Foto dokumentasi"
                      className="w-full max-h-64 object-cover"
                    />
                  </button>
                </div>
              ) : (
                !isAdmin && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Foto Dokumentasi
                    </p>
                    <button
                      id="btn-upload-photo-modal"
                      onClick={() => triggerPhotoUpload(selectedRow!.id)}
                      disabled={uploadingId === selectedRow.id}
                      className="flex flex-col items-center justify-center gap-2 w-full rounded-lg border border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 transition-all py-8 disabled:opacity-60"
                    >
                      {uploadingId === selectedRow.id ? (
                        <span className="spinner" style={{ width: "20px", height: "20px", borderWidth: "2px" }} />
                      ) : (
                        <>
                          <ImagePlus size={22} className="text-slate-400" />
                          <span className="text-xs text-slate-500 font-medium">Klik untuk unggah foto</span>
                        </>
                      )}
                    </button>
                  </div>
                )
              )}
```

- [ ] **Step 2: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser verification (modal)**

Same credential caveat as Task 2 Step 7 — only claim this was verified if you
actually ran it.

If credentials are available:
1. As the member from Task 2, click the table row for the entry that still has
   no photo (or another entry that has none) to open the detail modal.
2. Confirm the "Foto Dokumentasi" section shows a dashed "Klik untuk unggah
   foto" box.
3. Click it → file picker opens → select an image → spinner shows → photo
   renders inside the modal without closing it.
4. Close the modal, confirm the table's Foto cell for that row now shows the
   thumbnail too (proves `selectedRow` and `data`/`filtered` stayed in sync).

- [ ] **Step 4: Commit**

```bash
git add voice-app/src/app/result/page.tsx
git commit -m "feat: let members upload a photo to entries missing one (modal)

Detail modal's photo section now shows an upload prompt instead of
disappearing entirely when a member's entry has no photo yet, reusing
the same upload handler wired for the table in the previous commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Full verification pass

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Admin regression check**

If credentials are available, log in as `admin` and view `/result`. Confirm:
- Entries with no photo still show the plain gray `ImageIcon` box (not the
  dashed upload button) in the table.
- Opening the detail modal for an admin-visible entry with no photo shows no
  photo section at all (same as before this feature — admins get no upload
  affordance).

If credentials are not available, instead read
`voice-app/src/app/result/page.tsx` and confirm by inspection that every new
upload branch (table cell, modal section) is gated behind `!isAdmin`, and
state that this was verified by code reading, not by running the app.

- [ ] **Step 2: Error-path check**

If credentials are available: temporarily disconnect network (or use browser
devtools to block the Supabase storage request), attempt an upload, confirm
the Upload Error Toast appears with a readable message and `uploadingId`
resets (spinner disappears, button becomes clickable again). If not available,
verify by reading the `catch`/`finally` blocks in `uploadPhotoForRow` that
this is what the code does.

- [ ] **Step 3: Lint**

Run: `cd voice-app && npm run lint`
Expected: no new errors introduced by this feature (pre-existing warnings in
the file, if any, are out of scope — do not fix unrelated lint issues here).

- [ ] **Step 4: Production build**

Run: `cd voice-app && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Report results honestly**

Summarize, for each of Steps 1-4 above, whether it was actually executed
(browser verification ran) or only verified by static code reading (because
credentials weren't available) — per `superpowers:verification-before-completion`,
never state something was tested when it was only reasoned about.
