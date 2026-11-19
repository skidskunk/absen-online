import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { nip, password } = await request.json();

    const cleanNip = String(nip || "").trim();
    const cleanPass = String(password || "").trim();

    if (!cleanNip || !cleanPass) {
      return NextResponse.json(
        { ok: false, message: "NIP & password wajib diisi." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Cari user di tabel profiles berdasarkan NIP
    const { data: profile, error: profileError } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("nip", cleanNip)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { ok: false, message: "NIP tidak terdaftar." },
        { status: 404 }
      );
    }

    if (!profile.is_active) {
      return NextResponse.json(
        { ok: false, message: "Akun Anda dinonaktifkan. Hubungi admin." },
        { status: 403 }
      );
    }

    // 2. Login via Supabase Auth dengan email & password
    const supabase = await createClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: profile.email,
        password: cleanPass,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        { ok: false, message: "Password salah." },
        { status: 401 }
      );
    }

    // 3. Catat audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: profile.nip,
      actor_role: profile.role,
      action: "LOGIN_USER",
      detail: "Login pegawai berhasil",
    });

    return NextResponse.json({
      ok: true,
      message: "Login berhasil.",
      user: {
        id: profile.id,
        nip: profile.nip,
        nama: profile.nama,
        email: profile.email,
        jabatan: profile.jabatan,
        role: profile.role,
        is_default_password: profile.is_default_password,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error sistem: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
