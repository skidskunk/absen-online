/**
 * Import script to migrate old Google Sheets CSV (USERS.csv and ABSENSI.csv) into Supabase
 * Usage: npx ts-node scripts/import-from-sheets-csv.ts [path_to_users_csv] [path_to_absensi_csv]
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));
loadEnvFile(path.join(process.cwd(), ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Error: Supabase environment variables belum diatur.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || "12345678";

function parseCsv(content: string): string[][] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const row: string[] = [];
    let insideQuote = false;
    let entry = "";
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        insideQuote = !insideQuote;
      } else if (char === "," && !insideQuote) {
        row.push(entry.trim());
        entry = "";
      } else {
        entry += char;
      }
    }
    row.push(entry.trim());
    return row;
  });
}

async function importUsers(csvPath: string) {
  if (!fs.existsSync(csvPath)) {
    console.log(`File ${csvPath} tidak ditemukan, melewati import users.`);
    return;
  }

  console.log(`\n--- Memproses Import USERS dari ${csvPath} ---`);
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(content);

  const header = rows[0].map((h) => h.toLowerCase());
  const nipIdx = header.indexOf("nip");
  const namaIdx = header.indexOf("nama");
  const emailIdx = header.indexOf("email");
  const jabatanIdx = header.indexOf("jabatan");

  let success = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nip = row[nipIdx]?.trim();
    const nama = row[namaIdx]?.trim();
    const email = row[emailIdx]?.trim().toLowerCase();
    const jabatan = row[jabatanIdx]?.trim();

    if (!nip || !nama || !email) {
      skipped++;
      continue;
    }

    try {
      let authUserId: string;
      const { data: userList } = await supabase.auth.admin.listUsers();
      const existing = userList?.users.find((u) => u.email === email);

      if (existing) {
        authUserId = existing.id;
      } else {
        const { data: newAuth, error: authError } = await supabase.auth.admin.createUser({
          email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { nip, nama },
        });

        if (authError || !newAuth.user) {
          console.error(`Gagal auth user ${nip}:`, authError?.message);
          skipped++;
          continue;
        }
        authUserId = newAuth.user.id;
      }

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: authUserId,
        nip,
        nama,
        email,
        jabatan: jabatan || "Staff",
        role: "user",
        is_default_password: true,
        is_active: true,
      });

      if (profileError) {
        console.error(`Gagal upsert profile ${nip}:`, profileError.message);
        skipped++;
      } else {
        success++;
      }
    } catch (err: any) {
      console.error(`Error baris ${i} (${nip}):`, err.message);
      skipped++;
    }
  }

  console.log(`Selesai Import USERS: ${success} berhasil, ${skipped} dilewati.`);
}

async function importAttendances(csvPath: string) {
  if (!fs.existsSync(csvPath)) {
    console.log(`File ${csvPath} tidak ditemukan, melewati import attendances.`);
    return;
  }

  console.log(`\n--- Memproses Import ABSENSI dari ${csvPath} ---`);
  const content = fs.readFileSync(csvPath, "utf-8");
  const rows = parseCsv(content);

  const { data: profiles } = await supabase.from("profiles").select("id, nip");
  const profileMap: Record<string, string> = {};
  (profiles || []).forEach((p) => {
    profileMap[p.nip] = p.id;
  });

  let success = 0;
  let skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const tanggal = row[0]?.trim();
    const nip = row[1]?.trim();
    const nama = row[2]?.trim();
    const jabatan = row[3]?.trim();
    const statusDatang = row[4]?.trim().toUpperCase();
    const latDatang = parseFloat(row[5]) || null;
    const lngDatang = parseFloat(row[6]) || null;
    const jamDatang = row[7]?.trim() ? new Date(row[7]).toISOString() : null;
    const statusPulang = row[8]?.trim().toUpperCase() || null;
    const latPulang = parseFloat(row[9]) || null;
    const lngPulang = parseFloat(row[10]) || null;
    const jamPulang = row[11]?.trim() ? new Date(row[11]).toISOString() : null;
    const uraian = row[12]?.trim() || null;
    const output = row[13]?.trim() || null;
    const distM = parseFloat(row[14]) || 0;
    const inRadius = row[15]?.trim().toLowerCase() === "true";

    if (!tanggal || !nip) {
      skipped++;
      continue;
    }

    const userId = profileMap[nip] || null;

    const { error } = await supabase.from("attendances").upsert(
      {
        user_id: userId,
        nip,
        nama,
        jabatan,
        tanggal,
        status_datang: (["WFO", "WFH", "DINAS", "CUTI", "SAKIT"].includes(statusDatang) ? statusDatang : "WFO") as any,
        lat_datang: latDatang,
        lng_datang: lngDatang,
        jam_datang: jamDatang,
        status_pulang: statusPulang,
        lat_pulang: latPulang,
        lng_pulang: lngPulang,
        jam_pulang: jamPulang,
        uraian_kinerja: uraian,
        output_kinerja: output,
        dist_m: distM,
        in_radius: inRadius,
      },
      { onConflict: "nip,tanggal" }
    );

    if (error) {
      console.error(`Gagal import absen ${nip} tgl ${tanggal}:`, error.message);
      skipped++;
    } else {
      success++;
    }
  }

  console.log(`Selesai Import ABSENSI: ${success} berhasil, ${skipped} dilewati.`);
}

async function run() {
  const usersCsv = process.argv[2] || "USERS.csv";
  const absensiCsv = process.argv[3] || "ABSENSI.csv";

  await importUsers(usersCsv);
  await importAttendances(absensiCsv);
}

run().catch(console.error);
