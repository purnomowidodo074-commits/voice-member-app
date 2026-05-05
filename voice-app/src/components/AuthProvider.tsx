"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

export type UserRole = "operator" | "admin";

export interface AuthUser {
  username: string;
  role: UserRole;
  displayName: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isLoading: boolean;
}

// Hardcoded users — bisa dipindah ke env jika diperlukan
const USERS: Record<string, { password: string; role: UserRole; displayName: string }> = {
  operator: {
    password: "operator123",
    role: "operator",
    displayName: "Operator",
  },
  admin: {
    password: "admin123",
    role: "admin",
    displayName: "Administrator",
  },
};

// Routes yang bisa diakses per role
const ROLE_ROUTES: Record<UserRole, string[]> = {
  operator: ["/"],
  admin: ["/", "/result"],
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => false,
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  // Restore session dari localStorage
  useEffect(() => {
    const stored = localStorage.getItem("vm_auth");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as AuthUser;
        // Validasi user masih ada di daftar
        if (USERS[parsed.username]) {
          setUser(parsed);
        } else {
          localStorage.removeItem("vm_auth");
        }
      } catch {
        localStorage.removeItem("vm_auth");
      }
    }
    setIsLoading(false);
  }, []);

  // Route guard
  useEffect(() => {
    if (isLoading) return;

    // Jika belum login dan bukan di halaman login → redirect ke login
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    // Jika sudah login tapi halaman tidak diizinkan → redirect sesuai role
    if (user && pathname !== "/login") {
      const allowed = ROLE_ROUTES[user.role];
      if (!allowed.includes(pathname)) {
        router.replace("/");
      }
    }

    // Jika sudah login dan masuk ke /login → redirect ke home
    if (user && pathname === "/login") {
      router.replace("/");
    }
  }, [user, isLoading, pathname, router]);

  const login = (username: string, password: string): boolean => {
    const u = USERS[username.toLowerCase()];
    if (u && u.password === password) {
      const authUser: AuthUser = {
        username: username.toLowerCase(),
        role: u.role,
        displayName: u.displayName,
      };
      setUser(authUser);
      localStorage.setItem("vm_auth", JSON.stringify(authUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("vm_auth");
    router.replace("/login");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export { ROLE_ROUTES };
