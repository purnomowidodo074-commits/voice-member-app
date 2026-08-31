"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, Trophy } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { LINE_OPTIONS } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";

type Row = { member_name: string; line_name: string; created_at: string };

const LINE_COLORS: Record<string, string> = {
  "Mel-Pour-Analys": "#2563eb",
  "Mould-RCS": "#7e22ce",
  "Core Making": "#d97706",
  Finishing: "#16a34a",
  Maintenance: "#e11d48",
};

const PODIUM = [
  { rank: 2, ring: "ring-slate-300", bar: "bg-slate-200", text: "text-slate-600", h: "h-20" },
  { rank: 1, ring: "ring-amber-400", bar: "bg-amber-300", text: "text-amber-700", h: "h-28" },
  { rank: 3, ring: "ring-orange-300", bar: "bg-orange-200", text: "text-orange-700", h: "h-14" },
];

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

function rankSenders(rows: Row[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.member_name, (map.get(r.member_name) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

function monthlyTotals(rows: Row[]): { label: string; total: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = monthKey(r.created_at);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, total]) => ({ label: monthLabel(key), total }));
}

function lineTotals(rows: Row[]): { line: string; total: number }[] {
  return LINE_OPTIONS.map((line) => ({
    line,
    total: rows.filter((r) => r.line_name === line).length,
  }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

function Avatar({ name, photo, size }: { name: string; photo?: string | null; size: number }) {
  return (
    <div
      className="shrink-0 rounded-full overflow-hidden border border-slate-200 bg-slate-50 flex items-center justify-center font-bold text-slate-600"
      style={{ width: size, height: size, minWidth: size, fontSize: size / 2.6 }}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [rows, setRows] = useState<Row[]>([]);
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string | null>>({});
  const [period, setPeriod] = useState<"all" | "since_reset">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("voice_members")
        .select("member_name, line_name, created_at");
      if (err) throw err;
      setRows(data ?? []);

      try {
        const { data: settingRow } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "top_sender_reset_at")
          .maybeSingle();
        setResetAt(settingRow?.value ?? null);
      } catch {
        setResetAt(null);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rankingRows = useMemo(() => {
    if (period === "since_reset" && resetAt) {
      return rows.filter((r) => new Date(r.created_at) >= new Date(resetAt));
    }
    return rows;
  }, [rows, period, resetAt]);

  const senders = useMemo(() => rankSenders(rankingRows), [rankingRows]);
  const monthly = useMemo(() => monthlyTotals(rows), [rows]);
  const perLine = useMemo(() => lineTotals(rows), [rows]);

  useEffect(() => {
    const names = senders.slice(0, 15).map((s) => s.name);
    if (names.length === 0) return;
    supabase
      .from("member_accounts")
      .select("nama, profile_photo")
      .in("nama", names)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string | null> = {};
        for (const r of data) map[r.nama] = r.profile_photo || null;
        setProfiles(map);
      });
  }, [senders]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-slate-500">Halaman ini khusus admin.</p>
      </div>
    );
  }

  const podium = PODIUM.map((p) => ({ ...p, entry: senders[p.rank - 1] })).filter((p) => p.entry);
  const rest = senders.slice(3);

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
              Dashboard
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard Voice Member</h1>
            <p className="text-slate-500 text-sm mt-1">{rows.length} total aspirasi terkumpul</p>
          </div>
          <button onClick={fetchData} className="btn-secondary" disabled={loading}>
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <span className="spinner" style={{ width: "2rem", height: "2rem", borderWidth: "3px" }} />
            <p className="text-slate-500">Memuat data...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-red-600 font-semibold">Gagal memuat data</p>
            <p className="text-slate-500 text-sm">{error}</p>
            <button className="btn-primary mt-2" onClick={fetchData}>
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top Pengirim */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-5">
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <Trophy size={18} className="text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Top Pengirim</h3>
                <div className="ml-auto inline-flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
                  <button
                    onClick={() => setPeriod("all")}
                    className={`px-3 py-1.5 ${period === "all" ? "bg-purple-50 text-purple-700" : "text-slate-500 hover:bg-slate-50"}`}
                  >
                    Semua Waktu
                  </button>
                  <button
                    onClick={() => setPeriod("since_reset")}
                    disabled={!resetAt}
                    className={`px-3 py-1.5 border-l border-slate-200 disabled:opacity-40 ${
                      period === "since_reset" ? "bg-purple-50 text-purple-700" : "text-slate-500 hover:bg-slate-50"
                    }`}
                    title={resetAt ? "" : "Belum pernah reset ranking"}
                  >
                    Sejak Reset
                  </button>
                </div>
              </div>

              {senders.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Belum ada aspirasi pada periode ini.</p>
              ) : (
                <>
                  {/* Podium */}
                  <div className="flex items-end justify-center gap-3 sm:gap-6 mb-6">
                    {podium.map((p) => (
                      <div key={p.rank} className="flex flex-col items-center gap-2 w-24 sm:w-28">
                        <div className={`rounded-full ring-2 ${p.ring} p-0.5`}>
                          <Avatar name={p.entry!.name} photo={profiles[p.entry!.name]} size={p.rank === 1 ? 56 : 44} />
                        </div>
                        <p className="text-xs font-semibold text-slate-700 text-center truncate w-full" title={p.entry!.name}>
                          {p.entry!.name}
                        </p>
                        <p className="text-xs text-slate-400">{p.entry!.count} aspirasi</p>
                        <div className={`w-full ${p.h} ${p.bar} rounded-t-lg flex items-start justify-center pt-2`}>
                          <span className={`text-lg font-bold ${p.text}`}>{p.rank}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tabel lanjutan — ~5 baris terlihat, sisanya scroll */}
                  {rest.length > 0 && (
                    <div className="table-container border-none max-h-[264px] overflow-y-auto">
                      <table className="data-table w-full">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr>
                            <th className="w-12 text-center">#</th>
                            <th>Nama</th>
                            <th className="w-32 text-right">Jumlah Aspirasi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rest.map((s, i) => (
                            <tr key={s.name}>
                              <td className="text-center font-medium text-slate-500">{i + 4}</td>
                              <td>
                                <div className="flex items-center gap-2.5">
                                  <Avatar name={s.name} photo={profiles[s.name]} size={28} />
                                  <span className="font-semibold text-slate-800">{s.name}</span>
                                </div>
                              </td>
                              <td className="text-right font-bold text-slate-700">{s.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Total per bulan */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-5">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-5">
                Total Voice Member per Bulan
              </h3>
              {monthly.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Belum ada data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthly} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} />
                    <Bar dataKey="total" name="Aspirasi" fill="#7c3aed" radius={[4, 4, 0, 0]} maxBarSize={64}>
                      <LabelList dataKey="total" position="top" style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Per line */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-5">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-5">
                Voice Member per Line
              </h3>
              {perLine.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">Belum ada data.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={perLine} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                    <YAxis type="category" dataKey="line" width={120} tick={{ fontSize: 12, fill: "#334155" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "#f1f5f9" }} />
                    <Bar dataKey="total" name="Aspirasi" radius={[0, 4, 4, 0]} maxBarSize={32}>
                      {perLine.map((d) => (
                        <Cell key={d.line} fill={LINE_COLORS[d.line] ?? "#7c3aed"} />
                      ))}
                      <LabelList dataKey="total" position="right" style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
