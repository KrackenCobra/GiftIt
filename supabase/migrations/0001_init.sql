-- GiftIt initial schema.
-- Principle: the server stores ciphertext and sealed keys only. Row-level security (RLS) is ON
-- for every table, and every write that needs cross-row checks goes through a SECURITY DEFINER
-- function with a pinned search_path.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 40),
  identity_public_key text,            -- Ed25519, base64url. Friends pin it after a safety-number check.
  created_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text not null check (char_length(label) <= 40),
  public_key text not null,            -- X25519, base64url
  cert text,                           -- identity-key signature over (user, device, key). Verified by clients.
  certified_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.devices (user_id);

create table public.vault_keys (
  user_id uuid not null references auth.users (id) on delete cascade,
  device_id uuid primary key references public.devices (id) on delete cascade,
  sealed_key text not null,            -- vault key sealed to this device
  sealed_identity text not null        -- identity seed sealed to this device
);

create table public.recovery (
  user_id uuid primary key references auth.users (id) on delete cascade,
  salt text not null,
  wrapped_vault_key jsonb not null     -- vault key encrypted under the Argon2id(recovery phrase) key
);

create table public.circles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,  -- FK to profiles so the API can embed display names
  name_ciphertext jsonb,
  key_version int not null default 1 check (key_version >= 1),
  created_at timestamptz not null default now()
);
create index on public.circles (owner_id);

create table public.circle_members (
  circle_id uuid not null references public.circles (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  accepted_at timestamptz,             -- null = pending owner approval
  created_at timestamptz not null default now(),
  primary key (circle_id, user_id)
);
create index on public.circle_members (user_id);

create table public.circle_keys (
  circle_id uuid not null references public.circles (id) on delete cascade,
  key_version int not null,
  device_id uuid not null references public.devices (id) on delete cascade,
  sealed_key text not null,
  primary key (circle_id, key_version, device_id)
);

create table public.items (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in ('color','flower','food','size','brand','hobby','scent','genre','custom','wishlist')),
  scope text not null check (scope in ('private','circle')),
  circle_id uuid references public.circles (id) on delete cascade,
  key_version int not null default 1,
  ciphertext jsonb not null check (octet_length(ciphertext::text) <= 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'private') = (circle_id is null))
);
create index on public.items (owner_id);
create index on public.items (circle_id);

create table public.item_claims (
  item_id uuid not null references public.items (id) on delete cascade,
  claimer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, claimer_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  circle_id uuid not null references public.circles (id) on delete cascade,
  token_hash text not null unique,     -- SHA-256 hex of the raw token; the raw token is never stored
  expires_at timestamptz not null default now() + interval '24 hours',
  used_at timestamptz,
  used_by uuid references auth.users (id)
);

create table public.important_dates (
  id uuid primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  circle_id uuid references public.circles (id) on delete cascade,
  key_version int not null default 1,
  ciphertext jsonb not null check (octet_length(ciphertext::text) <= 4096)
);

create table public.gift_plans (
  id uuid primary key,
  planner_id uuid not null references auth.users (id) on delete cascade,
  ciphertext jsonb not null check (octet_length(ciphertext::text) <= 16384)  -- vault-key encrypted; "about whom" is inside
);

create table public.rate_events (
  user_id uuid not null,
  action text not null,
  at timestamptz not null default now()
);
create index on public.rate_events (user_id, action, at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_circle_member(p_circle uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.circle_members m
    where m.circle_id = p_circle and m.user_id = p_user and m.accepted_at is not null
  ) or exists (select 1 from public.circles c where c.id = p_circle and c.owner_id = p_user);
$$;

create or replace function public.shares_circle_with(p_other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.circles c
    left join public.circle_members m on m.circle_id = c.id
    where (c.owner_id = auth.uid() and m.user_id = p_other)
       or (c.owner_id = p_other and m.user_id = auth.uid())
  );
$$;

create or replace function public.rate_limit(p_action text, p_max int, p_window interval)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.rate_events
      where user_id = auth.uid() and action = p_action and at > now() - p_window) >= p_max then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  insert into public.rate_events (user_id, action) values (auth.uid(), p_action);
end $$;

-- New auth user -> profile row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Identity key is set once. A change is only possible via recovery (same phrase -> same key),
-- so any attempt to change it to something else is refused. Friends' pins catch it regardless.
create or replace function public.guard_identity_key()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.identity_public_key is not null and new.identity_public_key is distinct from old.identity_public_key then
    raise exception 'identity key cannot change';
  end if;
  return new;
end $$;
create trigger profiles_identity_guard before update on public.profiles
  for each row execute function public.guard_identity_key();

