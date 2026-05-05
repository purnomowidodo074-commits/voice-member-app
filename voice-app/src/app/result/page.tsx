"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Search,
  ImageIcon,
  FileSpreadsheet,
  Inbox,
  ExternalLink,
} from "lucide-react";
import Papa from "papaparse";
import { supabase } from "@/lib/supabase";
import { VoiceMember, LINE_OPTIONS } from "@/lib/types";
import Link from "next/link";

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

export default function ResultPage() {
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: rows, error: err } = await supabase
        .from("voice_members")
        .select("*")
        .order("created_at", { ascending: false });

      if (err) throw err;
      setData(rows ?? []);
      setFiltered(rows ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Gagal memuat data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

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
      const { error } = await supabase.from("voice_members").delete().eq("id", id);
      if (error) throw error;
      setData((prev) => prev.filter((r) => r.id !== id));
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : "Gagal menghapus data");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  // Export CSV
  const exportCSV = () => {
    const exportData = filtered.map((r) => ({
      Tanggal: formatDate(r.input_date),
      "Waktu Input": formatDateTime(r.created_at),
      "Nama": r.member_name,
      Line: r.line_name,
      "Voice Member": r.voice_text,
      "URL Foto": r.photo_url ?? "",
    }));
    const csv = Papa.unparse(exportData);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `voice-member-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
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

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
              Dashboard Data
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Hasil Voice Member
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {filtered.length} entri ditampilkan dari {data.length} total
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
              id="btn-export-csv"
              onClick={exportCSV}
              className="btn-success"
              disabled={filtered.length === 0}
            >
              <FileSpreadsheet size={15} />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Row */}
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

        {/* Search & Filter Bar */}
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
                    <tr key={row.id}>
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
                            onClick={() => setSelectedPhoto(row.photo_url!)}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-center mt-8 text-sm text-slate-500">
          Data diurutkan berdasarkan waktu input terbaru · Export CSV tersedia
        </p>
      </div>
    </div>
  );
}
