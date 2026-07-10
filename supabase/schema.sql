-- ShowUp — initial Supabase schema
-- Run in the Supabase SQL editor after creating the project.

-- Volunteer profiles (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('youth', 'adult', 'org', 'admin')),
  first_name text not null,
  last_name text not null,
  birth_date date,
  school text,
  grade text check (grade in ('9th', '10th', '11th', '12th')),
  -- Adult verification tiers
  tier text check (tier in ('general', 'youth-contact')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'cleared', 'rejected')),
  -- Youth parental consent
  parent_name text,
  parent_email text,
  parent_phone text,
  parent_consent boolean not null default false,
  parent_consent_confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Organizations (paid accounts)
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users,
  name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  website text,
  ein text,
  plan text not null default 'community' check (plan in ('community', 'growth')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  mission text,
  created_at timestamptz not null default now()
);

-- Org applications submitted before an account exists
create table public.org_applications (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  website text,
  ein text,
  plan text not null default 'community',
  mission text,
  status text not null default 'new' check (status in ('new', 'approved', 'declined')),
  created_at timestamptz not null default now()
);

-- Volunteer opportunities
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  title text not null,
  description text,
  type text not null,
  location text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  spots int not null default 10,
  youth_eligible boolean not null default true,
  youth_contact boolean not null default false, -- adults need Tier 2 clearance
  status text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Applications from volunteers
create table public.signups (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities on delete cascade,
  volunteer_id uuid not null references public.profiles on delete cascade,
  status text not null default 'applied'
    check (status in ('applied', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (opportunity_id, volunteer_id)
);

-- Check-in / check-out → verified hours
create table public.hour_logs (
  id uuid primary key default gen_random_uuid(),
  signup_id uuid not null references public.signups on delete cascade,
  checked_in_at timestamptz not null,
  checked_out_at timestamptz,
  hours numeric(5, 2) generated always as (
    round(extract(epoch from (checked_out_at - checked_in_at)) / 3600.0, 2)
  ) stored,
  verified_by uuid references auth.users,
  created_at timestamptz not null default now()
);

-- Self-logged external volunteer hours (served with any organization).
-- Verified separately from hour_logs via a supervisor-signed photo artifact.
create table public.external_hour_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  org_name text not null,
  service_date date not null,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  supervisor_name text not null,
  photo_url text, -- storage object path in the 'hour-verification-photos' bucket
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index external_hour_logs_user_idx
  on public.external_hour_logs (user_id, created_at desc);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_applications enable row level security;
alter table public.opportunities enable row level security;
alter table public.signups enable row level security;
alter table public.hour_logs enable row level security;
alter table public.external_hour_logs enable row level security;

-- Admin role check, used by admin-only policies below. SECURITY DEFINER so it
-- runs as its owner and bypasses RLS — this avoids "infinite recursion detected"
-- when a policy on public.profiles needs to read public.profiles.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Volunteers manage their own profile
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Organizations
-- An org owner can read their own row...
create policy "orgs read own" on public.organizations
  for select using (auth.uid() = owner_id);

-- ...admins can read every org...
create policy "admins read orgs" on public.organizations
  for select using (public.is_admin());

-- ...admins can update any org (e.g. approve → status 'active', or suspend)...
create policy "admins update orgs" on public.organizations
  for update using (public.is_admin());

-- ...and anyone (including anonymous visitors) can browse active orgs, which
-- powers the public organizations directory.
create policy "browse active orgs" on public.organizations
  for select using (status = 'active');

-- Anyone can browse open opportunities
create policy "browse opportunities" on public.opportunities
  for select using (status = 'open');

-- Orgs can read all their own opportunities (open, closed, cancelled)
create policy "orgs read own opportunities" on public.opportunities
  for select using (
    auth.uid() = (select owner_id from public.organizations where id = org_id)
  );

-- Orgs can insert opportunities for their own active organization
create policy "orgs insert opportunities" on public.opportunities
  for insert with check (
    auth.uid() = (
      select owner_id from public.organizations
      where id = org_id and status = 'active'
    )
  );

-- Orgs can close or cancel their own opportunities
create policy "orgs update own opportunities" on public.opportunities
  for update using (
    auth.uid() = (select owner_id from public.organizations where id = org_id)
  );

-- Anyone may submit an org application
create policy "submit org application" on public.org_applications
  for insert with check (true);

-- Volunteers see and create their own signups
create policy "own signups" on public.signups
  for all using (auth.uid() = volunteer_id) with check (auth.uid() = volunteer_id);

-- Volunteers can read their own hour logs
create policy "own hours" on public.hour_logs
  for select using (
    exists (
      select 1 from public.signups s
      where s.id = signup_id and s.volunteer_id = auth.uid()
    )
  );

-- Students read only their own self-logged hours...
create policy "read own external hours" on public.external_hour_logs
  for select using (auth.uid() = user_id);

-- ...and insert only rows attributed to themselves. No update/delete policy:
-- a student must not be able to flip their own status to 'approved'.
create policy "insert own external hours" on public.external_hour_logs
  for insert with check (auth.uid() = user_id);

-- Private bucket for supervisor-signed photos (run in the Supabase SQL editor).
insert into storage.buckets (id, name, public)
values ('hour-verification-photos', 'hour-verification-photos', false)
on conflict (id) do nothing;

-- Students upload into a folder named after their uid, and read back only their own.
create policy "upload own hour photos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'hour-verification-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "read own hour photos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'hour-verification-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Auto-create a profile row on signup using the metadata captured in the app
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, role, first_name, last_name, birth_date, school, grade, tier,
    parent_name, parent_email, parent_phone, parent_consent
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'adult'),
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'birth_date', '')::date,
    nullif(new.raw_user_meta_data ->> 'school', ''),
    nullif(new.raw_user_meta_data ->> 'grade', ''),
    nullif(new.raw_user_meta_data ->> 'tier', ''),
    nullif(new.raw_user_meta_data ->> 'parent_name', ''),
    nullif(new.raw_user_meta_data ->> 'parent_email', ''),
    nullif(new.raw_user_meta_data ->> 'parent_phone', ''),
    coalesce((new.raw_user_meta_data ->> 'parent_consent')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
