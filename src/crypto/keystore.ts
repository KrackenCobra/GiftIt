import * as SecureStore from 'expo-secure-store';
import { crypto } from './index';

/**
 * Device-bound key storage.
 * iOS: Keychain, WHEN_UNLOCKED_THIS_DEVICE_ONLY (never synced to iCloud, never in backups).
 * Android: Keystore-backed EncryptedSharedPreferences; app has allowBackup=false.
 * Private keys additionally require biometric / device-passcode auth on every read.
 */
const PROTECTED: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: true,
  authenticationPrompt: 'Unlock your GiftIt keys',
};
const DEVICE_ONLY: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const K = {
  devicePriv: 'giftit.device.sk',
  devicePub: 'giftit.device.pk',
  deviceId: 'giftit.device.id',
  vaultKey: 'giftit.vault.key',
  identitySk: 'giftit.identity.sk',
  identityPk: 'giftit.identity.pk',
  pin: (userId: string) => `giftit.pin.${userId}`,
  circleKey: (circleId: string, version: number) => `giftit.circle.${circleId}.v${version}`,
};

export async function saveDeviceKeys(deviceId: string, publicKey: Uint8Array, privateKey: Uint8Array) {
  const c = crypto();
  await SecureStore.setItemAsync(K.devicePriv, c.toB64(privateKey), PROTECTED);
  await SecureStore.setItemAsync(K.devicePub, c.toB64(publicKey), DEVICE_ONLY);
  await SecureStore.setItemAsync(K.deviceId, deviceId, DEVICE_ONLY);
  c.wipe(privateKey);
}

export async function loadDeviceIdentity() {
  const [id, pub] = await Promise.all([
    SecureStore.getItemAsync(K.deviceId, DEVICE_ONLY),
    SecureStore.getItemAsync(K.devicePub, DEVICE_ONLY),
  ]);
  if (!id || !pub) return null;
  return { deviceId: id, publicKey: crypto().fromB64(pub) };
}

/** Prompts for biometrics. Caller must wipe() the returned key when done. */
export async function loadDevicePrivateKey(): Promise<Uint8Array> {
  const sk = await SecureStore.getItemAsync(K.devicePriv, PROTECTED);
  if (!sk) throw new Error('No device key on this phone');
  return crypto().fromB64(sk);
}

/** Account identity key: lets this phone certify new devices. Private half is biometric-gated. */
export async function saveIdentity(publicKey: Uint8Array, privateKey: Uint8Array) {
  const c = crypto();
  await SecureStore.setItemAsync(K.identitySk, c.toB64(privateKey), PROTECTED);
  await SecureStore.setItemAsync(K.identityPk, c.toB64(publicKey), DEVICE_ONLY);
  c.wipe(privateKey);
}

export async function loadIdentityPublicKey() {
  const v = await SecureStore.getItemAsync(K.identityPk, DEVICE_ONLY);
  return v ? crypto().fromB64(v) : null;
}

/** Prompts for biometrics. Caller must wipe() it. */
export async function loadIdentityPrivateKey(): Promise<Uint8Array> {
  const v = await SecureStore.getItemAsync(K.identitySk, PROTECTED);
  if (!v) throw new Error('This phone cannot approve devices');
  return crypto().fromB64(v);
}

/** Friend's identity key, pinned after the two of you compared safety numbers. */
export async function pinIdentity(userId: string, identityPublicKey: Uint8Array) {
  await SecureStore.setItemAsync(K.pin(userId), crypto().toB64(identityPublicKey), DEVICE_ONLY);
}

export async function getPinnedIdentity(userId: string) {
  const v = await SecureStore.getItemAsync(K.pin(userId), DEVICE_ONLY);
  return v ? crypto().fromB64(v) : null;
}

/** Symmetric keys are cached in the keychain after first unwrap so the app doesn't re-prompt per item. */
export async function cacheKey(name: 'vault' | { circleId: string; version: number }, key: Uint8Array) {
  const slot = name === 'vault' ? K.vaultKey : K.circleKey(name.circleId, name.version);
  await SecureStore.setItemAsync(slot, crypto().toB64(key), DEVICE_ONLY);
}

export async function getCachedKey(name: 'vault' | { circleId: string; version: number }) {
  const slot = name === 'vault' ? K.vaultKey : K.circleKey(name.circleId, name.version);
  const v = await SecureStore.getItemAsync(slot, DEVICE_ONLY);
  return v ? crypto().fromB64(v) : null;
}

export async function forgetCircleKey(circleId: string, version: number) {
  await SecureStore.deleteItemAsync(K.circleKey(circleId, version), DEVICE_ONLY);
}

/** Sign-out / device wipe. */
export async function wipeAllKeys(knownCircleKeys: { circleId: string; version: number }[] = []) {
  await Promise.all([
    SecureStore.deleteItemAsync(K.devicePriv, PROTECTED),
    SecureStore.deleteItemAsync(K.devicePub, DEVICE_ONLY),
    SecureStore.deleteItemAsync(K.deviceId, DEVICE_ONLY),
    SecureStore.deleteItemAsync(K.vaultKey, DEVICE_ONLY),
    SecureStore.deleteItemAsync(K.identitySk, PROTECTED),
    SecureStore.deleteItemAsync(K.identityPk, DEVICE_ONLY),
    ...knownCircleKeys.map((c) => forgetCircleKey(c.circleId, c.version)),
  ]);
}
