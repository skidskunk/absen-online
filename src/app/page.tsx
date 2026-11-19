"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  MapPin,
  Clock,
  User,
  LogOut,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  Send,
  Building,
  WifiOff,
  Radio,
  FileText,
} from "lucide-react";
import InstallPWAButton from "@/components/InstallPWAButton";
import {
  saveToOfflineQueue,
  processOfflineQueue,
  getOfflineQueue,
} from "@/lib/offlineQueue";
import { Profile, Attendance, OfficeConfig } from "@/types/database";

export default function UserHomePage() {
  // Authentication & Profile State
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig | null>(null);

  // Login Form State
  const [nip, setNip] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Change Password Modal State
  const [showModalPass, setShowModalPass] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [changePassMsg, setChangePassMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  // Attendance Form State
  const [statusDatang, setStatusDatang] = useState<string>("WFO");
  const [uraianKinerja, setUraianKinerja] = useState("");
  const [outputKinerja, setOutputKinerja] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  // Network & Offline State
  const [isOnline, setIsOnline] = useState(true);
  const [offlineCount, setOfflineCount] = useState(0);

  // User Current GPS
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Load Status Absen & Profile
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/absen/status");
      const data = await res.json();
      if (res.ok && data.loggedIn) {
        setProfile(data.user);
        setAttendance(data.attendance);
        setOfficeConfig(data.officeConfig);
      } else {
        setProfile(null);
        setAttendance(null);
      }
    } catch {
      // Offline fallback: profile might remain cached in state
    } finally {
      setLoading(false);
    }
  }, []);

  // Online / Offline listener & offline queue processing
  useEffect(() => {
    setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    setOfflineCount(getOfflineQueue().length);

    const handleOnline = async () => {
      setIsOnline(true);
      const queueResult = await processOfflineQueue((item, success, message) => {
        setActionMsg({
          text: `Sinkronisasi otomatis (${item.type}): ${message}`,
          isError: !success,
        });
      });
      if (queueResult.synced > 0) {
        await fetchStatus();
      }
      setOfflineCount(getOfflineQueue().length);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [fetchStatus]);

  // Initial Fetch & GPS request
  useEffect(() => {
    fetchStatus();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setGeoError(null);
        },
        (err) => {
          setGeoError("Gagal mengambil GPS: " + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      setGeoError("Perangkat tidak mendukung Geolocation.");
    }
  }, [fetchStatus]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nip.trim() || !password.trim()) {
      setLoginError("NIP dan password wajib diisi.");
      return;
    }

    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await fetch("/api/auth/login-nip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nip, password }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setProfile(data.user);
        await fetchStatus();
      } else {
        setLoginError(data.message || "Gagal masuk.");
      }
    } catch (err: any) {
      setLoginError("Terjadi kesalahan jaringan: " + err.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    setProfile(null);
    setAttendance(null);
  };

  // Handle Ubah Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setChangePassMsg({
        text: "Password baru minimal 8 karakter.",
        isError: true,
      });
      return;
    }

    setChangePassLoading(true);
    setChangePassMsg(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setChangePassMsg({ text: data.message, isError: false });
        if (profile) {
          setProfile({ ...profile, is_default_password: false });
        }
        setTimeout(() => {
          setShowModalPass(false);
          setNewPassword("");
          setChangePassMsg(null);
        }, 1500);
      } else {
        setChangePassMsg({
          text: data.message || "Gagal mengubah password.",
          isError: true,
        });
      }
    } catch (err: any) {
      setChangePassMsg({ text: "Error: " + err.message, isError: true });
    } finally {
      setChangePassLoading(false);
    }
  };

  // Get current position helper
  const getCurrentLocation = (): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Perangkat tidak mendukung geolocation"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setUserLocation(loc);
          resolve(loc);
        },
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  };

  // Absen Datang Submit
  const handleAbsenDatang = async () => {
    setActionLoading(true);
    setActionMsg(null);

    try {
      let loc = userLocation;
      try {
        loc = await getCurrentLocation();
      } catch {
        if (statusDatang === "WFO") {
          throw new Error("Wajib mengizinkan GPS untuk absensi WFO.");
        }
      }

      const payload = {
        statusKerja: statusDatang,
        lat: loc?.lat || 0,
        lng: loc?.lng || 0,
      };

      // Check Offline
      if (!navigator.onLine) {
        saveToOfflineQueue("datang", payload);
        setOfflineCount(getOfflineQueue().length);
        setActionMsg({
          text: "Anda sedang offline. Absen datang disimpan di offline queue dan akan otomatis dikirim saat online.",
          isError: false,
        });
        return;
      }

      const res = await fetch("/api/absen/datang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setActionMsg({ text: data.message, isError: false });
        await fetchStatus();
      } else {
        setActionMsg({
          text: data.message || "Gagal absen datang.",
          isError: true,
        });
      }
    } catch (err: any) {
      setActionMsg({
        text: err.message || "Gagal mengambil lokasi.",
        isError: true,
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Absen Pulang Submit
  const handleAbsenPulang = async () => {
    if (!uraianKinerja.trim()) {
      setActionMsg({
        text: "Mohon isi laporan uraian kerja hari ini.",
        isError: true,
      });
      return;
    }
    if (!outputKinerja.trim()) {
      setActionMsg({
        text: "Mohon isi laporan output hari ini.",
        isError: true,
      });
      return;
    }

    setActionLoading(true);
    setActionMsg(null);

    try {
      let loc = userLocation;
      try {
        loc = await getCurrentLocation();
      } catch {}

      const payload = {
        statusKerja: attendance?.status_datang || "WFO",
        lat: loc?.lat || 0,
        lng: loc?.lng || 0,
        uraianKinerja: uraianKinerja.trim(),
        outputKinerja: outputKinerja.trim(),
      };

      // Check Offline
      if (!navigator.onLine) {
        saveToOfflineQueue("pulang", payload);
        setOfflineCount(getOfflineQueue().length);
        setActionMsg({
          text: "Anda sedang offline. Absen pulang disimpan di offline queue dan akan otomatis dikirim saat online.",
          isError: false,
        });
        return;
      }

      const res = await fetch("/api/absen/pulang", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setActionMsg({ text: data.message, isError: false });
        await fetchStatus();
      } else {
        setActionMsg({
          text: data.message || "Gagal absen pulang.",
          isError: true,
        });
      }
    } catch (err: any) {
      setActionMsg({ text: "Error: " + err.message, isError: true });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand">
          <div className="logo">
            <Building className="text-primaryBlue" size={24} />
          </div>
          <div>
            <div className="font-extrabold text-base tracking-wide">
              Absensi Online
            </div>
            <div className="text-xs text-darkMuted">Panel Pegawai (PWA)</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile && (
            <button
              onClick={handleLogout}
              className="btn danger btn-sm flex items-center gap-1.5"
            >
              <LogOut size={16} />
              <span>Keluar</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="container max-w-4xl mx-auto p-4 sm:p-6 flex-1">
        {/* Offline Banner */}
        {!isOnline && (
          <div className="mb-4 bg-accentWarning/20 border border-accentWarning/40 rounded-custom p-4 flex items-center gap-3 text-accentWarning animate-pulse">
            <WifiOff size={24} className="shrink-0" />
            <div className="text-sm">
              <span className="font-bold">Mode Offline:</span> Anda sedang offline.
              Absensi yang Anda submit akan disimpan di antrean perangkat dan dikirim
              otomatis saat online kembali.
            </div>
          </div>
        )}

        {/* Offline queue indicator */}
        {offlineCount > 0 && (
          <div className="mb-4 bg-accentInfo/20 border border-accentInfo/40 rounded-custom p-3 flex items-center justify-between text-xs text-accentInfo">
            <span>Ada {offlineCount} data absensi tersimpan di antrean offline.</span>
            {isOnline && (
              <button
                onClick={() =>
                  processOfflineQueue(() => {
                    fetchStatus();
                    setOfflineCount(getOfflineQueue().length);
                  })
                }
                className="underline font-semibold"
              >
                Kirim Sekarang
              </button>
            )}
          </div>
        )}

        {/* PWA Install Banner */}
        <InstallPWAButton />

        {loading ? (
          <div className="card text-center py-16 space-y-3">
            <div className="w-10 h-10 border-4 border-primaryBlue border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-darkMuted text-sm">Memuat aplikasi...</p>
          </div>
        ) : !profile ? (
          /* ================= LOGIN PEGAWAI ================= */
          <div className="max-w-md mx-auto my-6">
            <div className="card p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Login Pegawai</h2>
                <p className="text-darkMuted text-sm mt-1">
                  Masukkan NIP dan password Anda untuk melakukan absensi.
                </p>
              </div>

              {loginError && (
                <div className="p-3.5 bg-accentDanger/15 border border-accentDanger/30 rounded-xl text-accentDanger text-sm flex items-center gap-2">
                  <AlertTriangle size={18} className="shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-darkMuted mb-2">
                    NIP Pegawai
                  </label>
                  <input
                    type="text"
                    value={nip}
                    onChange={(e) => setNip(e.target.value)}
                    placeholder="Contoh: 198501012010011001"
                    required
                    autoComplete="username"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-darkMuted mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password Anda"
                    required
                    autoComplete="current-password"
                  />
                  <div className="text-xs text-darkMuted mt-1.5">
                    Password default: <code>12345678</code>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="btn full-width w-full py-3 mt-2"
                >
                  {loginLoading ? "Memproses..." : "Masuk ke Panel Absensi"}
                </button>
              </form>

              <div className="pt-4 border-t border-white/10 text-center">
                <a
                  href="/login-admin"
                  className="text-xs text-primaryBlue hover:underline"
                >
                  Masuk sebagai Administrator &rarr;
                </a>
              </div>
            </div>
          </div>
        ) : (
          /* ================= USER ATTENDANCE PANEL ================= */
          <div className="space-y-6">
            {/* Alert Default Password */}
            {profile.is_default_password && (
              <div className="bg-accentWarning/15 border border-accentWarning/40 rounded-custom p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-accentWarning">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={24} className="shrink-0" />
                  <div className="text-sm font-semibold">
                    Password Anda masih default. Segera ubah password untuk keamanan
                    akun Anda.
                  </div>
                </div>
                <button
                  onClick={() => setShowModalPass(true)}
                  className="btn btn-sm whitespace-nowrap bg-accentWarning text-black font-bold hover:bg-yellow-400"
                >
                  Ubah Sekarang
                </button>
              </div>
            )}

            {/* Top Grid: Profil & Lokasi Kantor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Profil Card */}
              <div className="card space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <User size={18} className="text-primaryBlue" />
                    Profil Pegawai
                  </h3>
                  <button
                    onClick={() => setShowModalPass(true)}
                    className="btn ghost btn-sm text-xs flex items-center gap-1"
                  >
                    <KeyRound size={14} />
                    Ubah Password
                  </button>
                </div>
                <div className="space-y-1.5 text-sm">
                  <div>
                    <span className="text-darkMuted">Nama:</span>{" "}
                    <span className="font-semibold">{profile.nama}</span>
                  </div>
                  <div>
                    <span className="text-darkMuted">NIP:</span>{" "}
                    <span className="font-mono">{profile.nip}</span>
                  </div>
                  <div>
                    <span className="text-darkMuted">Jabatan:</span>{" "}
                    <span>{profile.jabatan}</span>
                  </div>
                  <div>
                    <span className="text-darkMuted">Email:</span>{" "}
                    <span>{profile.email}</span>
                  </div>
                </div>
              </div>

              {/* Lokasi Kantor Card */}
              <div className="card space-y-3">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <MapPin size={18} className="text-accentSuccess" />
                  Lokasi Kantor
                </h3>
                <div className="space-y-1.5 text-sm">
                  <div>
                    <span className="text-darkMuted">Nama Kantor:</span>{" "}
                    <span className="font-semibold">
                      {officeConfig?.kantorNama || "Kantor Dinas"}
                    </span>
                  </div>
                  <div>
                    <span className="text-darkMuted">Koordinat:</span>{" "}
                    <span className="font-mono text-xs">
                      {officeConfig
                        ? `${officeConfig.kantorLat.toFixed(5)}, ${officeConfig.kantorLng.toFixed(5)}`
                        : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-darkMuted">Radius Maksimal:</span>{" "}
                    <span className="font-bold text-primaryBlue">
                      {officeConfig?.radiusMeter || 200} meter
                    </span>
                  </div>
                  {userLocation && (
                    <div className="pt-1 text-xs text-darkMuted flex items-center gap-1">
                      <Radio size={14} className="text-accentInfo animate-pulse" />
                      GPS Anda: {userLocation.lat.toFixed(5)},{" "}
                      {userLocation.lng.toFixed(5)}
                    </div>
                  )}
                  {geoError && (
                    <div className="text-xs text-accentDanger">{geoError}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Feedback Message */}
            {actionMsg && (
              <div
                className={`p-4 rounded-custom text-sm flex items-center gap-3 ${
                  actionMsg.isError
                    ? "bg-accentDanger/15 border border-accentDanger/30 text-accentDanger"
                    : "bg-accentSuccess/15 border border-accentSuccess/30 text-accentSuccess"
                }`}
              >
                {actionMsg.isError ? (
                  <AlertTriangle size={20} className="shrink-0" />
                ) : (
                  <CheckCircle2 size={20} className="shrink-0" />
                )}
                <span>{actionMsg.text}</span>
              </div>
            )}

            {/* Absensi Datang & Pulang Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card Absen Datang */}
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <Clock size={18} className="text-accentInfo" />
                    Absen Datang
                  </h3>
                  {attendance?.jam_datang && (
                    <span className="px-2.5 py-1 bg-accentSuccess/20 text-accentSuccess text-xs rounded-full font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} /> Sudah Masuk
                    </span>
                  )}
                </div>

                {attendance?.jam_datang ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
                    <div className="text-darkMuted text-xs">Status Kehadiran:</div>
                    <div className="font-bold text-base text-accentSuccess">
                      {attendance.status_datang}
                    </div>
                    <div className="text-xs text-darkMuted">
                      Jam Datang:{" "}
                      <span className="text-white font-mono">
                        {new Date(attendance.jam_datang).toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" }
                        )}{" "}
                        WITA
                      </span>
                    </div>
                    {attendance.dist_m > 0 && (
                      <div className="text-xs text-darkMuted">
                        Jarak ke Kantor:{" "}
                        <span className="text-white font-semibold">
                          {attendance.dist_m} meter
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-darkMuted mb-2">
                        Pilih Status Kerja
                      </label>
                      <select
                        value={statusDatang}
                        onChange={(e) => setStatusDatang(e.target.value)}
                      >
                        <option value="WFO">WFO (Work From Office)</option>
                        <option value="WFH">WFH (Work From Home)</option>
                        <option value="DINAS">DINAS LUAR</option>
                        <option value="CUTI">CUTI</option>
                        <option value="SAKIT">SAKIT</option>
                      </select>
                      {statusDatang === "WFO" && (
                        <p className="text-xs text-accentWarning mt-2 flex items-center gap-1">
                          <AlertTriangle size={13} />
                          WFO memerlukan verifikasi jarak GPS ke kantor (maksimal{" "}
                          {officeConfig?.radiusMeter || 200}m).
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleAbsenDatang}
                      disabled={actionLoading}
                      className="btn full-width w-full py-3"
                    >
                      {actionLoading ? "Memvalidasi GPS..." : "Kirim Absen Datang"}
                    </button>
                  </div>
                )}
              </div>

              {/* Card Absen Pulang */}
              <div className="card space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <FileText size={18} className="text-primaryBlue" />
                    Absen Pulang
                  </h3>
                  {attendance?.jam_pulang && (
                    <span className="px-2.5 py-1 bg-accentInfo/20 text-accentInfo text-xs rounded-full font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} /> Selesai Pulang
                    </span>
                  )}
                </div>

                {attendance?.jam_pulang ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-2 text-sm">
                    <div className="text-darkMuted text-xs">
                      Status Kepulangan:
                    </div>
                    <div className="font-bold text-base text-accentInfo">
                      {attendance.status_pulang || attendance.status_datang}
                    </div>
                    <div className="text-xs text-darkMuted">
                      Jam Pulang:{" "}
                      <span className="text-white font-mono">
                        {new Date(attendance.jam_pulang).toLocaleTimeString(
                          "id-ID",
                          { hour: "2-digit", minute: "2-digit" }
                        )}{" "}
                        WITA
                      </span>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <div className="text-xs text-darkMuted">Uraian Kinerja:</div>
                      <div className="text-xs text-white mt-0.5">
                        {attendance.uraian_kinerja || "-"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-darkMuted">Output Harian:</div>
                      <div className="text-xs text-white mt-0.5">
                        {attendance.output_kinerja || "-"}
                      </div>
                    </div>
                  </div>
                ) : !attendance?.jam_datang ? (
                  <div className="p-6 text-center text-darkMuted text-sm border border-dashed border-white/10 rounded-xl space-y-1">
                    <Clock size={28} className="mx-auto mb-2 text-darkMuted/50" />
                    <p>Anda belum absen datang hari ini.</p>
                    <p className="text-xs text-darkMuted/70">
                      Silakan absen datang terlebih dahulu untuk mengaktifkan absen
                      pulang.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-darkMuted mb-2">
                        Uraian Kinerja Hari Ini *
                      </label>
                      <textarea
                        value={uraianKinerja}
                        onChange={(e) => setUraianKinerja(e.target.value)}
                        rows={3}
                        placeholder="Tuliskan aktivitas atau pekerjaan yang Anda selesaikan hari ini..."
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-darkMuted mb-2">
                        Output Kinerja Hari Ini *
                      </label>
                      <textarea
                        value={outputKinerja}
                        onChange={(e) => setOutputKinerja(e.target.value)}
                        rows={3}
                        placeholder="Contoh: Menyelesaikan draft laporan, koordinasi tim..."
                        required
                      />
                    </div>

                    <button
                      onClick={handleAbsenPulang}
                      disabled={actionLoading}
                      className="btn full-width w-full py-3 flex items-center justify-center gap-2"
                    >
                      <Send size={16} />
                      <span>
                        {actionLoading ? "Memproses..." : "Kirim Absen Pulang"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Ubah Password */}
        {showModalPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div className="card max-w-md w-full p-6 space-y-4 bg-darkCard border-white/15">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <KeyRound size={18} className="text-primaryBlue" />
                  Ubah Password
                </h3>
                <button
                  onClick={() => setShowModalPass(false)}
                  className="btn ghost btn-sm"
                >
                  Tutup
                </button>
              </div>

              {changePassMsg && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    changePassMsg.isError
                      ? "bg-accentDanger/20 text-accentDanger border border-accentDanger/30"
                      : "bg-accentSuccess/20 text-accentSuccess border border-accentSuccess/30"
                  }`}
                >
                  <span>{changePassMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-darkMuted mb-2">
                    Password Baru (Minimal 8 Karakter)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Masukkan password baru"
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModalPass(false)}
                    className="btn secondary btn-sm"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={changePassLoading}
                    className="btn btn-sm"
                  >
                    {changePassLoading ? "Menyimpan..." : "Simpan Password Baru"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center p-4 text-xs text-darkMuted/60 border-t border-white/5">
        &copy; 2026 Sistem Absensi Online Geofencing &bull; Asia/Makassar (WITA)
      </footer>
    </div>
  );
}
