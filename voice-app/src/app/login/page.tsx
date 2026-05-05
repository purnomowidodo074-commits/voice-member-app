"use client";

import { useState, FormEvent } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Mic2, Lock, User, Eye, EyeOff, AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    await new Promise((r) => setTimeout(r, 600));

    const success = login(username.trim(), password);
    if (!success) {
      setError("Username atau password salah. Silakan coba lagi.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <div className="w-full max-w-[420px]">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4 bg-blue-600 shadow-lg shadow-blue-600/20">
            <Mic2 size={26} color="white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            Voice Member
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Portal Layanan Aspirasi Anggota
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="form-label" htmlFor="login-username">
                <span className="flex items-center gap-1.5">
                  <User size={14} />
                  Username
                </span>
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
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
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  required
                  autoComplete="current-password"
                  className="form-input pr-10"
                />
                <button
                  type="button"
                  id="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showPassword ? "Sembunyikan" : "Tampilkan"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-lg bg-red-50 border border-red-200">
                <AlertCircle size={16} className="text-red-500 shrink-0" />
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            <button
              id="btn-login"
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2.5 mt-2"
            >
              {isLoading ? (
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
          </form>
        </div>

        {/* Credentials info */}
        <div className="mt-6 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Informasi Akses Sistem
          </p>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="badge badge-blue">operator</span>
              </div>
              <code className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">
                operator123
              </code>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="badge badge-purple">admin</span>
              </div>
              <code className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">
                admin123
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
