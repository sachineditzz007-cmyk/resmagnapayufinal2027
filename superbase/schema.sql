-- Run this in Supabase SQL Editor before deploying.
create extension if not exists pgcrypto;
create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  txnid text not null unique,
  name text not null,
  email text not null,
  phone text not null,
  college text not null,
  course_year text,
  food_preference text,
  events jsonb not null default '[]'::jsonb,
  event_ids text[] not null default '{}',
  event_total integer not null,
  food_selected boolean not null default false,
  food_amount integer not null default 0,
  accommodation text not null default 'none',
  accommodation_amount integer not null default 0,
  amount numeric(10,2) not null,
  productinfo text not null,
  payment_status text not null default 'pending' check (payment_status in ('pending','success','failure')),
  payu_txn_id text,
  payu_mode text,
  payu_unmapped_status text,
  payu_response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists registrations_status_idx on public.registrations(payment_status);
create index if not exists registrations_created_at_idx on public.registrations(created_at desc);
-- No public access. The Vercel backend uses the Supabase service-role key server-side only.
alter table public.registrations enable row level security;
revoke all on public.registrations from anon, authenticated;
