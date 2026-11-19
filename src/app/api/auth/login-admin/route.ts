import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    const cleanUser = String(username || "").trim();
    const cleanPass = String(password || "").trim();

    if (!cleanUser || !cleanPass) {
      return NextResponse.json(
        { ok: false, message: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Resolve username to email
    let emailCandidate = cleanUser;

    if (!cleanUser.includes("@")) {
      try {
        const { data: byNip } = await adminSupabase
          .from("profiles")
          .select("email")
          .eq("nip", cleanUser)
          .maybeSingle();

        if (byNip?.email) {
          emailCandidate = byNip.email;
        } else if (cleanUser.toLowerCase() === "admin") {
          emailCandidate = "admin@absen.local";
        } else if (
          cleanUser.toLowerCase() === "superadmin" ||
          cleanUser.toUpperCase() === "SUPER001"
        ) {
          emailCandidate = "superadmin@absen.local";
        } else if (cleanUser.toUpperCase() === "ADMIN001") {
          emailCandidate = "admin@absen.local";
        }
      } catch {
        // Fallback if profiles table is not accessible
        if (cleanUser.toLowerCase() === "admin") {
          emailCandidate = "admin@absen.local";
        } else if (
          cleanUser.toLowerCase() === "superadmin" ||
          cleanUser.toUpperCase() === "SUPER001"
        ) {
          emailCandidate = "superadmin@absen.local";
        } else if (cleanUser.toUpperCase() === "ADMIN001") {
          emailCandidate = "admin@absen.local";
        }
      }
    }

    // 2. Sign in via Supabase Auth
    const supabase = await createClient();
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: emailCandidate,
        password: cleanPass,
      });

    if (authError || !authData.user) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Password atau akun administrator salah. Pastikan password sesuai.",
        },
        { status: 401 }
      );
    }

    // 3. Resolve role & profile
    let userRole = "user";
    let userNip = cleanUser;
    let userNama = "Admin";
    let userJabatan = "Administrator";

    try {
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profile) {
        userRole = profile.role;
        userNip = profile.nip;
        userNama = profile.nama;
        userJabatan = profile.jabatan;

        if (!profile.is_active) {
          await supabase.auth.signOut();
          return NextResponse.json(
            { ok: false, message: "Akun administrator dinonaktifkan." },
            { status: 403 }
          );
        }
      } else {
        // Self-heal default admin profiles
        if (emailCandidate === "superadmin@absen.local") {
          userRole = "super_admin";
          userNip = "SUPER001";
          userNama = "Super Admin";
        } else if (emailCandidate === "admin@absen.local") {
          userRole = "admin";
          userNip = "ADMIN001";
          userNama = "Admin";
        } else if (authData.user.user_metadata?.role) {
          userRole = authData.user.user_metadata.role;
        }

        // Try upserting to profiles
        await adminSupabase.from("profiles").upsert({
          id: authData.user.id,
          nip: userNip,
          nama: userNama,
          email: emailCandidate,
          jabatan: userJabatan,
          role: userRole as any,
          is_default_password: false,
          is_active: true,
          updated_at: new Date().toISOString(),
        });
      }
    } catch {
      // If table query threw permission denied, fall back to known admin accounts
      if (emailCandidate === "superadmin@absen.local") {
        userRole = "super_admin";
        userNip = "SUPER001";
        userNama = "Super Admin";
      } else if (emailCandidate === "admin@absen.local") {
        userRole = "admin";
        userNip = "ADMIN001";
        userNama = "Admin";
      } else if (authData.user.user_metadata?.role) {
        userRole = authData.user.user_metadata.role;
      }
    }

    if (userRole !== "admin" && userRole !== "super_admin") {
      await supabase.auth.signOut();
      return NextResponse.json(
        { ok: false, message: "Akses ditolak. Akun ini bukan administrator." },
        { status: 403 }
      );
    }

    // 4. Catat audit log
    try {
      await adminSupabase.from("audit_logs").insert({
        actor_nip: userNip,
        actor_role: userRole,
        action: "LOGIN_ADMIN",
        detail: "Login admin berhasil",
      });
    } catch {}

    return NextResponse.json({
      ok: true,
      message: "Login admin berhasil.",
      user: {
        id: authData.user.id,
        nip: userNip,
        nama: userNama,
        email: emailCandidate,
        jabatan: userJabatan,
        role: userRole,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error sistem: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
