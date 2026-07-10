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
2. Run `supabase/schema.sql` in the SQL editor (tables, RLS policies, and the trigger that
   creates a volunteer profile from signup metadata).
3. Copy `.env.example` to `.env.local` and fill in the project URL and anon key from
   Project Settings → API.

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

- Real auth-gated dashboards (volunteer, organization, admin)
- Org check-in/check-out flow writing to `hour_logs`
- Checkr integration for Tier 2 background checks
- Stripe billing for organization plans
- Hour report exports (CSV/PDF) for schools and colleges
