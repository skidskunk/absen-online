"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Database,
  Trash2,
  Edit,
  Search,
  RefreshCw,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Save,
  X,
} from "lucide-react";

type DbTable = "profiles" | "attendances" | "audit_logs" | "app_config";

export default function DatabaseViewerPage() {
  const [activeTable, setActiveTable] = useState<DbTable>("profiles");
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [myRole, setMyRole] = useState<string>("admin");

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);

  // Clear Database 2-Step Modal
  const [clearModalStep, setClearModalStep] = useState<0 | 1 | 2>(0);
  const [confirmText, setConfirmText] = useState("");
  const [clearLoading, setClearLoading] = useState(false);
  const [clearMsg, setClearMsg] = useState<string | null>(null);

  const fetchTableData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        table: activeTable,
        page: String(page),
        limit: String(limit),
      });
      if (search) params.append("search", search);
      if (filterDate) params.append("date", filterDate);

      const res = await fetch(`/api/admin/database?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setRows(data.rows || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.totalCount || 0);
        setMyRole(data.myRole || "admin");
      }
    } catch (err) {
      console.error("Gagal load database:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTable, page, limit, search, filterDate]);

  useEffect(() => {
    fetchTableData();
  }, [fetchTableData]);

  const handleTabChange = (tbl: DbTable) => {
    setActiveTable(tbl);
    setPage(1);
    setSearch("");
    setFilterDate("");
  };

  // Open Edit Modal
  const handleOpenEdit = (row: any) => {
    setEditingRow(row);
    if (activeTable === "profiles") {
      setEditForm({
        nama: row.nama || "",
        email: row.email || "",
        jabatan: row.jabatan || "",
        is_active: row.is_active ?? true,
      });
    } else if (activeTable === "attendances") {
      setEditForm({
        status_datang: row.status_datang || "WFO",
        status_pulang: row.status_pulang || "WFO",
        uraian_kinerja: row.uraian_kinerja || "",
        output_kinerja: row.output_kinerja || "",
      });
    } else if (activeTable === "app_config") {
      setEditForm({
        value: row.value || "",
      });
    }
    setEditModalOpen(true);
  };

  // Save Edit Row
  const handleSaveEdit = async () => {
    if (!editingRow) return;
    setEditLoading(true);

    try {
      const res = await fetch("/api/admin/database", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: activeTable,
          id: editingRow.id,
          key: editingRow.key,
          updates: editForm,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setEditModalOpen(false);
        await fetchTableData();
      } else {
        alert(data.message || "Gagal mengupdate baris.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setEditLoading(false);
    }
  };

  // Delete Row
  const handleDeleteRow = async (row: any) => {
    if (myRole !== "super_admin") {
      alert("Hanya Super Admin yang diizinkan menghapus data.");
      return;
    }

    if (!confirm("Yakin ingin menghapus baris data ini secara permanen?")) return;

    try {
      const identifier = row.id ? `id=${row.id}` : `key=${row.key}`;
      const res = await fetch(`/api/admin/database?table=${activeTable}&${identifier}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await fetchTableData();
      } else {
        alert(data.message || "Gagal menghapus.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  // Clear Database Handlers
  const handleStartClear = () => {
    setConfirmText("");
    setClearMsg(null);
    setClearModalStep(1);
  };

  const handleExecuteClear = async () => {
    if (confirmText !== "HAPUS SEMUA") {
      alert("Wajib mengetik 'HAPUS SEMUA' persis sama.");
      return;
    }

    setClearLoading(true);
    setClearMsg(null);

    try {
      const res = await fetch("/api/admin/database/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmText }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        setClearMsg(data.message);
        setTimeout(() => {
          setClearModalStep(0);
          fetchTableData();
        }, 1500);
      } else {
        alert(data.message || "Gagal mengosongkan database.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setClearLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Database className="text-primaryBlue" size={22} />
              Database Viewer &amp; Maintenance
            </h2>
            <p className="text-xs text-darkMuted mt-1">
              Akses langsung ke tabel database Supabase. Super Admin memiliki hak penuh
              untuk edit &amp; hapus.
            </p>
          </div>

          {/* Kosongkan Database button (Super Admin ONLY) */}
          {myRole === "super_admin" ? (
            <button
              onClick={handleStartClear}
              className="btn danger btn-sm flex items-center gap-1.5 whitespace-nowrap self-start sm:self-auto"
            >
              <Trash2 size={15} />
              <span>Kosongkan Database</span>
            </button>
          ) : (
            <span className="text-xs text-darkMuted italic">
              Mode View-Only (Admin)
            </span>
          )}
        </div>

        {/* Database Tables Tabs */}
        <div className="tabs-nav mb-0">
          <button
            onClick={() => handleTabChange("profiles")}
            className={`tab-btn ${activeTable === "profiles" ? "active" : ""}`}
          >
            profiles (Pegawai)
          </button>
          <button
            onClick={() => handleTabChange("attendances")}
            className={`tab-btn ${activeTable === "attendances" ? "active" : ""}`}
          >
            attendances (Absensi)
          </button>
          <button
            onClick={() => handleTabChange("audit_logs")}
            className={`tab-btn ${activeTable === "audit_logs" ? "active" : ""}`}
          >
            audit_logs (Audit)
          </button>
          <button
            onClick={() => handleTabChange("app_config")}
            className={`tab-btn ${activeTable === "app_config" ? "active" : ""}`}
          >
            app_config (Pengaturan)
          </button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-darkMuted"
              />
              <input
                type="text"
                placeholder={
                  activeTable === "profiles"
                    ? "Cari NIP, nama, email..."
                    : activeTable === "attendances"
                    ? "Cari NIP, nama..."
                    : activeTable === "audit_logs"
                    ? "Cari NIP, action..."
                    : "Cari key config..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 py-2 text-sm"
              />
            </div>

            {(activeTable === "attendances" || activeTable === "audit_logs") && (
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-auto py-2 text-sm"
              />
            )}

            <button
              onClick={fetchTableData}
              className="btn btn-sm secondary flex items-center gap-1"
            >
              <RefreshCw size={14} />
              <span>Cari</span>
            </button>
          </div>

          <div className="text-xs text-darkMuted">
            Total: <strong className="text-white">{totalCount}</strong> baris &bull; Hal:{" "}
            <strong className="text-white">{page}</strong> dari {totalPages}
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="card space-y-4">
        <div className="table-container">
          <table>
            <thead>
              {activeTable === "profiles" && (
                <tr>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Email</th>
                  <th>Jabatan</th>
                  <th>Role</th>
                  <th>Default Pass</th>
                  <th>Aktif</th>
                  {myRole === "super_admin" && <th>Aksi</th>}
                </tr>
              )}
              {activeTable === "attendances" && (
                <tr>
                  <th>Tanggal</th>
                  <th>NIP</th>
                  <th>Nama</th>
                  <th>Status Datang</th>
                  <th>Jam Datang</th>
                  <th>Status Pulang</th>
                  <th>Jam Pulang</th>
                  <th>Uraian</th>
                  <th>Output</th>
                  <th>Dist (m)</th>
                  {myRole === "super_admin" && <th>Aksi</th>}
                </tr>
              )}
              {activeTable === "audit_logs" && (
                <tr>
                  <th>Waktu</th>
                  <th>Actor NIP</th>
                  <th>Actor Role</th>
                  <th>Action</th>
                  <th>Detail</th>
                  {myRole === "super_admin" && <th>Aksi</th>}
                </tr>
              )}
              {activeTable === "app_config" && (
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Updated At</th>
                  <th>Updated By</th>
                  {myRole === "super_admin" && <th>Aksi</th>}
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-darkMuted">
                    Memuat data tabel {activeTable}...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-darkMuted">
                    Tabel kosong atau tidak ada data yang cocok.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id || r.key || i}>
                    {activeTable === "profiles" && (
                      <>
                        <td className="font-mono text-xs">{r.nip}</td>
                        <td className="font-semibold">{r.nama}</td>
                        <td className="text-xs text-darkMuted">{r.email}</td>
                        <td>{r.jabatan}</td>
                        <td>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              r.role === "super_admin"
                                ? "bg-accentDanger/20 text-accentDanger"
                                : r.role === "admin"
                                ? "bg-accentWarning/20 text-accentWarning"
                                : "bg-primaryBlue/20 text-primaryBlue"
                            }`}
                          >
                            {r.role}
                          </span>
                        </td>
                        <td>{r.is_default_password ? "TRUE" : "FALSE"}</td>
                        <td>
                          {r.is_active ? (
                            <span className="text-accentSuccess text-xs font-bold">
                              Aktif
                            </span>
                          ) : (
                            <span className="text-accentDanger text-xs font-bold">
                              Nonaktif
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    {activeTable === "attendances" && (
                      <>
                        <td className="font-mono text-xs whitespace-nowrap">{r.tanggal}</td>
                        <td className="font-mono text-xs">{r.nip}</td>
                        <td className="font-semibold">{r.nama}</td>
                        <td>{r.status_datang}</td>
                        <td className="font-mono text-xs">
                          {r.jam_datang
                            ? new Date(r.jam_datang).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                        <td>{r.status_pulang || "-"}</td>
                        <td className="font-mono text-xs">
                          {r.jam_pulang
                            ? new Date(r.jam_pulang).toLocaleTimeString("id-ID", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                        <td className="max-w-[150px] truncate text-xs" title={r.uraian_kinerja}>
                          {r.uraian_kinerja || "-"}
                        </td>
                        <td className="max-w-[150px] truncate text-xs" title={r.output_kinerja}>
                          {r.output_kinerja || "-"}
                        </td>
                        <td className="font-mono text-xs">{r.dist_m || 0}</td>
                      </>
                    )}

                    {activeTable === "audit_logs" && (
                      <>
                        <td className="font-mono text-xs whitespace-nowrap">
                          {new Date(r.created_at).toLocaleString("id-ID")}
                        </td>
                        <td className="font-mono text-xs">{r.actor_nip || "-"}</td>
                        <td>{r.actor_role || "-"}</td>
                        <td className="font-bold text-xs">{r.action}</td>
                        <td className="max-w-xs truncate text-xs" title={r.detail}>
                          {r.detail}
                        </td>
                      </>
                    )}

                    {activeTable === "app_config" && (
                      <>
                        <td className="font-mono font-bold text-xs">{r.key}</td>
                        <td className="font-mono text-sm">{r.value}</td>
                        <td className="text-xs text-darkMuted">
                          {r.updated_at ? new Date(r.updated_at).toLocaleString("id-ID") : "-"}
                        </td>
                        <td className="text-xs">{r.updated_by || "-"}</td>
                      </>
                    )}

                    {myRole === "super_admin" && (
                      <td>
                        <div className="flex items-center gap-1.5">
                          {activeTable !== "audit_logs" && (
                            <button
                              onClick={() => handleOpenEdit(r)}
                              className="btn btn-sm secondary text-xs p-1.5"
                              title="Edit Baris"
                            >
                              <Edit size={13} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteRow(r)}
                            className="btn btn-sm danger text-xs p-1.5"
                            title="Hapus Baris"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Navigation */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn btn-sm secondary flex items-center gap-1 text-xs"
          >
            <ChevronLeft size={14} />
            <span>Sebelumnya</span>
          </button>

          <span className="text-xs text-darkMuted">
            Halaman {page} dari {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="btn btn-sm secondary flex items-center gap-1 text-xs"
          >
            <span>Selanjutnya</span>
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* EDIT ROW MODAL */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="card max-w-lg w-full p-6 space-y-4 bg-darkCard border-white/15">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Edit size={18} className="text-primaryBlue" />
                Edit Baris ({activeTable})
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="btn ghost btn-sm">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {activeTable === "profiles" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-darkMuted mb-1">
                      Nama
                    </label>
                    <input
                      type="text"
                      value={editForm.nama || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, nama: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-darkMuted mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={editForm.email || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-darkMuted mb-1">
                      Jabatan
                    </label>
                    <input
                      type="text"
                      value={editForm.jabatan || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, jabatan: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="editIsActive"
                      checked={editForm.is_active}
                      onChange={(e) =>
                        setEditForm({ ...editForm, is_active: e.target.checked })
                      }
                      className="w-4 h-4"
                    />
                    <label htmlFor="editIsActive" className="text-sm">
                      Status Akun Aktif
                    </label>
                  </div>
                </>
              )}

              {activeTable === "attendances" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-darkMuted mb-1">
                        Status Datang
                      </label>
                      <select
                        value={editForm.status_datang || "WFO"}
                        onChange={(e) =>
                          setEditForm({ ...editForm, status_datang: e.target.value })
                        }
                      >
                        <option value="WFO">WFO</option>
                        <option value="WFH">WFH</option>
                        <option value="DINAS">DINAS</option>
                        <option value="CUTI">CUTI</option>
                        <option value="SAKIT">SAKIT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-darkMuted mb-1">
                        Status Pulang
                      </label>
                      <select
                        value={editForm.status_pulang || "WFO"}
                        onChange={(e) =>
                          setEditForm({ ...editForm, status_pulang: e.target.value })
                        }
                      >
                        <option value="WFO">WFO</option>
                        <option value="WFH">WFH</option>
                        <option value="DINAS">DINAS</option>
                        <option value="CUTI">CUTI</option>
                        <option value="SAKIT">SAKIT</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-darkMuted mb-1">
                      Uraian Kinerja
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.uraian_kinerja || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, uraian_kinerja: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-darkMuted mb-1">
                      Output Kinerja
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.output_kinerja || ""}
                      onChange={(e) =>
                        setEditForm({ ...editForm, output_kinerja: e.target.value })
                      }
                    />
                  </div>
                </>
              )}

              {activeTable === "app_config" && (
                <div>
                  <label className="block text-xs font-semibold text-darkMuted mb-1">
                    Value untuk key: <code>{editingRow?.key}</code>
                  </label>
                  <input
                    type="text"
                    value={editForm.value || ""}
                    onChange={(e) =>
                      setEditForm({ ...editForm, value: e.target.value })
                    }
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => setEditModalOpen(false)}
                className="btn secondary btn-sm"
              >
                Batal
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editLoading}
                className="btn btn-sm flex items-center gap-1.5"
              >
                <Save size={14} />
                <span>{editLoading ? "Menyimpan..." : "Simpan Perubahan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KOSONGKAN DATABASE 2-STEP MODAL */}
      {clearModalStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="card max-w-md w-full p-6 space-y-4 bg-darkCard border-accentDanger/40 shadow-2xl">
            <div className="flex items-center gap-3 text-accentDanger pb-3 border-b border-accentDanger/20">
              <ShieldAlert size={28} className="shrink-0" />
              <div>
                <h3 className="font-extrabold text-lg text-accentDanger">
                  Kosongkan Data Absensi
                </h3>
                <div className="text-xs text-darkMuted">Konfirmasi Keamanan 2 Langkah</div>
              </div>
            </div>

            {clearModalStep === 1 && (
              <div className="space-y-4">
                <p className="text-sm">
                  Yakin kosongkan semua data absensi?
                </p>
                <div className="p-3 bg-accentDanger/15 rounded-xl border border-accentDanger/30 text-xs text-accentDanger space-y-1">
                  <p className="font-bold">PERHATIAN:</p>
                  <p>
                    Tindakan ini akan menghapus <strong>seluruh data di tabel attendances</strong>.
                    Data profil pegawai (profiles) TIDAK akan dihapus.
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setClearModalStep(0)}
                    className="btn secondary btn-sm"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => setClearModalStep(2)}
                    className="btn danger btn-sm"
                  >
                    Lanjut ke Langkah 2 &rarr;
                  </button>
                </div>
              </div>
            )}

            {clearModalStep === 2 && (
              <div className="space-y-4">
                <p className="text-xs text-darkMuted">
                  Untuk mengaktifkan tombol konfirmasi, ketikkan teks persis:
                  <strong className="text-accentDanger block text-sm mt-1">
                    HAPUS SEMUA
                  </strong>
                </p>

                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS SEMUA di sini"
                  className="font-mono text-center tracking-widest uppercase py-2.5 font-bold"
                  autoFocus
                />

                {clearMsg && (
                  <div className="p-3 bg-accentSuccess/20 border border-accentSuccess/30 rounded-xl text-xs text-accentSuccess">
                    {clearMsg}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setClearModalStep(0)}
                    className="btn secondary btn-sm"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleExecuteClear}
                    disabled={confirmText !== "HAPUS SEMUA" || clearLoading}
                    className="btn danger btn-sm"
                  >
                    {clearLoading ? "Mengosongkan..." : "Konfirmasi Hapus Semua"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
