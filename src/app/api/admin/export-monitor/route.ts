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
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);

    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    const { data: attendances, error } = await adminSupabase
      .from("attendances")
      .select("*")
      .gte("tanggal", startStr)
      .lte("tanggal", endStr)
      .order("tanggal", { ascending: true })
      .order("nip", { ascending: true });

    if (error) throw error;

    const rows = (attendances || []).map((a) => ({
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
    }));

    return NextResponse.json({ ok: true, rows });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error export monitor: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
