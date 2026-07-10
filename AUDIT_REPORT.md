# ShowUp App — Full Audit Report
**Date:** July 8, 2026  
**Auditor:** Claude (COO mode)  
**App:** React 19 + Vite 8 + Tailwind CSS v4 + Supabase + vite-plugin-pwa  
**Status:** Supabase IS connected (credentials live in .env.local)

---

## WHAT IS BUILT AND APPEARS COMPLETE

Every file in src/ was read. Here is what's working:

**Pages (13 total, all routed in App.jsx):**

- **Landing.jsx** — Hero, "How it works," student portfolio mockup, safety tier cards, org CTA. Fully done.
- **VolunteerSignup.jsx** — 4-step form: role selection → personal details (school/grade for youth, tier for adults) → consent/parent info → account creation. Writes to Supabase auth with full metadata. Demo mode fallback. Complete.
- **SignIn.jsx** — Email/password sign-in, forgot password flow, redirects back to origin page after login. Demo mode. Complete.
- **OrgApply.jsx** — Bilingual (English/Spanish) intake form. Writes to `org_applications` table. Complete.
- **OrgSignup.jsx** — Plan selection (Community $29/mo, Growth $79/mo) + application form. Also writes to `org_applications`. Complete.
- **Browse.jsx** — Reads real opportunities from Supabase, falls back to mock data (mockData.js has 6 sample opportunities). Type, date, and location filters. Apply button creates a `signups` row. Tracks which opportunities the signed-in user has already applied to. Complete.
- **Dashboard.jsx** — Student view: total verified hours, bar chart by school year, upcoming shifts, recently verified hours, self-logged external hours with pending/approved/rejected badges. Adult view: simplified (no hours, just upcoming). Skeleton loader. Error state. Demo mode with Maya Rodriguez data. Complete.
- **LogHours.jsx** — Students self-log external hours: org name, date, hours, supervisor name, photo upload to Supabase Storage (`hour-verification-photos` bucket). Guards against non-students. Full validation. Includes full SQL migration in comments. Complete.
- **VerifyIdentity.jsx** — Adults upload a government ID photo to Supabase Storage (`volunteer-id-photos` bucket), updates `id_photo_url` on their profile. Guards against students and already-verified adults. Includes full SQL migration in comments. Complete.
- **AdminReview.jsx** — Admin-only: lists pending adult ID verifications, shows signed photo (via signed URL), links to NY Sex Offender Registry pre-filled with name, approve/reject buttons. Guards non-admins to /dashboard. Includes SQL migration in comments. Complete.
- **AdminOrgApplications.jsx** — Admin-only: lists org applications from `org_applications` table, approve/decline buttons, displays org details, mission, plan, contact info. Guards non-admins. Complete.
- **Support.jsx** — Amazon wish list CTA + "Other ways to give" email section. Links to https://a.co/099AnZI7. Complete.
- **404 page** — Inline in App.jsx. "That page didn't show up." ✓

**Components:**
- **Layout.jsx** — Sticky nav, mobile hamburger, auth-aware (Sign out vs Sign up/Log in), footer with 2026 copyright. Complete.
- **ProtectedRoute.jsx** — Redirects unauthenticated users to /signin, preserves destination for post-login redirect. Demo mode bypass. Complete.
- **AuthContext.jsx** — Session persistence, auto-refresh, cross-tab sync, force-clear on offline sign-out. Complete.
- **supabase.js** — Client with demo mode detection. Complete.
- **mockData.js** — 6 sample opportunities across all types. Complete.

**Database (supabase/schema.sql):**
All 7 tables exist and are defined: `profiles`, `organizations`, `org_applications`, `opportunities`, `signups`, `hour_logs`, `external_hour_logs`. Trigger (`on_auth_user_created`) auto-creates a profile row on signup. RLS is enabled on all tables.

---

## CRITICAL BUGS — FIX THESE BEFORE ANYTHING ELSE

### Bug 1 — Admin pages are broken in production (the one you asked about)

The `org_applications` table only has one RLS policy in schema.sql:
```sql
-- Only this exists:
create policy "submit org application" on public.org_applications
  for insert with check (true);
```

There is NO SELECT policy and NO UPDATE policy for admins.

When you sign in as admin and visit `/admin/org-applications`, Supabase returns an empty array (or error) because no policy allows admins to read the table. The Approve/Decline buttons fail for the same reason.

**Also missing:** The `is_admin()` helper function that both admin pages depend on for their own RLS policies. It's referenced in the migration comments in AdminReview.jsx and AdminOrgApplications.jsx but is NOT in schema.sql.

