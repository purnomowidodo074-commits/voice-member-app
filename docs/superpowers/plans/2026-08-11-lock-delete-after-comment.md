# Lock Member Delete After Comment Exists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the delete button in `/result`'s table "Aksi" column for members
(`!isAdmin`) once an entry has at least 1 of its 3 comments filled in.

**Architecture:** Single-file, single-condition change to
`voice-app/src/app/result/page.tsx`. Wraps the existing Aksi cell's
`confirmId === row.id ? (...) : (...)` ternary with a leading
`(isAdmin || filledComments(row).length === 0) &&` guard, reusing the
`filledComments()` helper already added for the comments feature. No new
state, no DB/RLS change.

**Tech Stack:** Next.js 16, React 19, TypeScript. No test runner configured —
verification is `npx tsc --noEmit`, `npm run lint`, `npm run build`, plus
manual/code-reading verification.

## Global Constraints

- Only the table's "Aksi" column cell changes. Admin's Aksi column is
  unaffected under all conditions (`isAdmin ||` in the guard covers this).
- Threshold: `filledComments(row).length > 0` (at least 1 of 3 comments) hides
  the cell's content entirely for members — not disabled/grayed, fully absent.
- Reuse `filledComments(row: VoiceMember)` from
  `voice-app/src/app/result/page.tsx` (already defined) — do not duplicate
  the counting logic.
- No RLS/DB change — this is a client-side UI restriction only, consistent
  with the rest of this page's existing security model.

---

### Task 1: Hide the Aksi cell for members once a comment exists

**Files:**
- Modify: `voice-app/src/app/result/page.tsx`

**Interfaces:**
- Consumes: `filledComments(row: VoiceMember): { label: string; value: string }[]`
  (already defined), `isAdmin` (already in scope).

- [ ] **Step 1: Wrap the Aksi cell's ternary with the visibility guard**

In `voice-app/src/app/result/page.tsx`, find:

```tsx
                      <td className="text-center">
                        {confirmId === row.id ? (
                          <div className="flex items-center justify-center gap-1.5">
```

Replace with:

```tsx
                      <td className="text-center">
                        {(isAdmin || filledComments(row).length === 0) && (
                        confirmId === row.id ? (
                          <div className="flex items-center justify-center gap-1.5">
```

Then find the end of the same cell:

```tsx
                          </button>
                        )}
                      </td>
                    </tr>
```

Replace with:

```tsx
                          </button>
                        ))}
                      </td>
                    </tr>
```

(The first replacement adds one opening `(` after `&&`; this second
replacement adds the matching closing `)` right before the existing `}`,
turning `{confirmId === row.id ? (...) : (...)}` into
`{(isAdmin || filledComments(row).length === 0) && (confirmId === row.id ? (...) : (...))}`.)

- [ ] **Step 2: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `cd voice-app && npm run lint`
Expected: no new errors beyond the pre-existing 4 (documented in the prior
feature's verification — `members/page.tsx:58`, `result/page.tsx` two
pre-existing `fetchData`/`setFiltered` effects, `AuthProvider.tsx:76`).

- [ ] **Step 4: Build**

Run: `cd voice-app && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual verification**

If credentials are available:
1. As admin, open an entry with no comments and one with ≥1 comment filled —
   confirm the delete icon shows and works for both.
2. As the member who owns that ≥1-comment entry, open `/result` — confirm the
   Aksi cell for that row is empty (no delete icon), while a different entry
   of theirs with no comments still shows the delete icon and still works
   (click → "Yakin?" confirm → delete succeeds).

If credentials are not available, state that this step was skipped and
verified only by code reading.

- [ ] **Step 6: Commit**

```bash
git add voice-app/src/app/result/page.tsx
git commit -m "feat: hide member delete button once an entry has a comment

Members could still delete an entry after admin had already responded
with a TL/GL, Sect H, or Dept H comment, risking loss of a record
that's been acted on. The Aksi cell's delete UI is now omitted for
members once filledComments(row).length > 0; admin is unaffected.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
