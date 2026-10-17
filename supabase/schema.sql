-- RESMAGNA 2027 registration and PayU payment records
-- Run this script in Supabase SQL Editor using the intended project.
create table if not exists public.registrations (
  txnid text primary key,
  name text not null,
  email text not null,
  phone text not null,
  college text not null,
  gender text check (gender is null or gender in ('Male', 'Female')),
  course_year text,
  food_preference text,
  events jsonb not null default '[]'::jsonb,
  event_ids text[] not null default '{}'::text[],
  event_total numeric(10,2) not null default 0 check (event_total >= 0),
  food_selected boolean not null default false,
  food_amount numeric(10,2) not null default 0 check (food_amount >= 0),
  accommodation text not null default 'none'
    check (accommodation in ('none', 'shared', 'private')),
  accommodation_amount numeric(10,2) not null default 0 check (accommodation_amount >= 0),
  amount numeric(10,2) not null check (amount >= 0),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'success', 'failure')),
  productinfo text not null default 'RESMAGNA 2027 Registration',
  payu_txn_id text,
  payu_mode text,
  payu_unmapped_status text,
  payu_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registrations_email_idx
  on public.registrations (email);
create index if not exists registrations_payment_status_idx
  on public.registrations (payment_status);
create index if not exists registrations_created_at_idx
  on public.registrations (created_at desc);

-- Upgrade existing installations safely.
alter table public.registrations add column if not exists gender text;

-- The browser must not read or modify participant/payment records directly.
-- Server-side API routes use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.
alter table public.registrations enable row level security;

-- Intentionally do not create anon/authenticated policies.
