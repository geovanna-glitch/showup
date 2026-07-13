-- ============================================================================
-- ShowUp — complete Supabase schema (fresh install)
--
-- Run this in the Supabase SQL editor when setting up a NEW project. It
-- creates every table, policy, bucket, and function the app uses.
--
-- Already-running projects should instead run the files in
-- supabase/migrations/ (each is idempotent and safe to re-run).
--
-- After running, create your admin account: sign up normally in the app,
-- then in the SQL editor run
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Tables
-- ────────────────────────────────────────────────────────────────────────────

-- Volunteer profiles (linked to auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('youth', 'adult', 'org', 'admin')),
  email text,
  first_name text not null,
  last_name text not null,
  birth_date date,
  school text,
  grade text check (grade in ('9th', '10th', '11th', '12th')),
  -- Adult verification tiers
  tier text check (tier in ('general', 'youth-contact')),
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'cleared', 'rejected')),
  -- Government-ID photo submitted for verification (private storage path)
  id_photo_url text,
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
  duties text, -- what volunteers will actually do
  type text not null,
  location text not null, -- town, e.g. "Mahopac, NY"
  address text, -- street address
  address_detail text, -- floor / room / building
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  arrive_by timestamptz, -- volunteers' "be there by" (often before the public start)
  spots int not null default 10,
  supervisor_name text, -- who volunteers report to that day
  supervisor_phone text, -- parents can call with questions
  what_to_bring text,
  food_provided boolean not null default false,
  food_sponsor text, -- only meaningful when food_provided
  accessibility_notes text,
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

-- Check-in / check-out → verified hours. Rows are ONLY created through the
-- org_check_in / org_check_out functions below, which stamp server time —
-- there is deliberately no insert/update policy on this table.
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
-- Verified via a supervisor-signed photo artifact plus a written reflection,
-- reviewed on /admin/hours.
create table public.external_hour_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  org_name text not null,
  service_date date not null,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  supervisor_name text not null,
  photo_url text, -- storage object path in the 'hour-verification-photos' bucket
  reflection text, -- student's written reflection (Mahopac CSD requirement)
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index external_hour_logs_user_idx
  on public.external_hour_logs (user_id, created_at desc);

-- ────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ────────────────────────────────────────────────────────────────────────────
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

-- ── Profiles ────────────────────────────────────────────────────────────────

-- Volunteers manage their own profile. Protected fields (role, verification
-- status, tier, consent) are locked by the protect_profile_columns trigger
-- below — RLS alone can't compare old vs. new values.
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "admins read all profiles" on public.profiles
  for select using (public.is_admin());

create policy "admins update verification" on public.profiles
  for update using (public.is_admin());

-- Blocks non-admins from changing security-sensitive columns on their own
-- row (e.g. promoting themselves to admin or self-verifying).
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- Dashboard / service-role sessions have no auth.uid(); let them through.
  if auth.uid() is null then
    return new;
  end if;

  if not public.is_admin() then
    if new.role is distinct from old.role
      or new.verification_status is distinct from old.verification_status
      or new.tier is distinct from old.tier
      or new.email is distinct from old.email
      or new.parent_consent is distinct from old.parent_consent
      or new.parent_consent_confirmed_at is distinct from old.parent_consent_confirmed_at
    then
      raise exception 'These account fields can only be changed by a ShowUp administrator.';
    end if;
  end if;

  return new;
end;
$$;

create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ── Organizations ───────────────────────────────────────────────────────────

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

-- ── Opportunities ───────────────────────────────────────────────────────────

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

-- ── Org applications ────────────────────────────────────────────────────────

-- Anyone may submit an org application
create policy "submit org application" on public.org_applications
  for insert with check (true);

create policy "admins read org_applications" on public.org_applications
  for select using (public.is_admin());

create policy "admins update org_applications" on public.org_applications
  for update using (public.is_admin());

-- ── Signups ─────────────────────────────────────────────────────────────────

-- Eligibility rules, enforced at insert time so the UI can never be bypassed:
-- event open and in the future, youth only on youth-eligible events, adults
-- verified (Tier 2 cleared for youth-contact events), and spots available.
create or replace function public.can_apply(opp uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.opportunities o
    where o.id = opp
      and o.status = 'open'
      and o.starts_at > now()
      and (
        select case
          when p.role = 'youth' then o.youth_eligible
          when p.role = 'adult' then
            p.verification_status in ('verified', 'cleared')
            and (
              not o.youth_contact
              or (p.tier = 'youth-contact' and p.verification_status = 'cleared')
            )
          else false
        end
        from public.profiles p
        where p.id = auth.uid()
      )
      and (
        select count(*)
        from public.signups s
        where s.opportunity_id = opp and s.status in ('applied', 'accepted')
      ) < o.spots
  );
$$;

create policy "read own signups" on public.signups
  for select using (auth.uid() = volunteer_id);

create policy "insert own signups" on public.signups
  for insert with check (
    auth.uid() = volunteer_id
    and status = 'applied'
    and public.can_apply(opportunity_id)
  );

-- Volunteers may only cancel — never self-accept.
create policy "cancel own signups" on public.signups
  for update using (auth.uid() = volunteer_id)
  with check (auth.uid() = volunteer_id and status = 'cancelled');

-- Live "spots left" counts for the Browse page (aggregate only — never
-- reveals who signed up).
create or replace function public.signup_counts(opp_ids uuid[])
returns table (opportunity_id uuid, taken bigint)
language sql
security definer
stable
set search_path = public
as $$
  select s.opportunity_id, count(*)
  from public.signups s
  where s.opportunity_id = any(opp_ids)
    and s.status in ('applied', 'accepted')
  group by s.opportunity_id;
