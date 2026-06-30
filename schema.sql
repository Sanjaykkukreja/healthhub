-- ════════════════════════════════════════════════════════════
--  HealthHub · Supabase Schema
--  Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────
--  TABLES
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid references auth.users on delete cascade primary key,
  full_name    text,
  avatar_url   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table if not exists public.family_members (
  id             uuid default uuid_generate_v4() primary key,
  owner_id       uuid references auth.users on delete cascade not null,
  name           text not null,
  role           text not null default 'Self',
  age            integer,
  gender         text,
  blood_group    text,
  height         text,
  weight         text,
  bp             text,
  sugar          text,
  hba1c          text,
  vitamin_d      text,
  bmi            decimal(4,1),
  health_score   integer default 80,
  conditions     text[]   default '{}',
  medications    jsonb    default '[]',
  allergies      text[]   default '{}',
  goals          text[]   default '{}',
  family_history text[]   default '{}',
  doctor         text,
  hospital       text,
  next_visit     date,
  insurance      text,
  avatar_color   text     default '#0F5B6E',
  created_at     timestamptz default now(),
  updated_at     timestamptz default now()
);

create table if not exists public.medical_records (
  id                  uuid default uuid_generate_v4() primary key,
  owner_id            uuid references auth.users on delete cascade not null,
  member_id           uuid references public.family_members on delete cascade not null,
  date                date not null,
  type                text not null,
  title               text not null,
  doctor              text,
  hospital            text,
  amount              decimal(10,2),
  summary             text,
  tags                text[]   default '{}',
  priority            text     default 'medium',
  source              text     default 'manual',
  uploaded_file_name  text,
  file_path           text,
  extracted_data      jsonb    default '{}',
  patient_name_on_doc text,
  created_at          timestamptz default now()
);

create table if not exists public.daily_logs (
  id                uuid default uuid_generate_v4() primary key,
  owner_id          uuid references auth.users on delete cascade not null,
  member_id         uuid references public.family_members on delete cascade not null,
  date              date not null,
  feeling           integer check (feeling between 1 and 10),
  symptoms          text[]   default '{}',
  note              text,
  bp                text,
  medications_taken boolean  default true,
  created_at        timestamptz default now(),
  unique (member_id, date)
);

create table if not exists public.health_metrics (
  id           uuid default uuid_generate_v4() primary key,
  owner_id     uuid references auth.users on delete cascade not null,
  member_id    uuid references public.family_members on delete cascade not null,
  date         date not null,
  systolic     integer,
  diastolic    integer,
  weight_kg    decimal(5,2),
  heart_rate   integer,
  steps        integer,
  sleep_hours  decimal(4,2),
  spo2         integer,
  glucose      integer,
  notes        text,
  created_at   timestamptz default now()
);

