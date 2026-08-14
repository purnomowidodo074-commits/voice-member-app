# Voice Member Detail Modal + Per-Entry PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking a row in the "Hasil Voice Member" table opens a detail popup showing the full, untruncated submission (all fields + photo), with a "Download PDF" button that exports that single entry as its own PDF.

**Architecture:** All changes live in one file, `voice-app/src/app/result/page.tsx`, following its existing conventions (inline modal blocks like the current Photo Modal / Reset Ranking modal, and an inline PDF-export function like the existing `exportPDF`). A new `selectedRow` state holds the clicked `VoiceMember`; a new Detail Modal renders when it's set; a new `exportSingleDetailPDF` function generates a one-entry, portrait-orientation PDF, separate from the existing bulk `exportPDF`. Existing nested buttons inside each row (photo thumbnail, delete/confirm/cancel) get `e.stopPropagation()` so they keep working without also opening the new modal.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, `jspdf`/`jspdf-autotable` (already used for the existing bulk export), Tailwind CSS, lucide-react icons. No automated test framework exists in this repo (`voice-app/package.json` has only `lint`) — verification is TypeScript type-checking (`npx tsc --noEmit`) per task plus manual end-to-end walkthroughs against the running dev server, matching this project's existing (test-framework-free) convention (see `docs/superpowers/plans/2026-08-06-member-self-registration.md`).

## Global Constraints

- Detail modal + PDF download must work for both admin and member roles, since the table is shared by both — spec Goal 3.
- The new per-entry PDF is separate from, and must not change, the existing bulk "Export PDF" button/behavior — spec Non-Goals.
- Per-entry PDF is A4 **portrait** (bulk export is landscape) — spec section 3.
- Per-entry PDF filename: `voice-member-{noreg}-{input_date}.pdf`, where `input_date` is already stored as `YYYY-MM-DD` (confirmed in `voice-app/src/app/page.tsx:20-21`, `getTodayDate()`) — spec section 3.
- If the photo fetch/embed step fails, the PDF must still generate and download (text-only) — this must not throw or block the export — spec "Error Handling".
- No changes to delete or photo-lightbox behavior beyond adding `e.stopPropagation()` to prevent event bubbling into the new row click handler — spec Non-Goals.

---

### Task 1: Detail modal, row click wiring, and basic (text-only) per-entry PDF

**Files:**
- Modify: `voice-app/src/app/result/page.tsx:4-13` (lucide-react import), `:230-234` (state), `:332-359` (after `exportPDF`), `:374-408` (after Photo Modal), `:565-566` (row `<tr>`), `:594-609` (photo button), `:622-654` (delete/confirm buttons)

**Interfaces:**
- Produces: `selectedRow: VoiceMember | null` state and `exportSingleDetailPDF(row: VoiceMember): void` — Task 2 depends on this function existing (it will extend its body to add photo embedding).

- [ ] **Step 1: Add `X` and `Download` icons to the lucide-react import**

In `voice-app/src/app/result/page.tsx`, find:
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
} from "lucide-react";
```

Replace with:
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

- [ ] **Step 2: Add `selectedRow` state**

Find:
```tsx
  const [rankingResetAt, setRankingResetAt] = useState<string | null>(null);
```

Replace with:
```tsx
  const [rankingResetAt, setRankingResetAt] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<VoiceMember | null>(null);
