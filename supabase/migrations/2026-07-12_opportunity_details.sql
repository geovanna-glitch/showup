-- ============================================================================
-- ShowUp — Opportunity detail fields
-- Date: July 12, 2026
--
-- Adds the event-day details orgs fill in when posting an opportunity:
-- volunteer arrival time, street address, day-of supervisor contact, duties,
-- what to wear/bring, food, and accessibility notes.
--
-- HOW TO RUN: paste this whole file into the Supabase SQL editor and Run.
-- Idempotent — safe to run more than once. Run it BEFORE posting an event
-- with the new form, or the post will fail with a "column not found" error.
-- ============================================================================

alter table public.opportunities
  add column if not exists arrive_by timestamptz,           -- "be there by" (often before the public start)
  add column if not exists address text,                    -- street address
  add column if not exists address_detail text,             -- floor / room / building
  add column if not exists supervisor_name text,            -- who volunteers report to that day
  add column if not exists supervisor_phone text,           -- parents can call with questions
  add column if not exists duties text,                     -- what volunteers will actually do
  add column if not exists what_to_bring text,              -- wear/bring notes
  add column if not exists food_provided boolean not null default false,
  add column if not exists food_sponsor text,               -- only meaningful when food_provided
  add column if not exists accessibility_notes text;        -- physical requirements / accessibility

-- Confirm: lists every column on the table so you can see the new ones landed.
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'opportunities'
order by ordinal_position;
