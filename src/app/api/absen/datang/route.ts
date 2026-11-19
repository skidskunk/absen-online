import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOfficeConfig } from "@/lib/config";
import { calculateHaversineDistance } from "@/lib/haversine";
import { getWitaDateStr } from "@/lib/date";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesi berakhir, silakan login ulang." },
        { status: 401 }
      );
    }

    const { statusKerja, lat, lng } = await request.json();

    const status = String(statusKerja || "WFO").trim().toUpperCase();
    const validStatuses = ["WFO", "WFH", "DINAS", "CUTI", "SAKIT"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { ok: false, message: "Status kerja tidak valid: " + status },
        { status: 400 }
      );
    }

    // Ambil profile user
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nip, nama, jabatan, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { ok: false, message: "Data profil tidak ditemukan." },
        { status: 404 }
      );
    }

    const todayStr = getWitaDateStr();
    const adminSupabase = createAdminClient();

    // Cek apakah sudah ada absen hari ini
    const { data: existing } = await adminSupabase
      .from("attendances")
      .select("id, jam_datang")
      .eq("nip", profile.nip)
      .eq("tanggal", todayStr)
      .maybeSingle();

    if (existing && existing.jam_datang) {
      return NextResponse.json(
        { ok: false, message: "Anda sudah absen datang hari ini." },
        { status: 400 }
      );
    }

    // Ambil konfigurasi kantor
    const config = await getOfficeConfig(adminSupabase);

    let distM = 0;
    let inRadius = true;

    if (status === "WFO") {
      const latitude = Number(lat);
      const longitude = Number(lng);

      if (isNaN(latitude) || isNaN(longitude)) {
        return NextResponse.json(
          { ok: false, message: "Lokasi GPS tidak valid untuk absen WFO." },
          { status: 400 }
        );
      }

      distM = calculateHaversineDistance(
        latitude,
        longitude,
        config.kantorLat,
        config.kantorLng
      );

      if (distM > config.radiusMeter) {
        return NextResponse.json(
          {
            ok: false,
            message: `WFO ditolak. Jarak ${distM}m (maks ${config.radiusMeter}m).`,
            distanceM: distM,
            radiusM: config.radiusMeter,
          },
          { status: 400 }
        );
      }

      inRadius = true;
    } else {
      // Jika status != WFO, skip GPS check
      distM = 0;
      inRadius = true;
    }

    const nowIso = new Date().toISOString();

    if (existing) {
      const { error: updateErr } = await adminSupabase
        .from("attendances")
        .update({
          status_datang: status,
          lat_datang: Number(lat) || null,
          lng_datang: Number(lng) || null,
          jam_datang: nowIso,
          dist_m: distM,
          in_radius: inRadius,
        })
        .eq("id", existing.id);

      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await adminSupabase
        .from("attendances")
        .insert({
          user_id: user.id,
          nip: profile.nip,
          nama: profile.nama,
          jabatan: profile.jabatan,
          tanggal: todayStr,
          status_datang: status,
          lat_datang: Number(lat) || null,
          lng_datang: Number(lng) || null,
          jam_datang: nowIso,
          dist_m: distM,
          in_radius: inRadius,
        });

      if (insertErr) throw insertErr;
    }

    // Log audit
    await adminSupabase.from("audit_logs").insert({
      actor_nip: profile.nip,
      actor_role: profile.role,
      action: "ABSEN_DATANG",
      detail: `Absen Datang ${status}`,
    });

    return NextResponse.json({
      ok: true,
      message: `Berhasil Absen Datang (${status})`,
      distanceM: distM,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Gagal absen datang: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
