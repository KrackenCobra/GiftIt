-- Minimal stand-in for Supabase's auth schema and roles, for running RLS tests on plain Postgres.
create schema if not exists auth;
create schema if not exists extensions;
create table auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
end $$;
grant usage on schema public, auth, extensions to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
