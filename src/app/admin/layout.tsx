"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Database,
  Users,
  MapPin,
  LogOut,
  Building,
  ArrowLeft,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login-admin");
    router.refresh();
  };

  const navItems = [
    { href: "/admin", label: "Dashboard & Monitor", icon: LayoutDashboard },
    { href: "/admin/laporan", label: "Laporan Range Tanggal", icon: FileSpreadsheet },
    { href: "/admin/database", label: "Database Viewer", icon: Database },
    { href: "/admin/users", label: "Manajemen Pegawai", icon: Users },
    { href: "/admin/pengaturan-lokasi", label: "Pengaturan Lokasi", icon: MapPin },
  ];

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
              Dashboard Admin
            </div>
            <div className="text-xs text-darkMuted">
              Monitoring &amp; Manajemen Pegawai &bull; Absensi Online
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="btn ghost btn-sm flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft size={14} />
            <span>Panel Pegawai</span>
          </Link>
          <button
            onClick={handleLogout}
            className="btn danger btn-sm flex items-center gap-1.5 text-xs"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Admin Navigation Tabs */}
      <div className="bg-darkCard/80 border-b border-white/10 px-4 sm:px-6 pt-3 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`tab-btn flex items-center gap-2 text-sm ${
                  isActive ? "active" : ""
                }`}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="text-center p-4 text-xs text-darkMuted/60 border-t border-white/5">
        &copy; 2026 Dashboard Admin Absensi Online &bull; Timezone: Asia/Makassar (WITA)
      </footer>
    </div>
  );
}
