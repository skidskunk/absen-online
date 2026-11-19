import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    if (!myProfile || myProfile.role !== "super_admin") {
      return NextResponse.json(
        { ok: false, message: "Hanya Super Admin yang berhak mengosongkan database." },
        { status: 403 }
      );
    }

    const { confirmText } = await request.json();

    if (confirmText !== "HAPUS SEMUA") {
      return NextResponse.json(
        { ok: false, message: "Konfirmasi salah. Wajib mengetik HAPUS SEMUA." },
        { status: 400 }
      );
    }

    // Call RPC clear_attendances via user client or admin client
    const { data, error } = await supabase.rpc("clear_attendances", {
      p_confirm_text: "HAPUS SEMUA",
    });

    if (error) {
      // Fallback via admin client if RPC failed due to auth context
      const { count } = await adminSupabase.from("attendances").select("*", { count: "exact", head: true });
      const { error: delError } = await adminSupabase.from("attendances").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delError) throw delError;

      await adminSupabase.from("audit_logs").insert({
        actor_nip: myProfile.nip,
        actor_role: myProfile.role,
        action: "CLEAR_DATABASE",
        detail: `Mengosongkan ${count || 0} baris attendances`,
      });

      return NextResponse.json({
        ok: true,
        message: `Database berhasil dikosongkan (${count || 0} data absensi dihapus).`,
        deleted: count || 0,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Database absensi berhasil dikosongkan.",
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Gagal mengosongkan database: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
