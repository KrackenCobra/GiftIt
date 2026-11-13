import { supabase } from '../lib/supabase';
import { crypto } from '../crypto';
import { cacheKey, getCachedKey, loadDeviceIdentity, loadDevicePrivateKey } from '../crypto/keystore';

/** Personal vault key (encrypts Private items). Unsealed once per install, then cached in the keychain. */
export async function getVaultKey(): Promise<Uint8Array> {
  const cached = await getCachedKey('vault');
  if (cached) return cached;
  const me = await loadDeviceIdentity();
  if (!me) throw new Error('Device not enrolled');
  const { data, error } = await supabase.from('vault_keys').select('sealed_key').eq('device_id', me.deviceId).single();
  if (error || !data) throw error ?? new Error('Vault key not available for this device yet');
  const sk = await loadDevicePrivateKey();
  try {
    const key = crypto().openSealedKey(data.sealed_key, me.publicKey, sk);
    await cacheKey('vault', key);
    return key;
  } finally {
    crypto().wipe(sk);
  }
}

/** A circle key at a given version, sealed to this device by the circle's owner. */
export async function getCircleKey(circleId: string, version: number): Promise<Uint8Array> {
  const slot = { circleId, version };
  const cached = await getCachedKey(slot);
  if (cached) return cached;
  const me = await loadDeviceIdentity();
  if (!me) throw new Error('Device not enrolled');
  const { data, error } = await supabase
    .from('circle_keys')
    .select('sealed_key')
    .eq('circle_id', circleId)
    .eq('key_version', version)
    .eq('device_id', me.deviceId)
    .single();
  if (error || !data) throw error ?? new Error('No access to this circle');
  const sk = await loadDevicePrivateKey();
  try {
    const key = crypto().openSealedKey(data.sealed_key, me.publicKey, sk);
    await cacheKey(slot, key);
    return key;
  } finally {
    crypto().wipe(sk);
  }
}
