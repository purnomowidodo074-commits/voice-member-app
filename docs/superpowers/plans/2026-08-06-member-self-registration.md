# Member Self-Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an employee whose noreg isn't in the Excel-derived roster self-register (nama + noreg + password) in the Voice Member app and log in immediately, with admin visibility into who registered this way.

**Architecture:** One new boolean column on the existing `member_accounts` Supabase table marks self-registered rows. `AuthProvider.tsx` gains a `notInRoster` signal on the existing `verifyNoreg` check and a new `registerNew` function that mirrors the existing `activate` function but skips Excel verification. The login page's existing 2-step "Aktivasi Akun" tab branches its Step 2 UI on whether the user came from the verified path or the new self-registration path. The admin `/members` page gets a 4th stat tile and a 3rd tab to list these accounts.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript, Supabase (Postgres + supabase-js client), Tailwind CSS, lucide-react icons. No automated test framework exists in this repo (`voice-app/package.json` has only `lint`) — verification is TypeScript type-checking (`npx tsc --noEmit`) per task plus manual end-to-end walkthroughs against the running dev server and the Supabase project directly, matching this project's existing (test-framework-free) convention.

## Global Constraints

- Noreg format for self-registration: exactly 7 digits (`/^\d{7}$/`) — copied from spec section 2.
- Self-registered accounts are immediately active (no admin approval step) — spec section "Goal".
- Nama is trimmed and uppercased before storage, matching the existing `MEMBERS` roster's all-caps convention — spec section 2.
- No changes to `login()`, password hashing, RLS policies, `Navbar.tsx`, or route guards — spec "Out of scope".
- Target Supabase project for the schema change: `voice-member`, project ref `hkrdqeauhfloqguojggx` (the currently-connected project; confirm with `mcp__0c0a06f4-c994-45dc-be01-51598ae74300__get_project_url` if the MCP connection has since changed accounts).

---

### Task 1: Add `is_self_registered` column to `member_accounts`

**Files:** None (Supabase schema change only, applied via the Supabase MCP tool — this repo does not track SQL migrations as files; see `SUPABASE_SETUP.md` for the existing precedent of applying schema directly against the dashboard/API).

**Interfaces:**
- Produces: `public.member_accounts.is_self_registered` (boolean, not null, default `false`) — Task 3 and Task 6 depend on this column existing.

- [ ] **Step 1: Confirm you're pointed at the right Supabase project**

Call the Supabase MCP tool `mcp__0c0a06f4-c994-45dc-be01-51598ae74300__get_project_url` with `project_id: "hkrdqeauhfloqguojggx"`. Expected result: `{"url":"https://hkrdqeauhfloqguojggx.supabase.co"}`. If this errors (project not found / different account connected), stop and ask the user which project is now the live one before continuing.

- [ ] **Step 2: Apply the migration**

Call the Supabase MCP tool `mcp__0c0a06f4-c994-45dc-be01-51598ae74300__apply_migration` with:
- `project_id`: `"hkrdqeauhfloqguojggx"`
- `name`: `"add_is_self_registered_to_member_accounts"`
- `query`:
```sql
alter table public.member_accounts
  add column is_self_registered boolean not null default false;
```

Expected result: `{"success": true}`.

- [ ] **Step 3: Verify the column exists with the expected default**

Call the Supabase MCP tool `mcp__0c0a06f4-c994-45dc-be01-51598ae74300__execute_sql` with `project_id: "hkrdqeauhfloqguojggx"` and:
```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'member_accounts' and column_name = 'is_self_registered';
```
Expected: one row — `is_self_registered | boolean | NO | false`.

- [ ] **Step 4: Verify existing rows got the default**

```sql
select count(*) as total, count(*) filter (where is_self_registered) as self_registered
from public.member_accounts;
```
Expected: `self_registered` is `0` and `total` matches the existing row count (unaffected by this migration).

No git commit for this task — it's a live database change, not a file change.

---

### Task 2: `AuthProvider.tsx` — flag noreg-not-in-roster on `verifyNoreg`

**Files:**
- Modify: `voice-app/src/components/AuthProvider.tsx:17-44` (interfaces), `voice-app/src/components/AuthProvider.tsx:106-132` (`verifyNoreg` body)

**Interfaces:**
- Consumes: nothing new.
- Produces: `verifyNoreg(noreg: string): Promise<{ valid: boolean; nama?: string; notInRoster?: boolean; message: string }>` — Task 4 depends on the `notInRoster` field being present when `valid` is `false` and the noreg isn't in `MEMBERS`.

