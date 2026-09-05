-- Snoring Child OSA Screening - Supabase schema
-- Run this file once in Supabase Dashboard > SQL Editor.
-- The Supabase Edge Function is the only database client. Browser roles receive
-- no table privileges; the server-side Supabase secret key uses service_role.

begin;

create table if not exists public.users (
  user_id text primary key,
  role text not null default 'parent',
  email text not null default '',
  display_name text not null default '',
  phone text not null default '',
  status text not null default 'active',
  created_at timestamptz,
  last_login_at timestamptz
);

create table if not exists public.auth_otps (
  otp_id text primary key,
  email text not null default '',
  otp_hash text not null default '',
  expires_at timestamptz,
  used_at timestamptz,
  created_at timestamptz
);

create table if not exists public.sessions (
  session_id text primary key,
  user_id text not null default '',
  token_hash text not null default '',
  expires_at timestamptz,
  created_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.children (
  child_id text primary key,
  parent_id text not null default '',
  child_code text not null default '',
  child_name text not null default '',
  nickname text not null default '',
  sex text not null default '',
  birth_date date,
  age_years numeric,
  weight_kg numeric,
  height_cm numeric,
  bmi numeric,
  tonsil_size text not null default '',
  adenoid_xray_result text not null default '',
  child_cid_number text not null default '',
  comorbidities_json jsonb,
  consent_version text not null default '',
  notes text not null default '',
  created_at timestamptz,
  updated_at timestamptz
);

create table if not exists public.screenings (
  screening_id text primary key,
  child_id text not null default '',
  parent_id text not null default '',
  submitted_at timestamptz,
  core_answers_json jsonb,
  osa18_answers_json jsonb,
  risk_factors_json jsonb,
  osa18_total integer,
  osa18_group text not null default '',
  risk_level text not null default '',
  recommendation text not null default '',
  clinical_status text not null default '',
  reviewer_notes text not null default '',
  updated_at timestamptz
);

create table if not exists public.videos (
  video_id text primary key,
  screening_id text not null default '',
  child_id text not null default '',
  parent_id text not null default '',
  storage_path text not null default '',
  file_name text not null default '',
  mime_type text not null default '',
  size_bytes bigint,
  uploaded_at timestamptz,
  upload_status text not null default '',
  ai_status text not null default '',
  ai_result_json jsonb,
  ai_confidence numeric,
  review_status text not null default '',
  reviewer_notes text not null default '',
  updated_at timestamptz
);

create table if not exists public.audit_logs (
  log_id text primary key,
  actor_user_id text not null default '',
  action text not null default '',
  target_type text not null default '',
  target_id text not null default '',
  created_at timestamptz,
  detail_json jsonb
);

create index if not exists users_email_idx on public.users (lower(email));
create index if not exists auth_otps_email_created_at_idx on public.auth_otps (email, created_at desc);
create unique index if not exists sessions_token_hash_idx on public.sessions (token_hash);
create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists children_parent_id_idx on public.children (parent_id);
create index if not exists children_cid_idx on public.children (child_cid_number) where child_cid_number <> '';
create index if not exists screenings_parent_submitted_idx on public.screenings (parent_id, submitted_at desc);
create index if not exists screenings_child_id_idx on public.screenings (child_id);
create index if not exists screenings_risk_level_idx on public.screenings (risk_level);
create index if not exists screenings_clinical_status_idx on public.screenings (clinical_status);
create index if not exists videos_parent_uploaded_idx on public.videos (parent_id, uploaded_at desc);
create index if not exists videos_screening_id_idx on public.videos (screening_id);
create index if not exists videos_ai_status_idx on public.videos (ai_status);
create index if not exists videos_review_status_idx on public.videos (review_status);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.users enable row level security;
alter table public.auth_otps enable row level security;
alter table public.sessions enable row level security;
alter table public.children enable row level security;
alter table public.screenings enable row level security;
alter table public.videos enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table public.users from anon, authenticated;
revoke all on table public.auth_otps from anon, authenticated;
revoke all on table public.sessions from anon, authenticated;
revoke all on table public.children from anon, authenticated;
revoke all on table public.screenings from anon, authenticated;
revoke all on table public.videos from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select, insert, update, delete on table public.users to service_role;
grant select, insert, update, delete on table public.auth_otps to service_role;
grant select, insert, update, delete on table public.sessions to service_role;
grant select, insert, update, delete on table public.children to service_role;
grant select, insert, update, delete on table public.screenings to service_role;
grant select, insert, update, delete on table public.videos to service_role;
grant select, insert, update, delete on table public.audit_logs to service_role;

-- Ask PostgREST to see the new schema immediately.
notify pgrst, 'reload schema';

commit;
