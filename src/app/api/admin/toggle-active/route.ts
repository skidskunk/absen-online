import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, message: "Sesi tidak valid, silakan login ulang." },
        { status: 401 }
      );
    }

    const adminSupabase = createAdminClient();

    let actorRole = "user";
    let actorNip = "ADMIN";

    const { data: currentProfile } = await adminSupabase
      .from("profiles")
      .select("nip, role")
      .eq("id", sessionUser.id)
      .maybeSingle();

    if (currentProfile?.role) {
      actorRole = currentProfile.role;
      actorNip = currentProfile.nip;
    } else if (sessionUser.email === "superadmin@absen.local") {
      actorRole = "super_admin";
      actorNip = "SUPER001";
    } else if (sessionUser.email === "admin@absen.local") {
      actorRole = "admin";
      actorNip = "ADMIN001";
    }

    if (actorRole !== "admin" && actorRole !== "super_admin") {
      return NextResponse.json(
        { ok: false, message: "Akses ditolak. Hanya administrator yang dapat mengubah status akun." },
        { status: 403 }
      );
    }

    const { id, is_active } = await request.json();

    if (!id || typeof is_active !== "boolean") {
      return NextResponse.json(
        { ok: false, message: "Parameter id dan is_active (boolean) diperlukan." },
        { status: 400 }
      );
    }

    // Hindari menonaktifkan akun sendiri
    if (id === sessionUser.id && !is_active) {
      return NextResponse.json(
        { ok: false, message: "Anda tidak dapat menonaktifkan akun Anda sendiri." },
        { status: 400 }
      );
    }

    const { data: targetProfile, error: getError } = await adminSupabase
      .from("profiles")
      .select("nip, nama, role")
      .eq("id", id)
      .maybeSingle();

    if (getError || !targetProfile) {
      return NextResponse.json(
        { ok: false, message: "Pegawai tidak ditemukan." },
        { status: 404 }
      );
    }

    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateError) throw updateError;

    try {
      await adminSupabase.from("audit_logs").insert({
        actor_nip: actorNip,
        actor_role: actorRole,
        action: is_active ? "USER_ACTIVATE" : "USER_DEACTIVATE",
        detail: `${is_active ? "Mengaktifkan" : "Menonaktifkan"} akun ${targetProfile.nip} - ${targetProfile.nama}`,
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      is_active,
      message: `Status pegawai ${targetProfile.nama} berhasil diubah menjadi: ${is_active ? "Aktif" : "Nonaktif"}`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error update status: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
