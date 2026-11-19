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

    const body = await request.json();
    let items: Array<{ nip: string; nama: string; email: string; jabatan: string }> = [];

    if (typeof body.rawText === "string") {
      const lines = body.rawText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split(",").map((p: string) => p.trim());
        if (parts.length >= 4) {
          items.push({
            nip: parts[0],
            nama: parts[1],
            email: parts[2],
            jabatan: parts[3],
          });
        }
      }
    } else if (Array.isArray(body.items)) {
      items = body.items;
    }

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Data bulk kosong atau format tidak sesuai (NIP,Nama,Email,Jabatan per baris)." },
        { status: 400 }
      );
    }

    // Ambil semua NIP yang sudah ada untuk skip duplicate
    const { data: existingProfiles } = await adminSupabase
      .from("profiles")
      .select("nip");

    const existingNips = new Set((existingProfiles || []).map((p) => p.nip));

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const item of items) {
      const nip = String(item.nip || "").trim();
      const nama = String(item.nama || "").trim();
      const email = String(item.email || "").trim().toLowerCase();
      const jabatan = String(item.jabatan || "").trim();

      if (!nip || !nama || !email || !jabatan) {
        failedCount++;
        errors.push(`${nip || "baris"}: data tidak lengkap`);
        continue;
      }

      if (existingNips.has(nip)) {
        failedCount++;
        errors.push(`${nip}: NIP duplikat`);
        continue;
      }

      try {
        const { data: authUser, error: authError } =
          await adminSupabase.auth.admin.createUser({
            email,
            password: DEFAULT_PASSWORD,
            email_confirm: true,
            user_metadata: { nip, nama },
          });

        if (authError || !authUser.user) {
          failedCount++;
          errors.push(`${nip}: ${authError?.message || "Gagal buat auth"}`);
          continue;
        }

        await adminSupabase.from("profiles").upsert({
          id: authUser.user.id,
          nip,
          nama,
          email,
          jabatan,
          role: "user",
          is_default_password: true,
          is_active: true,
        });

        existingNips.add(nip);
        successCount++;
      } catch (err: any) {
        failedCount++;
        errors.push(`${nip}: ${err.message || String(err)}`);
      }
    }

    // Catat audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: myProfile.nip,
      actor_role: myProfile.role,
      action: "ADMIN_BULK_CREATE",
      detail: `Bulk insert: ${successCount} sukses, ${failedCount} gagal/duplikat`,
    });

    return NextResponse.json({
      ok: true,
      message: `${successCount} pegawai berhasil ditambahkan.${
        failedCount > 0 ? ` (${failedCount} gagal/duplikat)` : ""
      }`,
      successCount,
      failedCount,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error bulk insert: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
