-- Supabase grants table privileges to these roles by default; RLS does the real gating.
grant select, insert, update, delete on all tables in schema public to authenticated;
