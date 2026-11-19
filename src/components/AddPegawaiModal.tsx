"use client";

import React, { useState } from "react";
import { UserPlus, Eye, EyeOff, AlertTriangle, X, Info } from "lucide-react";

interface AddPegawaiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export default function AddPegawaiModal({
  isOpen,
  onClose,
  onSuccess,
}: AddPegawaiModalProps) {
  const [nip, setNip] = useState("");
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [password, setPassword] = useState("Absen123!");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  // Real-time field validation
  const isNipEmpty = submitted && !nip.trim();
  const isNamaEmpty = submitted && !nama.trim();
  const isEmailEmpty = submitted && !email.trim();
  const isJabatanEmpty = submitted && !jabatan.trim();
  const isPasswordShort = submitted && (!password || password.length < 6);

  const isFormValid =
    nip.trim().length > 0 &&
    nama.trim().length > 0 &&
    email.trim().length > 0 &&
    jabatan.trim().length > 0 &&
    password.trim().length >= 6;

  const handleEmailBlur = () => {
    const trimmed = email.trim();
    if (trimmed && !trimmed.includes("@")) {
      setEmail(`${trimmed}@absen.local`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setErrorMsg(null);

    let finalEmail = email.trim().toLowerCase();
    if (finalEmail && !finalEmail.includes("@")) {
      finalEmail = `${finalEmail}@absen.local`;
      setEmail(finalEmail);
    }

    if (!isFormValid) {
      setErrorMsg("Mohon lengkapi semua kolom yang bertanda bintang (*).");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nip: nip.trim(),
          nama: nama.trim(),
          email: finalEmail,
          jabatan: jabatan.trim(),
          role,
          password: password.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        // Reset form
        setNip("");
        setNama("");
        setEmail("");
        setJabatan("");
        setRole("user");
        setPassword("Absen123!");
        setSubmitted(false);
        setErrorMsg(null);

        onSuccess(
          data.message || `Pegawai berhasil ditambahkan. Password awal: ${password}`
        );
        onClose();
      } else {
        // Jangan tutup modal, tampilkan error agar admin dapat memperbaiki
        setErrorMsg(data.message || "Gagal menambahkan pegawai.");
      }
    } catch (err: any) {
      setErrorMsg("Kesalahan koneksi: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="card max-w-xl w-full p-6 sm:p-7 space-y-5 bg-darkCard border-white/20 shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primaryBlue/20 text-primaryBlue flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Tambah Pegawai Baru</h3>
              <p className="text-xs text-darkMuted">
                Form pendaftaran pegawai baru ke database &amp; akun absensi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-darkMuted hover:text-white hover:bg-white/10 transition-colors"
            title="Tutup"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert Box */}
        {errorMsg && (
          <div className="p-3.5 bg-accentDanger/15 border border-accentDanger/30 rounded-xl text-accentDanger text-xs sm:text-sm flex items-start gap-2.5">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold">{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* NIP */}
            <div>
              <label className="block text-xs font-semibold text-darkMuted mb-1.5">
                NIP Pegawai <span className="text-accentDanger">*</span>
              </label>
              <input
                type="text"
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                placeholder="Contoh: 198001012024011001"
                className={`py-2 px-3 text-sm ${
                  isNipEmpty ? "border-accentDanger bg-accentDanger/5" : ""
                }`}
                required
              />
              {isNipEmpty && (
                <span className="text-xs text-accentDanger mt-1 block">
                  NIP wajib diisi.
                </span>
              )}
            </div>

            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs font-semibold text-darkMuted mb-1.5">
                Nama Lengkap <span className="text-accentDanger">*</span>
              </label>
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama Lengkap Beserta Gelar"
                className={`py-2 px-3 text-sm ${
                  isNamaEmpty ? "border-accentDanger bg-accentDanger/5" : ""
                }`}
                required
              />
              {isNamaEmpty && (
                <span className="text-xs text-accentDanger mt-1 block">
                  Nama lengkap wajib diisi.
                </span>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-darkMuted mb-1.5">
                Email Login <span className="text-accentDanger">*</span>
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={handleEmailBlur}
                placeholder="nama@absen.local"
                className={`py-2 px-3 text-sm ${
                  isEmailEmpty ? "border-accentDanger bg-accentDanger/5" : ""
                }`}
                required
              />
              <span className="text-[11px] text-darkMuted mt-1 block">
                Jika tanpa domain, otomatis ditambahkan <code>@absen.local</code>
              </span>
              {isEmailEmpty && (
                <span className="text-xs text-accentDanger mt-1 block">
                  Email wajib diisi.
                </span>
              )}
            </div>

            {/* Jabatan */}
            <div>
              <label className="block text-xs font-semibold text-darkMuted mb-1.5">
                Jabatan <span className="text-accentDanger">*</span>
              </label>
              <input
                type="text"
                value={jabatan}
                onChange={(e) => setJabatan(e.target.value)}
                placeholder="Contoh: Staff, Bendahara, Analis"
                className={`py-2 px-3 text-sm ${
                  isJabatanEmpty ? "border-accentDanger bg-accentDanger/5" : ""
                }`}
                required
              />
              {isJabatanEmpty && (
                <span className="text-xs text-accentDanger mt-1 block">
                  Jabatan wajib diisi.
                </span>
              )}
            </div>

            {/* Role (User / Admin only) */}
            <div>
              <label className="block text-xs font-semibold text-darkMuted mb-1.5">
                Hak Akses (Role) <span className="text-accentDanger">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "user" | "admin")}
                className="py-2 px-3 text-sm"
              >
                <option value="user">User (Pegawai Biasa)</option>
                <option value="admin">Admin (Administrator)</option>
              </select>
              <span className="text-[11px] text-darkMuted mt-1 block">
                Super Admin hanya bisa dibuat via Supabase Console.
              </span>
            </div>

            {/* Password Awal */}
            <div>
              <label className="block text-xs font-semibold text-darkMuted mb-1.5">
                Password Awal <span className="text-accentDanger">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password Awal"
                  className={`py-2 pl-3 pr-10 text-sm ${
                    isPasswordShort ? "border-accentDanger bg-accentDanger/5" : ""
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-darkMuted hover:text-white"
                  title={showPassword ? "Sembunyikan" : "Tampilkan"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span className="text-[11px] text-darkMuted mt-1 block">
                Default: <code>Absen123!</code> (bisa disesuaikan)
              </span>
            </div>
          </div>

          {/* Info Banner */}
          <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-darkMuted flex items-start gap-2.5">
            <Info size={16} className="text-accentInfo shrink-0 mt-0.5" />
            <div>
              Pegawai akan login dengan <strong>Email</strong> dan{" "}
              <strong>Password Awal</strong> ini. Minta pegawai untuk segera mengganti
              password setelah berhasil login pertama kali.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="btn secondary btn-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || !isFormValid}
              className="btn btn-sm flex items-center gap-1.5 px-4"
            >
              <UserPlus size={16} />
              <span>{loading ? "Menyimpan Pegawai..." : "Simpan Pegawai"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
