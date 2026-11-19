import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "12345678";

export async function POST(request: Request) {
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
      .select("nip, role")
      .eq("id", user.id)
      .single();

    if (!myProfile || (myProfile.role !== "admin" && myProfile.role !== "super_admin")) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
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
      .select("nip, nama")
      .eq("id", id)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { ok: false, message: "Pegawai tidak ditemukan." },
        { status: 404 }
      );
    }

    // 1. Reset password di Supabase Auth via Admin API
    const { error: resetError } = await adminSupabase.auth.admin.updateUserById(
      id,
      { password: DEFAULT_PASSWORD }
    );

    if (resetError) throw resetError;

    // 2. Set is_default_password = true
    await adminSupabase
      .from("profiles")
      .update({ is_default_password: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    // 3. Catat audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: myProfile.nip,
      actor_role: myProfile.role,
      action: "ADMIN_RESET_PASS",
      detail: `Reset password pegawai ${targetProfile.nip} (${targetProfile.nama}) ke default (${DEFAULT_PASSWORD})`,
    });

    return NextResponse.json({
      ok: true,
      message: `Password pegawai ${targetProfile.nama} berhasil di-reset ke ${DEFAULT_PASSWORD}.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error reset password: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
