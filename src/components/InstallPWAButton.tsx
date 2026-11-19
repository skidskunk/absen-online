"use client";

import React, { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if running in standalone mode (already installed)
    const isRunningStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    setIsStandalone(isRunningStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  if (isStandalone || dismissed) {
    return null;
  }

  // Android / Chrome / Desktop PWA prompt
  if (deferredPrompt) {
    return (
      <div className="card mb-4 bg-primaryBlue/15 border-primaryBlue/30 flex items-center justify-between p-4 gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primaryBlue flex items-center justify-center text-white shrink-0">
            <Download size={20} />
          </div>
          <div>
            <div className="font-semibold text-sm">Install Aplikasi Absensi</div>
            <div className="text-xs text-darkMuted">
              Install Aplikasi Absensi untuk akses lebih cepat & offline.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            className="btn btn-sm px-4 whitespace-nowrap"
          >
            Install
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="text-darkMuted hover:text-white p-1"
            title="Tutup"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  // iOS Safari instructions
  if (isIOS) {
    return (
      <div className="card mb-4 bg-primaryBlue/15 border-primaryBlue/30 p-4 animate-fadeIn">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primaryBlue flex items-center justify-center text-white shrink-0 mt-0.5">
              <Share size={20} />
            </div>
            <div>
              <div className="font-semibold text-sm">Install di iPhone / iPad</div>
              <div className="text-xs text-darkMuted mt-1">
                Tap tombol <span className="text-primaryBlue font-semibold">Share</span> di bagian bawah Safari, lalu pilih{" "}
                <span className="text-primaryBlue font-semibold">&quot;Add to Home Screen&quot;</span>.
              </div>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-darkMuted hover:text-white p-1"
            title="Tutup"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
