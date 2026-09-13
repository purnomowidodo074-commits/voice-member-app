"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
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
  KeyRound,
} from "lucide-react";

type Tab = "login" | "aktivasi";
type AktivasiStep = 1 | 2;

export default function LoginPage() {
  const { login, verifyNoreg, activate, registerNew, verifyResetNoreg, resetPassword } = useAuth();

  // --- Tab state ---
  const [activeTab, setActiveTab] = useState<Tab>("login");

  // --- Login state ---
  const [loginNoreg, setLoginNoreg] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // --- Aktivasi state ---
  const [aktiStep, setAktiStep] = useState<AktivasiStep>(1);
  const [isNewMember, setIsNewMember] = useState(false);
  const [aktiNotInRoster, setAktiNotInRoster] = useState(false);
  const [aktiNoreg, setAktiNoreg] = useState("");
  const [aktiNama, setAktiNama] = useState("");
  const [aktiPassword, setAktiPassword] = useState("");
  const [aktiPasswordConfirm, setAktiPasswordConfirm] = useState("");
  const [showAktiPassword, setShowAktiPassword] = useState(false);
  const [showAktiPasswordConfirm, setShowAktiPasswordConfirm] = useState(false);
  const [aktiError, setAktiError] = useState("");
  const [aktiSuccess, setAktiSuccess] = useState("");
  const [isAktiLoading, setIsAktiLoading] = useState(false);

  // --- Lupa Password state ---
  const [showForgot, setShowForgot] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2>(1);
  const [forgotNoreg, setForgotNoreg] = useState("");
  const [forgotNamaInput, setForgotNamaInput] = useState("");
  const [forgotVerifiedNama, setForgotVerifiedNama] = useState("");
  const [forgotPassword, setForgotPassword] = useState("");
  const [forgotPasswordConfirm, setForgotPasswordConfirm] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirm, setShowForgotConfirm] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoginLoading(true);

    const result = await login(loginNoreg.trim(), loginPassword);
    if (!result.success) {
      setLoginError(result.message);
    }
    setIsLoginLoading(false);
  };

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

  const handleBackToStep1 = () => {
    setAktiStep(1);
    setAktiPassword("");
    setAktiPasswordConfirm("");
    setAktiError("");
    setIsNewMember(false);
  };

  // --- Lupa Password handlers ---
  const handleForgotVerify = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotSuccess("");
    setIsForgotLoading(true);
    const result = await verifyResetNoreg(forgotNoreg.trim());
    if (!result.valid) {
      setForgotError(result.message);
    } else {
      setForgotVerifiedNama(result.nama ?? "");
      setForgotStep(2);
    }
    setIsForgotLoading(false);
  };

  const handleForgotReset = async (e: FormEvent) => {
    e.preventDefault();
    setForgotError("");
    if (!forgotNamaInput.trim()) {
      setForgotError("Nama wajib diisi untuk verifikasi.");
      return;
    }
    if (forgotPassword.length < 6) {
      setForgotError("Password minimal 6 karakter.");
      return;
    }
    if (forgotPassword !== forgotPasswordConfirm) {
      setForgotError("Konfirmasi password tidak cocok.");
      return;
    }
    setIsForgotLoading(true);
    const result = await resetPassword(forgotNoreg.trim(), forgotNamaInput, forgotPassword);
    if (!result.success) {
      setForgotError(result.message);
    } else {
      setForgotSuccess(result.message);
      setTimeout(() => {
        setShowForgot(false);
        setForgotStep(1);
        setForgotNoreg("");
        setForgotNamaInput("");
        setForgotVerifiedNama("");
        setForgotPassword("");
        setForgotPasswordConfirm("");
        setForgotSuccess("");
        setLoginNoreg(forgotNoreg.trim());
      }, 2000);
    }
    setIsForgotLoading(false);
  };

  const handleOpenForgot = () => {
    setShowForgot(true);
    setForgotStep(1);
    setForgotError("");
    setForgotSuccess("");
    setForgotNoreg(loginNoreg.trim());
    setForgotNamaInput("");
    setForgotVerifiedNama("");
  };

  const handleCloseForgot = () => {
    setShowForgot(false);
    setForgotStep(1);
    setForgotError("");
    setForgotSuccess("");
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-[440px]">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-blue-600 shadow-lg shadow-blue-600/20">
            <Mic2 size={26} color="white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Voice Member</h1>
          <p className="text-slate-500 text-sm mt-1">Portal Layanan Aspirasi Anggota</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              id="tab-login"
              type="button"
              onClick={() => handleTabChange("login")}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "login"
                  ? "text-blue-700 border-b-2 border-blue-600 bg-blue-50/40"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Lock size={14} />
              Masuk
            </button>
            <button
              id="tab-aktivasi"
              type="button"
              onClick={() => handleTabChange("aktivasi")}
              className={`flex-1 py-3.5 text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                activeTab === "aktivasi"
                  ? "text-blue-700 border-b-2 border-blue-600 bg-blue-50/40"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              <ShieldCheck size={14} />
              Aktivasi Akun
            </button>
          </div>

          <div className="p-8">

            {/* ======================== TAB LOGIN ======================== */}
            {activeTab === "login" && (
              showForgot ? (
                <div>
                  {/* Header Lupa Password */}
                  <div className="flex items-center gap-2 mb-4">
                    <button
                      type="button"
                      id="btn-back-to-login"
                      onClick={handleCloseForgot}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                        <KeyRound size={16} className="text-amber-600" />
                        Lupa Password
                      </h3>
                      <p className="text-xs text-slate-500">Verifikasi Noreg + Nama untuk reset</p>
                    </div>
                  </div>

                  {/* Step Indicator */}
                  <div className="flex items-center gap-2 mb-6">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${forgotStep === 1 ? "bg-amber-500 text-white" : "bg-green-500 text-white"}`}>
                      {forgotStep === 1 ? "1" : <CheckCircle2 size={14} />}
                    </div>
                    <div className={`flex-1 h-0.5 rounded transition-all ${forgotStep === 2 ? "bg-amber-500" : "bg-slate-200"}`} />
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${forgotStep === 2 ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-400"}`}>
                      2
                    </div>
                    <span className="text-xs text-slate-500 ml-1">
                      {forgotStep === 1 ? "Verifikasi Noreg" : "Password Baru"}
                    </span>
                  </div>

                  {forgotSuccess && (
                    <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-green-50 border border-green-200 mb-4">
                      <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                      <p className="text-green-700 text-sm font-medium">{forgotSuccess}</p>
                    </div>
                  )}

                  {forgotStep === 1 ? (
                    <form onSubmit={handleForgotVerify} className="space-y-5">
                      <div>
                        <p className="text-sm text-slate-600 mb-4">
                          Masukkan <strong>Noreg</strong> Anda. Sistem akan cek apakah akun sudah terdaftar.
                        </p>
                        <label className="form-label" htmlFor="forgot-noreg">
                          <span className="flex items-center gap-1.5">
                            <Hash size={14} />
                            Nomor Registrasi (Noreg)
                          </span>
                        </label>
                        <input
                          id="forgot-noreg"
                          type="text"
                          value={forgotNoreg}
                          onChange={(e) => setForgotNoreg(e.target.value)}
                          placeholder="Contoh: 2437740"
                          required
                          className="form-input"
                        />
                      </div>
                      {forgotError && (
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                          <p className="text-red-700 text-sm font-medium">{forgotError}</p>
                        </div>
                      )}
                      <button
                        id="btn-forgot-verify"
                        type="submit"
                        disabled={isForgotLoading}
                        className="btn-primary w-full py-2.5 bg-amber-500 hover:bg-amber-600 border-amber-500"
                      >
                        {isForgotLoading ? (
                          <>
                            <span className="spinner" />
                            Memeriksa...
                          </>
                        ) : (
                          <>
                            <ArrowRight size={16} />
                            Verifikasi Noreg
                          </>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleForgotReset} className="space-y-5">
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200">
                        <UserCheck size={18} className="text-blue-600 shrink-0" />
                        <div>
                          <p className="text-xs text-blue-600 font-medium">Akun ditemukan</p>
                          <p className="text-xs text-blue-600">Noreg: {forgotNoreg}</p>
                        </div>
                      </div>
                      <div>
                        <label className="form-label" htmlFor="forgot-nama">
                          <span className="flex items-center gap-1.5">
                            <UserCheck size={14} />
                            Nama Lengkap (untuk verifikasi)
                          </span>
                        </label>
                        <input
                          id="forgot-nama"
                          type="text"
                          value={forgotNamaInput}
                          onChange={(e) => setForgotNamaInput(e.target.value)}
                          placeholder="Masukkan nama sesuai akun"
                          required
                          className="form-input"
                        />
                        <p className="text-xs text-slate-400 mt-1">Harus sama persis dengan nama di akun (case-insensitive)</p>
                      </div>
                      <div>
                        <label className="form-label" htmlFor="forgot-password">
                          <span className="flex items-center gap-1.5">
                            <Lock size={14} />
                            Password Baru
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            id="forgot-password"
                            type={showForgotPassword ? "text" : "password"}
                            value={forgotPassword}
                            onChange={(e) => setForgotPassword(e.target.value)}
                            placeholder="Minimal 6 karakter"
                            required
                            minLength={6}
                            className="form-input pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotPassword(!showForgotPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showForgotPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="form-label" htmlFor="forgot-password-confirm">
                          <span className="flex items-center gap-1.5">
                            <Lock size={14} />
                            Konfirmasi Password Baru
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            id="forgot-password-confirm"
                            type={showForgotConfirm ? "text" : "password"}
                            value={forgotPasswordConfirm}
                            onChange={(e) => setForgotPasswordConfirm(e.target.value)}
                            placeholder="Ulangi password baru"
                            required
                            className="form-input pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowForgotConfirm(!showForgotConfirm)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showForgotConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {forgotPasswordConfirm && forgotPassword !== forgotPasswordConfirm && (
                          <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
                        )}
                      </div>
                      {forgotError && (
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                          <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                          <p className="text-red-700 text-sm font-medium">{forgotError}</p>
                        </div>
                      )}
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => { setForgotStep(1); setForgotError(""); }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50"
                        >
                          <ArrowLeft size={15} />
                          Kembali
                        </button>
                        <button
                          id="btn-forgot-reset"
                          type="submit"
                          disabled={isForgotLoading}
                          className="btn-primary flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 border-amber-500"
                        >
                          {isForgotLoading ? (
                            <>
                              <span className="spinner" />
                              Mereset...
                            </>
                          ) : (
                            <>
                              <KeyRound size={16} />
                              Reset Password
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-5">
                  <div>
                    <label className="form-label" htmlFor="login-noreg">
                      <span className="flex items-center gap-1.5">
                        <Hash size={14} />
                        Nomor Registrasi (Noreg)
                      </span>
                    </label>
                    <input
                      id="login-noreg"
                      type="text"
                      value={loginNoreg}
                      onChange={(e) => setLoginNoreg(e.target.value)}
                      placeholder="Masukkan nomor registrasi"
                      required
                      autoComplete="username"
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label className="form-label" htmlFor="login-password">
                      <span className="flex items-center gap-1.5">
                        <Lock size={14} />
                        Password
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        id="login-password"
                        type={showLoginPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Masukkan password"
                        required
                        autoComplete="current-password"
                        className="form-input pr-10"
                      />
                      <button
                        type="button"
                        id="btn-toggle-login-password"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        title={showLoginPassword ? "Sembunyikan" : "Tampilkan"}
                      >
                        {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <div className="flex justify-end mt-1.5">
                      <button
                        type="button"
                        id="btn-forgot-password"
                        onClick={handleOpenForgot}
                        className="text-xs text-amber-600 font-semibold hover:underline flex items-center gap-1"
                      >
                        <KeyRound size={12} />
                        Lupa password?
                      </button>
                    </div>
                  </div>

                  {loginError && (
                    <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                      <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-red-700 text-sm font-medium">{loginError}</p>
                    </div>
                  )}

                  <button
                    id="btn-login"
                    type="submit"
                    disabled={isLoginLoading}
                    className="btn-primary w-full py-2.5 mt-2"
                  >
                    {isLoginLoading ? (
                      <>
                        <span className="spinner" />
                        Masuk...
                      </>
                    ) : (
                      <>
                        <Lock size={16} />
                        Masuk
                      </>
                    )}
                  </button>

                  <p className="text-center text-xs text-slate-500 pt-1">
                    Belum punya akun?{" "}
                    <button
                      type="button"
                      onClick={() => handleTabChange("aktivasi")}
                      className="text-blue-600 font-semibold hover:underline"
                    >
                      Aktivasi sekarang
                    </button>
                  </p>
                </form>
              )
            )}

            {/* ======================== TAB AKTIVASI ======================== */}
            {activeTab === "aktivasi" && (
              <div>

                {/* Step Indicator */}
                <div className="flex items-center gap-2 mb-6">
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                    aktiStep === 1 ? "bg-blue-600 text-white" : "bg-green-500 text-white"
                  }`}>
                    {aktiStep === 1 ? "1" : <CheckCircle2 size={14} />}
                  </div>
                  <div className={`flex-1 h-0.5 rounded transition-all ${aktiStep === 2 ? "bg-blue-600" : "bg-slate-200"}`} />
                  <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-all ${
                    aktiStep === 2 ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-400"
                  }`}>
                    2
                  </div>
                  <span className="text-xs text-slate-500 ml-1">
                    {aktiStep === 1 ? "Verifikasi Noreg" : isNewMember ? "Lengkapi Data" : "Buat Password"}
                  </span>
                </div>

                {/* Success message */}
                {aktiSuccess && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-green-50 border border-green-200 mb-4">
                    <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
                    <p className="text-green-700 text-sm font-medium">{aktiSuccess}</p>
                  </div>
                )}

                {/* Step 1: Input Noreg */}
                {aktiStep === 1 && (
                  <form onSubmit={handleVerifyNoreg} className="space-y-5">
                    <div>
                      <p className="text-sm text-slate-600 mb-4">
                        Masukkan <strong>Nomor Registrasi (Noreg)</strong> Anda untuk memulai aktivasi akun.
                      </p>
                      <label className="form-label" htmlFor="akti-noreg">
                        <span className="flex items-center gap-1.5">
                          <Hash size={14} />
                          Nomor Registrasi (Noreg)
                        </span>
                      </label>
                      <input
                        id="akti-noreg"
                        type="text"
                        value={aktiNoreg}
                        onChange={(e) => setAktiNoreg(e.target.value)}
                        placeholder="Contoh: 2437740"
                        required
                        className="form-input"
                      />
                    </div>

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
                      {isAktiLoading ? (
                        <>
                          <span className="spinner" />
                          Memeriksa...
                        </>
                      ) : (
                        <>
                          <ArrowRight size={16} />
                          Verifikasi Noreg
                        </>
                      )}
                    </button>
                  </form>
                )}

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
                        <span className="flex items-center gap-1.5">
                          <Lock size={14} />
                          Buat Password
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          id="akti-password"
                          type={showAktiPassword ? "text" : "password"}
                          value={aktiPassword}
                          onChange={(e) => setAktiPassword(e.target.value)}
                          placeholder="Minimal 6 karakter"
                          required
                          minLength={6}
                          className="form-input pr-10"
                        />
                        <button
                          type="button"
                          id="btn-toggle-akti-password"
                          onClick={() => setShowAktiPassword(!showAktiPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showAktiPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="form-label" htmlFor="akti-password-confirm">
                        <span className="flex items-center gap-1.5">
                          <Lock size={14} />
                          Konfirmasi Password
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          id="akti-password-confirm"
                          type={showAktiPasswordConfirm ? "text" : "password"}
                          value={aktiPasswordConfirm}
                          onChange={(e) => setAktiPasswordConfirm(e.target.value)}
                          placeholder="Ulangi password"
                          required
                          className="form-input pr-10"
                        />
                        <button
                          type="button"
                          id="btn-toggle-akti-confirm"
                          onClick={() => setShowAktiPasswordConfirm(!showAktiPasswordConfirm)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                        >
                          {showAktiPasswordConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      {aktiPasswordConfirm && aktiPassword !== aktiPasswordConfirm && (
                        <p className="text-xs text-red-500 mt-1">Password tidak cocok</p>
                      )}
                    </div>

                    {aktiError && (
                      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                        <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                        <p className="text-red-700 text-sm font-medium">{aktiError}</p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        type="button"
                        id="btn-back-step1"
                        onClick={handleBackToStep1}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all"
                      >
                        <ArrowLeft size={15} />
                        Kembali
                      </button>
                      <button
                        id="btn-activate"
                        type="submit"
                        disabled={isAktiLoading}
                        className="btn-primary flex-1 py-2.5"
                      >
                        {isAktiLoading ? (
                          <>
                            <span className="spinner" />
                            Mengaktivasi...
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={16} />
                            Aktivasi Akun
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-center mt-5 text-xs text-slate-400">
          PT. Toyota Motor Manufacturing Indonesia
        </p>
      </div>
    </div>
  );
}