-- Devices: clients may insert their own, but never set cert/revoked directly.
create or replace function public.guard_device_columns()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_setting('giftit.trusted', true) is distinct from 'on' then
    if tg_op = 'INSERT' and (new.cert is not null or new.revoked_at is not null) then
      raise exception 'not allowed';
    end if;
    if tg_op = 'UPDATE' then
      raise exception 'use the device functions';
    end if;
  end if;
  return new;
end $$;
create trigger devices_guard before insert or update on public.devices
  for each row execute function public.guard_device_columns();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.vault_keys enable row level security;
alter table public.recovery enable row level security;
alter table public.circles enable row level security;
alter table public.circle_members enable row level security;
alter table public.circle_keys enable row level security;
alter table public.items enable row level security;
alter table public.item_claims enable row level security;
alter table public.invites enable row level security;
alter table public.important_dates enable row level security;
alter table public.gift_plans enable row level security;
alter table public.rate_events enable row level security;  -- no policies: functions only

-- profiles: yourself, and people you share a circle with (either direction). No search.
create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.shares_circle_with(id));
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- devices: yours, and devices of people you share a circle with (needed to seal keys to them).
create policy devices_read on public.devices for select
  using (user_id = auth.uid() or public.shares_circle_with(user_id));
create policy devices_insert on public.devices for insert
  with check (user_id = auth.uid()
    and (select count(*) from public.devices d where d.user_id = auth.uid() and d.revoked_at is null) < 10);

-- vault_keys / recovery: owner only.
create policy vault_rw on public.vault_keys for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy recovery_rw on public.recovery for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- circles
create policy circles_read on public.circles for select
  using (public.is_circle_member(id, auth.uid()));
create policy circles_insert on public.circles for insert
  with check (owner_id = auth.uid()
    and (select count(*) from public.circles c where c.owner_id = auth.uid()) < 20);
create policy circles_update on public.circles for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy circles_delete on public.circles for delete
  using (owner_id = auth.uid());

-- circle_members: owner sees all; members see accepted members; inserts only via functions.
create policy members_read on public.circle_members for select
  using (
    exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())
    or (accepted_at is not null and public.is_circle_member(circle_id, auth.uid()))
    or user_id = auth.uid()
  );
create policy members_leave on public.circle_members for delete
  using (user_id = auth.uid());

-- circle_keys: a device's own sealed keys are readable by its user; owner writes them.
create policy circle_keys_read on public.circle_keys for select
  using (exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid()));
create policy circle_keys_write on public.circle_keys for insert
  with check (exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()));
create policy circle_keys_upsert on public.circle_keys for update
  using (exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()));

-- items: owner always; circle members for circle-scoped items. Owner may only target own circles.
create policy items_read on public.items for select
  using (owner_id = auth.uid()
    or (scope = 'circle' and public.is_circle_member(circle_id, auth.uid())));
create policy items_insert on public.items for insert
  with check (owner_id = auth.uid()
    and (circle_id is null or exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()))
    and (select count(*) from public.items i where i.owner_id = auth.uid()) < 500);
create policy items_update on public.items for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid()
    and (circle_id is null or exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid())));
create policy items_delete on public.items for delete
  using (owner_id = auth.uid());

-- item_claims: visible to circle members who can see the item, but NEVER to the item's owner.
create policy claims_read on public.item_claims for select
  using (exists (
    select 1 from public.items i
    where i.id = item_id and i.owner_id <> auth.uid()
      and i.scope = 'circle' and public.is_circle_member(i.circle_id, auth.uid())
  ));

-- invites: owner only (redeem goes through a function).
create policy invites_owner on public.invites for select
  using (exists (select 1 from public.circles c where c.id = circle_id and c.owner_id = auth.uid()));

-- important dates: like items.
create policy dates_read on public.important_dates for select
  using (owner_id = auth.uid() or (circle_id is not null and public.is_circle_member(circle_id, auth.uid())));
