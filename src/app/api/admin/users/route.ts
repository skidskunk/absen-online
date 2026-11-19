import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "12345678";

// GET: Ambil semua user profiles
export async function GET() {
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

    const { data: users, error } = await adminSupabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ ok: true, users, myRole: myProfile.role });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}

// POST: Tambah Pegawai Baru
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

    const { nip, nama, email, jabatan, role } = await request.json();

    const cleanNip = String(nip || "").trim();
    const cleanNama = String(nama || "").trim();
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanJabatan = String(jabatan || "").trim();
    const assignedRole = myProfile.role === "super_admin" && role ? role : "user";

    if (!cleanNip || !cleanNama || !cleanEmail || !cleanJabatan) {
      return NextResponse.json(
        { ok: false, message: "Semua kolom wajib diisi (NIP, Nama, Email, Jabatan)." },
        { status: 400 }
      );
    }

    // Cek duplicate NIP
    const { data: existingNip } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("nip", cleanNip)
      .maybeSingle();

    if (existingNip) {
      return NextResponse.json(
        { ok: false, message: "NIP sudah terdaftar." },
        { status: 400 }
      );
    }

    // 1. Buat Auth User via Supabase Admin API
    const { data: authUser, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email: cleanEmail,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          nip: cleanNip,
          nama: cleanNama,
        },
      });

    if (authError || !authUser.user) {
      return NextResponse.json(
        { ok: false, message: "Gagal membuat akun auth: " + (authError?.message || "") },
        { status: 400 }
      );
    }

    // 2. Insert ke profiles (atau update jika sudah ter-trigger)
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .upsert({
        id: authUser.user.id,
        nip: cleanNip,
        nama: cleanNama,
        email: cleanEmail,
        jabatan: cleanJabatan,
        role: assignedRole,
        is_default_password: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      // rollback auth user if profile insert failed
      await adminSupabase.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    // 3. Catat audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: myProfile.nip,
      actor_role: myProfile.role,
      action: "ADMIN_CREATE_USER",
      detail: `Tambah user ${cleanNip} (${cleanNama}) - Default password: ${DEFAULT_PASSWORD}`,
    });

    return NextResponse.json({
      ok: true,
      message: "Pegawai berhasil ditambahkan dengan password default: " + DEFAULT_PASSWORD,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error tambah pegawai: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}

// PUT: Edit Profil Pegawai
export async function PUT(request: Request) {
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

    const { id, nama, email, jabatan, is_active, role } = await request.json();

    if (!id) {
      return NextResponse.json(
        { ok: false, message: "ID pegawai diperlukan." },
        { status: 400 }
      );
    }

    // Target profile
    const { data: targetProfile } = await adminSupabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (!targetProfile) {
      return NextResponse.json(
        { ok: false, message: "Pegawai tidak ditemukan." },
        { status: 404 }
      );
    }

    // Admin CANNOT edit role, only super_admin can
    const updatePayload: Record<string, any> = {
      nama: nama !== undefined ? String(nama).trim() : targetProfile.nama,
      email: email !== undefined ? String(email).trim().toLowerCase() : targetProfile.email,
      jabatan: jabatan !== undefined ? String(jabatan).trim() : targetProfile.jabatan,
      is_active: is_active !== undefined ? Boolean(is_active) : targetProfile.is_active,
      updated_at: new Date().toISOString(),
    };

    if (myProfile.role === "super_admin" && role) {
      if (["super_admin", "admin", "user"].includes(role)) {
        updatePayload.role = role;
      }
    }

    // If email changed, also update auth.users
    if (updatePayload.email && updatePayload.email !== targetProfile.email) {
      await adminSupabase.auth.admin.updateUserById(id, {
        email: updatePayload.email,
      });
    }

    const { error: updateError } = await adminSupabase
      .from("profiles")
      .update(updatePayload)
      .eq("id", id);

    if (updateError) throw updateError;

    // Catat audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: myProfile.nip,
      actor_role: myProfile.role,
      action: "ADMIN_UPDATE_USER",
      detail: `Update user ${targetProfile.nip}: ` + JSON.stringify(updatePayload),
    });

    return NextResponse.json({
      ok: true,
      message: "Data pegawai berhasil diperbarui.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error update pegawai: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}

// DELETE: Hapus Pegawai (Super Admin ONLY)
export async function DELETE(request: Request) {
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
        { ok: false, message: "Hanya Super Admin yang diizinkan menghapus pegawai." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ ok: false, message: "ID pegawai diperlukan." }, { status: 400 });
    }

    const { data: targetProfile } = await adminSupabase
      .from("profiles")
      .select("nip, nama, role")
      .eq("id", id)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ ok: false, message: "Pegawai tidak ditemukan." }, { status: 404 });
    }

    // Do not allow deleting self
    if (id === user.id) {
      return NextResponse.json(
        { ok: false, message: "Tidak dapat menghapus akun Anda sendiri." },
        { status: 400 }
      );
    }

    // Hapus via auth.admin (on delete cascade akan hapus profile & attendances)
    await adminSupabase.auth.admin.deleteUser(id);

    // Pastikan terhapus dari profiles
    await adminSupabase.from("profiles").delete().eq("id", id);

    // Catat audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: myProfile.nip,
      actor_role: myProfile.role,
      action: "ADMIN_DELETE_USER",
      detail: `Hapus user ${targetProfile.nip} (${targetProfile.nama})`,
    });

    return NextResponse.json({
      ok: true,
      message: `Pegawai ${targetProfile.nama} (${targetProfile.nip}) berhasil dihapus.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error hapus pegawai: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
