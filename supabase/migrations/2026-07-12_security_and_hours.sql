-- ============================================================================
-- ShowUp — Security fix + verified-hours pipeline migration
-- Date: July 12, 2026
--
-- HOW TO RUN: copy this whole file into the Supabase SQL editor and run it
-- once. It is idempotent — running it again is safe.
--
-- What it does, in order:
--   1. SECURITY: stops anyone from making themselves an admin (via signup
--      metadata or by editing their own profile row).
--   2. Adds the columns the app now uses: profiles.email and
--      external_hour_logs.reflection.
--   3. Admin policies so the hours-approval page and ID-photo viewing work.
--   4. Replaces the signups policy so eligibility, verification, and capacity
--      are enforced by the database (not just the UI).
--   5. Check-in / check-out functions so organizations can verify hours
--      on-site (timestamps are set by the server — they can't be faked).
--   6. Org onboarding: approving an application creates the organization,
--      and the org contact claims it by signing up with the same email.
--
-- AFTER RUNNING: check for admin accounts you don't recognize —
--   select id, first_name, last_name, email, role from public.profiles
--   where role = 'admin';
-- Anyone unexpected in that list should have their role set back to 'adult'.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 0. Helper: is the signed-in user an admin? SECURITY DEFINER so it can read
--    profiles without re-triggering RLS ("infinite recursion detected").
--    (Already exists in most environments; re-created here so this file is
--    self-sufficient.)
-- ────────────────────────────────────────────────────────────────────────────
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


-- ────────────────────────────────────────────────────────────────────────────
-- 1a. SECURITY FIX — signup can no longer mint an admin.
--     The old trigger copied `role` straight from browser-controlled signup
--     metadata, so signUp({ data: { role: 'admin' } }) created an instant
--     admin. Now only 'youth', 'adult', and 'org' are accepted; anything else
--     falls back to 'adult'. Admin accounts are only created by hand in the
--     SQL editor. Also captures the account email onto the profile so admin
--     screens can show it (emails otherwise live only in the auth system).
-- ────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists email text;

-- Backfill emails for accounts created before this migration.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is null;

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
    -- Whitelist: 'admin' (or anything unexpected) from signup metadata is
    -- ignored. This is the fix for the role-escalation hole.
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


-- ────────────────────────────────────────────────────────────────────────────
-- 1b. SECURITY FIX — users can no longer edit their own protected fields.
--     The "own profile" RLS policy lets a user update their own row (that's
--     fine — they should be able to fix a typo in their name), but nothing
--     stopped them changing `role` to 'admin' or `verification_status` to
--     'verified'. RLS policies can't compare old vs. new values, so a
--     BEFORE UPDATE trigger does it: non-admins get an error if they touch a
--     protected column. auth.uid() is null when you run SQL as the project
--     owner in the dashboard, so your own manual edits are never blocked.
-- ────────────────────────────────────────────────────────────────────────────
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

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();


-- ────────────────────────────────────────────────────────────────────────────
-- 2. Reflection column — Mahopac CSD expects a short written reflection with
--    logged service hours. Stored alongside each self-logged entry.
-- ────────────────────────────────────────────────────────────────────────────
alter table public.external_hour_logs
  add column if not exists reflection text;


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Admin access — everything the admin pages need. All idempotent.
-- ────────────────────────────────────────────────────────────────────────────

-- Profiles (needed by /admin ID review; may already exist from an earlier
-- hand-run migration).
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "admins update verification" on public.profiles;
create policy "admins update verification" on public.profiles
  for update using (public.is_admin());

-- Org applications (needed by /admin/org-applications).
drop policy if exists "admins read org_applications" on public.org_applications;
create policy "admins read org_applications" on public.org_applications
  for select using (public.is_admin());

drop policy if exists "admins update org_applications" on public.org_applications;
create policy "admins update org_applications" on public.org_applications
  for update using (public.is_admin());

-- Self-logged hours (needed by the new /admin/hours approval page). Students
-- still can't update their own rows — only admins flip pending → approved.
drop policy if exists "admins read external hours" on public.external_hour_logs;
create policy "admins read external hours" on public.external_hour_logs
  for select using (public.is_admin());

drop policy if exists "admins update external hours" on public.external_hour_logs;
create policy "admins update external hours" on public.external_hour_logs
  for update using (public.is_admin());

-- Storage: admins can view submitted photos. Without these, the "View photo"
-- buttons on the admin pages fail — the existing policies only let people see
-- files in their OWN folder.
drop policy if exists "admins read id photos" on storage.objects;
create policy "admins read id photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'volunteer-id-photos' and public.is_admin());

drop policy if exists "admins read hour photos" on storage.objects;
create policy "admins read hour photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'hour-verification-photos' and public.is_admin());


-- ────────────────────────────────────────────────────────────────────────────
-- 4. Signups — enforce eligibility and capacity in the database.
--    The old "own signups" policy was FOR ALL, which also let students flip
--    their own status to 'accepted'. Replaced with:
--      - read your own signups
--      - create a signup only if can_apply() says you're eligible
--      - update your own signup only to cancel it
-- ────────────────────────────────────────────────────────────────────────────

-- Eligibility rules, enforced at insert time. SECURITY DEFINER so it can read
-- profiles/opportunities/signups without RLS getting in the way.
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
      -- role/verification rules
      and (
        select case
          -- students: the event must be open to youth
          when p.role = 'youth' then o.youth_eligible
          -- adults: must be verified; youth-contact events additionally
          -- require Tier 2 clearance ('cleared' = background check passed)
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
      -- capacity: count active signups against the spot limit
      and (
        select count(*)
        from public.signups s
        where s.opportunity_id = opp and s.status in ('applied', 'accepted')
      ) < o.spots
  );
$$;

drop policy if exists "own signups" on public.signups;

drop policy if exists "read own signups" on public.signups;
create policy "read own signups" on public.signups
  for select using (auth.uid() = volunteer_id);

drop policy if exists "insert own signups" on public.signups;
create policy "insert own signups" on public.signups
  for insert with check (
    auth.uid() = volunteer_id
    and status = 'applied'
    and public.can_apply(opportunity_id)
  );

drop policy if exists "cancel own signups" on public.signups;
create policy "cancel own signups" on public.signups
  for update using (auth.uid() = volunteer_id)
  with check (auth.uid() = volunteer_id and status = 'cancelled');

-- Live "spots left" counts for the Browse page. Anyone may call it; it only
-- reveals aggregate counts, never who signed up.
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


-- ────────────────────────────────────────────────────────────────────────────
-- 5. Check-in / check-out — the verified-hours pipeline.
--    Orgs never write hour_logs directly: these functions verify the org owns
--    the event and stamp times with the server clock, so hours can't be
--    fabricated with a doctored request.
-- ────────────────────────────────────────────────────────────────────────────

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

-- The roster an org sees at check-in time: who signed up, their check-in
-- state, and hours once checked out. Returns only the fields the check-in
-- screen needs — orgs never get raw access to volunteer profiles (birth
-- dates, parent contacts stay private).
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
    and public.owns_opportunity(opp)  -- authorization: your event or nothing
    and s.status in ('applied', 'accepted')
  order by p.last_name, p.first_name;
$$;

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


-- ────────────────────────────────────────────────────────────────────────────
-- 6. Org onboarding — approving an application now provisions the org.
--    Flow: admin clicks Approve → organizations row is created (unowned) →
--    the org contact creates an account with the SAME email → the app calls
--    claim_my_organization() and the row is linked to their login.
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

  -- Create the organization once; re-approving never duplicates it.
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
  -- Link an approved, unowned organization to this login when the emails
  -- match. The email in the JWT is verified by Supabase auth, so this can't
  -- be spoofed by typing someone else's address into a form.
  update public.organizations g
  set owner_id = auth.uid()
  where g.owner_id is null
    and lower(g.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  returning g.id into claimed;

  return claimed;  -- null if nothing matched
end;
$$;
