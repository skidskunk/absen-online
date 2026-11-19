"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Compass,
  Search,
  Save,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldAlert,
} from "lucide-react";
import { calculateHaversineDistance } from "@/lib/haversine";
import { AuditLog, OfficeConfig } from "@/types/database";

// Dynamically import Leaflet OfficeMap without SSR
const OfficeMap = dynamic(() => import("@/components/OfficeMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] sm:h-[480px] rounded-2xl bg-darkCard border border-white/10 flex items-center justify-center text-darkMuted text-sm">
      Memuat peta Leaflet &amp; OpenStreetMap...
    </div>
  ),
});

export default function PengaturanLokasiPage() {
  const [config, setConfig] = useState<OfficeConfig | null>(null);
  const [history, setHistory] = useState<AuditLog[]>([]);
  const [myRole, setMyRole] = useState<string>("admin");
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [kantorNama, setKantorNama] = useState("");
  const [lat, setLat] = useState<number>(-5.144764422898236);
  const [lng, setLng] = useState<number>(119.45574635175397);
  const [radius, setRadius] = useState<number>(200);

  // Nominatim Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // User Current Geolocation
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [userDistM, setUserDistM] = useState<number | null>(null);

  // Save State & Toast
  const [saveLoading, setSaveLoading] = useState(false);
  const [toast, setToast] = useState<{ text: string; isError: boolean } | null>(null);

  const showToast = (text: string, isError = false) => {
    setToast({ text, isError });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Current Config & History
  const fetchLocationData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/pengaturan-lokasi");
      const data = await res.json();
      if (res.ok && data.ok) {
        setConfig(data.config);
        setHistory(data.history || []);
        setMyRole(data.myRole || "admin");

        setKantorNama(data.config.kantorNama);
        setLat(data.config.kantorLat);
        setLng(data.config.kantorLng);
        setRadius(data.config.radiusMeter);
      }
    } catch (err: any) {
      showToast("Gagal memuat konfigurasi: " + err.message, true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocationData();

    // Get user's current GPS position
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, [fetchLocationData]);

  // Recalculate distance from user to office coordinates
  useEffect(() => {
    if (userLocation && lat && lng) {
      const dist = calculateHaversineDistance(
        userLocation.lat,
        userLocation.lng,
        lat,
        lng
      );
      setUserDistM(dist);
    }
  }, [userLocation, lat, lng]);

  // Handler: Location change from Map (click or drag)
  const handleLocationChange = (newLat: number, newLng: number) => {
    setLat(Number(newLat.toFixed(7)));
    setLng(Number(newLng.toFixed(7)));
  };

  // Handler: "Gunakan Lokasi Saya Saat Ini"
  const handleUseMyLocation = () => {
    if (!("geolocation" in navigator)) {
      alert("Browser tidak mendukung geolocation.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const myLat = Number(pos.coords.latitude.toFixed(7));
        const myLng = Number(pos.coords.longitude.toFixed(7));
        setLat(myLat);
        setLng(myLng);
        setUserLocation({ lat: myLat, lng: myLng });
        showToast("Koordinat disetel ke lokasi Anda saat ini!");
      },
      (err) => {
        alert("Gagal mengambil lokasi: " + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  // Handler: Search Address with Nominatim OSM API
  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5`
      );
      const data = await res.json();
      setSearchResults(data || []);
      if (!data || data.length === 0) {
        showToast("Alamat tidak ditemukan di OpenStreetMap.", true);
      }
    } catch (err: any) {
      showToast("Error pencarian alamat: " + err.message, true);
    } finally {
      setSearching(false);
    }
  };

  // Handler: Select search result
  const handleSelectSearchResult = (item: any) => {
    const itemLat = Number(parseFloat(item.lat).toFixed(7));
    const itemLng = Number(parseFloat(item.lon).toFixed(7));
    setLat(itemLat);
    setLng(itemLng);
    setSearchResults([]);
    setSearchQuery(item.display_name);
    showToast("Marker dipindahkan ke lokasi hasil pencarian!");
  };

  // Handler: Save Office Configuration (Super Admin ONLY)
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (myRole !== "super_admin") {
      alert("Hanya Super Admin yang diizinkan mengubah konfigurasi lokasi.");
      return;
    }

    setSaveLoading(true);

    try {
      const res = await fetch("/api/admin/pengaturan-lokasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: String(lat),
          lng: String(lng),
          nama: kantorNama,
          radius: String(radius),
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        showToast("Lokasi kantor berhasil diupdate!");
        await fetchLocationData();
      } else {
        showToast(data.message || "Gagal menyimpan lokasi kantor.", true);
      }
    } catch (err: any) {
      showToast("Error: " + err.message, true);
    } finally {
      setSaveLoading(false);
    }
  };

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

      {/* Header Info */}
      <div className="card space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <MapPin className="text-primaryBlue" size={22} />
              Pengaturan Lokasi Kantor &amp; Geofencing Radius
            </h2>
            <p className="text-xs text-darkMuted mt-1">
              Atur titik koordinat kantor dan radius absensi WFO. Marker dapat diklik
              atau digeser langsung pada peta.
            </p>
          </div>

          {myRole !== "super_admin" && (
            <div className="p-2.5 bg-accentWarning/15 border border-accentWarning/30 rounded-xl text-xs text-accentWarning flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0" />
              <span>
                Mode Lihat: Hanya <strong>Super Admin</strong> yang dapat menyimpan
                perubahan.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Search & Actions Bar */}
      <div className="card space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Nominatim Search */}
          <form
            onSubmit={handleSearchAddress}
            className="flex-1 flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-darkMuted"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama gedung / jalan / alamat (Nominatim OSM)..."
                className="pl-9 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="btn btn-sm secondary whitespace-nowrap"
            >
              {searching ? "Mencari..." : "Cari Alamat"}
            </button>
          </form>

          {/* Gunakan Lokasi Saya */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            className="btn btn-sm secondary flex items-center justify-center gap-1.5 whitespace-nowrap text-accentSuccess"
          >
            <Compass size={15} />
            <span>Gunakan Lokasi Saya Saat Ini</span>
          </button>
        </div>

        {/* Search Results Dropdown List */}
        {searchResults.length > 0 && (
          <div className="p-2 bg-darkCard/95 border border-white/10 rounded-xl space-y-1 max-h-52 overflow-y-auto">
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full text-left p-2 rounded-lg hover:bg-white/10 text-xs text-darkText transition-colors truncate block"
              >
                {item.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid: Map & Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Interactive Map (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="card p-3">
            {!loading && (
              <OfficeMap
                lat={lat}
                lng={lng}
                radius={radius}
                userLat={userLocation?.lat}
                userLng={userLocation?.lng}
                readOnly={myRole !== "super_admin"}
                onLocationChange={handleLocationChange}
              />
            )}
            <div className="text-xs text-darkMuted mt-2 flex items-center justify-between">
              <span>* Klik peta atau geser marker untuk mengubah koordinat</span>
              <span className="flex items-center gap-1 text-accentSuccess font-semibold">
                <span className="w-2.5 h-2.5 rounded-full bg-accentSuccess inline-block animate-pulse"></span>
                Marker Hijau: Posisi Anda
              </span>
            </div>
          </div>
        </div>

        {/* Right: Form Configuration (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card space-y-4">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Compass size={18} className="text-primaryBlue" />
              Detail Lokasi &amp; Geofence
            </h3>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-darkMuted mb-1">
                  Nama Lokasi Kantor *
                </label>
                <input
                  type="text"
                  value={kantorNama}
                  onChange={(e) => setKantorNama(e.target.value)}
                  placeholder="Contoh: Kantor Dinas - Mamuju"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-darkMuted mb-1">
                    Latitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-darkMuted mb-1">
                    Longitude *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(parseFloat(e.target.value) || 0)}
                    required
                  />
                </div>
              </div>

              {/* Radius Geofence Slider & Input Number */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-darkMuted">
                    Radius Kehadiran (50 - 1000m) *
                  </label>
                  <span className="text-sm font-bold text-primaryBlue">
                    {radius} meter
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={50}
                    max={1000}
                    step={10}
                    value={radius}
                    onChange={(e) => setRadius(parseInt(e.target.value, 10))}
                    className="flex-1 accent-primaryBlue cursor-pointer"
                  />
                  <input
                    type="number"
                    min={50}
                    max={1000}
                    step={10}
                    value={radius}
                    onChange={(e) =>
                      setRadius(Math.max(50, Math.min(1000, parseInt(e.target.value, 10) || 50)))
                    }
                    className="w-24 py-1.5 px-2 text-sm text-center font-bold"
                  />
                </div>
              </div>

              {/* Real-time distance indicator */}
              {userDistM !== null && (
                <div
                  className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                    userDistM <= radius
                      ? "bg-accentSuccess/15 border-accentSuccess/30 text-accentSuccess"
                      : "bg-accentDanger/15 border-accentDanger/30 text-accentDanger"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Compass size={16} />
                    <span>Jarak saya sekarang: <strong>{userDistM} meter</strong></span>
                  </div>
                  <span className="font-extrabold uppercase tracking-wide">
                    {userDistM <= radius ? "DI DALAM RADIUS" : "DI LUAR RADIUS"}
                  </span>
                </div>
              )}

              {/* Tombol Simpan */}
              <button
                type="submit"
                disabled={myRole !== "super_admin" || saveLoading}
                className="btn full-width w-full py-3 flex items-center justify-center gap-2 text-sm mt-2"
              >
                <Save size={16} />
                <span>
                  {saveLoading
                    ? "Menyimpan Perubahan..."
                    : myRole === "super_admin"
                    ? "Simpan Lokasi & Radius"
                    : "Simpan Lokasi (Hanya Super Admin)"}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* RIWAYAT PERUBAHAN TABEL */}
      <div className="card space-y-4">
        <h3 className="font-bold text-base flex items-center gap-2">
          <History size={18} className="text-primaryBlue" />
          Riwayat Perubahan Lokasi &amp; Radius
        </h3>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Tanggal &amp; Waktu</th>
                <th>Super Admin (NIP)</th>
                <th>Detail Perubahan</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-6 text-darkMuted">
                    Belum ada riwayat perubahan lokasi.
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id}>
                    <td className="font-mono text-xs whitespace-nowrap">
                      {new Date(h.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="font-mono text-xs">{h.actor_nip || "SUPER_ADMIN"}</td>
                    <td className="text-xs">{h.detail || "-"}</td>
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
