-- RLS / function tests. Run after supabase_shim.sql + migration + grants.sql.
-- Users: A = circle owner, B = friend (approved later), C = stranger, D = removed later.
\set ON_ERROR_STOP 1
\set A '''aaaaaaaa-0000-0000-0000-000000000001'''
\set B '''bbbbbbbb-0000-0000-0000-000000000002'''
\set C '''cccccccc-0000-0000-0000-000000000003'''

insert into auth.users values (:A), (:B), (:C);

create or replace function public.t_as(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', p::text, false) $$;
create or replace function public.t_expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL (no error): %', p_label;
exception when others then
  if sqlerrm like 'FAIL (no error)%' then raise; end if;
  raise notice 'ok  %', p_label;
end $$;
create or replace function public.t_assert(p_cond boolean, p_label text) returns void language plpgsql as $$
begin
  if not coalesce(p_cond, false) then raise exception 'FAIL: %', p_label; end if;
  raise notice 'ok  %', p_label;
end $$;
grant execute on function public.t_as(uuid), public.t_expect_error(text, text), public.t_assert(boolean, text) to authenticated;

set role authenticated;

-- A sets up: identity, device, circle, items
select t_as(:A);
update profiles set identity_public_key = 'idA', display_name = 'Jeremie' where id = :A;
insert into devices (id, user_id, label, public_key) values ('d0000000-0000-0000-0000-00000000000a', :A, 'A phone', 'pkA');
select record_device_cert('d0000000-0000-0000-0000-00000000000a', 'certA');
insert into circles (id, owner_id) values ('c0000000-0000-0000-0000-000000000001', :A);
insert into items (id, owner_id, category, scope, circle_id, ciphertext) values
  ('10000000-0000-0000-0000-000000000001', :A, 'color', 'private', null, '{"v":1,"n":"x","c":"y"}'),
  ('10000000-0000-0000-0000-000000000002', :A, 'flower', 'circle', 'c0000000-0000-0000-0000-000000000001', '{"v":1,"n":"x","c":"y"}'),
  ('10000000-0000-0000-0000-000000000003', :A, 'wishlist', 'circle', 'c0000000-0000-0000-0000-000000000001', '{"v":1,"n":"x","c":"y"}');
select create_invite('c0000000-0000-0000-0000-000000000001', encode(extensions.digest('tok-B', 'sha256'), 'hex'));

select t_expect_error($$update profiles set identity_public_key = 'evil' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'identity key cannot be changed');
update devices set cert = 'forged' where user_id = :A;
select t_assert((select cert from devices where user_id = :A) = 'certA', 'device cert cannot be changed by direct update');
select t_expect_error($$insert into devices (user_id, label, public_key, cert) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x', 'k', 'c')$$, 'device cannot be inserted pre-certified');
select t_expect_error($$select create_invite('c0000000-0000-0000-0000-000000000001', 'not-a-hash')$$, 'invite hash format enforced');

-- C, a stranger, sees nothing
select t_as(:C);
select t_assert((select count(*) from items) = 0, 'stranger sees no items');
select t_assert((select count(*) from profiles where id <> :C) = 0, 'stranger sees no other profiles (no search)');
select t_assert((select count(*) from devices) = 0, 'stranger sees no devices');
select t_assert((select count(*) from circles) = 0, 'stranger sees no circles');
select t_expect_error($$insert into items (id, owner_id, category, scope, circle_id, ciphertext) values (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000003', 'color', 'circle', 'c0000000-0000-0000-0000-000000000001', '{}')$$, 'cannot post into someone else''s circle');
select t_expect_error($$select redeem_invite('wrong-token')$$, 'wrong invite token refused');

-- B redeems the invite -> pending, still sees nothing
select t_as(:B);
select t_assert(redeem_invite('tok-B') = 'c0000000-0000-0000-0000-000000000001', 'B redeems invite');
select t_assert((select count(*) from items) = 0, 'pending member sees no items');
select t_as(:C);
select t_expect_error($$select redeem_invite('tok-B')$$, 'invite works only once');

-- A approves B
select t_as(:A);
select approve_member('c0000000-0000-0000-0000-000000000001', :B);
select t_assert((select count(*) from item_claims) = 0, 'owner sees no claims');

select t_as(:B);
select t_assert((select count(*) from items) = 2, 'approved member sees exactly the 2 circle items');
select t_assert(not exists (select 1 from items where scope = 'private'), 'member never sees private items');
select t_assert((select count(*) from profiles) = 2, 'member sees own + owner profile');
select claim_item('10000000-0000-0000-0000-000000000003');
select t_assert((select count(*) from item_claims) = 1, 'member sees own claim');
select t_expect_error($$select claim_item('10000000-0000-0000-0000-000000000002')$$, 'only wishlist items can be claimed');
update items set ciphertext = '{"tampered":1}' where id = '10000000-0000-0000-0000-000000000002';
delete from items where id = '10000000-0000-0000-0000-000000000002';
select t_assert((select ciphertext->>'c' from items where id = '10000000-0000-0000-0000-000000000002') = 'y', 'member cannot modify or delete owner items');

-- The owner can never see who claimed their wishlist item
select t_as(:A);
select t_assert((select count(*) from item_claims) = 0, 'owner cannot see claims on own wishlist (surprise kept)');
select t_expect_error($$select claim_item('10000000-0000-0000-0000-000000000003')$$, 'owner cannot claim own item');

-- Removing B cuts access
select remove_member('c0000000-0000-0000-0000-000000000001', :B);
select t_as(:B);
select t_assert((select count(*) from items) = 0, 'removed member sees no items');
select t_assert((select count(*) from item_claims) = 0, 'removed member''s claims are deleted');

-- Expired invite
reset role;
insert into invites (circle_id, token_hash, expires_at) values ('c0000000-0000-0000-0000-000000000001', encode(extensions.digest('tok-old', 'sha256'), 'hex'), now() - interval '1 minute');
set role authenticated;
select t_as(:C);
select t_expect_error($$select redeem_invite('tok-old')$$, 'expired invite refused');

-- anon can't call functions
reset role;
set role anon;
select t_expect_error($$select redeem_invite('x')$$, 'anon cannot call functions');
reset role;
\echo ALL_RLS_TESTS_PASSED
