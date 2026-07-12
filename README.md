# ShowUp

Community volunteer marketplace by **Links of Love Inc.** (Mahopac, NY). Volunteers sign up
free; organizations pay to post opportunities, manage signups, and verify hours. Built around
youth volunteers (grades 9–12) building a 4-year verified service portfolio, with a tiered
safety system for adult volunteers.

## Stack

- React + Vite
- Tailwind CSS v4
- Supabase (auth + database)
- vite-plugin-pwa (installable on phone home screens)
- Deploy target: Vercel

## Run it

```bash
npm install
npm run dev
```

Without Supabase credentials the app runs in **demo mode** — every flow works with simulated
data so you can click through signup, browsing, and the dashboard.

## Connect Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Run `supabase/schema.sql` in the SQL editor — it creates every table, RLS policy,
   storage bucket, and function the app uses (a fresh project needs only this one file).
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from
   Project Settings → API.
4. Create your admin account: sign up in the app, then in the SQL editor run
   `update public.profiles set role = 'admin' where email = 'you@example.com';`

**Already-running projects:** don't re-run `schema.sql`. Instead run the files in
`supabase/migrations/` (each is idempotent — safe to run twice). Latest:
`2026-07-12_security_and_hours.sql` (security fix + verified-hours pipeline).

## Deploy to Vercel

Import the repo in Vercel, framework preset **Vite**, and add the two `VITE_SUPABASE_*`
environment variables. Add a rewrite so client-side routes work — `vercel.json`:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

## Volunteer safety model

| Who | Requirement |
| --- | --- |
| Youth (under 18) | Parental consent captured at signup |
| Adult Tier 1 (general) | ID verification, no direct child contact |
| Adult Tier 2 (youth-contact) | Background check must clear before activation |

## Roadmap after MVP

- Email notifications (parental consent confirmation, approval notices) via an
  Edge Function + email provider
- Checkr integration for Tier 2 background checks
- Stripe billing for organization plans
- Volunteer-facing cancel button for signups
- Terms of service / privacy policy review
