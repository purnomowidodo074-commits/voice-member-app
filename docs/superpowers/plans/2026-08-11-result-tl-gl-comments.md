# Result-Page TL/GL, Sect. H, Dept H. Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admin write 3 independent comments (TL/GL, Sect. H, Dept H.) per
`/result` entry, visible to the member who submitted it when they open their
own entry's detail modal.

**Architecture:** All UI/state changes live in `voice-app/src/app/result/page.tsx`
(no new files — this page already owns the table, detail modal, and PDF
export). 3 new nullable `TEXT` columns are added to `voice_members`, no new
RLS policy needed (the existing `UPDATE` policy already covers it). A shared
module-level helper (`filledComments`) computes which of the 3 comments are
non-empty and is reused by three consumers: the admin table's badge, the
member's read-only modal section, and the per-entry PDF export.

**Tech Stack:** Next.js 16 (App Router, client components), Supabase JS client
(`@supabase/supabase-js`), `lucide-react` icons, Tailwind utility classes,
`jspdf`. No test runner is configured in this repo (`package.json` has no
`test` script) — verification is `npx tsc --noEmit`, `npm run lint`,
`npm run build`, plus manual browser verification.

## Global Constraints

- All UI/logic changes go in `voice-app/src/app/result/page.tsx` — no new
  files (matches the design's decision to reuse the existing page's
  patterns, same as the prior photo-upload feature).