- [ ] **Step 1: Update `AuthContextType` and the default context value**

In `voice-app/src/components/AuthProvider.tsx`, find:
```ts
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  // Verifikasi noreg di Excel sebelum aktivasi (Step 1)
  verifyNoreg: (noreg: string) => Promise<{ valid: boolean; nama?: string; message: string }>;
  // Simpan akun baru ke Supabase (Step 2)
  activate: (noreg: string, nama: string, password: string) => Promise<ActivateResult>;
  // Login dengan noreg + password
  login: (noreg: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateProfilePhoto: (url: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  verifyNoreg: async () => ({ valid: false, message: "" }),
  activate: async () => ({ success: false, message: "" }),
  login: async () => ({ success: false, message: "" }),
  logout: () => {},
  updateProfilePhoto: () => {},
});
```

Replace with:
```ts
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  // Verifikasi noreg di Excel sebelum aktivasi (Step 1)
  verifyNoreg: (noreg: string) => Promise<{ valid: boolean; nama?: string; notInRoster?: boolean; message: string }>;
  // Simpan akun baru ke Supabase (Step 2)
  activate: (noreg: string, nama: string, password: string) => Promise<ActivateResult>;
  // Daftar mandiri untuk noreg yang tidak ada di daftar Excel
  registerNew: (noreg: string, nama: string, password: string) => Promise<ActivateResult>;
  // Login dengan noreg + password
  login: (noreg: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateProfilePhoto: (url: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  verifyNoreg: async () => ({ valid: false, message: "" }),
  activate: async () => ({ success: false, message: "" }),
  registerNew: async () => ({ success: false, message: "" }),
  login: async () => ({ success: false, message: "" }),
  logout: () => {},
  updateProfilePhoto: () => {},
});
```

