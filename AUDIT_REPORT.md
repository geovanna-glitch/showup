# ShowUp App — Audit Report & Fix Log
**Date:** July 12, 2026
**Auditor:** Claude
**App:** React 19 + Vite 8 + Tailwind CSS v4 + Supabase + vite-plugin-pwa
**Status:** Supabase IS connected and live (5 real opportunities, Links of Love active)

This replaces the July 8 report. Everything that report flagged has been fixed,
plus the items found in the July 12 re-audit. **One action is required from
you before the new features work — see the box below.**

---

## ⚠️ DO THIS FIRST (5 minutes)

Open the Supabase dashboard → SQL Editor, paste the entire contents of
**`supabase/migrations/2026-07-12_security_and_hours.sql`**, and click Run.
It is safe to run more than once.

Until you run it:
- **The security hole is still open** (anyone can make themselves an admin —
  details below).
- The new Hours Review page, check-in/check-out, org onboarding, and
  eligibility enforcement won't work (the app degrades gracefully — nothing
  crashes — but those features stay inert).

After running it, do the security sweep it prints at the top:

```sql
select id, first_name, last_name, email, role from public.profiles
where role = 'admin';
```

Every row should be someone you know. Set any stranger back to a normal role:

```sql
update public.profiles set role = 'adult' where id = '<their id>';
```

---

## WHAT WAS FIXED ON JULY 12

### 1. Security: admin role escalation (CRITICAL) — fixed
Anyone could become an admin two ways: by signing up with `role: 'admin'`
smuggled into the signup data, or by editing the `role` column on their own
profile through the database's public API. An attacker-admin could read every
student's name, birth date, school, and parent contact info.

**Fix (in the migration):** the signup trigger now only accepts
`youth`/`adult`/`org` roles, and a database trigger
(`protect_profile_columns`) blocks non-admins from changing `role`,
`verification_status`, `tier`, `email`, or parental-consent fields — even via
the raw API. Adults also can no longer self-approve their verification, and
students can no longer mark their own event applications "accepted."

### 2. The verified-hours pipeline — built (was the biggest gap)
Previously a student who used the app perfectly ended with 0 verified hours:
no check-in existed and self-logged hours could never be approved.

- **Check-in/check-out** (`src/pages/OrgCheckIn.jsx`, linked from each
  opportunity on the Post Opportunity page): org staff check volunteers in
  when they arrive and out when they leave. Times are stamped by the
  **server**, so hours can't be faked from a phone. Verified hours land on
  the student's dashboard automatically.
- **Hours Review admin page** (`src/pages/AdminHoursReview.jsx`, at
  `/admin/hours`, in your admin nav): shows every pending self-logged entry
  with the student's name, the signed-sheet photo, and their reflection.
  Approve/Reject with one click.
- **Approved hours now count**: the dashboard total and the by-school-year
  chart include approved self-logged hours (`src/pages/Dashboard.jsx`).
  Pending and rejected entries never count.

### 3. Student reflection field — built
`/log-hours` now requires a short written reflection with every entry
(Mahopac CSD asks for one). It's stored with the entry, shown to you on the
Hours Review page, and included in the student's CSV export.

### 4. Admin ID review bugs — fixed
- The email column was always blank: profiles now carry the account email
  (backfilled by the migration) and the page displays it.
- "View ID photo" failed because admins had no permission to read other
  people's uploads: the migration adds admin read access to both photo
  buckets. Same fix makes signed-sheet photos viewable on Hours Review.

### 5. Org onboarding — now a real pipeline
Approving an application used to only change a label. Now, clicking
**Approve** on `/admin/org-applications` also creates the organization
(active, unowned). The org contact then creates their login at
**`/organizations/create-account`** using the same email they applied with,
and the app links their account to the organization automatically on their
first visit to Post Opportunity. Tell orgs about that page when you approve
them (the app shows you a reminder).

### 6. Eligibility and capacity — enforced in the database
Students can't apply to adults-only events, unverified adults can't apply to
anything, youth-contact events require Tier 2 clearance, and full events
reject further signups. Enforced by the database (`can_apply()` in the
migration) so it can't be bypassed, and mirrored in the Browse page UI so the
button explains itself ("Finish ID verification to apply", "Full — check back
later"). "Spots left" is now a live count, not the original limit.

### 7. Honest copy — fixed
The app no longer claims to send emails it doesn't send (parental-consent
confirmation, verification-complete emails). Real email notifications remain
future work — see below.

### 8. Housekeeping
- `supabase/schema.sql` is now the complete, single source of truth — a new
  Supabase project can be rebuilt from that one file. The SQL that used to
  live in code comments has been consolidated.
- The "Post opportunity" nav link no longer lingers after an org signs out
  (`src/components/Layout.jsx`).
- Verified: lint clean, production build passes, live pages render with no
  console errors, protected routes redirect correctly.

---

## WHAT'S STILL FUTURE WORK (not blocking a pilot)

1. **Email notifications** — nothing sends email yet (parental consent,
   "you're approved", org outreach). Needs a Supabase Edge Function plus an
   email provider (e.g. Resend). The UI copy is now honest about this.
2. **Stripe billing** — plans ($29/$79) are displayed but no payment is
   collected. Fine while the pilot is free.
3. **Background checks (Tier 2)** — consent is collected but no screening
   provider is integrated. Until then, only mark an adult's status
   `cleared` after you've verified their check yourself.
4. **Parental consent is still just a checkbox** the student ticks. A real
   parent-confirmation email (item 1) should come before wide launch.
5. **Terms of service / privacy policy** — you collect minors' data and
   government IDs; worth a legal review before promoting broadly.
6. **Volunteer cancel button** — the database now allows students to cancel
   a signup, but there's no cancel button in the UI yet.

---

## FILE MAP (what changed July 12)

| File | Change |
|------|--------|
| `supabase/migrations/2026-07-12_security_and_hours.sql` | **NEW — run this in the SQL editor** |
| `supabase/schema.sql` | Rewritten as the complete fresh-install schema |
| `src/pages/AdminHoursReview.jsx` | NEW — approve/reject self-logged hours (`/admin/hours`) |
| `src/pages/OrgCheckIn.jsx` | NEW — on-site check-in/out (`/org/opportunities/:id/checkin`) |
| `src/pages/OrgAccountSignup.jsx` | NEW — org login creation (`/organizations/create-account`) |
| `src/pages/LogHours.jsx` | Reflection field added (required) |
| `src/pages/Dashboard.jsx` | Approved self-logged hours count in totals; CSV gains Reflection column |
| `src/pages/Browse.jsx` | Live spots-left, eligibility-aware Apply button, friendly errors |
| `src/pages/PostOpportunity.jsx` | Org-claim flow, Check-in link per opportunity |
| `src/pages/AdminOrgApplications.jsx` | Approve now provisions the organization |
| `src/pages/AdminReview.jsx` | Email column fixed |
| `src/pages/VerifyIdentity.jsx` | No longer writes protected column; honest copy |
| `src/pages/VolunteerSignup.jsx` | Honest parental-consent copy |
| `src/pages/OrgSignup.jsx` | Points approved orgs to account creation |
| `src/components/Layout.jsx` | Hours Review nav link; org link resets on sign-out |
| `src/App.jsx` | Three new routes |

---

*App remains installable as a PWA. Supabase project: lwsdrfbshfbvwnyccbxy.
Deploy target: Vercel.*
