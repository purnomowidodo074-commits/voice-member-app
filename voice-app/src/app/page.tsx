"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  User,
  Factory,
  MessageSquare,
  ImagePlus,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LINE_OPTIONS } from "@/lib/types";
import { compressImage } from "@/lib/compressImage";
import { useAuth } from "@/components/AuthProvider";

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

export default function FormPage() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    input_date: getTodayDate(),
    line_name: "",
    voice_text: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.line_name || !form.voice_text.trim()) {
      showToast("error", "Harap lengkapi semua field yang wajib diisi.");
      return;
    }

    const memberName = user?.nama ?? "";
    const memberNoreg = user?.noreg ?? "";

    setIsSubmitting(true);
    try {
      let photo_url: string | null = null;

      // Upload foto jika ada
      if (photoFile) {
        const compressed = await compressImage(photoFile);
        const ext = compressed.name.split(".").pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("voice-photos")
          .upload(fileName, compressed, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("voice-photos")
          .getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }

      // Insert ke database (sertakan noreg untuk filter result)
      const { error: insertError } = await supabase
        .from("voice_members")
        .insert([
          {
            input_date: form.input_date,
            member_name: memberName,
            noreg: memberNoreg,
            line_name: form.line_name,
            voice_text: form.voice_text.trim(),
            photo_url,
          },
        ]);

      if (insertError) throw insertError;

      showToast("success", "Aspirasi berhasil dikirim! Terima kasih.");
      setForm({
        input_date: getTodayDate(),
        line_name: "",
        voice_text: "",
      });
      setPhotoFile(null);
      setPhotoPreview(null);

      setTimeout(() => router.push("/result"), 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Terjadi kesalahan";
      showToast("error", `Gagal mengirim: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const lineBadgeColor: Record<string, string> = {
    "Mel-Pour-Analys": "badge-blue",
    "Mould-RCS": "badge-purple",
    "Core Making": "badge-amber",
    Finishing: "badge-green",
    Maintenance: "badge-rose",
  };

  return (
    <div className="min-h-screen py-10 px-4">
      {/* Toast */}
      {toast && (
        <div
          className="toast fixed top-20 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border"
          style={{
            borderColor: toast.type === "success" ? "#bbf7d0" : "#fecaca",
            backgroundColor: "#ffffff",
            maxWidth: "360px",
          }}
        >
          {toast.type === "success" ? (
            <CheckCircle2 size={20} className="text-green-500" />
          ) : (
            <AlertCircle size={20} className="text-red-500" />
          )}
          <p className="text-sm font-medium text-slate-700">
            {toast.msg}
          </p>
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4 bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
            Form Aspirasi Anggota
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3 text-slate-900">
            Voice Member
          </h1>
          <p className="text-slate-600 text-[0.95rem]">
            Sampaikan aspirasi, keluhan, atau masukan Anda untuk perbaikan bersama.
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 space-y-6">
            {/* Date & Name Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Date */}
              <div>
                <label className="form-label" htmlFor="input_date">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays size={14} />
                    Tanggal
                  </span>
                </label>
                <input
                  id="input_date"
                  type="date"
                  name="input_date"
                  value={form.input_date}
                  onChange={handleChange}
                  required
                  className="form-input"
                />
              </div>

              {/* Name — auto-fill dari akun login */}
              <div>
                <label className="form-label" htmlFor="member_name">
                  <span className="flex items-center gap-1.5">
                    <User size={14} />
                    Nama
                  </span>
                </label>
                <input
                  id="member_name"
                  type="text"
                  name="member_name"
                  value={user?.nama ?? ""}
                  readOnly
                  className="form-input bg-slate-50 text-slate-700 cursor-default select-none"
                  title="Nama diambil dari akun Anda"
                />
              </div>
            </div>

            {/* Line Dropdown */}
            <div>
              <label className="form-label" htmlFor="line_name">
                <span className="flex items-center gap-1.5">
                  <Factory size={14} />
                  Line <span className="text-red-500">*</span>
                </span>
              </label>
              <select
                id="line_name"
                name="line_name"
                value={form.line_name}
                onChange={handleChange}
                required
                className="form-input"
              >
                <option value="" disabled>
                  — Pilih line —
                </option>
                {LINE_OPTIONS.map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </select>
              {/* Preview Badge */}
              {form.line_name && (
                <div className="mt-2">
                  <span
                    className={`badge ${lineBadgeColor[form.line_name] ?? "badge-blue"}`}
                  >
                    {form.line_name}
                  </span>
                </div>
              )}
            </div>

            {/* Voice Member Textarea */}
            <div>
              <label className="form-label" htmlFor="voice_text">
                <span className="flex items-center gap-1.5">
                  <MessageSquare size={14} />
                  Voice Member <span className="text-red-500">*</span>
                </span>
              </label>
              <textarea
                id="voice_text"
                name="voice_text"
                value={form.voice_text}
                onChange={handleChange}
                placeholder="Tuliskan aspirasi, keluhan, atau masukan Anda di sini..."
                required
                rows={5}
                className="form-input"
                style={{ resize: "vertical", minHeight: "120px" }}
              />
              <p className="text-xs text-slate-500 mt-1">
                {form.voice_text.length} karakter
              </p>
            </div>

            {/* Photo Upload */}
            <div>
              <label className="form-label">
                <span className="flex items-center gap-1.5">
                  <ImagePlus size={14} />
                  Foto Dokumentasi{" "}
                  <span className="text-slate-500 font-normal lowercase tracking-normal">
                    (opsional)
                  </span>
                </span>
              </label>

              {photoPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Preview foto"
                    className="w-full object-cover"
                    style={{ maxHeight: "240px" }}
                  />
                  <button
                    type="button"
                    id="btn-remove-photo"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80 transition"
                    title="Hapus foto"
                  >
                    <X size={14} />
                  </button>
                  <div className="px-4 py-2 flex items-center gap-2 bg-slate-50 border-t border-slate-200">
                    <p className="text-xs text-slate-600 font-medium">
                      {photoFile?.name} ({(photoFile!.size / 1024).toFixed(1)} KB)
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  id="upload-area"
                  className={`upload-area ${isDragOver ? "drag-over" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={32} className="mx-auto mb-3 text-slate-400" />
                  <p className="text-sm font-medium text-slate-700">
                    Klik atau drag foto ke sini
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PNG, JPG, WEBP hingga 5MB
                  </p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="btn-submit"
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full"
                style={{ paddingTop: "0.875rem", paddingBottom: "0.875rem" }}
              >
                {isSubmitting ? (
                  <>
                    <span className="spinner" />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Kirim Aspirasi
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        <p className="text-center mt-6 text-sm text-slate-500">
          Data Anda akan tersimpan dan ditinjau oleh tim terkait.
        </p>
      </div>
    </div>
  );
}
