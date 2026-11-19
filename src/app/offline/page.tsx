"use client";

import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-darkBg text-darkText">
      <div className="card max-w-md w-full text-center p-8 space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-accentWarning/20 flex items-center justify-center text-accentWarning">
          <WifiOff size={32} />
        </div>
        <h2 className="text-2xl font-bold">Koneksi Terputus</h2>
        <p className="text-darkMuted text-sm">
          Anda sedang offline. Sistem akan menyimpan absensi Anda secara lokal dan
          mengirimkannya secara otomatis saat koneksi kembali pulih.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn full-width flex items-center justify-center gap-2"
        >
          <RefreshCw size={18} />
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
