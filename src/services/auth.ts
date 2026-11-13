import { Passkey } from 'react-native-passkey';
import { supabase } from '../lib/supabase';
import { crypto } from '../crypto';
import {
  cacheKey,
  loadDeviceIdentity,
  loadDevicePrivateKey,
  loadIdentityPrivateKey,
  loadIdentityPublicKey,
  saveDeviceKeys,
  saveIdentity,
  wipeAllKeys,
} from '../crypto/keystore';
import { newRecoveryPhrase, isValidRecoveryPhrase } from '../crypto/recovery';

/**
 * Sign-in.
 * Primary: passkeys (Supabase Auth passkeys are in BETA — method names below follow the
 * May 2026 docs; re-check https://supabase.com/docs/guides/auth/passkeys before release).
 * The native ceremony runs through react-native-passkey (Face ID / fingerprint).
 * Fallback: 6-digit email code, used only to get in and register a passkey. No SMS, no passwords.
 *
 * Signing in only proves who you are to the server. It never unlocks data: that needs a device
 * certified by your account identity key (from an existing phone or your recovery phrase).
 */

type PasskeyApi = {
  startRegistration(): Promise<{ data: { challenge_id: string; options: unknown } | null; error: Error | null }>;
  verifyRegistration(a: { challengeId: string; credential: unknown }): Promise<{ error: Error | null }>;
  startAuthentication(): Promise<{ data: { challenge_id: string; options: unknown } | null; error: Error | null }>;
  verifyAuthentication(a: { challengeId: string; credential: unknown }): Promise<{ error: Error | null }>;
};
const passkeyApi = () => (supabase.auth as unknown as { passkey: PasskeyApi }).passkey;

export async function registerPasskey() {
  if (!Passkey.isSupported()) throw new Error('This phone does not support passkeys');
  const { data, error } = await passkeyApi().startRegistration();
  if (error || !data) throw error ?? new Error('Could not start passkey registration');
  const credential = await Passkey.create(data.options as never);
  const res = await passkeyApi().verifyRegistration({ challengeId: data.challenge_id, credential });
  if (res.error) throw res.error;
}

export async function signInWithPasskey() {
  const { data, error } = await passkeyApi().startAuthentication();
  if (error || !data) throw error ?? new Error('Could not start passkey sign-in');
  const credential = await Passkey.get(data.options as never);
  const res = await passkeyApi().verifyAuthentication({ challengeId: data.challenge_id, credential });
  if (res.error) throw res.error;
}

export async function sendEmailCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyEmailCode(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' });
  if (error) throw error;
}

async function userId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

export type EnrollResult =
  | { status: 'ready' }
  | { status: 'first-device'; recoveryPhrase: string } // show once, then discard
  | { status: 'awaiting-approval'; deviceId: string };

/**
 * Called after every sign-in.
 * - First device on the account: creates vault key, recovery phrase and account identity.
 * - Later devices: registered as pending; an existing phone (or the recovery phrase) certifies them.
 */
export async function enrollThisDevice(deviceLabel: string): Promise<EnrollResult> {
  const c = crypto();
  const uid = await userId();
  const existing = await loadDeviceIdentity();
  if (existing) {
    const { data } = await supabase.from('devices').select('cert, revoked_at').eq('id', existing.deviceId).single();
    if (data?.revoked_at) {
      await wipeAllKeys();
      throw new Error('This device was removed from your account');
    }
    if (!data?.cert) return { status: 'awaiting-approval', deviceId: existing.deviceId };
    if (!(await loadIdentityPublicKey())) await finishApprovalOnThisDevice();
    return { status: 'ready' };
  }

  const kp = c.newDeviceKeyPair();
  const { data: profile } = await supabase.from('profiles').select('identity_public_key').eq('id', uid).maybeSingle();
  const isFirst = !profile?.identity_public_key;

  const { data: dev, error } = await supabase
    .from('devices')
    .insert({ user_id: uid, label: deviceLabel.slice(0, 40), public_key: c.toB64(kp.publicKey) })
    .select('id')
    .single();
  if (error || !dev) throw error ?? new Error('Device registration failed');
  const publicKey = kp.publicKey;
  await saveDeviceKeys(dev.id, publicKey, kp.privateKey);

  if (!isFirst) return { status: 'awaiting-approval', deviceId: dev.id };

  // First device: vault key + recovery phrase + identity derived from it.
  const vaultKey = c.newSymmetricKey();
  const phrase = newRecoveryPhrase();
  const salt = c.newRecoverySalt();
  const recoveryKey = c.deriveRecoveryKey(phrase, c.fromB64(salt));
  const wrapped = c.wrapVaultKey(vaultKey, recoveryKey, uid);
  const identity = c.identityFromRecoveryKey(recoveryKey);
  c.wipe(recoveryKey);
  const cert = c.certifyDevice(identity.privateKey, uid, dev.id, publicKey);

  const steps = await Promise.all([
    supabase.from('profiles').update({ identity_public_key: c.toB64(identity.publicKey) }).eq('id', uid),
    supabase.from('recovery').upsert({ user_id: uid, salt, wrapped_vault_key: wrapped }),
    supabase.from('vault_keys').insert({
      user_id: uid,
      device_id: dev.id,
      sealed_key: c.sealKey(vaultKey, publicKey),
      sealed_identity: c.sealKey(identity.privateKey.slice(0, 32), publicKey),
    }),
  ]);
  const failed = steps.find((s) => s.error);
  if (failed?.error) throw failed.error;
  const rpc = await supabase.rpc('record_device_cert', { p_device_id: dev.id, p_cert: cert });
  if (rpc.error) throw rpc.error;

  await saveIdentity(identity.publicKey, identity.privateKey);
  await cacheKey('vault', vaultKey);
  c.wipe(vaultKey);
  return { status: 'first-device', recoveryPhrase: phrase };
}

