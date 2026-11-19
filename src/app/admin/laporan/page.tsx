"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Printer,
  Search,
  RefreshCw,
  FileDown,
  Calendar,
  AlertCircle,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getWitaDateStr } from "@/lib/date";

export default function LaporanRangeTanggalPage() {
  const today = getWitaDateStr();
  // Default start date = 1st day of current month
  const defaultStart = today.substring(0, 8) + "01";

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(today);
  const [filterNip, setFilterNip] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");

  const [users, setUsers] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch users for dropdown filter
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        if (res.ok && data.ok) {
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error("Gagal load users:", err);
      }
    }
    fetchUsers();
  }, []);

  // Fetch Laporan
  const handleTarikLaporan = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        nip: filterNip,
        status: filterStatus,
      });

      const res = await fetch(`/api/admin/laporan?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.ok) {
        setRows(data.rows || []);
      } else {
        alert(data.message || "Gagal memuat laporan.");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (rows.length === 0) return alert("Tidak ada data untuk diekspor.");
    const headers = [
      "Tanggal",
      "NIP",
      "Nama",
      "Jabatan",
      "Status Datang",
      "Jam Datang",
      "Status Pulang",
      "Jam Pulang",
      "Uraian Kinerja",
      "Output Kinerja",
      "Jarak (m)",
      "Dalam Radius",
    ];
    const dataRows = rows.map((r) => [
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
      r.distM,
      r.inRadius ? "YA" : "TIDAK",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...dataRows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Absensi_${startDate}_sd_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Excel (.xlsx via SheetJS)
  const handleExportExcel = () => {
    if (rows.length === 0) return alert("Tidak ada data untuk diekspor.");

    const formattedData = rows.map((r, idx) => ({
      No: idx + 1,
      Tanggal: r.tanggal,
      NIP: r.nip,
      Nama: r.nama,
      Jabatan: r.jabatan,
      "Status Datang": r.statusDatang,
      "Jam Datang": r.jamDatang,
      "Status Pulang": r.statusPulang,
      "Jam Pulang": r.jamPulang,
      "Uraian Kinerja": r.uraian,
      "Output Kinerja": r.output,
      "Jarak Meter": r.distM,
      "Dalam Radius": r.inRadius ? "YA" : "TIDAK",
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Absensi");

    // Auto-fit column widths
    const maxProps = [
      { wch: 5 },
      { wch: 12 },
      { wch: 20 },
      { wch: 25 },
      { wch: 20 },
      { wch: 14 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 30 },
      { wch: 30 },
      { wch: 12 },
      { wch: 12 },
    ];
    worksheet["!cols"] = maxProps;

    XLSX.writeFile(workbook, `Laporan_Absensi_${startDate}_sd_${endDate}.xlsx`);
  };

  // Print / PDF
  const handlePrint = () => {
    if (rows.length === 0) return alert("Tidak ada data untuk dicetak.");
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Card */}
      <div className="card space-y-4 no-print">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="text-primaryBlue" size={22} />
            Laporan Absensi Range Tanggal
          </h2>
          <p className="text-xs text-darkMuted mt-1">
            Filter dan tarik rekapitulasi data kehadiran harian berdasarkan rentang
            tanggal tertentu.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-xs font-semibold text-darkMuted mb-1">
              Tanggal Mulai *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-darkMuted mb-1">
              Tanggal Akhir *
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-darkMuted mb-1">
              Filter Pegawai
            </label>
            <select
              value={filterNip}
              onChange={(e) => setFilterNip(e.target.value)}
              className="py-2 text-sm"
            >
              <option value="ALL">Semua Pegawai</option>
              {users.map((u) => (
                <option key={u.id} value={u.nip}>
                  {u.nama} ({u.nip})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-darkMuted mb-1">
              Status Datang
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="py-2 text-sm"
            >
              <option value="ALL">Semua Status</option>
              <option value="WFO">WFO (Work From Office)</option>
              <option value="WFH">WFH (Work From Home)</option>
              <option value="DINAS">DINAS LUAR</option>
              <option value="CUTI">CUTI</option>
              <option value="SAKIT">SAKIT</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
          <button
            onClick={handleTarikLaporan}
            disabled={loading}
            className="btn btn-sm flex items-center gap-1.5 px-4"
          >
            <Search size={15} />
            <span>{loading ? "Memuat Laporan..." : "Tarik Laporan"}</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={rows.length === 0}
              className="btn btn-sm ghost flex items-center gap-1.5"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={rows.length === 0}
              className="btn btn-sm secondary flex items-center gap-1.5 text-accentSuccess"
            >
              <FileDown size={14} />
              <span>Export Excel (.xlsx)</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={rows.length === 0}
              className="btn btn-sm ghost flex items-center gap-1.5"
            >
              <Printer size={14} />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Report Table Card */}
      <div className="card space-y-4">
        {/* Printable Header */}
        <div className="flex items-center justify-between pb-2 border-b border-white/10">
          <div>
            <h3 className="font-bold text-base">Hasil Laporan Kehadiran</h3>
            <p className="text-xs text-darkMuted">
              Periode: {startDate} s/d {endDate} &bull; Total data: {rows.length} baris
            </p>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>NIP</th>
                <th>Nama</th>
                <th>Jabatan</th>
                <th>Status Datang</th>
                <th>Jam Datang</th>
                <th>Status Pulang</th>
                <th>Jam Pulang</th>
                <th>Uraian Kinerja</th>
                <th>Output</th>
                <th>Jarak (m)</th>
                <th>Radius</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center py-10 text-darkMuted">
                    Mengambil data kehadiran...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="text-center py-12 text-darkMuted space-y-2">
                    <AlertCircle size={28} className="mx-auto text-darkMuted/60 mb-2" />
                    <div>
                      {hasSearched
                        ? "Tidak ada data absensi yang sesuai filter pada periode ini."
                        : "Silakan pilih rentang tanggal dan klik tombol 'Tarik Laporan'."}
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.id || i}>
                    <td className="font-mono text-xs whitespace-nowrap">{r.tanggal}</td>
                    <td className="font-mono text-xs">{r.nip}</td>
                    <td className="font-semibold whitespace-nowrap">{r.nama}</td>
                    <td className="text-xs text-darkMuted">{r.jabatan}</td>
                    <td>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          r.statusDatang === "WFO"
                            ? "bg-accentSuccess/20 text-accentSuccess"
                            : r.statusDatang === "WFH"
                            ? "bg-primaryBlue/20 text-primaryBlue"
                            : r.statusDatang === "DINAS"
                            ? "bg-accentInfo/20 text-accentInfo"
                            : "bg-accentWarning/20 text-accentWarning"
                        }`}
                      >
                        {r.statusDatang}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{r.jamDatang}</td>
                    <td>{r.statusPulang}</td>
                    <td className="font-mono text-xs">{r.jamPulang}</td>
                    <td className="max-w-xs truncate text-xs" title={r.uraian}>
                      {r.uraian}
                    </td>
                    <td className="max-w-xs truncate text-xs" title={r.output}>
                      {r.output}
                    </td>
                    <td className="font-mono text-xs">{r.distM}m</td>
                    <td>
                      {r.inRadius ? (
                        <span className="text-accentSuccess text-xs font-bold">YA</span>
                      ) : (
                        <span className="text-accentDanger text-xs font-bold">TIDAK</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