(`registerNew`'s body is written in Task 3 — this step only updates the type and default so the file still compiles standalone.)

- [ ] **Step 2: Update `verifyNoreg`'s not-found branch**

Find:
```ts
  // Step 1: Verifikasi Noreg (cek Excel + cek belum aktivasi)
  const verifyNoreg = async (noreg: string): Promise<{ valid: boolean; nama?: string; message: string }> => {
    const trimmed = noreg.trim();

    // Cek apakah noreg ada di data Excel
    const member = getMemberByNoreg(trimmed);
    if (!member) {
      return { valid: false, message: "Noreg tidak ditemukan. Pastikan nomor registrasi Anda benar." };
    }
```

Replace with:
```ts
  // Step 1: Verifikasi Noreg (cek Excel + cek belum aktivasi)
  const verifyNoreg = async (noreg: string): Promise<{ valid: boolean; nama?: string; notInRoster?: boolean; message: string }> => {
    const trimmed = noreg.trim();

    // Cek apakah noreg ada di data Excel
    const member = getMemberByNoreg(trimmed);
    if (!member) {
      return {
        valid: false,
        notInRoster: true,
        message: "Noreg tidak ditemukan di daftar karyawan terdaftar. Jika Anda member baru, silakan daftar mandiri.",
      };
    }
```

The rest of `verifyNoreg` (the `member_accounts` existence check and the success return) is unchanged.

- [ ] **Step 3: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: fails, pointing at the `<AuthContext.Provider value={{...}}>` line with something like "Property 'registerNew' is missing in type ... but required in type 'AuthContextType'". This is expected — Task 3 adds the missing implementation right after.

- [ ] **Step 4: Commit**

```bash
git add voice-app/src/components/AuthProvider.tsx
git commit -m "feat: flag noreg-not-in-roster on verifyNoreg

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

(It's fine to commit with the expected type error above — Task 3 in the same file fixes it immediately after. If you'd rather keep every commit green, do Task 2 and Task 3 as a single commit instead; either is acceptable here since both tasks touch the same file.)

---

### Task 3: `AuthProvider.tsx` — add `registerNew`

**Files:**
- Modify: `voice-app/src/components/AuthProvider.tsx:134-160` (insert new function after `activate`), `voice-app/src/components/AuthProvider.tsx:225-229` (provider value)

**Interfaces:**
- Consumes: `hashPassword(password: string): Promise<string>` (existing helper, `AuthProvider.tsx:47-52`), `supabase` client (`@/lib/supabase`), `ActivateResult` interface (existing, `AuthProvider.tsx:17-21`).
- Produces: `registerNew(noreg: string, nama: string, password: string): Promise<ActivateResult>` — Task 5 calls this directly.

- [ ] **Step 1: Add the `registerNew` function**

In `voice-app/src/components/AuthProvider.tsx`, immediately after the closing brace of the existing `activate` function (right before the `// Login dengan noreg + password` comment), insert:

```ts
  // Daftar mandiri — untuk noreg yang tidak ada di daftar Excel
  const registerNew = async (noreg: string, nama: string, password: string): Promise<ActivateResult> => {
    const trimmedNoreg = noreg.trim();
    const trimmedNama = nama.trim();

    if (!/^\d{7}$/.test(trimmedNoreg)) {
      return { success: false, message: "Noreg harus berupa 7 digit angka." };
    }
    if (!trimmedNama) {
      return { success: false, message: "Nama wajib diisi." };
    }

    try {
      const passwordHash = await hashPassword(password);
      const namaFinal = trimmedNama.toUpperCase();

      const { error } = await supabase.from("member_accounts").insert([
        {
          noreg: trimmedNoreg,
          nama: namaFinal,
          password_hash: passwordHash,
          role: "member",
          is_self_registered: true,
        },
      ]);

      if (error) {
        if (error.code === "23505") {
          // unique violation
          return { success: false, message: "Noreg sudah terdaftar. Silakan login." };
        }
        return { success: false, message: `Pendaftaran gagal: ${error.message}` };
      }

      return { success: true, message: "Akun berhasil didaftarkan! Silakan login.", nama: namaFinal };
    } catch {
      return { success: false, message: "Terjadi kesalahan. Coba lagi." };
    }
  };
```

- [ ] **Step 2: Wire `registerNew` into the provider value**

Find:
```ts
  return (
    <AuthContext.Provider value={{ user, isLoading, verifyNoreg, activate, login, logout, updateProfilePhoto }}>
      {children}
    </AuthContext.Provider>
  );
```

Replace with:
```ts
  return (
    <AuthContext.Provider value={{ user, isLoading, verifyNoreg, activate, registerNew, login, logout, updateProfilePhoto }}>
      {children}
    </AuthContext.Provider>
  );
```

- [ ] **Step 3: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: PASS (no errors). This confirms `registerNew`'s signature matches `AuthContextType` and resolves the expected failure from Task 2 Step 3.

- [ ] **Step 4: Commit**

```bash
git add voice-app/src/components/AuthProvider.tsx
git commit -m "feat: add registerNew for self-registering unlisted members

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Login page — surface the "Daftar sebagai Anggota Baru" entry point

**Files:**
- Modify: `voice-app/src/app/login/page.tsx:1-45` (imports, hook destructure, state), `voice-app/src/app/login/page.tsx:63-76` (`handleVerifyNoreg`), `voice-app/src/app/login/page.tsx:113-121` (`handleTabChange`), `voice-app/src/app/login/page.tsx:327-332` (Step 1 error block)

**Interfaces:**
- Consumes: `verifyNoreg` (Task 2's updated signature), `registerNew` (Task 3, wired into `useAuth()` but not called until Task 5).
- Produces: `isNewMember: boolean` state and `handleStartNewMemberRegistration` handler — Task 5 depends on both.

- [ ] **Step 1: Import `UserPlus` and `Info` icons, destructure `registerNew`**

Find:
```ts
import {
  Mic2,
  Lock,
  Hash,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";
```

Replace with:
```ts
import {
  Mic2,
  Lock,
  Hash,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  UserCheck,
  UserPlus,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Info,
} from "lucide-react";
```

Find:
```ts
  const { login, verifyNoreg, activate } = useAuth();
```

Replace with:
```ts
  const { login, verifyNoreg, activate, registerNew } = useAuth();
```

- [ ] **Step 2: Add `isNewMember` and `aktiNotInRoster` state**

Find:
```ts
  // --- Aktivasi state ---
  const [aktiStep, setAktiStep] = useState<AktivasiStep>(1);
  const [aktiNoreg, setAktiNoreg] = useState("");
  const [aktiNama, setAktiNama] = useState("");
```

Replace with:
```ts
  // --- Aktivasi state ---
  const [aktiStep, setAktiStep] = useState<AktivasiStep>(1);
  const [isNewMember, setIsNewMember] = useState(false);
  const [aktiNotInRoster, setAktiNotInRoster] = useState(false);
  const [aktiNoreg, setAktiNoreg] = useState("");
  const [aktiNama, setAktiNama] = useState("");
```

(`registerNew` itself is called from Task 5's `handleActivate`; it's destructured here in Step 1 so the component compiles with it in scope.)

- [ ] **Step 3: Update `handleVerifyNoreg` to capture `notInRoster`**

Find:
```ts
  const handleVerifyNoreg = async (e: FormEvent) => {
    e.preventDefault();
    setAktiError("");
    setIsAktiLoading(true);

    const result = await verifyNoreg(aktiNoreg.trim());
    if (!result.valid) {
      setAktiError(result.message);
    } else {
      setAktiNama(result.nama ?? "");
      setAktiStep(2);
    }
    setIsAktiLoading(false);
  };
```

Replace with:
```ts
  const handleVerifyNoreg = async (e: FormEvent) => {
    e.preventDefault();
    setAktiError("");
    setAktiNotInRoster(false);
    setIsAktiLoading(true);

    const result = await verifyNoreg(aktiNoreg.trim());
    if (!result.valid) {
      setAktiError(result.message);
      setAktiNotInRoster(result.notInRoster ?? false);
    } else {
      setAktiNama(result.nama ?? "");
      setIsNewMember(false);
      setAktiStep(2);
    }
    setIsAktiLoading(false);
  };

  const handleStartNewMemberRegistration = () => {
    setIsNewMember(true);
    setAktiNama("");
    setAktiError("");
    setAktiNotInRoster(false);
    setAktiStep(2);
  };
```

- [ ] **Step 4: Reset the new state in `handleTabChange`**

Find:
```ts
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setLoginError("");
    setAktiError("");
    setAktiSuccess("");
    if (tab === "aktivasi") {
      setAktiStep(1);
    }
  };
```

Replace with:
```ts
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setLoginError("");
    setAktiError("");
    setAktiSuccess("");
    setAktiNotInRoster(false);
    if (tab === "aktivasi") {
      setAktiStep(1);
      setIsNewMember(false);
    }
  };
