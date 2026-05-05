"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Mic2, LogOut, ShieldCheck, Wrench } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  if (pathname === "/login" || !user) return null;

  const isAdmin = user.role === "admin";

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-slate-200"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-600"
          >
            <Mic2 size={16} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm leading-none">Voice Member</p>
            <p className="text-xs leading-none mt-0.5 text-slate-500">
              e-Form Aspirasi
            </p>
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

          {isAdmin && (
            <Link
              href="/result"
              id="nav-result"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                pathname === "/result"
                  ? "bg-purple-50 text-purple-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <LayoutDashboard size={15} />
              Result
            </Link>
          )}
        </div>

        {/* User Info + Logout */}
        <div className="flex items-center gap-3">
          {/* Role Badge */}
          <div
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
              isAdmin
                ? "bg-purple-50 border-purple-200"
                : "bg-blue-50 border-blue-200"
            }`}
          >
            {isAdmin ? (
              <ShieldCheck size={13} className="text-purple-600" />
            ) : (
              <Wrench size={13} className="text-blue-600" />
            )}
            <span
              className={`text-xs font-semibold ${
                isAdmin ? "text-purple-700" : "text-blue-700"
              }`}
            >
              {user.displayName}
            </span>
          </div>

          {/* Logout Button */}
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
    </nav>
  );
}
