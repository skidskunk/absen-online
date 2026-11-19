-- ============================================================
-- FIX: TABEL DULU, BARU FUNGSI
-- ============================================================
create extension if not exists "pgcrypto";

-- 1. TABEL profiles DULU
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nip text unique not null,
  nama text not null,
  email text not null,
  jabatan text not null,
  role text not null default 'user' check (role in ('super_admin','admin','user')),
  is_default_password boolean default true,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. TABEL attendances
create table if not exists public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  nip text not null,
  nama text,
  jabatan text,
  tanggal date not null,
  status_datang text check (status_datang in ('WFO','WFH','DINAS','CUTI','SAKIT')),
  lat_datang double precision,
  lng_datang double precision,
  jam_datang timestamptz,
  status_pulang text,
  lat_pulang double precision,
  lng_pulang double precision,
  jam_pulang timestamptz,
  uraian_kinerja text,
  output_kinerja text,
  dist_m double precision default 0,
  in_radius boolean default true,
  created_at timestamptz default now(),
  unique (nip, tanggal)
);

create index if not exists idx_attendances_nip_tanggal on public.attendances(nip, tanggal);
create index if not exists idx_attendances_tanggal on public.attendances(tanggal);

-- 3. TABEL app_config
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz default now(),
  updated_by text
);

insert into public.app_config (key, value) values
  ('kantor_lat', '-5.144764422898236'),
  ('kantor_lng', '119.45574635175397'),
  ('kantor_nama', 'Kantor Dinas - Mamuju'),
  ('radius_meter', '200')
on conflict (key) do nothing;

-- 4. TABEL audit_logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  actor_nip text,
  actor_role text,
  action text not null,
  detail text
);

create index if not exists idx_audit_logs_action on public.audit_logs(action);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);

-- ============================================================
-- 5. BARU BIKIN FUNGSI, SETELAH TABEL ADA
-- ============================================================
create or replace function public.get_my_role()
returns text
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.get_my_nip()
returns text
language sql
security definer
stable
as $$
  select nip from public.profiles where id = auth.uid() limit 1;
$$;

-- ============================================================
-- 6. RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.attendances enable row level security;
alter table public.app_config enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
drop policy if exists "profiles_insert_service" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_super_admin" on public.profiles;
drop policy if exists "attendances_select_own_or_admin" on public.attendances;
drop policy if exists "attendances_insert_own" on public.attendances;
drop policy if exists "attendances_update_own_or_admin" on public.attendances;
drop policy if exists "attendances_delete_super_admin" on public.attendances;
drop policy if exists "app_config_select_all_login" on public.app_config;
drop policy if exists "app_config_update_super_admin" on public.app_config;
drop policy if exists "audit_logs_select_admin" on public.audit_logs;
drop policy if exists "audit_logs_insert_all_login" on public.audit_logs;

create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.get_my_role() in ('admin','super_admin'));

create policy "profiles_insert_service" on public.profiles
  for insert with check (false);

create policy "profiles_update_admin" on public.profiles
  for update using (public.get_my_role() in ('admin','super_admin') or auth.uid() = id);

create policy "profiles_delete_super_admin" on public.profiles
  for delete using (public.get_my_role() = 'super_admin');

create policy "attendances_select_own_or_admin" on public.attendances
  for select using (nip = public.get_my_nip() or public.get_my_role() in ('admin','super_admin'));

create policy "attendances_insert_own" on public.attendances
  for insert with check (nip = public.get_my_nip() or public.get_my_role() in ('admin','super_admin'));

create policy "attendances_update_own_or_admin" on public.attendances
  for update using (nip = public.get_my_nip() or public.get_my_role() in ('admin','super_admin'));

create policy "attendances_delete_super_admin" on public.attendances
  for delete using (public.get_my_role() = 'super_admin');

create policy "app_config_select_all_login" on public.app_config
  for select using (auth.role() = 'authenticated');

create policy "app_config_update_super_admin" on public.app_config
  for update using (public.get_my_role() = 'super_admin');

create policy "audit_logs_select_admin" on public.audit_logs
  for select using (public.get_my_role() in ('admin','super_admin'));

create policy "audit_logs_insert_all_login" on public.audit_logs
  for insert with check (auth.role() = 'authenticated');

-- ============================================================
-- 7. RPC CLEAR & UPDATE LOKASI
-- ============================================================
create or replace function public.clear_attendances(p_confirm_text text)
returns json
language plpgsql
security definer
as $$
declare v_role text; v_nip text; v_count int;
begin
  select role, nip into v_role, v_nip from public.profiles where id = auth.uid();
  if v_role is distinct from 'super_admin' then
    raise exception 'Hanya Super Admin yang bisa mengosongkan database.';
  end if;
  if p_confirm_text is distinct from 'HAPUS SEMUA' then
    raise exception 'Konfirmasi salah. Ketik HAPUS SEMUA.';
  end if;
  select count(*) into v_count from public.attendances;
  truncate table public.attendances restart identity cascade;
  insert into public.audit_logs (actor_nip, actor_role, action, detail)
  values (v_nip, v_role, 'CLEAR_DATABASE', 'Mengosongkan ' || v_count || ' baris attendances');
  return json_build_object('ok', true, 'deleted', v_count);
end;
$$;

create or replace function public.update_office_config(p_lat text, p_lng text, p_nama text, p_radius text)
returns json
language plpgsql
security definer
as $$
declare v_role text; v_nip text; v_old_lat text; v_old_radius text;
begin
  select role, nip into v_role, v_nip from public.profiles where id = auth.uid();
  if v_role is distinct from 'super_admin' then
    raise exception 'Hanya Super Admin yang bisa mengubah lokasi.';
  end if;
  select value into v_old_lat from public.app_config where key='kantor_lat';
  select value into v_old_radius from public.app_config where key='radius_meter';
  update public.app_config set value = p_lat, updated_at = now(), updated_by = v_nip where key='kantor_lat';
  update public.app_config set value = p_lng, updated_at = now(), updated_by = v_nip where key='kantor_lng';
  update public.app_config set value = p_nama, updated_at = now(), updated_by = v_nip where key='kantor_nama';
  update public.app_config set value = p_radius, updated_at = now(), updated_by = v_nip where key='radius_meter';
  insert into public.audit_logs (actor_nip, actor_role, action, detail)
  values (v_nip, v_role, 'UPDATE_LOKASI_KANTOR',
    'Lat ' || v_old_lat || ' -> ' || p_lat || ', Radius ' || v_old_radius || 'm -> ' || p_radius || 'm, Nama: ' || p_nama);
  return json_build_object('ok', true);
end;
$$;

-- 8. TRIGGER updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();


-- ============================================================
-- 9. GRANT PRIVILEGES (WAJIB: BERIKAN AKSES KE ROLES SUPABASE)
-- ============================================================
grant usage on schema public to postgres, anon, authenticated, service_role;

grant all privileges on all tables in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all functions in schema public to postgres, anon, authenticated, service_role;
grant all privileges on all sequences in schema public to postgres, anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
