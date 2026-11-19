import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json(
        { ok: false, message: "Parameter tahun/bulan tidak valid." },
        { status: 400 }
      );
    }

    const startStr = `${year}-${String(month).padStart(2, "0")}-01`;
    // Last day of month
    const lastDay = new Date(year, month, 0).getDate();
    const endStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    // Ambil data users dan attendances pada range tersebut
    const [usersRes, attendancesRes] = await Promise.all([
      adminSupabase
        .from("profiles")
        .select("nip, nama, jabatan")
        .order("nama", { ascending: true }),
      adminSupabase
        .from("attendances")
        .select("*")
        .gte("tanggal", startStr)
        .lte("tanggal", endStr),
    ]);

    const users = usersRes.data || [];
    const attendances = attendancesRes.data || [];

    const summaryMap: Record<
      string,
      {
        nip: string;
        nama: string;
        jabatan: string;
        hadir: number;
        wfo: number;
        wfh: number;
        dinas: number;
        cuti: number;
        sakit: number;
        pulangLengkap: number;
      }
    > = {};

    users.forEach((u) => {
      summaryMap[u.nip] = {
        nip: u.nip,
        nama: u.nama,
        jabatan: u.jabatan,
        hadir: 0,
        wfo: 0,
        wfh: 0,
        dinas: 0,
        cuti: 0,
        sakit: 0,
        pulangLengkap: 0,
      };
    });

    for (const a of attendances) {
      if (!summaryMap[a.nip]) continue;

      if (a.jam_datang) {
        summaryMap[a.nip].hadir++;
        const s = (a.status_datang || "").toUpperCase();
        if (s === "WFO") summaryMap[a.nip].wfo++;
        else if (s === "WFH") summaryMap[a.nip].wfh++;
        else if (s === "DINAS") summaryMap[a.nip].dinas++;
        else if (s === "CUTI") summaryMap[a.nip].cuti++;
        else if (s === "SAKIT") summaryMap[a.nip].sakit++;
      }

      if (a.jam_pulang) {
        summaryMap[a.nip].pulangLengkap++;
      }
    }

    return NextResponse.json({
      ok: true,
      periode: { year, month, start: startStr, end: endStr },
      rows: Object.values(summaryMap),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error rekap: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
