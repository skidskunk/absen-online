import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table") || "profiles";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
    const search = searchParams.get("search")?.trim() || "";
    const date = searchParams.get("date")?.trim() || "";

    const allowedTables = ["profiles", "attendances", "audit_logs", "app_config"];
    if (!allowedTables.includes(table)) {
      return NextResponse.json({ ok: false, message: "Tabel tidak valid." }, { status: 400 });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = adminSupabase.from(table).select("*", { count: "exact" });

    // Table-specific search and filter
    if (table === "profiles") {
      if (search) {
        query = query.or(`nip.ilike.%${search}%,nama.ilike.%${search}%,email.ilike.%${search}%`);
      }
      query = query.order("created_at", { ascending: false });
    } else if (table === "attendances") {
      if (search) {
        query = query.or(`nip.ilike.%${search}%,nama.ilike.%${search}%`);
      }
      if (date) {
        query = query.eq("tanggal", date);
      }
      query = query.order("tanggal", { ascending: false }).order("jam_datang", { ascending: false });
    } else if (table === "audit_logs") {
      if (search) {
        query = query.or(`actor_nip.ilike.%${search}%,action.ilike.%${search}%,detail.ilike.%${search}%`);
      }
      if (date) {
        query = query.gte("created_at", `${date}T00:00:00Z`).lte("created_at", `${date}T23:59:59Z`);
      }
      query = query.order("created_at", { ascending: false });
    } else if (table === "app_config") {
      if (search) {
        query = query.or(`key.ilike.%${search}%,value.ilike.%${search}%`);
      }
    }

    const { data, count, error } = await query.range(from, to);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      table,
      page,
      limit,
      totalCount: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      rows: data || [],
      myRole: myProfile.role,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error DB viewer: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}

// PUT: Edit row (super_admin ONLY)
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

    if (!myProfile || myProfile.role !== "super_admin") {
      return NextResponse.json(
        { ok: false, message: "Hanya Super Admin yang diizinkan mengedit baris database." },
        { status: 403 }
      );
    }

    const { table, id, key, updates } = await request.json();

    if (table === "app_config") {
      if (!key) return NextResponse.json({ ok: false, message: "Key config diperlukan." }, { status: 400 });
      const { error } = await adminSupabase
        .from("app_config")
        .update({ value: String(updates.value), updated_at: new Date().toISOString(), updated_by: myProfile.nip })
        .eq("key", key);
      if (error) throw error;
    } else if (table === "attendances") {
      if (!id) return NextResponse.json({ ok: false, message: "ID attendances diperlukan." }, { status: 400 });
      const { error } = await adminSupabase
        .from("attendances")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    } else if (table === "profiles") {
      if (!id) return NextResponse.json({ ok: false, message: "ID profile diperlukan." }, { status: 400 });
      const { error } = await adminSupabase
        .from("profiles")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    } else {
      return NextResponse.json({ ok: false, message: "Tabel tidak mendukung edit." }, { status: 400 });
    }

    // Catat audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: myProfile.nip,
      actor_role: myProfile.role,
      action: "ADMIN_DB_EDIT",
      detail: `Edit tabel ${table} (${id || key}): ` + JSON.stringify(updates),
    });

    return NextResponse.json({ ok: true, message: "Data berhasil diperbarui." });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error update baris: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}

// DELETE: Hapus row (super_admin ONLY)
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
        { ok: false, message: "Hanya Super Admin yang diizinkan menghapus baris database." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const id = searchParams.get("id");
    const key = searchParams.get("key");

    if (table === "attendances" && id) {
      await adminSupabase.from("attendances").delete().eq("id", id);
    } else if (table === "profiles" && id) {
      if (id === user.id) {
        return NextResponse.json({ ok: false, message: "Tidak dapat menghapus akun sendiri." }, { status: 400 });
      }
      await adminSupabase.auth.admin.deleteUser(id);
      await adminSupabase.from("profiles").delete().eq("id", id);
    } else if (table === "audit_logs" && id) {
      await adminSupabase.from("audit_logs").delete().eq("id", id);
    } else {
      return NextResponse.json({ ok: false, message: "Parameter hapus tidak valid." }, { status: 400 });
    }

    // Catat audit log
    await adminSupabase.from("audit_logs").insert({
      actor_nip: myProfile.nip,
      actor_role: myProfile.role,
      action: "ADMIN_DB_DELETE",
      detail: `Hapus baris dari tabel ${table}: ${id || key}`,
    });

    return NextResponse.json({ ok: true, message: "Baris berhasil dihapus." });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error hapus baris: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
