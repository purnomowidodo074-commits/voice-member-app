"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Mic2, LogOut, Camera, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/lib/supabase";
import { useState, useRef } from "react";

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout, updateProfilePhoto } = useAuth();
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (pathname === "/login" || !user) return null;

  const isAdmin = user.role === "admin";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `profile-${user.noreg}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      const { error: dbErr } = await supabase
        .from("member_accounts")
        .update({ profile_photo: publicUrl })
        .eq("noreg", user.noreg);

      if (dbErr) throw dbErr;

      updateProfilePhoto(publicUrl);
      setShowUpload(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal upload foto";
      setUploadError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <Image
            src="/logo-tmmin.png"
            alt="PT. Toyota Motor Manufacturing Indonesia"
            width={80}
            height={36}
            className="object-contain"
          />

          <div className="w-px h-8 bg-slate-300" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600">
              <Mic2 size={16} color="white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-slate-800 text-sm leading-none">Voice Member</p>
              <p className="text-xs leading-none mt-0.5 text-slate-500">e-Form Aspirasi</p>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <div className="flex items-center gap-1">
          <Link
            href="/"
            id="nav-form"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              pathname === "/"
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <FileText size={15} />
            Form Input
          </Link>

          <Link
            href="/result"
            id="nav-result"
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              pathname === "/result"
                ? "bg-blue-50 text-blue-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            <LayoutDashboard size={15} />
            {isAdmin ? "Semua Result" : "Result Saya"}
          </Link>
        </div>

        {/* User Info + Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-slate-50 border-slate-200">
            <button
              onClick={() => !isAdmin && setShowUpload(true)}
              className={`relative shrink-0 overflow-hidden rounded-full ${
                !isAdmin ? "cursor-pointer hover:ring-2 hover:ring-purple-400" : "cursor-default"
              }`}
              style={{ width: "28px", height: "28px" }}
              title={isAdmin ? "" : "Klik untuk ganti foto profil"}
            >
              {user.profile_photo ? (
                <img src={user.profile_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                  {user.nama.charAt(0).toUpperCase()}
                </div>
              )}
              {!isAdmin && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                  <Camera size={12} color="white" />
                </div>
              )}
            </button>
            <div>
              <p className="text-xs font-semibold text-slate-800 leading-none">{user.nama}</p>
              {isAdmin && (
                <p className="text-[10px] text-blue-600 font-medium mt-0.5">Administrator</p>
              )}
              {!isAdmin && (
                <p className="text-[10px] text-slate-400 mt-0.5">Noreg: {user.noreg}</p>
              )}
            </div>
          </div>

          <button
            id="btn-logout"
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all bg-white border border-red-200 text-red-600 hover:bg-red-50"
            title="Keluar"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={() => { setShowUpload(false); setUploadError(null); }}
        >
          <div
            className="w-full max-w-xs bg-white rounded-xl shadow-xl border border-slate-200 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">Foto Profil</h3>
              <button onClick={() => { setShowUpload(false); setUploadError(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            {/* Preview */}
            <div className="flex justify-center mb-4">
              <div
                className="rounded-full overflow-hidden border-2 border-slate-200"
                style={{ width: "80px", height: "80px" }}
              >
                {user.profile_photo ? (
                  <img src={user.profile_photo} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-blue-50 text-blue-700 text-2xl font-bold">
                    {user.nama.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />

            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="btn-primary w-full text-sm flex items-center justify-center gap-2"
            >
              {uploading ? (
                <span className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
              ) : (
                <Camera size={14} />
              )}
              {uploading ? "Mengupload..." : "Upload Foto"}
            </button>

            {uploadError && (
              <p className="text-xs text-red-600 mt-3 text-center">{uploadError}</p>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
