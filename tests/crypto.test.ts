import sodiumLib from 'libsodium-wrappers-sumo';
import { createCrypto, DecryptionError, type GiftItCrypto, type ItemContext, type SodiumLike } from '../src/crypto/core';

let c: GiftItCrypto;
beforeAll(async () => {
  await sodiumLib.ready;
  c = createCrypto(sodiumLib as unknown as SodiumLike);
});

const ctx: ItemContext = { kind: 'item', itemId: 'item-1', ownerId: 'user-a', keyVersion: 1 };

describe('item encryption', () => {
  test('round-trips', () => {
    const key = c.newSymmetricKey();
    const env = c.encryptJson({ value: 'Peonies', note: 'not roses' }, key, ctx);
    expect(c.decryptJson(env, key, ctx)).toEqual({ value: 'Peonies', note: 'not roses' });
  });

  test('ciphertext contains no plaintext and nonces never repeat', () => {
    const key = c.newSymmetricKey();
    const a = c.encryptJson({ value: 'Teal' }, key, ctx);
    const b = c.encryptJson({ value: 'Teal' }, key, ctx);
    expect(JSON.stringify(a)).not.toMatch(/Teal/);
    expect(a.n).not.toEqual(b.n);
    expect(a.c).not.toEqual(b.c);
  });

  test('wrong key fails', () => {
    const env = c.encryptJson({ value: 'x' }, c.newSymmetricKey(), ctx);
    expect(() => c.decryptJson(env, c.newSymmetricKey(), ctx)).toThrow(DecryptionError);
  });

  test('tampered ciphertext fails', () => {
    const key = c.newSymmetricKey();
    const env = c.encryptJson({ value: 'x' }, key, ctx);
    const raw = c.fromB64(env.c);
    raw[0] = raw[0]! ^ 1;
    expect(() => c.decryptJson({ ...env, c: c.toB64(raw) }, key, ctx)).toThrow(DecryptionError);
  });

  test.each([
    ['moved to another row', { ...ctx, itemId: 'item-2' }],
    ['claimed by another owner', { ...ctx, ownerId: 'user-b' }],
    ['replayed under another key version', { ...ctx, keyVersion: 2 }],
    ['reused as another kind', { ...ctx, kind: 'gift_plan' as const }],
  ])('context binding: %s fails', (_label, other) => {
    const key = c.newSymmetricKey();
    const env = c.encryptJson({ value: 'x' }, key, ctx);
    expect(() => c.decryptJson(env, key, other)).toThrow(DecryptionError);
  });

  test('rejects bad keys and contexts', () => {
    expect(() => c.encryptJson({}, new Uint8Array(16), ctx)).toThrow('Bad symmetric key');
    expect(() => c.encryptJson({}, c.newSymmetricKey(), { ...ctx, keyVersion: 0 })).toThrow('Invalid item context');
  });
});

describe('key sealing (sharing a circle key with a device)', () => {
  test('only the recipient device can open it', () => {
    const friend = c.newDeviceKeyPair();
    const stranger = c.newDeviceKeyPair();
    const circleKey = c.newSymmetricKey();
    const sealed = c.sealKey(circleKey, friend.publicKey);
    expect(c.openSealedKey(sealed, friend.publicKey, friend.privateKey)).toEqual(circleKey);
    expect(() => c.openSealedKey(sealed, stranger.publicKey, stranger.privateKey)).toThrow(DecryptionError);
  });

  test('end to end: owner shares, friend decrypts, removed friend cannot read rotated item', () => {
    const friend = c.newDeviceKeyPair();
    const v1 = c.newSymmetricKey();
    const env1 = c.encryptJson({ value: 'Teal' }, v1, ctx);
    const friendKey = c.openSealedKey(c.sealKey(v1, friend.publicKey), friend.publicKey, friend.privateKey);
    expect(c.decryptJson(env1, friendKey, ctx)).toEqual({ value: 'Teal' });

    const v2 = c.newSymmetricKey();
    const ctx2 = { ...ctx, keyVersion: 2 };
    const env2 = c.encryptJson({ value: 'Teal' }, v2, ctx2);
    expect(() => c.decryptJson(env2, friendKey, ctx2)).toThrow(DecryptionError);
  });
});