create policy dates_write on public.important_dates for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- gift plans: planner only. Ever.
create policy plans_rw on public.gift_plans for all
  using (planner_id = auth.uid()) with check (planner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Functions (the only way to do cross-row or privileged changes)
-- ---------------------------------------------------------------------------

create or replace function public.record_device_cert(p_device_id uuid, p_cert text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.rate_limit('device_cert', 10, interval '1 day');
  perform set_config('giftit.trusted', 'on', true);
  update public.devices set cert = p_cert, certified_at = now()
   where id = p_device_id and user_id = auth.uid() and revoked_at is null;
  if not found then raise exception 'device not found'; end if;
  -- The server cannot verify Ed25519 here; clients verify every cert against a pinned identity key.
end $$;

create or replace function public.revoke_device(p_device_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('giftit.trusted', 'on', true);
  update public.devices set revoked_at = now() where id = p_device_id and user_id = auth.uid();
  delete from public.vault_keys where device_id = p_device_id;
  delete from public.circle_keys where device_id = p_device_id;
end $$;

create or replace function public.create_invite(p_circle_id uuid, p_token_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.circles where id = p_circle_id and owner_id = auth.uid()) then
    raise exception 'not your circle';
  end if;
  if p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'bad token'; end if;
  perform public.rate_limit('invite', 10, interval '1 day');
  insert into public.invites (circle_id, token_hash) values (p_circle_id, p_token_hash);
end $$;

create or replace function public.redeem_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.invites;
begin
  perform public.rate_limit('redeem', 10, interval '1 hour');
  select * into v_inv from public.invites
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
   for update;
  if v_inv.id is null or v_inv.used_at is not null or v_inv.expires_at < now() then
    raise exception 'invite invalid or expired';   -- same message for every failure: no oracle
  end if;
  if exists (select 1 from public.circles where id = v_inv.circle_id and owner_id = auth.uid()) then
    raise exception 'invite invalid or expired';
  end if;
  update public.invites set used_at = now(), used_by = auth.uid() where id = v_inv.id;
  insert into public.circle_members (circle_id, user_id) values (v_inv.circle_id, auth.uid())
    on conflict do nothing;
  return v_inv.circle_id;
end $$;

create or replace function public.approve_member(p_circle_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.circle_members m set accepted_at = now()
   from public.circles c
   where c.id = m.circle_id and c.owner_id = auth.uid()
     and m.circle_id = p_circle_id and m.user_id = p_user_id;
  if not found then raise exception 'not found'; end if;
end $$;

create or replace function public.remove_member(p_circle_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.circles where id = p_circle_id and owner_id = auth.uid()) then
    raise exception 'not your circle';
  end if;
  delete from public.circle_members where circle_id = p_circle_id and user_id = p_user_id;
  delete from public.circle_keys k using public.devices d
   where k.circle_id = p_circle_id and k.device_id = d.id and d.user_id = p_user_id;
  delete from public.item_claims cl using public.items i
   where cl.item_id = i.id and i.circle_id = p_circle_id and cl.claimer_id = p_user_id;
end $$;

-- Called after the owner re-encrypted every item under the new key version.
create or replace function public.finish_rotation(p_circle_id uuid, p_new_version int, p_name_ciphertext jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.items where circle_id = p_circle_id and key_version <> p_new_version) then
    raise exception 'items not yet re-encrypted';
  end if;
  update public.circles set key_version = p_new_version, name_ciphertext = p_name_ciphertext
   where id = p_circle_id and owner_id = auth.uid() and key_version = p_new_version - 1;
  if not found then raise exception 'rotation conflict'; end if;
  delete from public.circle_keys where circle_id = p_circle_id and key_version < p_new_version;
end $$;

create or replace function public.claim_item(p_item_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.items i
     where i.id = p_item_id and i.category = 'wishlist' and i.scope = 'circle'
       and i.owner_id <> auth.uid() and public.is_circle_member(i.circle_id, auth.uid())
  ) then raise exception 'not found'; end if;
  perform public.rate_limit('claim', 50, interval '1 day');
  insert into public.item_claims (item_id, claimer_id) values (p_item_id, auth.uid()) on conflict do nothing;
end $$;

create or replace function public.unclaim_item(p_item_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.item_claims where item_id = p_item_id and claimer_id = auth.uid();
$$;

-- Quota for the gift-suggestion proxy: 60 queries per user per hour.
create or replace function public.suggest_quota()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.rate_limit('suggest', 60, interval '1 hour');
end $$;

-- Housekeeping: old rate events and expired invites. Schedule daily with pg_cron.
create or replace function public.cleanup()
returns void language sql security definer set search_path = '' as $$
  delete from public.rate_events where at < now() - interval '2 days';
  delete from public.invites where expires_at < now() - interval '7 days';
$$;

-- Lock down function execution to signed-in users.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.record_device_cert(uuid, text), public.revoke_device(uuid),
  public.create_invite(uuid, text), public.redeem_invite(text),
  public.approve_member(uuid, uuid), public.remove_member(uuid, uuid),
  public.finish_rotation(uuid, int, jsonb), public.claim_item(uuid), public.unclaim_item(uuid),
  public.suggest_quota()
  to authenticated;
-- Helpers used inside RLS policies must stay callable by the policy's role.
grant execute on function public.is_circle_member(uuid, uuid), public.shares_circle_with(uuid) to authenticated;
