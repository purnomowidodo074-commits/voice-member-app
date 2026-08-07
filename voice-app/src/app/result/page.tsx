"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/lib/supabase";
import { VoiceMember, LINE_OPTIONS } from "@/lib/types";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

const LINE_BADGE: Record<string, string> = {
  "Mel-Pour-Analys": "badge-blue",
  "Mould-RCS": "badge-purple",
  "Core Making": "badge-amber",
  Finishing: "badge-green",
  Maintenance: "badge-rose",
};

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

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
  data,
  resetAt,
  onResetRanking,
}: {
  data: VoiceMember[];
  resetAt?: string | null;
  onResetRanking?: () => Promise<void>;
}) {
  const [profiles, setProfiles] = useState<Record<string, string | null>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const periodData = resetAt
      ? data.filter((r) => new Date(r.created_at) >= new Date(resetAt))
      : data;
    const map = new Map<string, number>();
    for (const r of periodData) {
      map.set(r.member_name, (map.get(r.member_name) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [data, resetAt]);

  useEffect(() => {
    const names = counts.slice(0, 10).map((c) => c.name);
    if (names.length === 0) return;
    supabase
      .from("member_accounts")
      .select("nama, profile_photo")
      .in("nama", names)
      .then(({ data: rows }) => {
        if (!rows) return;
        const map: Record<string, string | null> = {};
        for (const r of rows) {
          map[r.nama] = r.profile_photo || null;
        }
        setProfiles(map);
      });
  }, [counts]);

  const maxCount = counts[0]?.count ?? 1;
  const periodTotal = counts.reduce((sum, c) => sum + c.count, 0);

  const handleConfirmReset = async () => {
    if (!onResetRanking) return;
    setResetting(true);
    setResetError(null);
    try {
      await onResetRanking();
      setConfirmReset(false);
    } catch (e: unknown) {
      setResetError(e instanceof Error ? e.message : "Gagal mereset ranking. Coba lagi.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-5 mb-6">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Top Pengirim</h3>
        <span className="text-xs text-slate-400 ml-auto">
          {resetAt
            ? `${periodTotal} aspirasi sejak ${formatDate(resetAt)}`
            : `${data.length} total aspirasi`}
        </span>
        {onResetRanking && (
          <button
            onClick={() => setConfirmReset(true)}
            className="btn-secondary text-xs py-1.5 px-3"
            title="Kosongkan ranking tanpa menghapus data"
          >
            <RotateCcw size={13} />
            Reset Ranking
          </button>
        )}
      </div>

      {counts.length === 0 ? (
        <p className="text-sm text-slate-400 py-6 text-center">
          Belum ada aspirasi pada periode ranking ini. Data lama tetap tersimpan di tabel.
        </p>
      ) : (
        <div className="space-y-2.5">
          {counts.slice(0, 10).map((item, i) => (
            <div key={item.name} className="flex items-center gap-3">
              <span className="w-5 text-xs font-bold text-slate-400 text-right shrink-0">{i + 1}</span>
              <div className="shrink-0 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center text-xs font-bold text-slate-600"
                   style={{ width: "28px", height: "28px", minWidth: "28px" }}>
                {profiles[item.name] ? (
                  <img src={profiles[item.name]!} alt="" className="w-full h-full object-cover" />
                ) : (
                  item.name.charAt(0).toUpperCase()
                )}
              </div>
              <span className="text-sm font-medium text-slate-700 w-32 truncate shrink-0">{item.name}</span>
              <div className="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden relative">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                  style={{ width: `${(item.count / maxCount) * 100}%` }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-600">
                  {item.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmReset && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setConfirmReset(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 text-amber-600 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Reset Ranking Top Pengirim?</h3>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-2">
              Ranking Top Pengirim akan dikosongkan dan mulai dihitung dari nol.
            </p>
            <p className="text-sm text-slate-600 leading-relaxed mb-6">
              Data aspirasi yang sudah dikirim <span className="font-semibold text-slate-800">tidak akan dihapus</span> — seluruh data tetap utuh, hanya ranking yang direset.
            </p>
            {resetError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium">
                {resetError}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary text-sm"
                onClick={() => setConfirmReset(false)}
                disabled={resetting}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetting}
                className="inline-flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-medium px-4 py-2 rounded-lg border border-transparent transition-all disabled:opacity-60"
              >
                {resetting ? (
                  <span className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px" }} />
                ) : (
                  <RotateCcw size={15} />
                )}
                Ya, Reset Ranking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ResultPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [data, setData] = useState<VoiceMember[]>([]);
  const [filtered, setFiltered] = useState<VoiceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [lineFilter, setLineFilter] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [rankingResetAt, setRankingResetAt] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<VoiceMember | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from("voice_members")
        .select("*")
        .order("created_at", { ascending: false });

      // Member hanya lihat data milik sendiri (filter by noreg)
      if (!isAdmin) {
        query = query.eq("noreg", user.noreg);
      }

      const { data: rows, error: err } = await query;

      if (err) throw err;
      setData(rows ?? []);
      setFiltered(rows ?? []);

      try {
        const { data: settingRow, error: settingErr } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "top_sender_reset_at")
          .maybeSingle();
        if (!settingErr) {
          setRankingResetAt(settingRow?.value ?? null);
        }
      } catch {
        setRankingResetAt(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal memuat data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const resetRanking = async () => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        { key: "top_sender_reset_at", value: now, updated_at: now },
        { onConflict: "key" }
      );
    if (error) throw error;
    setRankingResetAt(now);
  };

  const exportPDF = () => {
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.text("Laporan Voice Member", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Tanggal Export: ${new Date().toLocaleDateString("id-ID")}`, pageWidth / 2, 22, { align: "center" });

    const rows = filtered.map((r, i) => [
      i + 1,
      formatDate(r.input_date),
      r.member_name,
      r.line_name,
      r.voice_text,
    ]);

    autoTable(doc, {
      head: [["#", "Tanggal", "Nama", "Line", "Voice Member"]],
      body: rows,
      startY: 28,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [88, 28, 135], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });

    doc.save(`voice-member-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportSingleDetailPDF = async (row: VoiceMember) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
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
    const lineHeight = 5; // matches the existing `y += lines.length * 5 + 8` spacing already in this function
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += 8; // preserve the existing spacing gap that follows the text block

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
        if (y + imgHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        const imageY = y + 5;
        doc.addImage(dataUrl, format, margin, imageY, imgWidth, imgHeight);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Foto Dokumentasi", margin, y);
      } catch (e) {
        console.warn("Gagal menyematkan foto ke PDF, melanjutkan tanpa foto.", e);
      }
    }

    doc.save(`voice-member-${row.noreg}-${row.input_date}.pdf`);
  };

  return (
    <div className="min-h-screen py-10 px-4">
      {/* Delete Error Toast */}
      {deleteError && (
        <div className="fixed top-5 right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border border-red-200 bg-white max-w-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p className="text-sm font-medium text-slate-700">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="ml-auto text-slate-400 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full rounded-2xl overflow-hidden bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedPhoto} alt="Foto dokumentasi" className="w-full" />
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
              {isAdmin ? "Dashboard Data" : "Riwayat Saya"}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {isAdmin ? "Hasil Voice Member" : "Aspirasi yang Saya Kirim"}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {isAdmin
                ? `${filtered.length} entri ditampilkan dari ${data.length} total`
                : `${data.length} aspirasi telah Anda kirimkan`}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              id="btn-refresh"
              onClick={fetchData}
              className="btn-secondary"
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              id="btn-export-pdf"
              onClick={exportPDF}
              className="btn-success"
              disabled={filtered.length === 0}
            >
              <FileText size={15} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Stats Row — only admin */}
        {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {LINE_OPTIONS.map((line) => {
            const count = data.filter((r) => r.line_name === line).length;
            const isSelected = lineFilter === line;
            return (
              <button
                key={line}
                onClick={() => setLineFilter(isSelected ? "" : line)}
                className={`p-4 text-left transition-all rounded-xl border ${
                  isSelected
                    ? "bg-purple-50 border-purple-300 ring-2 ring-purple-500/20"
                    : "bg-white border-slate-200 hover:border-purple-300 hover:shadow-sm"
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wider ${isSelected ? "text-purple-700" : "text-slate-500"}`}>
                  {line}
                </p>
                <p className={`text-2xl font-bold mt-1 ${isSelected ? "text-purple-900" : "text-slate-800"}`}>
                  {count}
                </p>
              </button>
            );
          })}
        </div>
        )}

        {/* Top Member Chart — only admin */}
        {isAdmin && data.length > 0 && (
          <MemberBarChart
            data={data}
            resetAt={rankingResetAt}
            onResetRanking={resetRanking}
          />
        )}

        {/* Search & Filter Bar — only admin */}
        {isAdmin && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-input"
              type="text"
              placeholder="Cari nama atau voice member..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9"
            />
          </div>
          <select
            id="filter-line"
            value={lineFilter}
            onChange={(e) => setLineFilter(e.target.value)}
            className="form-input sm:max-w-[220px]"
          >
            <option value="">Semua Line</option>
            {LINE_OPTIONS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          {(search || lineFilter) && (
            <button
              className="btn-secondary whitespace-nowrap"
              onClick={() => { setSearch(""); setLineFilter(""); }}
            >
              Reset Filter
            </button>
          )}
        </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <span className="spinner" style={{ width: "2rem", height: "2rem", borderWidth: "3px" }} />
              <p className="text-slate-500">Memuat data...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-red-600 font-semibold">Gagal memuat data</p>
              <p className="text-slate-500 text-sm">{error}</p>
              <button className="btn-primary mt-2" onClick={fetchData}>Coba Lagi</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Inbox size={48} className="text-slate-300" />
              <p className="text-slate-700 font-semibold text-lg">Belum ada data</p>
              <p className="text-slate-500 text-sm">
                {data.length > 0 ? "Tidak ada data yang cocok dengan filter." : "Mulai dengan mengisi form aspirasi."}
              </p>
              {data.length === 0 && (
                <Link href="/" className="btn-primary mt-4">
                  Isi Form Sekarang
                </Link>
              )}
            </div>
          ) : (
            <div className="table-container border-none">
              <table className="data-table w-full">
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
                <tbody>
                  {filtered.map((row, idx) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedRow(row)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="text-center font-medium text-slate-500">{idx + 1}</td>
                      <td className="whitespace-nowrap text-slate-600">
                        {formatDate(row.input_date)}
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex items-center justify-center rounded-full text-xs font-bold shrink-0 bg-blue-50 text-blue-700 border border-blue-200"
                            style={{ width: "32px", height: "32px" }}
                          >
                            {row.member_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800">
                            {row.member_name}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${LINE_BADGE[row.line_name] ?? "badge-blue"}`}>
                          {row.line_name}
                        </span>
                      </td>
                      <td className="max-w-[300px]">
                        <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">
                          {row.voice_text}
                        </p>
                      </td>
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
                      <td className="whitespace-nowrap text-slate-500 text-xs">
                        {formatDateTime(row.created_at)}
                      </td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center mt-8 text-sm text-slate-500">
          Data diurutkan berdasarkan waktu input terbaru · Export PDF tersedia
        </p>
      </div>
    </div>
  );
}