$$;

-- ── Hour logs (verified via check-in/out) ───────────────────────────────────

-- Volunteers can read their own hour logs
create policy "own hours" on public.hour_logs
  for select using (
    exists (
      select 1 from public.signups s
      where s.id = signup_id and s.volunteer_id = auth.uid()
    )
  );

create or replace function public.owns_opportunity(opp uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.opportunities o
    join public.organizations g on g.id = o.org_id
    where o.id = opp and g.owner_id = auth.uid()
  );
$$;

-- The roster an org sees at check-in time. Returns only what the check-in
-- screen needs — orgs never get raw profile access (birth dates and parent
-- contacts stay private).
create or replace function public.org_roster(opp uuid)
returns table (
  signup_id uuid,
  volunteer_id uuid,
  first_name text,
  last_name text,
  role text,
  grade text,
  signup_status text,
  hour_log_id uuid,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  hours numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.id, s.volunteer_id, p.first_name, p.last_name, p.role, p.grade, s.status,
    h.id, h.checked_in_at, h.checked_out_at, h.hours
  from public.signups s
  join public.profiles p on p.id = s.volunteer_id
  left join public.hour_logs h on h.signup_id = s.id
  where s.opportunity_id = opp
    and public.owns_opportunity(opp)
    and s.status in ('applied', 'accepted')
  order by p.last_name, p.first_name;
$$;

-- Check-in/out stamp server time so hours can't be fabricated by the client.
create or replace function public.org_check_in(signup uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  opp uuid;
  log_id uuid;
begin
  select s.opportunity_id into opp from public.signups s where s.id = signup;
  if opp is null or not public.owns_opportunity(opp) then
    raise exception 'You can only check in volunteers for your own opportunities.';
  end if;

  if exists (
    select 1 from public.hour_logs h
    where h.signup_id = signup and h.checked_out_at is null
  ) then
    raise exception 'This volunteer is already checked in.';
  end if;

  insert into public.hour_logs (signup_id, checked_in_at, verified_by)
  values (signup, now(), auth.uid())
  returning id into log_id;

  -- Showing up implies acceptance.
  update public.signups set status = 'accepted'
  where id = signup and status = 'applied';

  return log_id;
end;
$$;

create or replace function public.org_check_out(signup uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  opp uuid;
begin
  select s.opportunity_id into opp from public.signups s where s.id = signup;
  if opp is null or not public.owns_opportunity(opp) then
    raise exception 'You can only check out volunteers for your own opportunities.';
  end if;

  update public.hour_logs
  set checked_out_at = now()
  where signup_id = signup and checked_out_at is null;

  if not found then
    raise exception 'This volunteer is not checked in.';
  end if;
end;
$$;

-- ── External hour logs (self-logged, reviewed by an admin) ──────────────────

-- Students read only their own self-logged hours...
create policy "read own external hours" on public.external_hour_logs
  for select using (auth.uid() = user_id);

-- ...and insert only rows attributed to themselves. No update/delete policy
-- for students: they must not be able to flip their own status to 'approved'.
create policy "insert own external hours" on public.external_hour_logs
  for insert with check (auth.uid() = user_id);

create policy "admins read external hours" on public.external_hour_logs
  for select using (public.is_admin());

create policy "admins update external hours" on public.external_hour_logs
  for update using (public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- Storage — two private buckets. Uploaders write into a folder named after
-- their own uid; admins can view everything for review.
-- ────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('hour-verification-photos', 'hour-verification-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('volunteer-id-photos', 'volunteer-id-photos', false)
on conflict (id) do nothing;

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

create policy "upload own id photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'volunteer-id-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "read own id photo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'volunteer-id-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins read id photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'volunteer-id-photos' and public.is_admin());

create policy "admins read hour photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'hour-verification-photos' and public.is_admin());

-- ────────────────────────────────────────────────────────────────────────────
-- Signup trigger — creates a profile row from signup metadata. The role is
-- whitelisted: 'admin' (or anything unexpected) coming from the browser is
-- ignored and falls back to 'adult'. Admin accounts are created only by hand.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, role, email, first_name, last_name, birth_date, school, grade, tier,
    parent_name, parent_email, parent_phone, parent_consent
  )
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'role' in ('youth', 'adult', 'org')
        then new.raw_user_meta_data ->> 'role'
      else 'adult'
    end,
    new.email,
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

-- ────────────────────────────────────────────────────────────────────────────
-- Org onboarding — approving an application provisions the organization; the
-- org contact then claims it by creating an account with the same email.
-- ────────────────────────────────────────────────────────────────────────────
create or replace function public.approve_org_application(app uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can approve applications.';
  end if;

  update public.org_applications set status = 'approved' where id = app;

  insert into public.organizations
    (name, contact_name, email, phone, website, ein, plan, status, mission)
  select
    a.org_name, a.contact_name, a.email, a.phone, a.website, a.ein,
    case when a.plan in ('community', 'growth') then a.plan else 'community' end,
    'active', a.mission
  from public.org_applications a
  where a.id = app
    and not exists (
      select 1 from public.organizations g
      where lower(g.email) = lower(a.email)
    );
end;
$$;

create or replace function public.claim_my_organization()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed uuid;
begin
  -- The JWT email is verified by Supabase auth — it can't be spoofed by
  -- typing someone else's address into a form.
  update public.organizations g
  set owner_id = auth.uid()
  where g.owner_id is null
    and lower(g.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  returning g.id into claimed;

  return claimed;
end;
$$;
