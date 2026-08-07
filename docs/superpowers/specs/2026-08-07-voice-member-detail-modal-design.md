# Voice Member Detail Modal + Per-Entry PDF — Design Spec

**Date:** 2026-08-07
**Status:** Approved
**Scope:** `voice-app/src/app/result/page.tsx` (Hasil Voice Member page)

## Problem

The "Hasil Voice Member" table (used by both admin and member roles) truncates
the voice text to two lines and offers no way to see a submission's full
content or export a single entry as a PDF. Users must currently use the
bulk "Export PDF" button, which dumps every filtered row into one table-style
PDF — there's no per-entry detail view or per-entry PDF.

## Goals

1. Clicking a table row opens a detail popup showing the full content of that
   voice member submission (untruncated text + all fields + photo).
2. The popup has a "Download PDF" button that generates a single-entry PDF
   for that submission.
3. Available to both admin and member roles (the table is shared by both).

## Non-Goals

- No changes to the existing bulk "Export PDF" button/behavior.
- No changes to delete or photo-lightbox behavior beyond preventing event
  bubbling into the new row click handler.
- No new backend/RLS changes — this is purely additive UI using data already
  fetched into `data`/`filtered` state.

## Design

### 1. State & Row Interaction

- New state in `ResultPage`: `selectedRow: VoiceMember | null`.
- Table `<tr>` gets `onClick={() => setSelectedRow(row)}` plus
  `cursor-pointer hover:bg-slate-50 transition-colors` styling so rows read
  as clickable.
- Existing interactive elements nested inside the row — the photo thumbnail
  button and the delete/confirm/cancel buttons — get `e.stopPropagation()`
  added to their `onClick` handlers so clicking them does not also trigger
  the new row-click handler.

### 2. Detail Modal

A new modal component/block, following the existing modal pattern already
used for the photo lightbox and the reset-ranking confirmation (fixed
inset overlay, `bg-slate-900/60 backdrop-blur-sm`, click-outside-to-close,
inner content stops propagation).

Renders when `selectedRow` is non-null:

- Header: member name, noreg, line badge, close (X) button.
- Body:
  - Tanggal Kejadian (`input_date`), Waktu Input (`created_at`) — reuse
    existing `formatDate`/`formatDateTime` helpers.
  - Full `voice_text`, unclamped (no `line-clamp-2`).
  - Photo (if `photo_url` present): shown as a thumbnail/preview inside the
    modal; clicking it opens the existing photo lightbox
    (`setSelectedPhoto(row.photo_url)`), reusing that component as-is.
- Footer: "Download PDF" button (calls `exportSingleDetailPDF(selectedRow)`)
  and "Tutup" button (`setSelectedRow(null)`).

### 3. Per-Entry PDF Export

New function `exportSingleDetailPDF(row: VoiceMember)`, separate from the
existing bulk `exportPDF()`:

- **Orientation**: A4 portrait (existing bulk export is landscape; this is a
  detail sheet, not a table).
- **Header**: title "Detail Voice Member", export date/time, styled
  consistently with the existing bulk PDF (purple header color, same
  fonts/sizes conventions from `exportPDF`).
- **Fields**: Nama, No. Reg, Line, Tanggal Kejadian, Waktu Input — rendered
  as label/value pairs.
- **Voice text**: full paragraph via `doc.splitTextToSize(...)` so it wraps
  properly instead of being clipped.
- **Photo** (if `photo_url` is set): fetched and embedded below the text via
  `doc.addImage`. Since `photo_url` is a Supabase Storage URL, the image is
  fetched as a blob and converted to a data URL (`FileReader`) before being
  added to the PDF, avoiding `addImage`'s CORS/tainted-canvas issues.
  - **Failure handling**: if the fetch/convert step fails (network error,
    CORS, missing image), the PDF is still generated and downloaded — just
    without the photo section. This must not block or fail the whole
    export function (wrap in `try/catch`, log a console warning on
    failure, no user-facing error toast needed since the PDF still
    succeeds).
- **Filename**: `voice-member-{noreg}-{input_date as YYYY-MM-DD}.pdf`.

## Data Flow

No new data fetching. `selectedRow` is set directly from a `VoiceMember`
object already present in `filtered`/`data` (fetched once in `fetchData`).
The only new network activity is the optional photo fetch during PDF
generation, which is local to `exportSingleDetailPDF` and does not touch
component state.

## Error Handling

- Row click never fails (pure state set from in-memory data).
- Photo embed failure in the PDF is caught and silently degrades (PDF
  without photo) per above — this is the only failure mode introduced.

## Testing

Manual verification (no existing automated test suite covers this page):

1. As admin: click a row → modal shows full untruncated text + correct
   fields + photo (if present) → Download PDF → verify PDF downloads with
   correct content, wraps long text properly, and includes the photo.
2. As admin: click a row with no photo → modal renders without a photo
   section → Download PDF succeeds without a photo section.
3. As member (own submissions only): same row-click/detail/PDF flow works
   on their own rows.
4. Clicking the photo thumbnail button or a delete/confirm button inside a
   row does NOT open the detail modal (event bubbling correctly stopped).
5. Clicking outside the modal, and the "Tutup" button, both close it.