**Also missing:** Admin read-all and admin update policies on the `profiles` table. Without them, AdminReview.jsx cannot load the list of pending volunteer IDs (it can read its own profile row for the gate check, but not anyone else's).

**Fix — run this SQL in your Supabase SQL editor:**

```sql
-- Step 1: Create the is_admin() helper (avoids RLS infinite recursion)
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

-- Step 2: Admin access to profiles
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "admins update verification" on public.profiles;
create policy "admins update verification" on public.profiles
  for update using (public.is_admin());

-- Step 3: Admin access to org_applications
drop policy if exists "admins read org_applications" on public.org_applications;
create policy "admins read org_applications" on public.org_applications
  for select using (public.is_admin());

drop policy if exists "admins update org_applications" on public.org_applications;
create policy "admins update org_applications" on public.org_applications
  for update using (public.is_admin());
```

### Bug 2 — The volunteer-id-photos storage bucket is missing

schema.sql only creates the `hour-verification-photos` bucket. The `volunteer-id-photos` bucket (used by VerifyIdentity.jsx and AdminReview.jsx) is documented in a migration comment inside VerifyIdentity.jsx but was never added to schema.sql. If adults have tried to submit their ID, those uploads are failing silently.

**Fix — also run this in the Supabase SQL editor:**
```sql
-- Create the private bucket for ID photos
insert into storage.buckets (id, name, public)
values ('volunteer-id-photos', 'volunteer-id-photos', false)
on conflict (id) do nothing;

-- Adults can upload to their own folder only
drop policy if exists "upload own id photo" on storage.objects;
create policy "upload own id photo" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'volunteer-id-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Adults can read back only their own upload
drop policy if exists "read own id photo" on storage.objects;
create policy "read own id photo" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'volunteer-id-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

### Bug 3 — The `id_photo_url` column may be missing from profiles

schema.sql does not include `id_photo_url` on the profiles table. It's documented in a migration comment in VerifyIdentity.jsx. Run:
```sql
alter table public.profiles
  add column if not exists id_photo_url text;
```

### Bug 4 — The "Export report" button is dead

In Dashboard.jsx (line ~357), there's an "Export report" button in the Hours by school year section with no `onClick` handler. It renders but does nothing. This is the most visible broken element for a signed-in student.

### Bug 5 — Password reset return flow is incomplete

SignIn.jsx sends a reset email that redirects back to `/signin`. But there's no code to detect the `type=recovery` URL hash that Supabase appends, and no "set new password" form. Users who click the reset link land on the regular sign-in form and are confused. This needs a `supabase.auth.onAuthStateChange` listener that catches `PASSWORD_RECOVERY` events.

---

## WHAT'S MISSING THAT THE APP WILL NEED

These are not bugs in existing code — they are features that don't exist yet.

**1. No admin link in the nav**  
The admin pages (`/admin`, `/admin/org-applications`) are fully built but you can only reach them by typing the URL directly. There's no admin menu in Layout.jsx. Since you're the only admin right now, you know the URL — but this should be added.

**2. No org dashboard or opportunity posting**  
When an approved organization logs in, they see a simplified volunteer dashboard. There is no UI for organizations to:
- Post new opportunities
- See who signed up for their events
- Check volunteers in and out

The `opportunities` table exists in the schema and Browse.jsx reads from it, but there's no organization-facing form to create opportunity rows. No one can post real opportunities yet.

**3. No check-in / check-out UI**  
The `hour_logs` table exists and Dashboard.jsx reads from it, but there's no page where an org staff member can scan a volunteer in and out. This is the core mechanism that makes hours "verified" rather than "self-reported." Without it, hour_logs will always be empty.

**4. No Stripe billing**  
Plans are selected on OrgSignup.jsx but no payment happens. The `plan` field is stored in `org_applications` but there's no payment gate before or after approval.

**5. No Checkr integration**  
Tier 2 adult volunteers consent to a background check on signup, but nothing is actually triggered. The app tells them "being processed" but there's no third-party integration.

**6. No email notifications**  
Three places in the UI promise emails that aren't sent:
- "We've emailed [parentEmail] to confirm parental consent" (VolunteerSignup.jsx)
- "We'll reach out to [email] within 2 business days" (OrgSignup.jsx)
- "You'll get an email when you're ready to go" (VerifyIdentity.jsx)

None of these are wired up. Supabase can send some of these via Database Webhooks or Edge Functions.

**7. No organizations RLS policies at all**  
The `organizations` table has RLS enabled but zero policies in schema.sql. No one can read or write to it.

**8. No hour export (CSV/PDF)**  
The "Export report" button exists in the UI but is dead (Bug 4 above). Students can't download their service record.

---

## TABLE OF EVERYTHING

| File | Status |
|------|--------|
| Landing.jsx | ✅ Complete |
| VolunteerSignup.jsx | ✅ Complete |
| SignIn.jsx | ✅ Complete (password reset return broken) |
| OrgApply.jsx | ✅ Complete |
| OrgSignup.jsx | ✅ Complete |
| Browse.jsx | ✅ Complete |
| Dashboard.jsx | ✅ Complete (Export button dead) |
| LogHours.jsx | ✅ Complete |
| VerifyIdentity.jsx | ✅ Complete (bucket may be missing) |
| AdminReview.jsx | ✅ UI complete — blocked by missing RLS |
| AdminOrgApplications.jsx | ✅ UI complete — blocked by missing RLS |
| Support.jsx | ✅ Complete |
| Layout.jsx | ✅ Complete (no admin link) |
| ProtectedRoute.jsx | ✅ Complete |
| AuthContext.jsx | ✅ Complete |
| supabase.js | ✅ Complete |
| mockData.js | ✅ Complete |
| supabase/schema.sql | ⚠️ Missing: id_photo_url column, volunteer-id-photos bucket, is_admin() function, admin policies on profiles and org_applications, organizations policies |

---

## THE SINGLE MOST IMPORTANT THING TO DO NEXT

**Run the 5-part SQL block in Bug 1 above.** That one paste into the Supabase SQL editor unlocks both admin pages — which means you can see every org application that has already come in through the live form. Until you do this, you are blind to everything submitted.

Then run Bug 2 and Bug 3 fixes so adult ID verification works end to end.

Everything else — Stripe, Checkr, check-in/out, email notifications, org opportunity posting — is "after MVP" per the README, and nothing blocks a real pilot launch without them. But the admin tools are unusable without the RLS fix.

---

*App is installable as a PWA (vite-plugin-pwa configured). Supabase project: lwsdrfbshfbvwnyccbxy. Deploy target: Vercel with vercel.json rewrite rule documented in README.*