create table if not exists public.appointments (
  id           uuid default uuid_generate_v4() primary key,
  owner_id     uuid references auth.users on delete cascade not null,
  member_id    uuid references public.family_members on delete cascade not null,
  date         date not null,
  time         time,
  doctor       text,
  hospital     text,
  reason       text,
  status       text default 'upcoming',
  notes        text,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────
create index if not exists idx_records_member   on public.medical_records (member_id, date desc);
create index if not exists idx_records_owner    on public.medical_records (owner_id);
create index if not exists idx_logs_member      on public.daily_logs (member_id, date desc);
create index if not exists idx_metrics_member   on public.health_metrics (member_id, date desc);
create index if not exists idx_members_owner    on public.family_members (owner_id);

-- ─────────────────────────────────────────
--  ROW LEVEL SECURITY
-- ─────────────────────────────────────────
alter table public.profiles        enable row level security;
alter table public.family_members  enable row level security;
alter table public.medical_records enable row level security;
alter table public.daily_logs      enable row level security;
alter table public.health_metrics  enable row level security;
alter table public.appointments    enable row level security;

drop policy if exists "own_profile_select" on public.profiles;
create policy "own_profile_select" on public.profiles for select using (auth.uid() = id);
drop policy if exists "own_profile_insert" on public.profiles;
create policy "own_profile_insert" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "own_profile_update" on public.profiles;
create policy "own_profile_update" on public.profiles for update using (auth.uid() = id);

drop policy if exists "own_members_select" on public.family_members;
create policy "own_members_select" on public.family_members for select using (auth.uid() = owner_id);
drop policy if exists "own_members_insert" on public.family_members;
create policy "own_members_insert" on public.family_members for insert with check (auth.uid() = owner_id);
drop policy if exists "own_members_update" on public.family_members;
create policy "own_members_update" on public.family_members for update using (auth.uid() = owner_id);
drop policy if exists "own_members_delete" on public.family_members;
create policy "own_members_delete" on public.family_members for delete using (auth.uid() = owner_id);

drop policy if exists "own_records_select" on public.medical_records;
create policy "own_records_select" on public.medical_records for select using (auth.uid() = owner_id);
drop policy if exists "own_records_insert" on public.medical_records;
create policy "own_records_insert" on public.medical_records for insert with check (auth.uid() = owner_id);
drop policy if exists "own_records_update" on public.medical_records;
create policy "own_records_update" on public.medical_records for update using (auth.uid() = owner_id);
drop policy if exists "own_records_delete" on public.medical_records;
create policy "own_records_delete" on public.medical_records for delete using (auth.uid() = owner_id);

drop policy if exists "own_logs_select" on public.daily_logs;
create policy "own_logs_select" on public.daily_logs for select using (auth.uid() = owner_id);
drop policy if exists "own_logs_insert" on public.daily_logs;
create policy "own_logs_insert" on public.daily_logs for insert with check (auth.uid() = owner_id);
drop policy if exists "own_logs_update" on public.daily_logs;
create policy "own_logs_update" on public.daily_logs for update using (auth.uid() = owner_id);
drop policy if exists "own_logs_delete" on public.daily_logs;
create policy "own_logs_delete" on public.daily_logs for delete using (auth.uid() = owner_id);

drop policy if exists "own_metrics_select" on public.health_metrics;
create policy "own_metrics_select" on public.health_metrics for select using (auth.uid() = owner_id);
drop policy if exists "own_metrics_insert" on public.health_metrics;
create policy "own_metrics_insert" on public.health_metrics for insert with check (auth.uid() = owner_id);
drop policy if exists "own_metrics_update" on public.health_metrics;
create policy "own_metrics_update" on public.health_metrics for update using (auth.uid() = owner_id);
drop policy if exists "own_metrics_delete" on public.health_metrics;
create policy "own_metrics_delete" on public.health_metrics for delete using (auth.uid() = owner_id);

drop policy if exists "own_appts_select" on public.appointments;
create policy "own_appts_select" on public.appointments for select using (auth.uid() = owner_id);
drop policy if exists "own_appts_insert" on public.appointments;
create policy "own_appts_insert" on public.appointments for insert with check (auth.uid() = owner_id);
drop policy if exists "own_appts_update" on public.appointments;
create policy "own_appts_update" on public.appointments for update using (auth.uid() = owner_id);
drop policy if exists "own_appts_delete" on public.appointments;
create policy "own_appts_delete" on public.appointments for delete using (auth.uid() = owner_id);

-- ─────────────────────────────────────────
--  STORAGE  (uploaded medical documents)
-- ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'medical-documents', 'medical-documents', false, 26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']
) on conflict (id) do nothing;

drop policy if exists "storage_upload" on storage.objects;
create policy "storage_upload" on storage.objects
  for insert with check (bucket_id = 'medical-documents' and auth.uid()::text = (string_to_array(name, '/'))[1]);
drop policy if exists "storage_select" on storage.objects;
create policy "storage_select" on storage.objects
  for select using (bucket_id = 'medical-documents' and auth.uid()::text = (string_to_array(name, '/'))[1]);
drop policy if exists "storage_delete" on storage.objects;
create policy "storage_delete" on storage.objects
  for delete using (bucket_id = 'medical-documents' and auth.uid()::text = (string_to_array(name, '/'))[1]);

-- ─────────────────────────────────────────
--  TRIGGER: auto-create profile on signup
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
--  TRIGGER: auto-update updated_at
-- ─────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at before update on public.profiles       for each row execute procedure public.handle_updated_at();
drop trigger if exists set_members_updated_at on public.family_members;
create trigger set_members_updated_at  before update on public.family_members for each row execute procedure public.handle_updated_at();