```

- [ ] **Step 5: Show the "Daftar sebagai Anggota Baru" button in Step 1**

Find (Step 1 form, the error block right before the "Verifikasi Noreg" submit button):
```tsx
                    {aktiError && (
                      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-red-700 text-sm font-medium">{aktiError}</p>
                      </div>
                    )}

                    <button
                      id="btn-verify-noreg"
                      type="submit"
                      disabled={isAktiLoading}
                      className="btn-primary w-full py-2.5"
                    >
```

Replace with:
```tsx
                    {aktiError && (
                      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-red-700 text-sm font-medium">{aktiError}</p>
                      </div>
                    )}

                    {aktiNotInRoster && (
                      <button
                        type="button"
                        id="btn-register-new-member"
                        onClick={handleStartNewMemberRegistration}
                        className="btn-secondary w-full py-2.5"
                      >
                        <UserPlus size={16} />
                        Daftar sebagai Anggota Baru
                      </button>
                    )}

                    <button
                      id="btn-verify-noreg"
                      type="submit"
                      disabled={isAktiLoading}
                      className="btn-primary w-full py-2.5"
                    >
```

- [ ] **Step 6: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: PASS. `registerNew` is destructured but not called until Task 5 — this project's `tsconfig.json` does not enable `noUnusedLocals`, so this is not an error. If it were, Task 5 (done immediately after) uses it, so proceed to Task 5 in the same sitting rather than fixing it here.

- [ ] **Step 7: Commit**

```bash
git add voice-app/src/app/login/page.tsx
git commit -m "feat: show self-registration entry point when noreg not in roster

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Login page — new-member form (Step 2) and submit wiring

**Files:**
- Modify: `voice-app/src/app/login/page.tsx:78-111` (`handleActivate`), `voice-app/src/app/login/page.tsx:123-128` (`handleBackToStep1`), `voice-app/src/app/login/page.tsx:290-293` (step indicator label), `voice-app/src/app/login/page.tsx:356-366` (Step 2 verified-member card → branch)

**Interfaces:**
- Consumes: `registerNew` (Task 3), `isNewMember`/`setIsNewMember` (Task 4).
- Produces: fully working self-registration flow — Task 8 verifies this end-to-end.

- [ ] **Step 1: Branch `handleActivate` on `isNewMember`**

