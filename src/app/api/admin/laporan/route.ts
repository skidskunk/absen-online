import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWitaTime } from "@/lib/date";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const { data: myProfile } = await adminSupabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!myProfile || (myProfile.role !== "admin" && myProfile.role !== "super_admin")) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const filterNip = searchParams.get("nip");
    const filterStatus = searchParams.get("status");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { ok: false, message: "Start date dan end date wajib diisi." },
        { status: 400 }
      );
    }

    let query = adminSupabase
      .from("attendances")
      .select("*")
      .gte("tanggal", startDate)
      .lte("tanggal", endDate)
      .order("tanggal", { ascending: false })
      .order("nip", { ascending: true });

    if (filterNip && filterNip !== "ALL") {
      query = query.eq("nip", filterNip);
    }

    if (filterStatus && filterStatus !== "ALL") {
      query = query.eq("status_datang", filterStatus);
    }

    const { data: attendances, error } = await query;
    if (error) throw error;

    const rows = (attendances || []).map((a) => ({
      id: a.id,
      tanggal: a.tanggal,
      nip: a.nip,
      nama: a.nama || "",
      jabatan: a.jabatan || "",
      statusDatang: a.status_datang || "-",
      jamDatang: a.jam_datang ? formatWitaTime(a.jam_datang) : "-",
      statusPulang: a.status_pulang || "-",
      jamPulang: a.jam_pulang ? formatWitaTime(a.jam_pulang) : "-",
      uraian: a.uraian_kinerja || "-",
      output: a.output_kinerja || "-",
      distM: a.dist_m ?? 0,
      inRadius: a.in_radius ?? true,
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error laporan: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
