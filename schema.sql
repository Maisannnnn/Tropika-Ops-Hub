-- Tropika Ops Hub — Supabase schema
-- Run this once in Supabase Dashboard > SQL Editor > New query > Run

create extension if not exists "uuid-ossp";

create table properties (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  island text,
  address text,
  phone text,
  website text,
  rating numeric,
  status text default 'prospect', -- prospect, contacted, negotiating, contract_sent, partnered
  contract_url text,
  contact_person text,
  contact_email text,
  created_at timestamptz default now()
);

create table property_rooms (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id) on delete cascade,
  room_type text,
  rate_usd_per_night numeric,
  max_occupancy int,
  notes text
);

create table agents (
  id uuid primary key default uuid_generate_v4(),
  name text,
  agency_name text,
  country text,
  whatsapp text,
  email text,
  relationship_stage text default 'new', -- new, engaged, active, dormant
  last_contact_date date,
  notes text,
  created_at timestamptz default now()
);

create table bookings (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid references properties(id),
  room_id uuid references property_rooms(id),
  agent_id uuid references agents(id),
  guest_name text,
  guest_count int,
  check_in date,
  check_out date,
  quote_amount_usd numeric,
  status text default 'draft', -- draft, request_sent, confirmed_by_hotel, deposit_received, balance_paid, completed, cancelled
  booking_form_sent_at timestamptz,
  created_at timestamptz default now()
);

create table invoices (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid references bookings(id),
  invoice_number text,
  amount_usd numeric,
  date_issued date,
  due_date date,
  status text default 'draft', -- draft, sent, paid, overdue
  created_at timestamptz default now()
);

alter table properties enable row level security;
alter table property_rooms enable row level security;
alter table agents enable row level security;
alter table bookings enable row level security;
alter table invoices enable row level security;

-- Single-operator tool: any authenticated (signed-in) user has full access.
create policy "Authenticated full access" on properties for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on property_rooms for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on agents for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on bookings for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Authenticated full access" on invoices for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