Find:
```ts
  const handleActivate = async (e: FormEvent) => {
    e.preventDefault();
    setAktiError("");

    if (aktiPassword.length < 6) {
      setAktiError("Password minimal 6 karakter.");
      return;
    }
    if (aktiPassword !== aktiPasswordConfirm) {
      setAktiError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsAktiLoading(true);
    const result = await activate(aktiNoreg.trim(), aktiNama, aktiPassword);

    if (!result.success) {
      setAktiError(result.message);
    } else {
      setAktiSuccess(result.message);
      // Reset dan pindah ke tab login setelah 2 detik
      setTimeout(() => {
        setAktiStep(1);
        setAktiNoreg("");
        setAktiNama("");
        setAktiPassword("");
        setAktiPasswordConfirm("");
        setAktiSuccess("");
        setActiveTab("login");
        setLoginNoreg(aktiNoreg.trim());
      }, 2000);
    }
    setIsAktiLoading(false);
  };
```

Replace with:
```ts
  const handleActivate = async (e: FormEvent) => {
    e.preventDefault();
    setAktiError("");

    if (isNewMember && !/^\d{7}$/.test(aktiNoreg.trim())) {
      setAktiError("Noreg harus berupa 7 digit angka.");
      return;
    }
    if (isNewMember && !aktiNama.trim()) {
      setAktiError("Nama wajib diisi.");
      return;
    }
    if (aktiPassword.length < 6) {
      setAktiError("Password minimal 6 karakter.");
      return;
    }
    if (aktiPassword !== aktiPasswordConfirm) {
      setAktiError("Konfirmasi password tidak cocok.");
      return;
    }

    setIsAktiLoading(true);
    const result = isNewMember
      ? await registerNew(aktiNoreg.trim(), aktiNama, aktiPassword)
      : await activate(aktiNoreg.trim(), aktiNama, aktiPassword);

    if (!result.success) {
      setAktiError(result.message);
    } else {
      setAktiSuccess(result.message);
      // Reset dan pindah ke tab login setelah 2 detik
      setTimeout(() => {
        setAktiStep(1);
        setAktiNoreg("");
        setAktiNama("");
        setAktiPassword("");
        setAktiPasswordConfirm("");
        setAktiSuccess("");
        setIsNewMember(false);
        setActiveTab("login");
        setLoginNoreg(aktiNoreg.trim());
      }, 2000);
    }
    setIsAktiLoading(false);
  };
```

- [ ] **Step 2: Reset `isNewMember` in `handleBackToStep1`**

Find:
```ts
  const handleBackToStep1 = () => {
    setAktiStep(1);
    setAktiPassword("");
    setAktiPasswordConfirm("");
    setAktiError("");
  };
```

Replace with:
```ts
  const handleBackToStep1 = () => {
    setAktiStep(1);
    setAktiPassword("");
    setAktiPasswordConfirm("");
    setAktiError("");
    setIsNewMember(false);
  };
```

- [ ] **Step 3: Update the step-indicator label**

Find:
```tsx
                  <span className="text-xs text-slate-500 ml-1">
                    {aktiStep === 1 ? "Verifikasi Noreg" : "Buat Password"}
                  </span>
```

Replace with:
```tsx
                  <span className="text-xs text-slate-500 ml-1">
                    {aktiStep === 1 ? "Verifikasi Noreg" : isNewMember ? "Lengkapi Data" : "Buat Password"}
                  </span>
```

- [ ] **Step 4: Branch the Step 2 identity card between verified and new-member modes**

Find:
```tsx
                {/* Step 2: Buat Password */}
                {aktiStep === 2 && (
                  <form onSubmit={handleActivate} className="space-y-5">
                    {/* Info nama */}
                    <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
                      <UserCheck size={18} className="text-blue-600 shrink-0" />
                      <div>
                        <p className="text-xs text-blue-600 font-medium">Anggota terverifikasi</p>
                        <p className="text-sm font-bold text-blue-900">{aktiNama}</p>
                        <p className="text-xs text-blue-600">Noreg: {aktiNoreg}</p>
                      </div>
                    </div>

                    <div>
                      <label className="form-label" htmlFor="akti-password">
```

