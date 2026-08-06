"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMemberByNoreg } from "@/lib/members";

export type UserRole = "member" | "admin";

export interface AuthUser {
  noreg: string;
  nama: string;
  role: UserRole;
  profile_photo?: string | null;
}

interface ActivateResult {
  success: boolean;
  message: string;
  nama?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  // Verifikasi noreg di Excel sebelum aktivasi (Step 1)
  verifyNoreg: (noreg: string) => Promise<{ valid: boolean; nama?: string; message: string }>;
  // Simpan akun baru ke Supabase (Step 2)
  activate: (noreg: string, nama: string, password: string) => Promise<ActivateResult>;
  // Login dengan noreg + password
  login: (noreg: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  updateProfilePhoto: (url: string) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  verifyNoreg: async () => ({ valid: false, message: "" }),
  activate: async () => ({ success: false, message: "" }),
  login: async () => ({ success: false, message: "" }),
  logout: () => {},
  updateProfilePhoto: () => {},
});

// SHA-256 hash menggunakan Web Crypto API (browser-native, no library needed)
async function hashPassword(password: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Routes yang bisa diakses per role
const ROLE_ROUTES: Record<UserRole, string[]> = {
  member: ["/", "/result"],
  admin: ["/", "/result", "/members"],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore session dari localStorage
  useEffect(() => {
    const stored = localStorage.getItem("vm_auth_v2");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        if (parsed.noreg && parsed.nama && parsed.role) {
          setUser(parsed);
        } else {
          localStorage.removeItem("vm_auth_v2");
        }
      } catch {
        localStorage.removeItem("vm_auth_v2");
      }
    }
    setIsLoading(false);
  }, []);

  // Route guard
  useEffect(() => {
    if (isLoading) return;

    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    if (user && pathname !== "/login") {
      const allowed = ROLE_ROUTES[user.role];
      if (!allowed.includes(pathname)) {
        router.replace("/");
      }
    }

    if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, isLoading, pathname, router]);

  // Step 1: Verifikasi Noreg (cek Excel + cek belum aktivasi)
  const verifyNoreg = async (noreg: string): Promise<{ valid: boolean; nama?: string; message: string }> => {
    const trimmed = noreg.trim();

    // Cek apakah noreg ada di data Excel
    const member = getMemberByNoreg(trimmed);
    if (!member) {
      return { valid: false, message: "Noreg tidak ditemukan. Pastikan nomor registrasi Anda benar." };
    }

    // Cek apakah sudah pernah aktivasi (ada di Supabase)
    const { data, error } = await supabase
      .from("member_accounts")
      .select("noreg")
      .eq("noreg", trimmed)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = row not found (normal)
      return { valid: false, message: "Gagal memeriksa status aktivasi. Coba lagi." };
    }

    if (data) {
      return { valid: false, message: "Akun dengan Noreg ini sudah aktif. Silakan langsung login." };
    }

    return { valid: true, nama: member.nama, message: `Noreg valid. Selamat datang, ${member.nama}!` };
  };

  // Step 2: Aktivasi — simpan akun ke Supabase
  const activate = async (noreg: string, nama: string, password: string): Promise<ActivateResult> => {
    try {
      const passwordHash = await hashPassword(password);

      const { error } = await supabase.from("member_accounts").insert([
        {
          noreg: noreg.trim(),
          nama: nama,
          password_hash: passwordHash,
          role: "member",
        },
      ]);

      if (error) {
        if (error.code === "23505") {
          // unique violation
          return { success: false, message: "Akun sudah pernah diaktivasi. Silakan login." };
        }
        return { success: false, message: `Aktivasi gagal: ${error.message}` };
      }

      return { success: true, message: "Akun berhasil diaktivasi! Silakan login.", nama };
    } catch {
      return { success: false, message: "Terjadi kesalahan. Coba lagi." };
    }
  };

  // Login dengan noreg + password
  const login = async (noreg: string, password: string): Promise<{ success: boolean; message: string }> => {
    try {
      const passwordHash = await hashPassword(password);

      const { data, error } = await supabase
        .from("member_accounts")
        .select("noreg, nama, role, profile_photo")
        .eq("noreg", noreg.trim())
        .eq("password_hash", passwordHash)
        .single();

      if (error || !data) {
        // Cek apakah noreg ada tapi password salah
        const { data: exists } = await supabase
          .from("member_accounts")
          .select("noreg")
          .eq("noreg", noreg.trim())
          .single();

        if (exists) {
          return { success: false, message: "Password salah. Silakan coba lagi." };
        }

        // Cek apakah noreg ada di Excel (belum aktivasi)
        const member = getMemberByNoreg(noreg.trim());
        if (member) {
          return { success: false, message: "Akun belum diaktivasi. Silakan klik tab Aktivasi Akun." };
        }

        return { success: false, message: "Noreg tidak ditemukan. Periksa kembali nomor registrasi Anda." };
      }

      const authUser: AuthUser = {
        noreg: data.noreg,
        nama: data.nama,
        role: data.role as UserRole,
        profile_photo: data.profile_photo || null,
      };

      setUser(authUser);
      localStorage.setItem("vm_auth_v2", JSON.stringify(authUser));
      return { success: true, message: `Selamat datang, ${data.nama}!` };
    } catch {
      return { success: false, message: "Terjadi kesalahan. Coba lagi." };
    }
  };

  const updateProfilePhoto = (url: string) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, profile_photo: url };
      localStorage.setItem("vm_auth_v2", JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("vm_auth_v2");
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, verifyNoreg, activate, login, logout, updateProfilePhoto }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { ROLE_ROUTES };
