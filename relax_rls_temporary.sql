-- TEMPORARY: relax RLS to allow the anon key full access while auth is disabled.
-- Run this in Supabase Dashboard > SQL Editor > New query > Run.
-- We will tighten this back to "authenticated only" once the login screen is restored.

drop policy if exists "Authenticated full access" on properties;
drop policy if exists "Authenticated full access" on property_rooms;
drop policy if exists "Authenticated full access" on agents;
drop policy if exists "Authenticated full access" on bookings;
drop policy if exists "Authenticated full access" on invoices;

create policy "Temporary open access" on properties for all using (true) with check (true);
create policy "Temporary open access" on property_rooms for all using (true) with check (true);
create policy "Temporary open access" on agents for all using (true) with check (true);
create policy "Temporary open access" on bookings for all using (true) with check (true);
create policy "Temporary open access" on invoices for all using (true) with check (true);
