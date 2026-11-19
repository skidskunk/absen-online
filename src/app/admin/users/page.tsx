"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Edit,
  Trash2,
  KeyRound,
  Shield,
  CheckCircle2,
  AlertTriangle,
  X,
  Save,
  UserPlus,
  Power,
} from "lucide-react";
import { Profile, UserRole } from "@/types/database";
import AddPegawaiModal from "@/components/AddPegawaiModal";

export default function UsersManagementPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [myRole, setMyRole] = useState<string>("admin");

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [formNama, setFormNama] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formJabatan, setFormJabatan] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formRole, setFormRole] = useState<UserRole>("user");
  const [saveLoading, setSaveLoading] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      if (res.ok && data.ok) {
        setUsers(data.users || []);
        setMyRole(data.myRole || "admin");
      }
    } catch (err: any) {
      showToast("Gagal memuat pengguna: " + err.message, true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleOpenEdit = (u: Profile) => {
    setEditingUser(u);
    setFormNama(u.nama);
    setFormEmail(u.email);
    setFormJabatan(u.jabatan);
    setFormIsActive(u.is_active);
    setFormRole(u.role);
    setEditModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSaveLoading(true);

    try {
      const payload: any = {
        id: editingUser.id,
        nama: formNama,
        email: formEmail,
        jabatan: formJabatan,
        is_active: formIsActive,
      };

      if (myRole === "super_admin") {
        payload.role = formRole;
      }

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || "Data pegawai berhasil diperbarui!");
        setEditModalOpen(false);
        await fetchUsers();
      } else {
        showToast(data.message || "Gagal memperbarui data pegawai.", true);
      }
    } catch (err: any) {
      showToast("Error: " + err.message, true);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleResetPassword = async (u: Profile) => {
    if (!confirm(`Reset password ${u.nama} (${u.nip}) ke default: Absen123!?`)) return;

    try {
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || "Password berhasil di-reset!");
        await fetchUsers();
      } else {
        showToast(data.message || "Gagal reset password.", true);
      }
    } catch (err: any) {
      showToast("Error: " + err.message, true);
    }
  };

  const handleToggleActive = async (u: Profile) => {
    const newStatus = !u.is_active;
    const actionWord = newStatus ? "mengaktifkan" : "menonaktifkan";

    if (!confirm(`Yakin ingin ${actionWord} akun ${u.nama}?`)) return;

    try {
      const res = await fetch("/api/admin/toggle-active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, is_active: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || `Status akun ${u.nama} berhasil diubah.`);
        await fetchUsers();
      } else {
        showToast(data.message || "Gagal mengubah status akun.", true);
      }
    } catch (err: any) {
      showToast("Error: " + err.message, true);
    }
  };

  const handleDeleteUser = async (u: Profile) => {
    if (myRole !== "super_admin") {
      alert("Hanya Super Admin yang diizinkan menghapus pegawai.");
      return;
    }

    if (!confirm(`Hapus pegawai ${u.nama} (${u.nip}) secara permanen? Seluruh riwayat absensi akan terhapus.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/users?id=${u.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        showToast(data.message || "Pegawai berhasil dihapus.");
        await fetchUsers();
      } else {
        showToast(data.message || "Gagal menghapus pegawai.", true);
      }
    } catch (err: any) {
      showToast("Error: " + err.message, true);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.nip || "").toLowerCase().includes(q) ||
      (u.nama || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.jabatan || "").toLowerCase().includes(q)
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

      {/* Header Card */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Users className="text-primaryBlue" size={22} />
              Manajemen Data Pegawai &amp; Akun
            </h2>
            <p className="text-xs text-darkMuted mt-1">
              Admin &amp; Super Admin dapat menambah dan mengedit pegawai serta mereset password.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-darkMuted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari NIP, nama..."
                className="pl-9 py-2 text-sm w-56 sm:w-64"
              />
            </div>
            <button
              onClick={fetchUsers}
              className="btn btn-sm secondary p-2.5"
              title="Refresh"
            >
              <RefreshCw size={15} />
            </button>
            {/* Tombol [+ Tambah Pegawai] */}
            <button
              onClick={() => setShowAddModal(true)}
              className="btn btn-sm bg-primaryBlue hover:bg-primaryBlue/80 text-white font-bold flex items-center gap-1.5 shadow-lg shadow-primaryBlue/20"
            >
              <UserPlus size={16} />
              <span>+ Tambah Pegawai</span>
            </button>
          </div>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="card space-y-4">
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-darkMuted">
                    Memuat data pegawai...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-darkMuted">
                    Tidak ada pegawai yang sesuai dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isSuper = u.role === "super_admin";
                  return (
                    <tr key={u.id}>
                      <td className="font-mono text-xs font-semibold">{u.nip}</td>
                      <td className="font-semibold">{u.nama}</td>
                      <td className="text-xs text-darkMuted">{u.email}</td>
                      <td>{u.jabatan}</td>
                      <td>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isSuper
                              ? "bg-accentDanger/20 text-accentDanger border border-accentDanger/30"
                              : u.role === "admin"
                              ? "bg-accentWarning/20 text-accentWarning border border-accentWarning/30"
                              : "bg-primaryBlue/20 text-primaryBlue border border-primaryBlue/30"
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td>
                        {u.is_active ? (
                          <span className="text-accentSuccess text-xs font-semibold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-accentSuccess inline-block"></span>
                            Aktif
                          </span>
                        ) : (
                          <span className="text-accentDanger text-xs font-semibold flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-accentDanger inline-block"></span>
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td>
                        {u.is_default_password ? (
                          <span className="text-accentWarning text-xs bg-accentWarning/10 px-2 py-0.5 rounded-full font-medium">
                            Default (Absen123!)
                          </span>
                        ) : (
                          <span className="text-accentSuccess text-xs bg-accentSuccess/10 px-2 py-0.5 rounded-full font-medium">
                            Kustom
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Edit Profil */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="btn btn-sm secondary p-1.5 text-xs flex items-center gap-1"
                            title="Edit Pegawai"
                          >
                            <Edit size={13} />
                            <span>Edit</span>
                          </button>

                          {/* Toggle Aktif / Nonaktif */}
                          <button
                            onClick={() => handleToggleActive(u)}
                            className={`btn btn-sm p-1.5 text-xs flex items-center gap-1 ${
                              u.is_active ? "ghost text-accentWarning" : "secondary text-accentSuccess"
                            }`}
                            title={u.is_active ? "Nonaktifkan Pegawai" : "Aktifkan Pegawai"}
                          >
                            <Power size={13} />
                            <span>{u.is_active ? "Nonaktifkan" : "Aktifkan"}</span>
                          </button>

                          {/* Reset Password */}
                          <button
                            onClick={() => handleResetPassword(u)}
                            className="btn btn-sm secondary p-1.5 text-xs flex items-center gap-1"
                            title="Reset Password ke default Absen123!"
                          >
                            <KeyRound size={13} />
                            <span>Reset</span>
                          </button>

                          {/* Hapus Pegawai (Super Admin ONLY, dan bukan super_admin) */}
                          {myRole === "super_admin" && !isSuper && (
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="btn btn-sm danger p-1.5 text-xs flex items-center gap-1"
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

      {/* MODAL TAMBAH PEGAWAI */}
      <AddPegawaiModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={(msg) => {
          showToast(msg);
          fetchUsers();
        }}
      />

      {/* Edit User Modal */}
      {editModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="card max-w-lg w-full p-6 space-y-4 bg-darkCard border-white/15">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Edit size={18} className="text-primaryBlue" />
                Edit Data Pegawai: {editingUser.nip}
              </h3>
              <button
                onClick={() => setEditModalOpen(false)}
                className="btn ghost btn-sm"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-darkMuted mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-darkMuted mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-darkMuted mb-1">
                  Jabatan *
                </label>
                <input
                  type="text"
                  value={formJabatan}
                  onChange={(e) => setFormJabatan(e.target.value)}
                  required
                />
              </div>

              {/* Super Admin ONLY: Role Dropdown */}
              {myRole === "super_admin" && (
                <div>
                  <label className="block text-xs font-semibold text-accentWarning mb-1 flex items-center gap-1">
                    <Shield size={13} />
                    Role Otoritas (Hanya Super Admin)
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                  >
                    <option value="user">User (Pegawai Biasa)</option>
                    <option value="admin">Admin (Administrator)</option>
                    <option value="super_admin">Super Admin (Hak Penuh)</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="formIsActiveCheck"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="formIsActiveCheck" className="text-sm font-semibold">
                  Status Akun Aktif (Dapat Login &amp; Absen)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="btn secondary btn-sm"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="btn btn-sm flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>{saveLoading ? "Menyimpan..." : "Simpan Perubahan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
