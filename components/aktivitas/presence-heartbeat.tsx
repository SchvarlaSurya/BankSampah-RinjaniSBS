"use client";

import { useEffect } from "react";
import { PRESENCE } from "@/contract";

const URL_PRESENCE = "/api/admin/presence";

/**
 * Heartbeat presence admin (tanpa tampilan). Dipasang di layout admin.
 * - POST tiap PRESENCE.HEARTBEAT_MS, HANYA saat tab terlihat; langsung kirim saat tab kembali terlihat.
 * - Tab ditutup / halaman ditinggalkan: tandai offline lewat navigator.sendBeacon.
 * - Respons 401/403 (sesi habis, bukan staf, wajib ganti password): berhenti total.
 */
export function PresenceHeartbeat() {
  useEffect(() => {
    let berhenti = false;
    let sedangKirim = false;

    async function kirim() {
      if (berhenti || sedangKirim || document.visibilityState !== "visible") return;
      sedangKirim = true;
      try {
        const res = await fetch(URL_PRESENCE, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "online" }),
          cache: "no-store",
        });
        if (res.status === 401 || res.status === 403) hentikan();
      } catch {
        // Jaringan putus: coba lagi di jadwal berikutnya.
      } finally {
        sedangKirim = false;
      }
    }

    function offline() {
      if (berhenti) return;
      const data = new Blob([JSON.stringify({ status: "offline" })], { type: "application/json" });
      navigator.sendBeacon?.(URL_PRESENCE, data);
    }

    const saatTerlihat = () => {
      if (document.visibilityState === "visible") void kirim();
    };

    const timer = setInterval(() => void kirim(), PRESENCE.HEARTBEAT_MS);
    document.addEventListener("visibilitychange", saatTerlihat);
    window.addEventListener("pagehide", offline);

    function hentikan() {
      berhenti = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", saatTerlihat);
      window.removeEventListener("pagehide", offline);
    }

    void kirim();
    return hentikan;
  }, []);

  return null;
}
