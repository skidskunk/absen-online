/**
 * Seed script for initial Super Admin and Admin accounts
 * Usage: npx ts-node scripts/seed-admin.ts
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
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib ada di .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedUser(userData: {
  email: string;
  password: string;
  nip: string;
  nama: string;
  jabatan: string;
  role: "super_admin" | "admin" | "user";
}) {
  console.log(`Menyiapkan akun: ${userData.email} (${userData.role})...`);

  const { data: userList } = await supabase.auth.admin.listUsers();
  let authUser = userList?.users.find((u) => u.email === userData.email);

  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true,
      user_metadata: { nip: userData.nip, nama: userData.nama },
    });
    if (error) {
      console.error(`Gagal membuat auth user ${userData.email}:`, error.message);
      return;
    }
    authUser = data.user;
    console.log(`Auth user ${userData.email} berhasil dibuat.`);
  } else {
    console.log(`Auth user ${userData.email} sudah ada.`);
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: authUser.id,
    nip: userData.nip,
    nama: userData.nama,
    email: userData.email,
    jabatan: userData.jabatan,
    role: userData.role,
    is_default_password: true,
    is_active: true,
    updated_at: new Date().toISOString(),
  });

  if (profileError) {
    console.error(`Gagal upsert profile ${userData.nip}:`, profileError.message);
  } else {
    console.log(`Profile ${userData.nip} (${userData.role}) berhasil disimpan.`);
  }
}

async function main() {
  console.log("=== SEEDING AKUN ADMINISTRATOR ===");

  await seedUser({
    email: process.env.SEED_SUPERADMIN_EMAIL || "superadmin@absen.local",
    password: process.env.SEED_SUPERADMIN_PASSWORD || "SuperAdmin123!",
    nip: process.env.SEED_SUPERADMIN_NIP || "SUPER001",
    nama: "Super Admin",
    jabatan: "Super Administrator",
    role: "super_admin",
  });

  await seedUser({
    email: process.env.SEED_ADMIN_EMAIL || "admin@absen.local",
    password: process.env.SEED_ADMIN_PASSWORD || "Admin12345!",
    nip: process.env.SEED_ADMIN_NIP || "ADMIN001",
    nama: "Admin",
    jabatan: "Administrator",
    role: "admin",
  });

  console.log("\nSeeding selesai!");
}

main().catch(console.error);
