import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    const { statusKerja, lat, lng, uraianKinerja, outputKinerja } =
      await request.json();

    const cleanUraian = String(uraianKinerja || "").trim();
    const cleanOutput = String(outputKinerja || "").trim();

    if (!cleanUraian) {
      return NextResponse.json(
        { ok: false, message: "Mohon isi laporan uraian kerja hari ini." },
        { status: 400 }
      );
    }

    if (!cleanOutput) {
      return NextResponse.json(
        { ok: false, message: "Mohon isi laporan output hari ini." },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nip, nama, jabatan, role")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { ok: false, message: "Profil tidak ditemukan." },
        { status: 404 }
      );
    }

    const todayStr = getWitaDateStr();
    const adminSupabase = createAdminClient();

    // Cek apakah sudah absen datang hari ini
    const { data: attendance } = await adminSupabase
      .from("attendances")
      .select("*")
      .eq("nip", profile.nip)
      .eq("tanggal", todayStr)
      .maybeSingle();

    if (!attendance || !attendance.jam_datang) {
      return NextResponse.json(
        { ok: false, message: "Anda belum absen datang hari ini." },
        { status: 400 }
      );
    }

    if (attendance.jam_pulang) {
      return NextResponse.json(
        { ok: false, message: "Anda sudah absen pulang." },
        { status: 400 }
      );
    }

    const statusP = String(
      statusKerja || attendance.status_datang || "WFO"
    ).trim().toUpperCase();

    const nowIso = new Date().toISOString();

    const { error: updateErr } = await adminSupabase
      .from("attendances")
      .update({
        status_pulang: statusP,
        lat_pulang: Number(lat) || null,
        lng_pulang: Number(lng) || null,
        jam_pulang: nowIso,
        uraian_kinerja: cleanUraian,
        output_kinerja: cleanOutput,
      })
      .eq("id", attendance.id);

    if (updateErr) throw updateErr;

    // Log audit
    await adminSupabase.from("audit_logs").insert({
      actor_nip: profile.nip,
      actor_role: profile.role,
      action: "ABSEN_PULANG",
      detail: `Absen Pulang: ${cleanOutput}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Berhasil Absen Pulang. Selamat beristirahat!",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Gagal absen pulang: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
