import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { crypto, type Envelope } from '../crypto';
import { cacheKey, forgetCircleKey, getPinnedIdentity, loadIdentityPrivateKey, loadIdentityPublicKey, pinIdentity } from '../crypto/keystore';
import { getCircleKey } from './keys';

async function myId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

/**
 * Devices we will seal keys to: not revoked AND carrying a certificate signed by the account
 * identity key we trust (our own, or a friend's key pinned after comparing safety numbers).
 * The server's word alone is never enough.
 */
async function trustedDevicesOf(userId: string): Promise<{ id: string; public_key: string }[]> {
  const c = crypto();
  const me = await myId();
  const identity = userId === me ? await loadIdentityPublicKey() : await getPinnedIdentity(userId);
  if (!identity) throw new Error('Compare safety numbers with this person first');
  const { data, error } = await supabase
    .from('devices')
    .select('id, public_key, cert')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .not('cert', 'is', null);
  if (error) throw error;
  return (data ?? []).filter((d) => c.verifyDeviceCert(identity, userId, d.id, c.fromB64(d.public_key), d.cert as string));
}

async function sealToUsers(circleId: string, version: number, key: Uint8Array, userIds: string[]) {
  const c = crypto();
  const rows: { circle_id: string; key_version: number; device_id: string; sealed_key: string }[] = [];
  for (const uid of userIds) {
    for (const d of await trustedDevicesOf(uid)) {
      rows.push({ circle_id: circleId, key_version: version, device_id: d.id, sealed_key: c.sealKey(key, c.fromB64(d.public_key)) });
    }
  }
  if (rows.length) {
    const { error } = await supabase.from('circle_keys').upsert(rows, { onConflict: 'circle_id,key_version,device_id' });
    if (error) throw error;
  }
}

export interface CircleSummary {
  id: string;
  name: string;
  keyVersion: number;
  members: { userId: string; displayName: string | null; pending: boolean }[];
}

/** Circles I own, with decrypted names. */
export async function listMyCircles(): Promise<CircleSummary[]> {
  const c = crypto();
  const uid = await myId();
  const { data, error } = await supabase
    .from('circles')
    .select('id, key_version, name_ciphertext, circle_members(user_id, accepted_at, profiles(display_name))')
    .eq('owner_id', uid)
    .order('created_at');
  if (error) throw error;
  const out: CircleSummary[] = [];
  for (const row of data ?? []) {
    let name = 'Circle';
    try {
      const key = await getCircleKey(row.id, row.key_version);
      name = c.decryptJson<string>(row.name_ciphertext as Envelope, key, {
        kind: 'circle_name', itemId: row.id, ownerId: uid, keyVersion: row.key_version,
      });
    } catch {
      /* keep placeholder */
    }
    const members = ((row.circle_members ?? []) as unknown as {
      user_id: string; accepted_at: string | null; profiles: { display_name: string | null } | null;
    }[]).map((m) => ({ userId: m.user_id, displayName: m.profiles?.display_name ?? null, pending: !m.accepted_at }));
    out.push({ id: row.id, name, keyVersion: row.key_version, members });
  }
  return out;
}

/** People whose circles I'm an approved member of (their shared items are readable to me). */
export async function listFriends(): Promise<{ userId: string; displayName: string | null }[]> {
  const uid = await myId();
  const { data, error } = await supabase
    .from('circle_members')
    .select('circles(owner_id, profiles:owner_id(display_name))')
    .eq('user_id', uid)
    .not('accepted_at', 'is', null);
  if (error) throw error;
  const seen = new Map<string, string | null>();
  for (const r of (data ?? []) as unknown as { circles: { owner_id: string; profiles: { display_name: string | null } | null } }[]) {
    seen.set(r.circles.owner_id, r.circles.profiles?.display_name ?? null);
  }
  return [...seen].map(([userId, displayName]) => ({ userId, displayName }));
}

/** A circle is "my audience": I own it and decide who's in it. Its name is encrypted too. */
export async function createCircle(name: string) {
  const c = crypto();
  const uid = await myId();
  const key = c.newSymmetricKey();
  const { data, error } = await supabase.from('circles').insert({ owner_id: uid, key_version: 1 }).select('id').single();
  if (error || !data) throw error ?? new Error('Could not create circle');
  const nameCt = c.encryptJson(name.trim().slice(0, 40), key, { kind: 'circle_name', itemId: data.id, ownerId: uid, keyVersion: 1 });
  const upd = await supabase.from('circles').update({ name_ciphertext: nameCt }).eq('id', data.id);
  if (upd.error) throw upd.error;
  await sealToUsers(data.id, 1, key, [uid]);
  await cacheKey({ circleId: data.id, version: 1 }, key);
  c.wipe(key);
  return data.id as string;
}

/**
 * One-time invite. The raw token only ever exists in the link/QR; the server stores its SHA-256.
 * Expires in 24 h, single use (enforced in SQL).
 */
export async function createInvite(circleId: string): Promise<string> {
  const token = crypto().toB64(getRandomBytes(32));
  const tokenHash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, token);
  const { error } = await supabase.rpc('create_invite', { p_circle_id: circleId, p_token_hash: tokenHash });
  if (error) throw error;
  return `giftit://invite/${token}`;
}

