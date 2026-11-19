"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, AlertTriangle, ArrowLeft } from "lucide-react";

export default function LoginAdminPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Username/NIP dan password wajib diisi.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/login-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        router.push("/admin");
        router.refresh();
      } else {
        setErrorMsg(data.message || "Gagal masuk administrator.");
      }
    } catch (err: any) {
      setErrorMsg("Kesalahan jaringan: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="logo">
            <ShieldCheck className="text-primaryBlue" size={24} />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-wide">
              Absensi Online
            </div>
            <div className="text-xs text-darkMuted">Administrator Access</div>
          </div>
        </div>

        <a href="/" className="btn ghost btn-sm flex items-center gap-1.5 text-xs">
          <ArrowLeft size={14} />
          <span>Panel Pegawai</span>
        </a>
      </header>

      {/* Main Container */}
      <main className="container max-w-md mx-auto p-4 my-auto">
        <div className="card p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Login Admin</h2>
            <p className="text-darkMuted text-sm mt-1">
              Masukkan kredensial administrator (Admin / Super Admin).
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-accentDanger/15 border border-accentDanger/30 rounded-xl text-accentDanger text-sm flex items-center gap-2">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-darkMuted mb-2">
                Username / NIP / Email
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan NIP, Email, atau Username"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-darkMuted mb-2">
                Password Administrator
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn full-width w-full py-3 mt-2"
            >
              {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
            </button>
          </form>


        </div>
      </main>

      {/* Footer */}
      <footer className="text-center p-4 text-xs text-darkMuted/60 border-t border-white/5">
        &copy; 2026 Absensi Online Administrator Access
      </footer>
    </div>
  );
}
