"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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

export default function MembersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [accounts, setAccounts] = useState<ActivatedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

      if (err) throw err;
      setAccounts(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activatedNoregs = useMemo(
    () => new Set(accounts.filter((a) => a.role === "member").map((a) => a.noreg)),
    [accounts]
  );

  const sudahAktivasi = useMemo(
    () => accounts.filter((a) => a.role === "member" && !a.is_self_registered),
    [accounts]
  );

  const belumAktivasi = useMemo(
    () => MEMBERS.filter((m) => !activatedNoregs.has(m.noreg)),
    [activatedNoregs]
  );

  const filteredBelum = useMemo(() => {
    if (!search.trim()) return belumAktivasi;
    const q = search.toLowerCase();
    return belumAktivasi.filter(
      (m) => m.nama.toLowerCase().includes(q) || m.noreg.includes(q)
    );
  }, [belumAktivasi, search]);

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

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <p className="text-slate-500">Halaman ini khusus admin.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
              Status Aktivasi
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Status Aktivasi Anggota
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {MEMBERS.length} total anggota terdaftar
            </p>
          </div>

          <button
            id="btn-refresh"
            onClick={fetchData}
            className="btn-secondary"
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

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
            className={`p-4 text-left rounded-xl border transition-all ${
              tab === "sudah"
                ? "bg-green-50 border-green-300 ring-2 ring-green-500/20"
                : "bg-white border-slate-200 hover:border-green-300 hover:shadow-sm"
            }`}
          >
            <div className={`flex items-center gap-2 ${tab === "sudah" ? "text-green-700" : "text-slate-500"}`}>
              <UserCheck size={15} />
              <p className="text-xs font-semibold uppercase tracking-wider">Sudah Aktivasi</p>
            </div>
            <p className={`text-2xl font-bold mt-1 ${tab === "sudah" ? "text-green-900" : "text-slate-800"}`}>
              {sudahAktivasi.length}
            </p>
          </button>
          <button
            onClick={() => setTab("belum")}
            className={`p-4 text-left rounded-xl border transition-all ${
              tab === "belum"
                ? "bg-amber-50 border-amber-300 ring-2 ring-amber-500/20"
                : "bg-white border-slate-200 hover:border-amber-300 hover:shadow-sm"
            }`}
          >
            <div className={`flex items-center gap-2 ${tab === "belum" ? "text-amber-700" : "text-slate-500"}`}>
              <UserX size={15} />
              <p className="text-xs font-semibold uppercase tracking-wider">Belum Aktivasi</p>
            </div>
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

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 mb-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-input"
              type="text"
              placeholder="Cari nama atau noreg..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input pl-9"
            />
          </div>
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
          ) : tab === "belum" ? (
            filteredBelum.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <UserCheck size={40} className="text-green-300" />
                <p className="text-slate-700 font-semibold text-lg">Semua anggota sudah aktivasi</p>
              </div>
            ) : (
              <div className="table-container border-none">
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="w-12 text-center">#</th>
                      <th>Noreg</th>
                      <th>Nama</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBelum.map((m, idx) => (
                      <tr key={m.noreg}>
                        <td className="text-center font-medium text-slate-500">{idx + 1}</td>
                        <td className="font-mono text-sm text-slate-600">{m.noreg}</td>
                        <td className="font-semibold text-slate-800">{m.nama}</td>
                        <td>
                          <span className="badge badge-amber">Belum Aktivasi</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
            <div className="table-container border-none">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th className="w-12 text-center">#</th>
                    <th>Noreg</th>
                    <th>Nama</th>
                    <th>Status</th>
                    <th>Waktu Aktivasi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSudah.map((a, idx) => (
                    <tr key={a.noreg}>
                      <td className="text-center font-medium text-slate-500">{idx + 1}</td>
                      <td className="font-mono text-sm text-slate-600">{a.noreg}</td>
                      <td className="font-semibold text-slate-800">{a.nama}</td>
                      <td>
                        <span className="badge badge-green">Sudah Aktivasi</span>
                      </td>
                      <td className="whitespace-nowrap text-slate-500 text-xs">
                        {formatDateTime(a.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