describe('recovery and identity', () => {
  const phrase = 'abandon '.repeat(23) + 'art';

  test('phrase unwraps the vault key; a wrong phrase does not', () => {
    const salt = c.fromB64(c.newRecoverySalt());
    const vault = c.newSymmetricKey();
    const wrapped = c.wrapVaultKey(vault, c.deriveRecoveryKey(phrase, salt), 'user-a');
    expect(c.unwrapVaultKey(wrapped, c.deriveRecoveryKey(`  ${phrase.toUpperCase()} `, salt), 'user-a')).toEqual(vault);
    expect(() => c.unwrapVaultKey(wrapped, c.deriveRecoveryKey(phrase.replace('art', 'zoo'), salt), 'user-a')).toThrow(DecryptionError);
    expect(() => c.unwrapVaultKey(wrapped, c.deriveRecoveryKey(phrase, salt), 'user-b')).toThrow(DecryptionError);
  });

  test('identity is deterministic from the phrase and from its seed', () => {
    const salt = c.fromB64(c.newRecoverySalt());
    const a = c.identityFromRecoveryKey(c.deriveRecoveryKey(phrase, salt));
    const b = c.identityFromRecoveryKey(c.deriveRecoveryKey(phrase, salt));
    expect(a.publicKey).toEqual(b.publicKey);
    expect(c.identityFromSeed(a.privateKey.slice(0, 32)).publicKey).toEqual(a.publicKey);
  });

  test('device certificates: valid only for the exact account, device and key', () => {
    const id = c.identityFromSeed(c.newSymmetricKey());
    const other = c.identityFromSeed(c.newSymmetricKey());
    const dev = c.newDeviceKeyPair();
    const evil = c.newDeviceKeyPair();
    const cert = c.certifyDevice(id.privateKey, 'user-a', 'dev-1', dev.publicKey);
    expect(c.verifyDeviceCert(id.publicKey, 'user-a', 'dev-1', dev.publicKey, cert)).toBe(true);
    expect(c.verifyDeviceCert(other.publicKey, 'user-a', 'dev-1', dev.publicKey, cert)).toBe(false); // forged by server
    expect(c.verifyDeviceCert(id.publicKey, 'user-a', 'dev-1', evil.publicKey, cert)).toBe(false); // swapped key
    expect(c.verifyDeviceCert(id.publicKey, 'user-b', 'dev-1', dev.publicKey, cert)).toBe(false);
    expect(c.verifyDeviceCert(id.publicKey, 'user-a', 'dev-1', dev.publicKey, 'garbage')).toBe(false);
  });

  test('identity seed survives being sealed to a new device', () => {
    const id = c.identityFromSeed(c.newSymmetricKey());
    const newPhone = c.newDeviceKeyPair();
    const seed = c.openSealedKey(c.sealKey(id.privateKey.slice(0, 32), newPhone.publicKey), newPhone.publicKey, newPhone.privateKey);
    expect(c.identityFromSeed(seed).publicKey).toEqual(id.publicKey);
  });

  test('safety number is symmetric and changes when a key changes', () => {
    const a = c.identityFromSeed(c.newSymmetricKey()).publicKey;
    const b = c.identityFromSeed(c.newSymmetricKey()).publicKey;
    const m = c.identityFromSeed(c.newSymmetricKey()).publicKey;
    expect(c.safetyNumber(a, b)).toEqual(c.safetyNumber(b, a));
    expect(c.safetyNumber(a, b)).toMatch(/^\d{5}( \d{5}){5}$/);
    expect(c.safetyNumber(a, m)).not.toEqual(c.safetyNumber(a, b));
  });
});