/** Friend side: redeem → becomes a *pending* member. Nothing is readable until the owner approves. */
export async function redeemInvite(link: string) {
  const token = link.replace(/^giftit:\/\/invite\//, '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('That invite link is not valid');
  const { data, error } = await supabase.rpc('redeem_invite', { p_token: token });
  if (error) throw error;
  return data as string; // circle id
}

/**
 * Safety number both people compare before approval (in person or on a call).
 * Returns the friend's identity key too; call confirmSafetyNumber() only after the numbers match.
 */
export async function safetyNumberWith(userId: string): Promise<{ number: string; theirIdentity: string }> {
  const c = crypto();
  const mine = await loadIdentityPublicKey();
  const { data } = await supabase.from('profiles').select('identity_public_key').eq('id', userId).single();
  if (!mine || !data?.identity_public_key) throw new Error('Missing identity keys');
  return { number: c.safetyNumber(mine, c.fromB64(data.identity_public_key)), theirIdentity: data.identity_public_key };
}

export async function confirmSafetyNumber(userId: string, theirIdentity: string) {
  const pinned = await getPinnedIdentity(userId);
  const c = crypto();
  if (pinned && c.toB64(pinned) !== theirIdentity) {
    // Key changed since we last verified: never silently re-trust.
    throw new Error('Safety number changed. Verify again in person before continuing.');
  }
  await pinIdentity(userId, c.fromB64(theirIdentity));
}

export async function approveMember(circleId: string, memberId: string) {
  const { data, error } = await supabase.from('circles').select('key_version').eq('id', circleId).single();
  if (error || !data) throw error ?? new Error('Circle not found');
  const version = data.key_version as number;
  const key = await getCircleKey(circleId, version);
  await sealToUsers(circleId, version, key, [memberId]);
  const rpc = await supabase.rpc('approve_member', { p_circle_id: circleId, p_user_id: memberId });
  if (rpc.error) throw rpc.error;
}

/**
 * Remove a member and rotate: new key version, every item in the circle re-encrypted,
 * key re-sealed to remaining members, old ciphertext and old sealed keys deleted.
 */
export async function removeMemberAndRotate(circleId: string, memberId: string) {
  return rotateCircle(circleId, memberId);
}

/** Rotate every circle I own, e.g. after revoking a lost phone. */
export async function rotateAllMyCircles() {
  const uid = await myId();
  const { data, error } = await supabase.from('circles').select('id').eq('owner_id', uid);
  if (error) throw error;
  for (const c of data ?? []) await rotateCircle(c.id);
}

/**
 * New circle key version: every item re-encrypted and re-signed, key re-sealed only to
 * currently trusted devices (revoked ones are excluded), old sealed keys deleted.
 */
export async function rotateCircle(circleId: string, removeUserId?: string) {
  const c = crypto();
  const uid = await myId();
  const { data: circle, error } = await supabase.from('circles').select('key_version, name_ciphertext').eq('id', circleId).single();
  if (error || !circle) throw error ?? new Error('Circle not found');
  const oldV = circle.key_version as number;
  const newV = oldV + 1;
  const oldKey = await getCircleKey(circleId, oldV);
  const newKey = c.newSymmetricKey();

  if (removeUserId) {
    const rm = await supabase.rpc('remove_member', { p_circle_id: circleId, p_user_id: removeUserId });
    if (rm.error) throw rm.error;
  }

  const { data: members } = await supabase.from('circle_members').select('user_id').eq('circle_id', circleId).not('accepted_at', 'is', null);
  await sealToUsers(circleId, newV, newKey, [uid, ...(members ?? []).map((m) => m.user_id as string)]);

  const { data: items } = await supabase.from('items').select('id, ciphertext').eq('circle_id', circleId);
  const myIdentity = await loadIdentityPublicKey();
  if (!myIdentity) throw new Error('This phone is not set up yet');
  const idSk = await loadIdentityPrivateKey(); // one biometric prompt for the whole rotation
  try {
    for (const it of items ?? []) {
      const oldCtx = { kind: 'item' as const, itemId: it.id, ownerId: uid, keyVersion: oldV };
      const newCtx = { ...oldCtx, keyVersion: newV };
      // Never re-sign something we didn't write: skip rows whose signature doesn't verify.
      if (!c.verifyEnvelope(it.ciphertext as Envelope, oldCtx, myIdentity)) {
        await supabase.from('items').delete().eq('id', it.id);
        continue;
      }
      const plain = c.decryptJson(it.ciphertext as Envelope, oldKey, oldCtx);
      const ct = c.signEnvelope(c.encryptJson(plain, newKey, newCtx), newCtx, idSk);
      const up = await supabase.from('items').update({ ciphertext: ct, key_version: newV }).eq('id', it.id);
      if (up.error) throw up.error;
    }
  } finally {
    c.wipe(idSk);
  }
  const name = c.decryptJson(circle.name_ciphertext as Envelope, oldKey, { kind: 'circle_name', itemId: circleId, ownerId: uid, keyVersion: oldV });
  const nameCt = c.encryptJson(name, newKey, { kind: 'circle_name', itemId: circleId, ownerId: uid, keyVersion: newV });

  const fin = await supabase.rpc('finish_rotation', { p_circle_id: circleId, p_new_version: newV, p_name_ciphertext: nameCt });
  if (fin.error) throw fin.error;
  await cacheKey({ circleId, version: newV }, newKey);
  await forgetCircleKey(circleId, oldV);
  c.wipe(newKey);
}
