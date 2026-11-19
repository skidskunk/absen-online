export type UserRole = "super_admin" | "admin" | "user";

export type StatusDatang = "WFO" | "WFH" | "DINAS" | "CUTI" | "SAKIT";

export interface Profile {
  id: string; // uuid PK FK to auth.users(id)
  nip: string;
  nama: string;
  email: string;
  jabatan: string;
  role: UserRole;
  is_default_password: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string; // uuid PK
  user_id?: string | null;
  nip: string;
  nama?: string | null;
  jabatan?: string | null;
  tanggal: string; // YYYY-MM-DD
  status_datang: StatusDatang | null;
  lat_datang?: number | null;
  lng_datang?: number | null;
  jam_datang?: string | null;
  status_pulang?: string | null;
  lat_pulang?: number | null;
  lng_pulang?: number | null;
  jam_pulang?: string | null;
  uraian_kinerja?: string | null;
  output_kinerja?: string | null;
  dist_m: number;
  in_radius: boolean;
  created_at?: string;
}

export interface AppConfig {
  key: string;
  value: string;
  updated_at?: string;
  updated_by?: string | null;
}

export interface AuditLog {
  id: string;
  created_at: string;
  actor_nip?: string | null;
  actor_role?: string | null;
  action: string;
  detail?: string | null;
}

export interface OfficeConfig {
  kantorLat: number;
  kantorLng: number;
  kantorNama: string;
  radiusMeter: number;
}
