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

    // Verifikasi role admin
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
        { ok: false, message: "Akses ditolak. Hanya administrator yang dapat mereset password." },
        { status: 403 }
      );
    }

    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "ID pegawai diperlukan." },
        { status: 400 }
      );
    }

    const { data: targetProfile } = await adminSupabase
      .from("profiles")
      .select("nip, nama, email")
      .eq("id", id)
      .maybeSingle();

    if (!targetProfile) {
      return NextResponse.json(
        { ok: false, message: "Pegawai tidak ditemukan." },
        { status: 404 }
      );
    }

    const newDefaultPass = process.env.DEFAULT_USER_PASSWORD || "Absen123!";

    // 1. Reset password di Supabase Auth via Admin API
    const { error: resetError } = await adminSupabase.auth.admin.updateUserById(
      id,
      { password: newDefaultPass }
    );

    if (resetError) {
      return NextResponse.json(
        { ok: false, message: "Gagal reset password: " + resetError.message },
        { status: 500 }
      );
    }

    // 2. Set is_default_password = true di tabel profiles
    await adminSupabase
      .from("profiles")
      .update({ is_default_password: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    // 3. Catat audit log
    try {
      await adminSupabase.from("audit_logs").insert({
        actor_nip: actorNip,
        actor_role: actorRole,
        action: "ADMIN_RESET_PASS",
        detail: `Reset password pegawai ${targetProfile.nip} (${targetProfile.nama}) ke default (${newDefaultPass})`,
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      message: `Password pegawai ${targetProfile.nama} berhasil di-reset ke: ${newDefaultPass}`,
      newPassword: newDefaultPass,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error reset password: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
