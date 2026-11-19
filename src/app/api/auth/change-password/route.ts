import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { newPassword } = await request.json();
    const cleanPass = String(newPassword || "").trim();

    if (!cleanPass || cleanPass.length < 8) {
      return NextResponse.json(
        { ok: false, message: "Password minimal 8 karakter." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { ok: false, message: "Sesi tidak valid, silakan login ulang." },
        { status: 401 }
      );
    }

    // Update password in Supabase Auth
    const { error: updateError } = await supabase.auth.updateUser({
      password: cleanPass,
    });

    if (updateError) {
      return NextResponse.json(
        { ok: false, message: "Gagal ubah password: " + updateError.message },
        { status: 400 }
      );
    }

    // Update is_default_password flag in profiles
    const adminSupabase = createAdminClient();
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("nip, role")
      .eq("id", user.id)
      .single();

    await adminSupabase
      .from("profiles")
      .update({ is_default_password: false, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    // Audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: profile?.nip || "UNKNOWN",
      actor_role: profile?.role || "user",
      action: "USER_CHANGE_PASS",
      detail: "Password diubah oleh user",
    });

    return NextResponse.json({
      ok: true,
      message: "Password berhasil diubah.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error sistem: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