Replace with:
```tsx
                {/* Step 2: Buat Password */}
                {aktiStep === 2 && (
                  <form onSubmit={handleActivate} className="space-y-5">
                    {isNewMember ? (
                      <>
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200">
                          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-amber-800 text-xs">
                            Data Anda akan disimpan sebagai member baru (di luar daftar resmi).
                          </p>
                        </div>

                        <div>
                          <label className="form-label" htmlFor="akti-noreg-new">
                            <span className="flex items-center gap-1.5">
                              <Hash size={14} />
                              Nomor Registrasi (Noreg)
                            </span>
                          </label>
                          <input
                            id="akti-noreg-new"
                            type="text"
                            value={aktiNoreg}
                            onChange={(e) => setAktiNoreg(e.target.value)}
                            placeholder="7 digit angka"
                            required
                            pattern="\d{7}"
                            title="Noreg harus 7 digit angka"
                            className="form-input"
                          />
                        </div>

                        <div>
                          <label className="form-label" htmlFor="akti-nama-new">
                            <span className="flex items-center gap-1.5">
                              <UserCheck size={14} />
                              Nama Lengkap
                            </span>
                          </label>
                          <input
                            id="akti-nama-new"
                            type="text"
                            value={aktiNama}
                            onChange={(e) => setAktiNama(e.target.value)}
                            placeholder="Nama lengkap Anda"
                            required
                            className="form-input"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
                        <UserCheck size={18} className="text-blue-600 shrink-0" />
                        <div>
                          <p className="text-xs text-blue-600 font-medium">Anggota terverifikasi</p>
                          <p className="text-sm font-bold text-blue-900">{aktiNama}</p>
                          <p className="text-xs text-blue-600">Noreg: {aktiNoreg}</p>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="form-label" htmlFor="akti-password">
```

The password / confirm-password fields, error block, and back/submit buttons that follow are unchanged — only the identity block above them branches.

- [ ] **Step 5: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Manual end-to-end verification**

Start the dev server:
```bash
cd voice-app && npm run dev
```

In a browser, navigate to `http://localhost:3000/login`:
1. Click tab "Aktivasi Akun".
2. Enter a noreg that is **not** in `voice-app/src/lib/members.ts` (e.g. `9999999`) and submit. Expected: red error message ending in "...silakan daftar mandiri." plus a new outlined button "Daftar sebagai Anggota Baru".
3. Click that button. Expected: step indicator now shows "Lengkapi Data"; an amber info banner appears; Noreg field is pre-filled with `9999999` and editable; a new "Nama Lengkap" text input is empty and required.
4. Try submitting with noreg changed to `123` (invalid). Expected: red error "Noreg harus berupa 7 digit angka." and no navigation.
5. Fix noreg back to `9999999`, fill Nama = `Test Member Baru`, password `test123`, confirm `test123`, submit. Expected: green success message "Akun berhasil didaftarkan! Silakan login.", then after ~2s it switches to the "Masuk" tab with noreg `9999999` pre-filled.
6. Log in with noreg `9999999` / password `test123`. Expected: successful login, redirected to `/`.
7. Using the Supabase MCP `execute_sql` tool against `hkrdqeauhfloqguojggx`, run `select noreg, nama, role, is_self_registered from public.member_accounts where noreg = '9999999';` — expected one row: `nama = 'TEST MEMBER BARU'`, `role = 'member'`, `is_self_registered = true`.
8. Clean up the test row: `delete from public.member_accounts where noreg = '9999999';` (via `execute_sql`) so it doesn't pollute the admin dashboard counts checked in Task 7.
9. Re-run the original Excel-verified path as a regression check: activate any noreg from `MEMBERS` that isn't already in `member_accounts` (e.g. one you haven't used yet) and confirm Step 2 still shows the blue "Anggota terverifikasi" read-only card (not the new editable form), and activation still succeeds. Clean up that test row the same way afterward.

- [ ] **Step 7: Commit**

```bash
git add voice-app/src/app/login/page.tsx
git commit -m "feat: wire self-registration form and submit handler on login page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Admin page — data layer for self-registered members

**Files:**
- Modify: `voice-app/src/app/members/page.tsx:1-14` (imports, interface), `voice-app/src/app/members/page.tsx:38-73` (fetch + derived lists), `voice-app/src/app/members/page.tsx:128-168` (stats grid)

**Interfaces:**
- Consumes: `is_self_registered` column (Task 1).
- Produces: `memberBaru: ActivatedAccount[]`, `filteredBaru: ActivatedAccount[]`, `tab` type extended to include `"baru"` — Task 7 depends on all three.

- [ ] **Step 1: Import `UserPlus` and extend `ActivatedAccount`**

Find:
```ts
import { RefreshCw, Search, UserCheck, UserX, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MEMBERS } from "@/lib/members";
import { useAuth } from "@/components/AuthProvider";

