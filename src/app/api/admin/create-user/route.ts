import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // 1. Verifikasi sesi login administrator
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

    // Cek role user yang sedang login
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
    } else if (sessionUser.user_metadata?.role) {
      actorRole = sessionUser.user_metadata.role;
      actorNip = sessionUser.user_metadata.nip || "ADMIN";
    }

    if (actorRole !== "admin" && actorRole !== "super_admin") {
      return NextResponse.json(
        { ok: false, message: "Akses ditolak. Hanya administrator yang dapat menambah pegawai." },
        { status: 403 }
      );
    }

    // 2. Terima dan validasi payload dari frontend
    const body = await request.json();
    const cleanNip = String(body.nip || "").trim();
    const cleanNama = String(body.nama || "").trim();
    let cleanEmail = String(body.email || "").trim().toLowerCase();
    const cleanJabatan = String(body.jabatan || "").trim();
    const requestedRole = String(body.role || "user").trim().toLowerCase();
    const initialPassword = String(body.password || "Absen123!").trim();

    // Auto-append @absen.local jika admin tidak mengetikkan @
    if (cleanEmail && !cleanEmail.includes("@")) {
      cleanEmail = `${cleanEmail}@absen.local`;
    }

    if (!cleanNip) {
      return NextResponse.json({ ok: false, message: "NIP wajib diisi." }, { status: 400 });
    }
    if (!cleanNama) {
      return NextResponse.json({ ok: false, message: "Nama lengkap wajib diisi." }, { status: 400 });
    }
    if (!cleanEmail) {
      return NextResponse.json({ ok: false, message: "Email wajib diisi." }, { status: 400 });
    }
    if (!cleanJabatan) {
      return NextResponse.json({ ok: false, message: "Jabatan wajib diisi." }, { status: 400 });
    }
    if (initialPassword.length < 6) {
      return NextResponse.json({ ok: false, message: "Password minimal 6 karakter." }, { status: 400 });
    }

    // Role hanya boleh 'user' atau 'admin' (super_admin hanya via Supabase)
    const allowedRole = requestedRole === "admin" ? "admin" : "user";

    // 3. Cek duplikasi NIP & Email di profiles
    const { data: existingNip } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("nip", cleanNip)
      .maybeSingle();

    if (existingNip) {
      return NextResponse.json(
        { ok: false, message: "NIP sudah terdaftar" },
        { status: 400 }
      );
    }

    const { data: existingEmail } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingEmail) {
      return NextResponse.json(
        { ok: false, message: "Email sudah terdaftar" },
        { status: 400 }
      );
    }

    // 4. Buat User Auth via Supabase Admin API (service_role)
    const { data: authUser, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          nip: cleanNip,
          nama: cleanNama,
          role: allowedRole,
        },
      });

    if (authError || !authUser.user) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Gagal membuat akun auth: " + (authError?.message || "Unknown error"),
        },
        { status: 400 }
      );
    }

    const newUserId = authUser.user.id;

    // 5. Insert ke public.profiles
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .upsert({
        id: newUserId,
        nip: cleanNip,
        nama: cleanNama,
        email: cleanEmail,
        jabatan: cleanJabatan,
        role: allowedRole,
        is_default_password: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    // 6. Rollback jika insert profiles gagal (cegah user auth yatim)
    if (profileError) {
      await adminSupabase.auth.admin.deleteUser(newUserId);
      return NextResponse.json(
        {
          ok: false,
          message:
            "Gagal menyimpan ke tabel profiles: " + profileError.message + " (Akun auth dibatalkan)",
        },
        { status: 500 }
      );
    }

    // 7. Catat ke public.audit_logs
    try {
      await adminSupabase.from("audit_logs").insert({
        actor_nip: actorNip,
        actor_role: actorRole,
        action: "CREATE_USER",
        detail: `Membuat pegawai ${cleanNip} - ${cleanNama} (${allowedRole})`,
      });
    } catch (auditErr) {
      console.warn("Gagal menulis audit_log CREATE_USER:", auditErr);
    }

    return NextResponse.json({
      ok: true,
      message: `Pegawai berhasil ditambahkan. Password awal: ${initialPassword}`,
      user: {
        id: newUserId,
        nip: cleanNip,
        nama: cleanNama,
        email: cleanEmail,
        jabatan: cleanJabatan,
        role: allowedRole,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Terjadi kesalahan sistem: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
