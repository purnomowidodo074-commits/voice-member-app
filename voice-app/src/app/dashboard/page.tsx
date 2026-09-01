"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Trophy, MessageSquare, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { LINE_OPTIONS, AGING_BUCKETS, agingBucketIndex } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";

type Row = {
  member_name: string;
  line_name: string;
  created_at: string;
  comment_tl_gl: string | null;
  comment_sect_h: string | null;
  comment_dept_h: string | null;
};

const isResponded = (r: Row) =>
  !!(r.comment_tl_gl || r.comment_sect_h || r.comment_dept_h);

const AGING_FILLS = ["#16a34a", "#d97706", "#ea580c", "#dc2626"];

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

function monthlyStatus(rows: Row[]): { label: string; responded: number; pending: number }[] {
  const map = new Map<string, { responded: number; pending: number }>();
  for (const r of rows) {
    const k = monthKey(r.created_at);
    const cur = map.get(k) ?? { responded: 0, pending: 0 };
    if (isResponded(r)) cur.responded++;
    else cur.pending++;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({ label: monthLabel(key), ...v }));
}

function lineStatus(rows: Row[]): { line: string; responded: number; pending: number; total: number }[] {
  return LINE_OPTIONS.map((line) => {
    const inLine = rows.filter((r) => r.line_name === line);
    const responded = inLine.filter(isResponded).length;
    return { line, responded, pending: inLine.length - responded, total: inLine.length };
  })
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total);
}

function agingBuckets(rows: Row[]): { label: string; count: number; fill: string }[] {
  const counts = AGING_BUCKETS.map(() => 0);
  for (const r of rows) {
    if (!isResponded(r)) counts[agingBucketIndex(r.created_at)]++;
  }
  return AGING_BUCKETS.map((b, i) => ({ label: b.label, count: counts[i], fill: AGING_FILLS[i] }));
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
  const router = useRouter();

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
        .select("member_name, line_name, created_at, comment_tl_gl, comment_sect_h, comment_dept_h");
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
  const monthly = useMemo(() => monthlyStatus(rows), [rows]);
  const lineStat = useMemo(() => lineStatus(rows), [rows]);
  const aging = useMemo(() => agingBuckets(rows), [rows]);
  const kpi = useMemo(() => {
    const total = rows.length;
    const responded = rows.filter(isResponded).length;
    return {
      total,
      responded,
      pending: total - responded,
      rate: total ? Math.round((responded / total) * 100) : 0,
    };
  }, [rows]);

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
            {/* Aspirasi per Line */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 rounded-xl border bg-white border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Member Voice</p>
                <p className="text-2xl font-bold mt-1 text-slate-800">{rows.length}</p>
              </div>
              {LINE_OPTIONS.map((line) => (
                <div key={line} className="p-4 rounded-xl border bg-white border-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{line}</p>
                  <p className="text-2xl font-bold mt-1 text-slate-800">
                    {rows.filter((r) => r.line_name === line).length}
                  </p>
                </div>
              ))}
            </div>

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

            {/* Status Tanggapan per Line + KPI */}
            <div className="grid grid-cols-4 gap-3 lg:gap-6">
              <div className="col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 px-4 sm:px-6 py-5">
                <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-5">
                  Status Tanggapan per Line
                </h3>
                {lineStat.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">Belum ada data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={lineStat} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis type="category" dataKey="line" width={120} tick={{ fontSize: 12, fill: "#334155" }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "#f1f5f9" }} itemStyle={{ color: "#334155" }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: "#334155" }}>{value}</span>} />
                      <Bar dataKey="responded" stackId="a" name="Ditanggapi" fill="#16a34a" maxBarSize={32} radius={[4, 0, 0, 4]} />
                      <Bar dataKey="pending" stackId="a" name="Belum" fill="#e2e8f0" maxBarSize={32} radius={[0, 4, 4, 0]}>
                        <LabelList dataKey="total" position="right" style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="grid grid-rows-4 gap-3 lg:gap-6">
                {[
                  { label: "Total Aspirasi", value: kpi.total, Icon: MessageSquare, color: "text-slate-700", bg: "bg-slate-100" },
                  { label: "Sudah Ditanggapi", value: kpi.responded, Icon: CheckCircle2, color: "text-green-700", bg: "bg-green-100" },
                  { label: "Belum Ditanggapi", value: kpi.pending, Icon: Clock, color: "text-amber-700", bg: "bg-amber-100" },
                  { label: "Response Rate", value: `${kpi.rate}%`, Icon: TrendingUp, color: "text-blue-700", bg: "bg-blue-100" },
                ].map(({ label, value, Icon, color, bg }) => (
                  <div key={label} className="bg-white rounded-xl shadow-sm border border-slate-200 px-3 lg:px-5 flex items-center gap-2 lg:gap-4">
                    <div className={`hidden sm:flex w-11 h-11 rounded-lg items-center justify-center shrink-0 ${bg}`}>
                      <Icon size={20} className={color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-lg lg:text-2xl font-bold text-slate-900 leading-none">{value}</p>
                      <p className="text-[11px] lg:text-xs text-slate-500 mt-1 leading-tight">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
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
                    <Tooltip cursor={{ fill: "#f1f5f9" }} itemStyle={{ color: "#334155" }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} formatter={(value) => <span style={{ color: "#334155" }}>{value}</span>} />
                    <Bar dataKey="responded" stackId="a" name="Ditanggapi" fill="#7c3aed" maxBarSize={64} />
                    <Bar dataKey="pending" stackId="a" name="Belum" fill="#ddd6fe" radius={[4, 4, 0, 0]} maxBarSize={64} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Umur aspirasi belum ditanggapi */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-6 py-5">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-1">
                Umur Aspirasi Belum Ditanggapi
              </h3>
              {aging.every((b) => b.count === 0) ? (
                <p className="text-sm text-slate-400 py-8 text-center">Semua aspirasi sudah ditanggapi 🎉</p>
              ) : (
                <>
                  <p className="text-xs text-slate-400 mb-4">Klik batang untuk melihat daftar aspirasinya</p>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={aging} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} />
                      <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12, fill: "#334155" }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: "#f1f5f9" }} />
                      <Bar
                        dataKey="count"
                        name="Aspirasi"
                        radius={[0, 4, 4, 0]}
                        maxBarSize={32}
                        cursor="pointer"
                        onClick={(_, index) => {
                          if (aging[index]?.count) router.push(`/result?belum=1&umur=${index}`);
                        }}
                      >
                        {aging.map((d) => (
                          <Cell key={d.label} fill={d.fill} />
                        ))}
                        <LabelList dataKey="count" position="right" style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
