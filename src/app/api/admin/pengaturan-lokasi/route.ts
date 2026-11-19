import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOfficeConfig } from "@/lib/config";

// GET: Current config + Riwayat
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
      .select("nip, role")
      .eq("id", user.id)
      .single();

    if (!myProfile || (myProfile.role !== "admin" && myProfile.role !== "super_admin")) {
      return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
    }

    const [config, logsRes] = await Promise.all([
      getOfficeConfig(adminSupabase),
      adminSupabase
        .from("audit_logs")
        .select("*")
        .eq("action", "UPDATE_LOKASI_KANTOR")
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    return NextResponse.json({
      ok: true,
      config,
      history: logsRes.data || [],
      myRole: myProfile.role,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Error lokasi: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}

// POST: Update Lokasi & Radius (Super Admin ONLY)
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
        { ok: false, message: "Hanya Super Admin yang diizinkan mengubah lokasi kantor." },
        { status: 403 }
      );
    }

    const { lat, lng, nama, radius } = await request.json();

    const latStr = String(lat || "").trim();
    const lngStr = String(lng || "").trim();
    const namaStr = String(nama || "Kantor").trim();
    const radiusStr = String(radius || "200").trim();

    if (!latStr || !lngStr || !radiusStr) {
      return NextResponse.json(
        { ok: false, message: "Data latitude, longitude, dan radius wajib diisi." },
        { status: 400 }
      );
    }

    // Try calling RPC update_office_config
    const { error: rpcError } = await supabase.rpc("update_office_config", {
      p_lat: latStr,
      p_lng: lngStr,
      p_nama: namaStr,
      p_radius: radiusStr,
    });

    if (rpcError) {
      // Fallback via admin client
      const { data: oldLatRow } = await adminSupabase.from("app_config").select("value").eq("key", "kantor_lat").single();
      const { data: oldRadRow } = await adminSupabase.from("app_config").select("value").eq("key", "radius_meter").single();

      const oldLat = oldLatRow?.value || "-";
      const oldRad = oldRadRow?.value || "-";

      const nowIso = new Date().toISOString();
      await Promise.all([
        adminSupabase.from("app_config").upsert({ key: "kantor_lat", value: latStr, updated_at: nowIso, updated_by: myProfile.nip }),
        adminSupabase.from("app_config").upsert({ key: "kantor_lng", value: lngStr, updated_at: nowIso, updated_by: myProfile.nip }),
        adminSupabase.from("app_config").upsert({ key: "kantor_nama", value: namaStr, updated_at: nowIso, updated_by: myProfile.nip }),
        adminSupabase.from("app_config").upsert({ key: "radius_meter", value: radiusStr, updated_at: nowIso, updated_by: myProfile.nip }),
      ]);

      await adminSupabase.from("audit_logs").insert({
        actor_nip: myProfile.nip,
        actor_role: myProfile.role,
        action: "UPDATE_LOKASI_KANTOR",
        detail: `Lat ${oldLat} -> ${latStr}, Radius ${oldRad}m -> ${radiusStr}m, Nama: ${namaStr}`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Lokasi kantor dan radius berhasil diperbarui.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: "Gagal update lokasi: " + (err.message || String(err)) },
      { status: 500 }
    );
  }
}
