"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  CheckCircle,
  Clock,
  RefreshCw,
  Download,
  Plus,
  FileSpreadsheet,
  MapPin,
  Trash2,
  KeyRound,
  AlertTriangle,
  Search,
  CheckCircle2,
  Power,
  Shield,
  UserPlus,
} from "lucide-react";
import { OfficeConfig } from "@/types/database";
import { getWitaDateStr } from "@/lib/date";
import AddPegawaiModal from "@/components/AddPegawaiModal";

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<"monitor" | "pegawai" | "rekap">("monitor");
  const [loading, setLoading] = useState(true);

  // Dashboard Data
  const [selectedDate, setSelectedDate] = useState<string>(getWitaDateStr());
  const [stats, setStats] = useState({
    totalPegawai: 0,
    sudahDatang: 0,
    sudahPulang: 0,
    belumLengkap: 0,
  });
  const [monitorRows, setMonitorRows] = useState<any[]>([]);
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig | null>(null);
  const [myRole, setMyRole] = useState<string>("admin");

  // Data Pegawai State
  const [pegawaiList, setPegawaiList] = useState<any[]>([]);
  const [pegawaiSearch, setPegawaiSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);
  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  // Bulk Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  // Rekap Bulanan
  const now = new Date();
  const [rekapYear, setRekapYear] = useState<number>(now.getFullYear());
  const [rekapMonth, setRekapMonth] = useState<number>(now.getMonth() + 1);
  const [rekapRows, setRekapRows] = useState<any[]>([]);
  const [rekapLoading, setRekapLoading] = useState(false);

  // Export Month for Monitor
  const [monitorMonth, setMonitorMonth] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );

  // Load Dashboard Data
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/dashboard?date=${selectedDate}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setStats(data.stats);
        setMonitorRows(data.rows || []);
        setPegawaiList(data.pegawai || []);
        setOfficeConfig(data.officeConfig);
        setMyRole(data.myRole || "admin");
      }
    } catch (err) {
      console.error("Gagal load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // Load Rekap Bulanan
  const loadRekap = async () => {
    setRekapLoading(true);
    try {
      const res = await fetch(
        `/api/admin/rekap-bulanan?year=${rekapYear}&month=${rekapMonth}`
      );
      const data = await res.json();
      if (res.ok && data.ok) {
        setRekapRows(data.rows || []);
      }
    } catch (err) {
      console.error("Gagal load rekap:", err);
    } finally {
      setRekapLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "rekap") {
      loadRekap();
    }
  }, [activeTab, rekapYear, rekapMonth]);

  // Handle Bulk Insert
  const handleBulkInsert = async () => {
    if (!bulkText.trim()) return;
    setBulkLoading(true);
    setBulkResult(null);

    try {
      const res = await fetch("/api/admin/bulk-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: bulkText }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setBulkResult(data.message);
        setBulkText("");
        await loadDashboard();
        showToast("Bulk insert berhasil diproses!");
      } else {
        setBulkResult("Gagal: " + (data.message || "Unknown error"));
      }
    } catch (err: any) {
      setBulkResult("Error: " + err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  // Handle Reset Password Pegawai ke Absen123!
  const handleResetPassword = async (id: string, nama: string, nip: string) => {
    if (!confirm(`Yakin reset password pegawai ${nama} (${nip}) ke default: Absen123!?`)) return;

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || `Password ${nama} berhasil direset ke Absen123!`);
        await loadDashboard();
      } else {
        showToast(data.message || "Gagal reset password.", true);
      }
    } catch (err: any) {
      showToast("Error: " + err.message, true);
    }
  };

  // Handle Toggle Aktif / Nonaktif
  const handleToggleActive = async (id: string, nama: string, currentActive: boolean) => {
    const newStatus = !currentActive;
    const actionWord = newStatus ? "mengaktifkan" : "menonaktifkan";

    if (!confirm(`Yakin ingin ${actionWord} akun ${nama}?`)) return;

    try {
      const res = await fetch("/api/admin/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_active: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || `Status akun ${nama} berhasil diubah.`);
        await loadDashboard();
      } else {
        showToast(data.message || "Gagal mengubah status.", true);
      }
    } catch (err: any) {
      showToast("Error: " + err.message, true);
    }
  };

  // Handle Delete Pegawai (Super Admin Only)
  const handleDeletePegawai = async (id: string, nama: string) => {
    if (myRole !== "super_admin") {
      alert("Hanya Super Admin yang diizinkan menghapus pegawai.");
      return;
    }

    if (!confirm(`PERINGATAN: Yakin menghapus pegawai ${nama}? Semua riwayat absensi terkait akan dihapus.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || `Pegawai ${nama} berhasil dihapus.`);
        await loadDashboard();
      } else {
        showToast(data.message || "Gagal menghapus pegawai.", true);
      }
    } catch (err: any) {
      showToast("Error: " + err.message, true);
    }
  };

  // CSV Export Helpers
  const exportMonitorCSV = () => {
    if (monitorRows.length === 0) return alert("Tidak ada data untuk diexport.");
    const headers = ["NIP", "Nama", "Jabatan", "Status", "Jam Datang", "Jam Pulang", "Uraian Kinerja", "Output"];
    const rows = monitorRows.map((r) => [
      `"${r.nip}"`,
      `"${r.nama}"`,
      `"${r.jabatan}"`,
      `"${r.status}"`,
      `"${r.datang}"`,
      `"${r.pulang}"`,
      `"${(r.uraian || "").replace(/"/g, '""')}"`,
      `"${(r.output || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Monitor_Absensi_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMonitorBulanan = async () => {
    const [y, m] = monitorMonth.split("-");
    try {
      const res = await fetch(`/api/admin/export-monitor?year=${y}&month=${m}`);
      const data = await res.json();
      if (!res.ok || !data.ok || !data.rows || data.rows.length === 0) {
        alert("Tidak ada data detail bulanan pada periode ini.");
        return;
      }
      const headers = ["Tanggal", "NIP", "Nama", "Jabatan", "Status Datang", "Jam Datang", "Status Pulang", "Jam Pulang", "Uraian Kinerja", "Output"];
      const rows = data.rows.map((r: any) => [
        `"${r.tanggal}"`,
        `"${r.nip}"`,
        `"${r.nama}"`,
        `"${r.jabatan}"`,
        `"${r.statusDatang}"`,
        `"${r.jamDatang}"`,
        `"${r.statusPulang}"`,
        `"${r.jamPulang}"`,
        `"${(r.uraian || "").replace(/"/g, '""')}"`,
        `"${(r.output || "").replace(/"/g, '""')}"`,
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e: any) => e.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Monitor_Bulanan_${monitorMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert("Gagal export bulanan: " + err.message);
    }
  };

  const exportRekapCSV = () => {
    if (rekapRows.length === 0) return alert("Tidak ada data rekap.");
    const headers = ["NIP", "Nama", "Jabatan", "Hadir", "WFO", "WFH", "Dinas", "Cuti", "Sakit", "Pulang Lengkap"];
    const rows = rekapRows.map((r) => [
      `"${r.nip}"`,
      `"${r.nama}"`,
      `"${r.jabatan}"`,
      r.hadir,
      r.wfo,
      r.wfh,
      r.dinas,
      r.cuti,
      r.sakit,
      r.pulangLengkap,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Bulanan_${rekapYear}_${rekapMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter Pegawai List
  const filteredPegawai = pegawaiList.filter((p) => {
    const q = pegawaiSearch.toLowerCase();
    return (
      (p.nip || "").toLowerCase().includes(q) ||
      (p.nama || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      (p.jabatan || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-fadeIn text-sm font-semibold ${
            toast.isError
              ? "bg-accentDanger text-white"
              : "bg-accentSuccess text-black"
          }`}
        >
          {toast.isError ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Lokasi Kantor Aktif Card */}
      <div className="card bg-gradient-to-r from-darkCard to-primaryBlue/10 border-primaryBlue/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primaryBlue/20 flex items-center justify-center text-primaryBlue shrink-0">
            <MapPin size={24} />
          </div>
          <div>
            <div className="text-xs text-darkMuted uppercase font-bold tracking-wider">
              Lokasi Kantor Aktif
            </div>
            <div className="font-extrabold text-lg text-white">
              {officeConfig?.kantorNama || "Kantor Dinas"}
            </div>
            <div className="text-xs text-darkMuted flex items-center gap-3 mt-0.5">
              <span>
                Lat: <code className="text-white">{officeConfig?.kantorLat.toFixed(5)}</code>
              </span>
              <span>
                Lng: <code className="text-white">{officeConfig?.kantorLng.toFixed(5)}</code>
              </span>
              <span>
                Radius: <strong className="text-accentInfo">{officeConfig?.radiusMeter}m</strong>
              </span>
            </div>
          </div>
        </div>

        {myRole === "super_admin" ? (
          <Link
            href="/admin/pengaturan-lokasi"
            className="btn btn-sm bg-primaryBlue hover:bg-primaryBlue/80 text-white whitespace-nowrap"
          >
            Ubah Lokasi
          </Link>
        ) : (
          <span className="text-xs text-darkMuted italic">
            (Hanya Super Admin dapat mengubah lokasi)
          </span>
        )}
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card stat-card">
          <div className="flex items-center justify-center gap-2 text-darkMuted text-xs font-semibold uppercase">
            <Users size={16} /> Total Pegawai
          </div>
          <div className="stat-value">{stats.totalPegawai}</div>
          <div className="text-xs text-darkMuted">Orang Terdaftar</div>
        </div>

        <div className="card stat-card">
          <div className="flex items-center justify-center gap-2 text-accentSuccess text-xs font-semibold uppercase">
            <UserCheck size={16} /> Hadir (Masuk)
          </div>
          <div className="stat-value success-text">{stats.sudahDatang}</div>
          <div className="text-xs text-darkMuted">WFO / WFH / Dinas</div>
        </div>

        <div className="card stat-card">
          <div className="flex items-center justify-center gap-2 text-accentInfo text-xs font-semibold uppercase">
            <CheckCircle size={16} /> Sudah Pulang
          </div>
          <div className="stat-value info-text">{stats.sudahPulang}</div>
          <div className="text-xs text-darkMuted">Selesai Absen Pulang</div>
        </div>

        <div className="card stat-card">
          <div className="flex items-center justify-center gap-2 text-accentWarning text-xs font-semibold uppercase">
            <Clock size={16} /> Belum Lengkap
          </div>
          <div className="stat-value warning-text">{stats.belumLengkap}</div>
          <div className="text-xs text-darkMuted">Belum Absen Pulang</div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="tabs-nav">
        <button
          onClick={() => setActiveTab("monitor")}
          className={`tab-btn ${activeTab === "monitor" ? "active" : ""}`}
        >
          Monitor Harian
        </button>
        <button
          onClick={() => setActiveTab("pegawai")}
          className={`tab-btn ${activeTab === "pegawai" ? "active" : ""}`}
        >
          Data Pegawai
        </button>
        <button
          onClick={() => setActiveTab("rekap")}
          className={`tab-btn ${activeTab === "rekap" ? "active" : ""}`}
        >
          Rekap Bulanan
        </button>
      </div>

      {/* TAB 1: MONITOR HARIAN */}
      {activeTab === "monitor" && (
        <div className="card space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-lg font-bold">Monitor Absensi Harian</h3>
              <p className="text-xs text-darkMuted">
                Menampilkan kehadiran pegawai untuk tanggal terpilih
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto py-1.5 px-3 text-sm"
              />
              <button
                onClick={loadDashboard}
                className="btn btn-sm secondary flex items-center gap-1"
                title="Refresh"
              >
                <RefreshCw size={14} />
                <span>Refresh</span>
              </button>
              <button
                onClick={exportMonitorCSV}
                className="btn btn-sm ghost flex items-center gap-1"
              >
                <Download size={14} />
                <span>Export Harian CSV</span>
              </button>

              <div className="flex items-center gap-1 pl-2 border-l border-white/10">
                <input
                  type="month"
                  value={monitorMonth}
                  onChange={(e) => setMonitorMonth(e.target.value)}
                  className="w-auto py-1.5 px-3 text-sm"
                />
                <button
                  onClick={exportMonitorBulanan}
                  className="btn btn-sm secondary flex items-center gap-1"
                >
                  <Download size={14} />
                  <span>Export Bulanan CSV</span>
                </button>
              </div>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Jabatan</th>
                  <th>Status</th>
                  <th>Jam Datang</th>
                  <th>Jam Pulang</th>
                  <th>Uraian Kinerja</th>
                  <th>Output Harian</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-darkMuted">
                      Memuat data kehadiran...
                    </td>
                  </tr>
                ) : monitorRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-darkMuted">
                      Belum ada data absensi untuk tanggal {selectedDate}.
                    </td>
                  </tr>
                ) : (
                  monitorRows.map((row, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-xs">{row.nip}</td>
                      <td className="font-semibold">{row.nama}</td>
                      <td>{row.jabatan}</td>
                      <td>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            row.status === "WFO"
                              ? "bg-accentSuccess/20 text-accentSuccess"
                              : row.status === "WFH"
                              ? "bg-primaryBlue/20 text-primaryBlue"
                              : row.status === "DINAS"
                              ? "bg-accentInfo/20 text-accentInfo"
                              : row.status === "CUTI" || row.status === "SAKIT"
                              ? "bg-accentWarning/20 text-accentWarning"
                              : "text-darkMuted"
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{row.datang}</td>
                      <td className="font-mono text-xs">{row.pulang}</td>
                      <td className="max-w-xs truncate text-xs" title={row.uraian}>
                        {row.uraian}
                      </td>
                      <td className="max-w-xs truncate text-xs" title={row.output}>
                        {row.output}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: DATA PEGAWAI (DENGAN MODAL TAMBAH PEGAWAI) */}
      {activeTab === "pegawai" && (
        <div className="space-y-4">
          <div className="card space-y-4">
            {/* Header Data Pegawai dengan Tombol [+ Tambah Pegawai] di pojok kanan atas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Users className="text-primaryBlue" size={20} />
                  Kelola Data Pegawai
                </h3>
                <p className="text-xs text-darkMuted">
                  Daftar seluruh pegawai terdaftar dari tabel <code>public.profiles</code> (diurutkan berdasarkan nama)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="btn secondary btn-sm flex items-center gap-1.5"
                  title="Import banyak pegawai sekaligus dari format CSV"
                >
                  <FileSpreadsheet size={15} />
                  <span>Tambah Bulk (CSV)</span>
                </button>
                {/* TOMBOL PRIORITAS: [+ Tambah Pegawai] */}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="btn btn-sm bg-primaryBlue hover:bg-primaryBlue/80 flex items-center gap-1.5 shadow-lg shadow-primaryBlue/20 text-white font-bold"
                >
                  <UserPlus size={16} />
                  <span>+ Tambah Pegawai</span>
                </button>
              </div>
            </div>

            {/* Filter / Search Pegawai */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-darkMuted"
                />
                <input
                  type="text"
                  value={pegawaiSearch}
                  onChange={(e) => setPegawaiSearch(e.target.value)}
                  placeholder="Cari berdasarkan NIP atau nama..."
                  className="pl-9 py-2 text-sm"
                />
              </div>

              <div className="text-xs text-darkMuted">
                Menampilkan <strong>{filteredPegawai.length}</strong> pegawai
              </div>
            </div>

            {/* Tabel Daftar Pegawai */}
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>NIP</th>
                    <th>Nama Lengkap</th>
                    <th>Email</th>
                    <th>Jabatan</th>
                    <th>Role</th>
                    <th>Status Akun</th>
                    <th>Password</th>
                    <th className="text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPegawai.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-darkMuted">
                        Tidak ada data pegawai yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredPegawai.map((p) => {
                      const isSuper = p.role === "super_admin";
                      return (
                        <tr key={p.id}>
                          <td className="font-mono text-xs font-semibold">{p.nip}</td>
                          <td className="font-semibold">{p.nama}</td>
                          <td className="text-xs text-darkMuted">{p.email}</td>
                          <td>{p.jabatan}</td>
                          <td>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                isSuper
                                  ? "bg-accentDanger/20 text-accentDanger border border-accentDanger/30"
                                  : p.role === "admin"
                                  ? "bg-accentWarning/20 text-accentWarning border border-accentWarning/30"
                                  : "bg-primaryBlue/20 text-primaryBlue border border-primaryBlue/30"
                              }`}
                            >
                              {p.role}
                            </span>
                          </td>
                          <td>
                            {p.is_active ? (
                              <span className="text-xs text-accentSuccess font-semibold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-accentSuccess inline-block"></span>
                                Aktif
                              </span>
                            ) : (
                              <span className="text-xs text-accentDanger font-semibold flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-accentDanger inline-block"></span>
                                Nonaktif
                              </span>
                            )}
                          </td>
                          <td>
                            {p.is_default_password ? (
                              <span className="text-xs text-accentWarning bg-accentWarning/10 px-2 py-0.5 rounded-full font-medium">
                                Default (Absen123!)
                              </span>
                            ) : (
                              <span className="text-xs text-accentSuccess bg-accentSuccess/10 px-2 py-0.5 rounded-full font-medium">
                                Kustom
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Tombol Nonaktifkan / Aktifkan */}
                              <button
                                onClick={() => handleToggleActive(p.id, p.nama, p.is_active)}
                                className={`btn btn-sm text-xs p-1.5 flex items-center gap-1 ${
                                  p.is_active ? "ghost text-accentWarning" : "secondary text-accentSuccess"
                                }`}
                                title={p.is_active ? "Nonaktifkan Pegawai" : "Aktifkan Pegawai"}
                              >
                                <Power size={13} />
                                <span>{p.is_active ? "Nonaktifkan" : "Aktifkan"}</span>
                              </button>

                              {/* Tombol Reset Password */}
                              <button
                                onClick={() => handleResetPassword(p.id, p.nama, p.nip)}
                                className="btn btn-sm secondary text-xs p-1.5 flex items-center gap-1"
                                title="Reset Password ke default Absen123!"
                              >
                                <KeyRound size={13} />
                                <span>Reset</span>
                              </button>

                              {/* Tombol Hapus: Hanya muncul jika myRole === 'super_admin' dan bukan akun super_admin */}
                              {myRole === "super_admin" && !isSuper && (
                                <button
                                  onClick={() => handleDeletePegawai(p.id, p.nama)}
                                  className="btn btn-sm danger text-xs p-1.5 flex items-center gap-1"
                                  title="Hapus Pegawai (Super Admin Only)"
                                >
                                  <Trash2 size={13} />
                                  <span>Hapus</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REKAP BULANAN */}
      {activeTab === "rekap" && (
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/10">
            <div>
              <h3 className="text-lg font-bold">Rekapitulasi Bulanan</h3>
              <p className="text-xs text-darkMuted">
                Total kehadiran dan status kerja bulanan per pegawai
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="number"
                value={rekapYear}
                onChange={(e) => setRekapYear(parseInt(e.target.value, 10))}
                className="w-24 py-1.5 px-3 text-sm"
                placeholder="Tahun"
              />
              <select
                value={rekapMonth}
                onChange={(e) => setRekapMonth(parseInt(e.target.value, 10))}
                className="w-36 py-1.5 px-3 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(2026, i, 1).toLocaleString("id-ID", { month: "long" })}
                  </option>
                ))}
              </select>
              <button
                onClick={loadRekap}
                className="btn btn-sm secondary flex items-center gap-1"
              >
                <RefreshCw size={14} />
                <span>Tampilkan</span>
              </button>
              <button
                onClick={exportRekapCSV}
                className="btn btn-sm ghost flex items-center gap-1"
              >
                <Download size={14} />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Jabatan</th>
                  <th>Hadir</th>
                  <th>WFO</th>
                  <th>WFH</th>
                  <th>Dinas</th>
                  <th>Cuti</th>
                  <th>Sakit</th>
                  <th>Pulang Lengkap</th>
                </tr>
              </thead>
              <tbody>
                {rekapLoading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-darkMuted">
                      Menghitung rekap bulanan...
                    </td>
                  </tr>
                ) : rekapRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-8 text-darkMuted">
                      Tidak ada data rekap untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  rekapRows.map((r, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{r.nip}</td>
                      <td className="font-semibold">{r.nama}</td>
                      <td>{r.jabatan}</td>
                      <td className="font-bold text-accentSuccess">{r.hadir}</td>
                      <td>{r.wfo}</td>
                      <td>{r.wfh}</td>
                      <td>{r.dinas}</td>
                      <td>{r.cuti}</td>
                      <td>{r.sakit}</td>
                      <td className="font-bold text-accentInfo">{r.pulangLengkap}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH PEGAWAI (PRIORITAS) */}
      <AddPegawaiModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(msg) => {
          showToast(msg);
          loadDashboard();
        }}
      />

      {/* Modal Bulk Insert */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="card max-w-xl w-full p-6 space-y-4 bg-darkCard border-white/15">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-primaryBlue" />
                Tambah Pegawai Bulk (CSV)
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="btn ghost btn-sm">
                Tutup
              </button>
            </div>

            <p className="text-xs text-darkMuted">
              Masukkan 1 pegawai per baris dengan format:{" "}
              <code>NIP,Nama Lengkap,Email,Jabatan</code>
            </p>

            <textarea
              rows={8}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="198501012010011001,Budi Santoso,budi@kantor.go.id,Staff IT&#10;198702022010012002,Siti Aminah,siti@kantor.go.id,Analis Data"
              className="font-mono text-xs"
            />

            {bulkResult && (
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-accentInfo">
                {bulkResult}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="btn secondary btn-sm"
              >
                Tutup
              </button>
              <button
                onClick={handleBulkInsert}
                disabled={bulkLoading || !bulkText.trim()}
                className="btn btn-sm"
              >
                {bulkLoading ? "Memproses Bulk..." : "Proses Tambah Bulk"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