interface ActivatedAccount {
  noreg: string;
  nama: string;
  role: string;
  created_at: string;
}
```

Replace with:
```ts
import { RefreshCw, Search, UserCheck, UserX, UserPlus, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { MEMBERS } from "@/lib/members";
import { useAuth } from "@/components/AuthProvider";

interface ActivatedAccount {
  noreg: string;
  nama: string;
  role: string;
  created_at: string;
  is_self_registered: boolean;
}
```

- [ ] **Step 2: Select the new column and extend the `tab` state type**

Find:
```ts
  const [tab, setTab] = useState<"belum" | "sudah">("belum");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("member_accounts")
        .select("noreg, nama, role, created_at")
        .order("created_at", { ascending: false });
```

Replace with:
```ts
  const [tab, setTab] = useState<"belum" | "sudah" | "baru">("belum");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("member_accounts")
        .select("noreg, nama, role, created_at, is_self_registered")
        .order("created_at", { ascending: false });
```

- [ ] **Step 3: Add `memberBaru` and `filteredBaru` derived lists**

Find:
```ts
  const filteredSudah = useMemo(() => {
    if (!search.trim()) return sudahAktivasi;
    const q = search.toLowerCase();
    return sudahAktivasi.filter(
      (a) => a.nama.toLowerCase().includes(q) || a.noreg.includes(q)
    );
  }, [sudahAktivasi, search]);
```

Replace with:
```ts
  const filteredSudah = useMemo(() => {
    if (!search.trim()) return sudahAktivasi;
    const q = search.toLowerCase();
    return sudahAktivasi.filter(
      (a) => a.nama.toLowerCase().includes(q) || a.noreg.includes(q)
    );
  }, [sudahAktivasi, search]);

  const memberBaru = useMemo(
    () => accounts.filter((a) => a.is_self_registered),
    [accounts]
  );

  const filteredBaru = useMemo(() => {
    if (!search.trim()) return memberBaru;
    const q = search.toLowerCase();
    return memberBaru.filter(
      (a) => a.nama.toLowerCase().includes(q) || a.noreg.includes(q)
    );
  }, [memberBaru, search]);
```

- [ ] **Step 4: Add the 4th stat tile**

Find:
```tsx
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="p-4 rounded-xl border bg-white border-slate-200">
            <div className="flex items-center gap-2 text-slate-500">
              <Users size={15} />
              <p className="text-xs font-semibold uppercase tracking-wider">Total Anggota</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-slate-800">{MEMBERS.length}</p>
          </div>
          <button
            onClick={() => setTab("sudah")}
```

Replace with:
```tsx
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-4 rounded-xl border bg-white border-slate-200">
            <div className="flex items-center gap-2 text-slate-500">
              <Users size={15} />
              <p className="text-xs font-semibold uppercase tracking-wider">Total Anggota</p>
            </div>
            <p className="text-2xl font-bold mt-1 text-slate-800">{MEMBERS.length}</p>
          </div>
          <button
            onClick={() => setTab("sudah")}
```

Then find the end of the "Belum Aktivasi" stat button (immediately before the closing `</div>` of the stats grid):
```tsx
            <p className={`text-2xl font-bold mt-1 ${tab === "belum" ? "text-amber-900" : "text-slate-800"}`}>
              {belumAktivasi.length}
            </p>
          </button>
        </div>
```

Replace with:
```tsx
            <p className={`text-2xl font-bold mt-1 ${tab === "belum" ? "text-amber-900" : "text-slate-800"}`}>
              {belumAktivasi.length}
            </p>
          </button>
          <button
            onClick={() => setTab("baru")}
            className={`p-4 text-left rounded-xl border transition-all ${
              tab === "baru"
                ? "bg-blue-50 border-blue-300 ring-2 ring-blue-500/20"
                : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm"
            }`}
          >
            <div className={`flex items-center gap-2 ${tab === "baru" ? "text-blue-700" : "text-slate-500"}`}>
              <UserPlus size={15} />
              <p className="text-xs font-semibold uppercase tracking-wider">Member Baru (Mandiri)</p>
            </div>
            <p className={`text-2xl font-bold mt-1 ${tab === "baru" ? "text-blue-900" : "text-slate-800"}`}>
              {memberBaru.length}
            </p>
          </button>
        </div>
```

- [ ] **Step 5: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add voice-app/src/app/members/page.tsx
git commit -m "feat: track is_self_registered on admin members page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Admin page — "Member Baru" tab table and empty state

**Files:**
- Modify: `voice-app/src/app/members/page.tsx` (table section, the ternary chain starting at `tab === "belum" ? (`)

**Interfaces:**
- Consumes: `filteredBaru`, `memberBaru`, `tab` (all from Task 6).
- Produces: nothing further consumed by other tasks — this is the last UI task.

- [ ] **Step 1: Insert the "baru" branch into the table ternary**

Find (the point where the "belum" branch ends and falls through to the "sudah" branch):
```tsx
              </div>
            )
          ) : filteredSudah.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <UserX size={40} className="text-slate-300" />
              <p className="text-slate-700 font-semibold text-lg">Belum ada yang aktivasi</p>
            </div>
          ) : (
```

Replace with:
```tsx
              </div>
            )
          ) : tab === "baru" ? (
            filteredBaru.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <UserPlus size={40} className="text-slate-300" />
                <p className="text-slate-700 font-semibold text-lg">Belum ada member yang daftar mandiri</p>
              </div>
            ) : (
              <div className="table-container border-none">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="w-12 text-center">#</th>
                      <th>Noreg</th>
                      <th>Nama</th>
                      <th>Waktu Daftar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBaru.map((a, idx) => (
                      <tr key={a.noreg}>
                        <td className="text-center font-medium text-slate-500">{idx + 1}</td>
                        <td className="font-mono text-sm text-slate-600">{a.noreg}</td>
                        <td className="font-semibold text-slate-800">{a.nama}</td>
                        <td className="whitespace-nowrap text-slate-500 text-xs">
                          {formatDateTime(a.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredSudah.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <UserX size={40} className="text-slate-300" />
              <p className="text-slate-700 font-semibold text-lg">Belum ada yang aktivasi</p>
            </div>
          ) : (
```

This inserts a new `tab === "baru"` branch between the existing "belum" and "sudah" (default/else) branches of the ternary chain, without altering either of those.

- [ ] **Step 2: Type-check**

Run: `cd voice-app && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Manual verification**

With the dev server still running (`npm run dev` from Task 5, restart if stopped) and logged in as the admin account (`noreg: ADMIN`):
1. Navigate to `/members`.
2. Repeat Task 5 Step 6's self-registration (noreg `9999999`, nama `Test Member Baru`, password `test123`) — do **not** delete the row this time.
3. Refresh `/members` (or click the "Refresh" button). Expected: the "Member Baru (Mandiri)" stat tile shows `1`.
4. Click that tile. Expected: table shows one row — Noreg `9999999`, Nama `TEST MEMBER BARU`, a "Waktu Daftar" timestamp.
5. Confirm the "Sudah Aktivasi" tile count did **not** increase (self-registered accounts stay out of the Excel-roster-based counts, per spec).
6. Clean up: via Supabase MCP `execute_sql` on `hkrdqeauhfloqguojggx`, run `delete from public.member_accounts where noreg = '9999999';`, then refresh `/members` and confirm the tile returns to `0`.

- [ ] **Step 4: Commit**

```bash
git add voice-app/src/app/members/page.tsx
git commit -m "feat: add Member Baru tab to admin members page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Full regression pass and Netlify smoke check

**Files:** None (verification only).

**Interfaces:** None — this task consumes the completed feature from Tasks 1–7 and produces nothing further.

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

- [ ] **Step 3: Push and let Netlify deploy**

```bash
git push origin main
```
Then, per the existing manual process (`Site configuration → Environment variables` already point at the `voice-member` project from the earlier migration), trigger a deploy in the Netlify dashboard if it doesn't auto-deploy on push, and once live, repeat the Task 5 Step 6 and Task 7 Step 3 manual walkthroughs against the production URL instead of `localhost:3000` — using a throwaway test noreg (not `9999999` if that's now familiar/reused — pick another unused 7-digit number) and cleaning it up afterward via Supabase MCP `execute_sql` the same way.

- [ ] **Step 4: Final cleanup check**

Via Supabase MCP `execute_sql` on `hkrdqeauhfloqguojggx`:
```sql
select noreg, nama, is_self_registered from public.member_accounts where noreg like '9%9%' or nama ilike '%test%';
```
Confirm no leftover test rows remain from any of the manual verification steps in Tasks 5, 7, or this task.