- Supabase project id for all DB operations: `hkrdqeauhfloqguojggx` (from
  `voice-app/.env.local`'s `NEXT_PUBLIC_SUPABASE_URL`).
- **No new RLS policy.** The existing `UPDATE` policy `"Allow public update"`
  on `public.voice_members` (see `voice-app/supabase-migration.sql`,
  section 8) already allows updating any column, including the new comment
  columns. Do not add another policy.
- 3 comments are **independent** (no workflow/ordering between them) and are
  all editable by the single existing `admin` role — no new roles.
- Fixed field order everywhere (table iteration, modal, PDF): **TL/GL, then
  Sect. H, then Dept H.** — never reorder.
- "Filled" means non-null and non-empty after `.trim()`. Empty/whitespace-only
  values are treated the same as `null` and stored as `null` on save (not as
  an empty string).
- Badge thresholds on the admin table's "Tanggapan" column: 0 filled →
  `badge-gray` (`"0/3"`), 1 or 2 filled → `badge-amber` (`"1/3"` / `"2/3"`),
  3 filled → `badge-green` (`"3/3"`).
- Member's modal section is admin-edit vs. member-read-only, and for members
  it renders **only the filled comments** — if none are filled, the whole
  "Tanggapan" section is omitted (not shown with empty placeholders).
- Only `exportSingleDetailPDF` (per-entry PDF, both roles use it) gets a new
  "Tanggapan" section, listing only filled comments. `exportPDF` (the bulk
  table export) is **not** touched — no new column there.
- No admin-only server-side enforcement beyond what already exists in this
  app: like the delete/upload buttons, the comment textareas are gated by
  the client-side `isAdmin` check only (`useAuth()`'s `user?.role === "admin"`)
  — this matches the existing security model of the whole page, not a
  regression.

---

### Task 1: Add comment columns to `voice_members` and the `VoiceMember` type

**Files:**
- Modify: `voice-app/supabase-migration.sql` (append new section 9, before the
  closing `-- SELESAI. Verifikasi:` block)
- Modify: `voice-app/src/lib/types.ts`

**Interfaces:**
- Produces: `VoiceMember.comment_tl_gl`, `VoiceMember.comment_sect_h`,
  `VoiceMember.comment_dept_h`, each `string | null` — consumed by every
  later task.

- [ ] **Step 1: Confirm the columns are currently missing**

Use the `mcp__claude_ai_Supabase__execute_sql` tool (project_id
`hkrdqeauhfloqguojggx`):

```sql
select column_name from information_schema.columns
where table_name = 'voice_members' and column_name like 'comment_%';
```

Expected: zero rows.

- [ ] **Step 2: Apply the migration to the live database**

Use the `mcp__claude_ai_Supabase__apply_migration` tool (project_id
`hkrdqeauhfloqguojggx`, name `add_voice_members_comment_columns`):

```sql
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_tl_gl TEXT DEFAULT NULL;
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_sect_h TEXT DEFAULT NULL;
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_dept_h TEXT DEFAULT NULL;
```

- [ ] **Step 3: Verify the columns now exist**

Re-run the query from Step 1. Expected: 3 rows —
`comment_tl_gl`, `comment_sect_h`, `comment_dept_h`.

- [ ] **Step 4: Record the migration in the SQL file**

In `voice-app/supabase-migration.sql`, find this block near the end of the
file:

```sql
-- ============================================================
-- SELESAI. Verifikasi:
-- SELECT * FROM member_accounts;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'voice_members';
-- SELECT * FROM app_settings;
-- SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
-- SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='voice_members';
-- ============================================================
```

Replace it with:

```sql
-- ============================================================
-- 9. voice_members: kolom komentar TL/GL, Sect. H, Dept H.
-- Kolom nullable untuk tanggapan admin per entri voice member
-- (lihat docs/superpowers/specs/2026-08-11-result-tl-gl-comments-design.md).
-- Diisi lewat modal detail admin di /result, ditampilkan ke member
-- pemilik entri di modal detail miliknya sendiri. Tidak perlu policy
-- RLS baru — policy UPDATE dari section 8 di atas sudah mencakup
-- kolom apapun di tabel ini.
-- ============================================================
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_tl_gl TEXT DEFAULT NULL;
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_sect_h TEXT DEFAULT NULL;
ALTER TABLE public.voice_members
  ADD COLUMN IF NOT EXISTS comment_dept_h TEXT DEFAULT NULL;

-- ============================================================
-- SELESAI. Verifikasi:
-- SELECT * FROM member_accounts;
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'voice_members';
-- SELECT * FROM app_settings;
-- SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
-- SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='voice_members';
-- ============================================================
```

- [ ] **Step 5: Update the `VoiceMember` type**

In `voice-app/src/lib/types.ts`, find:

```ts
export interface VoiceMember {
  id: string;
  created_at: string;
  input_date: string;
  member_name: string;
  noreg: string;
  line_name: string;
  voice_text: string;
  photo_url: string | null;
}
```

Replace with:

```ts
export interface VoiceMember {
  id: string;
  created_at: string;
  input_date: string;
  member_name: string;
  noreg: string;
  line_name: string;
  voice_text: string;
  photo_url: string | null;
  comment_tl_gl: string | null;
  comment_sect_h: string | null;
  comment_dept_h: string | null;
}
```

- [ ] **Step 6: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: no errors (nothing consumes the new fields yet, so this only
confirms the type edit itself is syntactically valid).

- [ ] **Step 7: Commit**

```bash
git add voice-app/supabase-migration.sql voice-app/src/lib/types.ts
git commit -m "feat: add TL/GL, Sect H, Dept H comment columns to voice_members

Adds comment_tl_gl, comment_sect_h, comment_dept_h nullable TEXT
columns so admin can record per-entry feedback that members later
see on their own submissions. No new RLS policy needed - the
existing UPDATE policy already covers these columns.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Shared comment helpers + admin table "Tanggapan" indicator column

**Files:**
- Modify: `voice-app/src/app/globals.css`
- Modify: `voice-app/src/app/result/page.tsx`

**Interfaces:**
- Consumes: `VoiceMember.comment_tl_gl`/`comment_sect_h`/`comment_dept_h`
  from Task 1.
- Produces:
  - `filledComments(row: VoiceMember): { label: string; value: string }[]` —
    reused by Task 4 (member modal) and Task 5 (PDF export).
  - `<CommentBadge row={row} />` component — used only in this task's table
    column.

- [ ] **Step 1: Add the `badge-gray` CSS class**

In `voice-app/src/app/globals.css`, find:

```css
.badge-rose {
  background: #fff1f2;
  color: #be123c;
  border: 1px solid #fecdd3;
}
```

Add immediately after it:

```css

.badge-gray {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}
```

- [ ] **Step 2: Add `COMMENT_FIELDS`, `filledComments`, and `CommentBadge`**

In `voice-app/src/app/result/page.tsx`, find:

```tsx
function formatDateTime(dtStr: string) {
  if (!dtStr) return "-";
  const d = new Date(dtStr);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MemberBarChart({
```

Replace with:

```tsx
function formatDateTime(dtStr: string) {
  if (!dtStr) return "-";
  const d = new Date(dtStr);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const COMMENT_FIELDS: {
  key: "comment_tl_gl" | "comment_sect_h" | "comment_dept_h";
  label: string;
}[] = [
  { key: "comment_tl_gl", label: "Komentar TL/GL" },
  { key: "comment_sect_h", label: "Komentar Sect. H" },
  { key: "comment_dept_h", label: "Komentar Dept H." },
];

function filledComments(row: VoiceMember): { label: string; value: string }[] {
  return COMMENT_FIELDS.map((f) => ({
    label: f.label,
    value: (row[f.key] ?? "").trim(),
  })).filter((c) => c.value.length > 0);
}

function CommentBadge({ row }: { row: VoiceMember }) {
  const count = filledComments(row).length;
  const badgeClass =
    count === 3 ? "badge-green" : count === 0 ? "badge-gray" : "badge-amber";
  return (
    <span className={`badge ${badgeClass}`} title={`Tanggapan: ${count} dari 3 terisi`}>
      {count}/3
    </span>
  );
}

function MemberBarChart({
```

- [ ] **Step 3: Add the "Tanggapan" table header cell**

In `voice-app/src/app/result/page.tsx`, find:

```tsx
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th>Tanggal</th>
                    <th>Nama</th>
                    <th>Line</th>
                    <th>Voice Member</th>
                    <th className="w-20 text-center">Foto</th>
                    <th>Waktu Input</th>
                    <th className="w-20 text-center">Aksi</th>
                  </tr>
                </thead>
```

Replace with:

```tsx
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th>Tanggal</th>
                    <th>Nama</th>
                    <th>Line</th>
                    <th>Voice Member</th>
                    <th className="w-20 text-center">Foto</th>
                    {isAdmin && <th className="w-24 text-center">Tanggapan</th>}
                    <th>Waktu Input</th>
                    <th className="w-20 text-center">Aksi</th>
                  </tr>
                </thead>
```

- [ ] **Step 4: Add the "Tanggapan" table body cell**

In `voice-app/src/app/result/page.tsx`, find (this is the end of the Foto
column's `<td>`, immediately followed by the Waktu Input column):

```tsx
                        )}
                      </td>
                      <td className="whitespace-nowrap text-slate-500 text-xs">
                        {formatDateTime(row.created_at)}
                      </td>
```

Replace with:

```tsx
                        )}
                      </td>
                      {isAdmin && (
                        <td className="text-center">
                          <CommentBadge row={row} />
                        </td>
                      )}
                      <td className="whitespace-nowrap text-slate-500 text-xs">
                        {formatDateTime(row.created_at)}
                      </td>
```

- [ ] **Step 5: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Manual browser verification**

If credentials are available: log in as `admin`, open `/result`. Confirm a
new "Tanggapan" column appears with a gray `0/3` badge on every row (no
comments exist yet). If credentials are not available, state that this step
was skipped and verified only by code reading.

- [ ] **Step 7: Commit**

```bash
git add voice-app/src/app/globals.css voice-app/src/app/result/page.tsx
git commit -m "feat: add Tanggapan indicator column to admin result table

Adds a shared filledComments() helper plus a CommentBadge that shows
how many of the 3 comment fields (TL/GL, Sect H, Dept H) are filled
per entry, visible only to admin. No comment editing yet - that's
next.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Admin modal — editable comments + save

**Files:**
- Modify: `voice-app/src/app/result/page.tsx`

**Interfaces:**
- Consumes: the 3 `VoiceMember` comment fields from Task 1.
- Produces: `saveComments(row: VoiceMember): Promise<void>` — not reused by
  later tasks, but its state (`commentDraft`, `savingComment`,
  `commentError`) is scoped to this task only.

- [ ] **Step 1: Add comment state**

In `voice-app/src/app/result/page.tsx`, find:

```tsx
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
```

Replace with:

```tsx
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [commentDraft, setCommentDraft] = useState({ tlGl: "", sectH: "", deptH: "" });
  const [savingComment, setSavingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
```

- [ ] **Step 2: Sync the draft whenever a different row's modal opens**

In `voice-app/src/app/result/page.tsx`, find:

```tsx
  // Filter & Search
  useEffect(() => {
    let result = data;
    if (lineFilter) {
      result = result.filter((r) => r.line_name === lineFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.member_name.toLowerCase().includes(q) ||
          r.voice_text.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [data, search, lineFilter]);

  const deleteRow = async (id: string) => {
```

Replace with:

```tsx
  // Filter & Search
  useEffect(() => {
    let result = data;
    if (lineFilter) {
      result = result.filter((r) => r.line_name === lineFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.member_name.toLowerCase().includes(q) ||
          r.voice_text.toLowerCase().includes(q)
      );
    }
    setFiltered(result);
  }, [data, search, lineFilter]);

  // Reset komentar draft setiap kali modal dibuka untuk baris berbeda,
  // supaya draft yang belum disimpan tidak "bocor" ke baris lain.
  useEffect(() => {
    if (!selectedRow) return;
    setCommentDraft({
      tlGl: selectedRow.comment_tl_gl ?? "",
      sectH: selectedRow.comment_sect_h ?? "",
      deptH: selectedRow.comment_dept_h ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRow?.id]);

  const deleteRow = async (id: string) => {
```

- [ ] **Step 3: Add the `saveComments` handler**

In `voice-app/src/app/result/page.tsx`, find:

```tsx
  const handleUploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file || !uploadTargetId) return;
    const row = data.find((r) => r.id === uploadTargetId);
    if (row) uploadPhotoForRow(row, file);
  };

  const resetRanking = async () => {
```

Replace with:

```tsx
  const handleUploadInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file next time
    if (!file || !uploadTargetId) return;
    const row = data.find((r) => r.id === uploadTargetId);
    if (row) uploadPhotoForRow(row, file);
  };

  const saveComments = async (row: VoiceMember) => {
    setSavingComment(true);
    setCommentError(null);
    try {
      const updates = {
        comment_tl_gl: commentDraft.tlGl.trim() || null,
        comment_sect_h: commentDraft.sectH.trim() || null,
        comment_dept_h: commentDraft.deptH.trim() || null,
      };
      const { error: updateErr } = await supabase
        .from("voice_members")
        .update(updates)
        .eq("id", row.id);
      if (updateErr) throw updateErr;

      setData((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updates } : r)));
      setFiltered((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updates } : r)));
      setSelectedRow((prev) => (prev && prev.id === row.id ? { ...prev, ...updates } : prev));
    } catch (e: unknown) {
      setCommentError(e instanceof Error ? e.message : "Gagal menyimpan komentar");
    } finally {
      setSavingComment(false);
    }
  };

  const resetRanking = async () => {
```

- [ ] **Step 4: Add the comment error toast**

In `voice-app/src/app/result/page.tsx`, find:

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

      {/* Photo Modal */}
```

Replace with:

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

      {/* Comment Error Toast */}
      {commentError && (
        <div className="fixed top-36 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border border-red-200 bg-white max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm font-medium text-slate-700">{commentError}</p>
          <button onClick={() => setCommentError(null)} className="ml-auto text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Photo Modal */}
```

- [ ] **Step 5: Add the editable comment section to the modal**

In `voice-app/src/app/result/page.tsx`, find:

```tsx
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Isi Voice Member
                </p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedRow.voice_text}
                </p>
              </div>

              {selectedRow.photo_url ? (
```

Replace with:

```tsx
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Isi Voice Member
                </p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedRow.voice_text}
                </p>
              </div>

              {isAdmin && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Tanggapan
                  </p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Komentar TL/GL
                      </label>
                      <textarea
                        value={commentDraft.tlGl}
                        onChange={(e) =>
                          setCommentDraft((prev) => ({ ...prev, tlGl: e.target.value }))
                        }
                        rows={2}
                        className="form-input w-full text-sm"
                        placeholder="Tulis komentar TL/GL..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Komentar Sect. H
                      </label>
                      <textarea
                        value={commentDraft.sectH}
                        onChange={(e) =>
                          setCommentDraft((prev) => ({ ...prev, sectH: e.target.value }))
                        }
                        rows={2}
                        className="form-input w-full text-sm"
                        placeholder="Tulis komentar Sect. H..."
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">
                        Komentar Dept H.
                      </label>
                      <textarea
                        value={commentDraft.deptH}
                        onChange={(e) =>
                          setCommentDraft((prev) => ({ ...prev, deptH: e.target.value }))
                        }
                        rows={2}
                        className="form-input w-full text-sm"
                        placeholder="Tulis komentar Dept H...."
                      />
                    </div>
                    <button
                      id="btn-save-comments"
                      onClick={() => saveComments(selectedRow!)}
                      disabled={savingComment}
                      className="btn-primary text-sm py-1.5 px-3"
                    >
                      {savingComment && (
                        <span className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
                      )}
                      Simpan Komentar
                    </button>
                  </div>
                </div>
              )}

              {selectedRow.photo_url ? (
```

- [ ] **Step 6: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Manual browser verification**

If credentials are available: log in as `admin`, open `/result`, click any
row. Confirm a "Tanggapan" section with 3 textareas and a "Simpan Komentar"
button appears above "Foto Dokumentasi". Type into all 3, click "Simpan
Komentar" — button shows a spinner then returns to normal, no error toast,
and closing/reopening the modal for the same row shows the text persisted.
Confirm the table's badge for that row now reads `3/3` (green) without a
manual page refresh. If credentials are not available, state that this step
was skipped and verified only by code reading.

- [ ] **Step 8: Commit**

```bash
git add voice-app/src/app/result/page.tsx
git commit -m "feat: let admin write TL/GL, Sect H, Dept H comments per entry

Adds a Tanggapan section to the admin detail modal with one textarea
per comment level and a single Simpan Komentar button that updates
all 3 columns at once, patching local state (data/filtered/
selectedRow) so the table's badge and modal reflect the save
immediately without a refetch.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Member modal — read-only comment display

**Files:**
- Modify: `voice-app/src/app/result/page.tsx`

**Interfaces:**
- Consumes: `filledComments(row: VoiceMember)` from Task 2.

- [ ] **Step 1: Add the read-only comment section for members**

In `voice-app/src/app/result/page.tsx`, find the end of the admin comment
section added in Task 3 (the block ends right before the photo conditional):

```tsx
                    <button
                      id="btn-save-comments"
                      onClick={() => saveComments(selectedRow!)}
                      disabled={savingComment}
                      className="btn-primary text-sm py-1.5 px-3"
                    >
                      {savingComment && (
                        <span className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
                      )}
                      Simpan Komentar
                    </button>
                  </div>
                </div>
              )}

              {selectedRow.photo_url ? (
```

Replace with:

```tsx
                    <button
                      id="btn-save-comments"
                      onClick={() => saveComments(selectedRow!)}
                      disabled={savingComment}
                      className="btn-primary text-sm py-1.5 px-3"
                    >
                      {savingComment && (
                        <span className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
                      )}
                      Simpan Komentar
                    </button>
                  </div>
                </div>
              )}

              {!isAdmin && filledComments(selectedRow).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Tanggapan
                  </p>
                  <div className="space-y-3">
                    {filledComments(selectedRow).map((c) => (
                      <div key={c.label}>
                        <p className="text-xs font-medium text-slate-500 mb-1">{c.label}</p>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {c.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedRow.photo_url ? (
```

- [ ] **Step 2: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser verification**

Same credential caveat as prior tasks — only claim this was verified if it
actually ran.

If credentials are available:
1. As the member who owns the entry commented on in Task 3, log in and open
   `/result`, click that entry's row.
2. Confirm the modal shows a read-only "Tanggapan" section listing the 3
   comment labels and values, positioned after "Isi Voice Member" and before
   "Foto Dokumentasi" — with no textareas or save button (member cannot
   edit).
3. Open a different entry belonging to the same member that has no comments
   filled — confirm the "Tanggapan" section does not render at all.

- [ ] **Step 4: Commit**

```bash
git add voice-app/src/app/result/page.tsx
git commit -m "feat: show TL/GL, Sect H, Dept H comments to the sending member

Member's own detail modal now renders a read-only Tanggapan section
listing only the comments admin has filled in, reusing the same
filledComments() helper the admin table badge already uses. Section
is omitted entirely when no comments are filled yet.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: PDF export — "Tanggapan" section

**Files:**
- Modify: `voice-app/src/app/result/page.tsx`

**Interfaces:**
- Consumes: `filledComments(row: VoiceMember)` from Task 2.

- [ ] **Step 1: Add the comment section to `exportSingleDetailPDF`**

In `voice-app/src/app/result/page.tsx`, find:

```tsx
    y += 8; // preserve the existing spacing gap that follows the text block

    if (row.photo_url) {
```

Replace with:

```tsx
    y += 8; // preserve the existing spacing gap that follows the text block

    const comments = filledComments(row);
    if (comments.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Tanggapan", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const c of comments) {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.text(c.label, margin, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const commentLines: string[] = doc.splitTextToSize(c.value, pageWidth - margin * 2);
        for (const line of commentLines) {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += 5;
        }
        y += 3;
      }
      y += 5;
    }

    if (row.photo_url) {
```

- [ ] **Step 2: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual browser verification**

Same credential caveat as prior tasks.

If credentials are available: open the detail modal for an entry with all 3
comments filled (from Task 3), click "Download PDF". Open the downloaded
file and confirm a "Tanggapan" section appears after the voice member text
and before the photo (if any), listing all 3 labels and their text, wrapped
correctly. Then open an entry with no comments and confirm its PDF has no
"Tanggapan" section at all (identical to pre-feature output). Also click
"Export PDF" (bulk table export) and confirm it is unchanged — no comment
column added.

- [ ] **Step 4: Commit**

```bash
git add voice-app/src/app/result/page.tsx
git commit -m "feat: include filled TL/GL, Sect H, Dept H comments in per-entry PDF

exportSingleDetailPDF now prints a Tanggapan section (only the
comments that are actually filled) between the voice member text and
the photo. The bulk table export (exportPDF) is unchanged.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Full verification pass

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Type-check, lint, build**

Run in order:
```bash
cd voice-app && npx tsc --noEmit
npm run lint
npm run build
```
Expected: all three succeed with no new errors. Pre-existing warnings in the
file, if any, are out of scope — do not fix unrelated lint issues here.

- [ ] **Step 2: End-to-end manual walkthrough**

If credentials are available, log in as `admin` and:
1. Pick an entry with `0/3` badge, open it, fill all 3 comments, save.
   Confirm badge becomes `3/3` (green) without refresh.
2. Pick another entry, fill only 1 comment, save. Confirm badge becomes
   `1/3` (amber).
3. Log out, log in as the member who owns the `3/3` entry. Open `/result`,
   click that entry — confirm all 3 comments show read-only, in TL/GL →
   Sect. H → Dept H. order.
4. Open the `1/3` entry as that member — confirm only the 1 filled comment
   shows (not 3 rows with 2 blank).
5. Open an entry that was never commented on — confirm no "Tanggapan"
   section appears at all.
6. Download PDF for the `3/3` entry as the member — confirm the comments
   appear in the PDF.

If credentials are not available, state that this step was skipped and that
verification relied on code reading plus Tasks 1-5's individual manual
checks (report honestly which of those were actually run vs. code-reviewed
only).

- [ ] **Step 3: Report results honestly**

Summarize, for Steps 1-2 above, whether each was actually executed (browser
verified) or only checked by static code reading — per
`superpowers:verification-before-completion`. No commit needed for this task
unless a fix was required during verification; if so, make that fix in its
own small commit describing what was found and corrected.
