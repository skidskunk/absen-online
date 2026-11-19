import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOfficeConfig } from "@/lib/config";
import { getWitaDateStr } from "@/lib/date";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ ok: false, loggedIn: false }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
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

    const [attendanceRes, officeConfig] = await Promise.all([
      adminSupabase
        .from("attendances")
        .select("*")
        .eq("nip", profile.nip)
        .eq("tanggal", todayStr)
        .maybeSingle(),
      getOfficeConfig(adminSupabase),
    ]);

    return NextResponse.json({
      ok: true,
      loggedIn: true,
      user: profile,
      attendance: attendanceRes.data || null,
      officeConfig,
      todayStr,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error sistem: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