/** Run on a trusted phone to certify a new one. Prompts for biometrics. */
export async function approveDevice(pendingDeviceId: string) {
  const c = crypto();
  const uid = await userId();
  const { data: pending, error } = await supabase.from('devices').select('id, public_key, cert').eq('id', pendingDeviceId).single();
  if (error || !pending || pending.cert) throw error ?? new Error('Nothing to approve');

  const me = await loadDeviceIdentity();
  if (!me) throw new Error('This phone is not enrolled');
  const sk = await loadDevicePrivateKey();
  const idSk = await loadIdentityPrivateKey();
  try {
    const { data: mine } = await supabase.from('vault_keys').select('sealed_key').eq('device_id', me.deviceId).single();
    if (!mine) throw new Error('No vault key for this phone');
    const vaultKey = c.openSealedKey(mine.sealed_key, me.publicKey, sk);
    const theirPk = c.fromB64(pending.public_key);
    const row = {
      user_id: uid,
      device_id: pending.id,
      sealed_key: c.sealKey(vaultKey, theirPk),
      sealed_identity: c.sealKey(idSk.slice(0, 32), theirPk), // Ed25519 seed half
    };
    c.wipe(vaultKey);
    const ins = await supabase.from('vault_keys').insert(row);
    if (ins.error) throw ins.error;
    const cert = c.certifyDevice(idSk, uid, pending.id, theirPk);
    const rpc = await supabase.rpc('record_device_cert', { p_device_id: pending.id, p_cert: cert });
    if (rpc.error) throw rpc.error;
  } finally {
    c.wipe(sk);
    c.wipe(idSk);
  }
}

/** On the newly approved phone: pick up the vault key and identity sealed to it. */
async function finishApprovalOnThisDevice() {
  const c = crypto();
  const me = await loadDeviceIdentity();
  if (!me) return;
  const { data } = await supabase.from('vault_keys').select('sealed_key, sealed_identity').eq('device_id', me.deviceId).single();
  if (!data) return;
  const sk = await loadDevicePrivateKey();
  try {
    const vaultKey = c.openSealedKey(data.sealed_key, me.publicKey, sk);
    const seed = c.openSealedKey(data.sealed_identity, me.publicKey, sk);
    const identity = c.identityFromSeed(seed);
    c.wipe(seed);
    await saveIdentity(identity.publicKey, identity.privateKey);
    await cacheKey('vault', vaultKey);
    c.wipe(vaultKey);
  } finally {
    c.wipe(sk);
  }
}

/** Lost every phone: the 24-word phrase restores the vault and re-derives the identity. */
export async function restoreWithRecoveryPhrase(phrase: string) {
  if (!isValidRecoveryPhrase(phrase)) throw new Error('That recovery phrase is not valid');
  const c = crypto();
  const uid = await userId();
  const me = await loadDeviceIdentity();
  if (!me) throw new Error('Enroll this phone first');
  const { data, error } = await supabase.from('recovery').select('salt, wrapped_vault_key').single();
  if (error || !data) throw error ?? new Error('No recovery data');
  const rk = c.deriveRecoveryKey(phrase, c.fromB64(data.salt));
  let vaultKey: Uint8Array;
  try {
    vaultKey = c.unwrapVaultKey(data.wrapped_vault_key, rk, uid);
  } catch {
    c.wipe(rk);
    throw new Error('That recovery phrase does not match this account');
  }
  const identity = c.identityFromRecoveryKey(rk);
  c.wipe(rk);

  const ins = await supabase.from('vault_keys').upsert({
    user_id: uid,
    device_id: me.deviceId,
    sealed_key: c.sealKey(vaultKey, me.publicKey),
    sealed_identity: c.sealKey(identity.privateKey.slice(0, 32), me.publicKey),
  });
  if (ins.error) throw ins.error;
  const cert = c.certifyDevice(identity.privateKey, uid, me.deviceId, me.publicKey);
  const rpc = await supabase.rpc('record_device_cert', { p_device_id: me.deviceId, p_cert: cert });
  if (rpc.error) throw rpc.error;
  await saveIdentity(identity.publicKey, identity.privateKey);
  await cacheKey('vault', vaultKey);
  c.wipe(vaultKey);
}

/**
 * Remove a lost or old phone, then replace the key of every circle you own so the
 * phone can't read anything shared from now on.
 */
export async function revokeDevice(deviceId: string) {
  const me = await loadDeviceIdentity();
  if (me?.deviceId === deviceId) throw new Error('Use Sign out to remove this phone');
  const { error } = await supabase.rpc('revoke_device', { p_device_id: deviceId });
  if (error) throw error;
  const { rotateAllMyCircles } = await import('./circles');
  await rotateAllMyCircles();
}

export async function signOutAndWipe() {
  await supabase.auth.signOut({ scope: 'local' });
  await wipeAllKeys();
}
