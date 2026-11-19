import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWitaDateStr, formatWitaTime } from "@/lib/date";
import { getOfficeConfig } from "@/lib/config";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("date") || getWitaDateStr();

    const adminSupabase = createAdminClient();

    // Check admin role
    const { data: myProfile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!myProfile || (myProfile.role !== "admin" && myProfile.role !== "super_admin")) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    // Ambil semua pegawai & attendances pada tanggal terpilih
    const [usersRes, attendancesRes, officeConfig] = await Promise.all([
      adminSupabase
        .from("profiles")
        .select("id, nip, nama, email, jabatan, role, is_active, is_default_password")
        .order("nama", { ascending: true }),
      adminSupabase
        .from("attendances")
        .select("*")
        .eq("tanggal", dateStr),
      getOfficeConfig(adminSupabase),
    ]);

    const users = usersRes.data || [];
    const attendances = attendancesRes.data || [];

    const absMap: Record<string, any> = {};
    for (const a of attendances) {
      absMap[a.nip] = a;
    }

    const monitorRows = users.map((u) => {
      const a = absMap[u.nip];
      return {
        nip: u.nip,
        nama: u.nama,
        jabatan: u.jabatan,
        status: a?.status_datang || "-",
        datang: a?.jam_datang ? formatWitaTime(a.jam_datang) : "-",
        pulang: a?.jam_pulang ? formatWitaTime(a.jam_pulang) : "-",
        uraian: a?.uraian_kinerja || "-",
        output: a?.output_kinerja || "-",
        distM: a?.dist_m ?? 0,
        inRadius: a?.in_radius ?? true,
      };
    });

    const sudahDatang = monitorRows.filter((x) => x.datang !== "-").length;
    const sudahPulang = monitorRows.filter((x) => x.pulang !== "-").length;

    return NextResponse.json({
      ok: true,
      date: dateStr,
      stats: {
        totalPegawai: users.length,
        sudahDatang,
        sudahPulang,
        belumLengkap: Math.max(0, sudahDatang - sudahPulang),
      },
      rows: monitorRows,
      pegawai: users,
      officeConfig,
      myRole: myProfile.role,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error dashboard: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