```

- [ ] **Step 3: Add the basic (text-only) `exportSingleDetailPDF` function**

Find:
```tsx
    doc.save(`voice-member-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  return (
```

Replace with:
```tsx
    doc.save(`voice-member-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportSingleDetailPDF = (row: VoiceMember) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;
    let y = 20;

    doc.setFontSize(16);
    doc.setTextColor(88, 28, 135);
    doc.text("Detail Voice Member", pageWidth / 2, y, { align: "center" });
    y += 7;
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Tanggal Export: ${new Date().toLocaleDateString("id-ID")}`, pageWidth / 2, y, { align: "center" });
    y += 12;

    doc.setTextColor(30);
    doc.setFontSize(11);
    const fields: [string, string][] = [
      ["Nama", row.member_name],
      ["No. Reg", row.noreg],
      ["Line", row.line_name],
      ["Tanggal Kejadian", formatDate(row.input_date)],
      ["Waktu Input", formatDateTime(row.created_at)],
    ];
    for (const [label, value] of fields) {
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(`: ${value}`, margin + 35, y);
      y += 7;
    }

    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Isi Voice Member", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const lines: string[] = doc.splitTextToSize(row.voice_text, pageWidth - margin * 2);
    doc.text(lines, margin, y);

    doc.save(`voice-member-${row.noreg}-${row.input_date}.pdf`);
  };

  return (
```

This adds a standalone, fully-working (photo not embedded yet — that's Task 2) per-entry PDF export: title, export date, the five key/value fields, and the full (untruncated, word-wrapped) voice text.

- [ ] **Step 4: Insert the Detail Modal, after the Photo Modal block**

Find:
```tsx
            <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700">Foto Dokumentasi</p>
              <div className="flex gap-3">
                <a
                  href={selectedPhoto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 btn-secondary text-sm py-1.5 px-3"
                >
                  <ExternalLink size={14} />
                  Buka
                </a>
                <button
                  className="btn-secondary text-sm py-1.5 px-3"
                  onClick={() => setSelectedPhoto(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
```

Replace with:
```tsx
            <div className="flex justify-between items-center px-4 py-3 bg-slate-50 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700">Foto Dokumentasi</p>
              <div className="flex gap-3">
                <a
                  href={selectedPhoto}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 btn-secondary text-sm py-1.5 px-3"
                >
                  <ExternalLink size={14} />
                  Buka
                </a>
                <button
                  className="btn-secondary text-sm py-1.5 px-3"
                  onClick={() => setSelectedPhoto(null)}
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setSelectedRow(null)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full text-sm font-bold shrink-0 bg-blue-50 text-blue-700 border border-blue-200"
                  style={{ width: "40px", height: "40px" }}
                >
                  {selectedRow.member_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedRow.member_name}</h3>
                  <p className="text-xs text-slate-500">Noreg {selectedRow.noreg}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-slate-400 hover:text-slate-600 shrink-0"
                title="Tutup"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`badge ${LINE_BADGE[selectedRow.line_name] ?? "badge-blue"}`}>
                  {selectedRow.line_name}
                </span>
                <span className="text-xs text-slate-500">
                  Tanggal Kejadian: {formatDate(selectedRow.input_date)}
                </span>
                <span className="text-xs text-slate-500">
                  · Waktu Input: {formatDateTime(selectedRow.created_at)}
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Isi Voice Member
                </p>
                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {selectedRow.voice_text}
                </p>
              </div>

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
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
              <button className="btn-secondary text-sm" onClick={() => setSelectedRow(null)}>
                Tutup
              </button>
              <button
                onClick={() => exportSingleDetailPDF(selectedRow!)}
                className="btn-success text-sm"
              >
                <Download size={15} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
```

(`selectedRow!` is used inside the two `onClick` closures — same pattern the file already uses for `row.photo_url!` on the photo button below — because TypeScript doesn't retain narrowing across a nested closure boundary even though the JSX above it, evaluated synchronously, narrows fine without `!`.)

- [ ] **Step 5: Make the table row clickable**

Find:
```tsx
                  {filtered.map((row, idx) => (
                    <tr key={row.id}>
```

Replace with:
```tsx
                  {filtered.map((row, idx) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRow(row)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
```

- [ ] **Step 6: Stop the photo thumbnail button from also opening the detail modal**

Find:
```tsx
                          <button
                            id={`btn-photo-${row.id}`}
                            onClick={() => setSelectedPhoto(row.photo_url!)}
                            className="inline-block relative overflow-hidden rounded-lg border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all p-0 bg-slate-50"
                            style={{ width: "48px", height: "48px" }}
                            title="Lihat foto"
                          >
```

Replace with:
```tsx
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
```

- [ ] **Step 7: Stop the delete/confirm/cancel buttons from also opening the detail modal**

Find:
```tsx
                      <td className="text-center">
                        {confirmId === row.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs text-slate-600 font-medium">Yakin?</span>
                            <button
                              onClick={() => deleteRow(row.id)}
                              disabled={deletingId === row.id}
                              className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                              title="Ya, hapus"
                            >
                              {deletingId === row.id ? (
                                <span className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px" }} />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </button>
                            <button
                              onClick={() => setConfirmId(null)}
                              className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                              title="Batal"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmId(row.id)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg mx-auto text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Hapus data"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        )}
                      </td>
```

Replace with:
```tsx
                      <td className="text-center">
                        {confirmId === row.id ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <span className="text-xs text-slate-600 font-medium">Yakin?</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRow(row.id);
                              }}
                              disabled={deletingId === row.id}
                              className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                              title="Ya, hapus"
                            >
                              {deletingId === row.id ? (
                                <span className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px" }} />
                              ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmId(null);
                              }}
                              className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                              title="Batal"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmId(row.id);
                            }}
                            className="flex items-center justify-center w-8 h-8 rounded-lg mx-auto text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Hapus data"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                          </button>
                        )}
                      </td>
```

- [ ] **Step 8: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 9: Manual verification**

Start the dev server if not already running: `cd voice-app && npm run dev`. Then in a browser:
1. Log in as admin (`noreg: ADMIN`) and go to the "Hasil Voice Member" page (`/result`).
2. Click anywhere on a table row (not on the photo thumbnail or delete icon). Expected: the Detail Modal opens, showing the member's name, noreg, line badge, tanggal kejadian, waktu input, and the **full** voice text (not clamped to 2 lines).
3. If that row has a photo, confirm it's shown inside the modal; click it and confirm the existing photo lightbox opens on top.
4. Click "Download PDF". Expected: a PDF named `voice-member-{noreg}-{input_date}.pdf` downloads; open it and confirm it shows the title, the five fields, and the full voice text wrapped correctly (no photo yet — that's Task 2).
5. Close the modal by clicking outside it, then reopen a row and close it via the "Tutup" button. Both should work.
6. On a row that has a photo, click the photo thumbnail button directly (not elsewhere in the row). Expected: only the photo lightbox opens — the Detail Modal does **not** also open.
7. Click a row's delete icon, then "Batal" in the confirm state. Expected: only the delete-confirm UI is affected — the Detail Modal does not open at any point in this flow.
8. Log out, log in as a regular member, go to `/result`, and repeat steps 2–5 against one of that member's own rows. Expected: identical behavior.

- [ ] **Step 10: Commit**

```bash
git add voice-app/src/app/result/page.tsx
git commit -m "feat: add voice member detail modal with per-entry PDF export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Embed the photo into the per-entry PDF

**Files:**
- Modify: `voice-app/src/app/result/page.tsx` (the `exportSingleDetailPDF` function added in Task 1)

**Interfaces:**
- Consumes: `exportSingleDetailPDF(row: VoiceMember)` from Task 1.
- Produces: same function, now `async`, embedding `row.photo_url` into the generated PDF when present, with a silent fallback (PDF still downloads, without a photo section) if the fetch/convert step fails.

- [ ] **Step 1: Make `exportSingleDetailPDF` async and embed the photo**

Find:
```tsx
  const exportSingleDetailPDF = (row: VoiceMember) => {
```

Replace with:
```tsx
  const exportSingleDetailPDF = async (row: VoiceMember) => {
```

Then find:
```tsx
    const lines: string[] = doc.splitTextToSize(row.voice_text, pageWidth - margin * 2);
    doc.text(lines, margin, y);

    doc.save(`voice-member-${row.noreg}-${row.input_date}.pdf`);
  };
```

Replace with:
```tsx
    const lines: string[] = doc.splitTextToSize(row.voice_text, pageWidth - margin * 2);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 8;

    if (row.photo_url) {
      try {
        const res = await fetch(row.photo_url);
        const blob = await res.blob();
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        const format = blob.type.includes("png") ? "PNG" : "JPEG";
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = imgWidth * 0.6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Foto Dokumentasi", margin, y);
        y += 5;
        doc.addImage(dataUrl, format, margin, y, imgWidth, imgHeight);
      } catch (e) {
        console.warn("Gagal menyematkan foto ke PDF, melanjutkan tanpa foto.", e);
      }
    }

    doc.save(`voice-member-${row.noreg}-${row.input_date}.pdf`);
  };
```

(The `try/catch` around the fetch/FileReader/`addImage` sequence means any failure there — network error, non-2xx response, unreadable blob — is caught, logged, and skipped; `doc.save(...)` on the next line still runs unconditionally, so the PDF always downloads.)

- [ ] **Step 2: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 3: Manual verification**

With the dev server running:
1. As admin (or member), open the Detail Modal for a row that **has** a photo and click "Download PDF". Expected: the downloaded PDF now includes a "Foto Dokumentasi" section with the image visible below the voice text.
2. Open the Detail Modal for a row **without** a photo and click "Download PDF". Expected: the PDF downloads normally with no photo section (unchanged from Task 1).
3. Simulate a photo-fetch failure: open browser DevTools → Network tab → set throttling to "Offline", then click "Download PDF" on a row with a photo. Expected: the PDF still downloads (text content intact), just without the photo; check the browser console for the `"Gagal menyematkan foto ke PDF..."` warning. Restore network afterward.

- [ ] **Step 4: Commit**

```bash
git add voice-app/src/app/result/page.tsx
git commit -m "feat: embed photo into per-entry voice member PDF export

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Full verification pass

**Files:** None (verification only).

**Interfaces:** None — this task consumes the completed feature from Tasks 1–2 and produces nothing further.

- [ ] **Step 1: Run the linter**

```bash
cd voice-app && npm run lint
```
Expected: no errors (warnings acceptable only if they pre-exist on `main` — compare against `git stash` if unsure).

- [ ] **Step 2: Run a full production build**

```bash
cd voice-app && npm run build
```
Expected: build succeeds with no type or lint-blocking errors. This catches anything `tsc --noEmit` alone might miss (e.g. Next.js-specific static analysis).

- [ ] **Step 3: Re-run the full manual walkthrough from Task 1 Step 9 and Task 2 Step 3**

Confirm all of the following still hold together, in one pass, against the built/dev app:
1. Admin: row click opens modal with full text + correct fields + photo (if any); Download PDF produces a complete single-entry PDF including the photo.
2. Admin: row without photo behaves correctly (modal has no photo section; PDF has no photo section).
3. Member: same two flows work identically on their own rows.
4. Photo-thumbnail click and delete/confirm/cancel clicks never open the Detail Modal.
5. Modal closes via outside-click and via "Tutup".
6. The existing bulk "Export PDF" button (unrelated to this feature) still works unchanged — export it once and confirm it's still the landscape, all-rows table PDF as before.

No commit needed for this task unless a fix is required — if a regression is found, fix it, re-run Steps 1–3, then commit the fix with an appropriate message referencing what was broken.
