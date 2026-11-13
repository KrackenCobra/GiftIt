/**
 * GiftIt end-to-end encryption core.
 *
 * Pure functions over an injected libsodium instance, so the same code runs
 * in the app (react-native-libsodium) and in Node tests (libsodium-wrappers-sumo).
 *
 * Primitives:
 *  - Item encryption: XChaCha20-Poly1305 (IETF AEAD), random 24-byte nonce per write,
 *    with item/owner/key-version bound as associated data so ciphertext can't be
 *    moved between rows or replayed under an old key version.
 *  - Key distribution: X25519 sealed boxes (crypto_box_seal) to each device public key.
 *  - Recovery: Argon2id over a 24-word phrase wraps the personal vault key.
 *  - Account identity: an Ed25519 key derived from the recovery key. It certifies each device.
 *    Friends pin it after comparing safety numbers, and only seal circle keys to devices
 *    carrying a valid certificate, so a stolen session or a malicious server can't add a
 *    device that friends will trust.
 */

export interface SodiumLike {
  crypto_aead_xchacha20poly1305_ietf_encrypt(
    message: Uint8Array,
    additionalData: Uint8Array | null,
    secretNonce: null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_decrypt(
    secretNonce: null,
    ciphertext: Uint8Array,
    additionalData: Uint8Array | null,
    publicNonce: Uint8Array,
    key: Uint8Array,
  ): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_keygen(): Uint8Array;
  crypto_aead_xchacha20poly1305_ietf_NPUBBYTES: number;
  crypto_aead_xchacha20poly1305_ietf_KEYBYTES: number;
  crypto_box_keypair(): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_box_seal(message: Uint8Array, publicKey: Uint8Array): Uint8Array;
  crypto_box_seal_open(ciphertext: Uint8Array, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array;
  crypto_box_PUBLICKEYBYTES: number;
  crypto_pwhash(
    keyLength: number,
    password: Uint8Array,
    salt: Uint8Array,
    opsLimit: number,
    memLimit: number,
    algorithm: number,
  ): Uint8Array;
  crypto_pwhash_SALTBYTES: number;
  crypto_pwhash_OPSLIMIT_MODERATE: number;
  crypto_pwhash_MEMLIMIT_INTERACTIVE: number;
  crypto_pwhash_ALG_ARGON2ID13: number;
  crypto_generichash(hashLength: number, message: Uint8Array, key?: Uint8Array | null): Uint8Array;
  crypto_sign_seed_keypair(seed: Uint8Array): { publicKey: Uint8Array; privateKey: Uint8Array };
  crypto_sign_detached(message: Uint8Array, privateKey: Uint8Array): Uint8Array;
  crypto_sign_verify_detached(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean;
  randombytes_buf(length: number): Uint8Array;
  from_string(s: string): Uint8Array;
  to_string(b: Uint8Array): string;
  to_base64(b: Uint8Array, variant?: number): string;
  from_base64(s: string, variant?: number): Uint8Array;
  memzero(b: Uint8Array): void;
  base64_variants: { URLSAFE_NO_PADDING: number };
}

export const ENVELOPE_VERSION = 1 as const;

/** What is stored in the `ciphertext` column. Contains no plaintext metadata. */
export interface Envelope {
  v: typeof ENVELOPE_VERSION;
  n: string; // nonce, base64url
  c: string; // ciphertext + Poly1305 tag, base64url
}

/** Bound into every item's AEAD tag. All fields must match on decrypt. */
export interface ItemContext {
  kind: 'item' | 'date' | 'gift_plan' | 'circle_name';
  itemId: string;
  ownerId: string;
  keyVersion: number;
}

export class DecryptionError extends Error {
  constructor() {
    super('Decryption failed: wrong key, tampered data or mismatched context');
    this.name = 'DecryptionError';
  }
}

export function createCrypto(sodium: SodiumLike) {
  const B64 = sodium.base64_variants.URLSAFE_NO_PADDING;
  const b64 = (u: Uint8Array) => sodium.to_base64(u, B64);
  const unb64 = (s: string) => sodium.from_base64(s, B64);

  /** Canonical, order-stable encoding of the associated data. */
  function contextBytes(ctx: ItemContext): Uint8Array {
    if (!ctx.itemId || !ctx.ownerId || !Number.isInteger(ctx.keyVersion) || ctx.keyVersion < 1) {
      throw new Error('Invalid item context');
    }
    return sodium.from_string(
      `giftit/v${ENVELOPE_VERSION}|${ctx.kind}|${ctx.itemId}|${ctx.ownerId}|${ctx.keyVersion}`,
    );
  }

  function newSymmetricKey(): Uint8Array {
    return sodium.crypto_aead_xchacha20poly1305_ietf_keygen();
  }

  function newDeviceKeyPair() {
    const kp = sodium.crypto_box_keypair();
    return { publicKey: kp.publicKey, privateKey: kp.privateKey };
  }

  function encryptJson(value: unknown, key: Uint8Array, ctx: ItemContext): Envelope {
    assertKey(key);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
    const plaintext = sodium.from_string(JSON.stringify(value));
    const ct = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, contextBytes(ctx), null, nonce, key);
    sodium.memzero(plaintext);
    return { v: ENVELOPE_VERSION, n: b64(nonce), c: b64(ct) };
  }

  function decryptJson<T = unknown>(env: Envelope, key: Uint8Array, ctx: ItemContext): T {
    assertKey(key);
    if (!env || env.v !== ENVELOPE_VERSION) throw new DecryptionError();
    let pt: Uint8Array;
    try {
      pt = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, unb64(env.c), contextBytes(ctx), unb64(env.n), key);
    } catch {
      throw new DecryptionError();
    }
    const text = sodium.to_string(pt);
    sodium.memzero(pt);
    return JSON.parse(text) as T;
  }

  /** Seal a symmetric key (vault or circle key) to one device's public key. */
  function sealKey(key: Uint8Array, recipientPublicKey: Uint8Array): string {
    assertKey(key);
    if (recipientPublicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) throw new Error('Bad public key');
    return b64(sodium.crypto_box_seal(key, recipientPublicKey));
  }

  function openSealedKey(sealed: string, publicKey: Uint8Array, privateKey: Uint8Array): Uint8Array {
    try {
      const key = sodium.crypto_box_seal_open(unb64(sealed), publicKey, privateKey);
      assertKey(key);
      return key;
    } catch {
      throw new DecryptionError();
    }
  }

  /**
   * Derive a key-wrapping key from the 24-word recovery phrase.
   * The phrase already carries 256 bits of entropy; Argon2id adds cost to any offline guessing
   * of a mistyped / partially leaked phrase.
   */
  function deriveRecoveryKey(phrase: string, salt: Uint8Array): Uint8Array {
    if (salt.length !== sodium.crypto_pwhash_SALTBYTES) throw new Error('Bad salt');
    const normalized = phrase.normalize('NFKD').trim().toLowerCase().split(/\s+/).join(' ');
    return sodium.crypto_pwhash(
      sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES,
      sodium.from_string(normalized),
      salt,
      sodium.crypto_pwhash_OPSLIMIT_MODERATE,
      sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
      sodium.crypto_pwhash_ALG_ARGON2ID13,
    );
  }

  function newRecoverySalt(): string {
    return b64(sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES));
  }

  /** Wrap the vault key under the recovery key. Stored server-side; useless without the phrase. */
  function wrapVaultKey(vaultKey: Uint8Array, recoveryKey: Uint8Array, userId: string): Envelope {
    return encryptJson(b64(vaultKey), recoveryKey, { kind: 'item', itemId: 'vault-key', ownerId: userId, keyVersion: 1 });
  }

  function unwrapVaultKey(env: Envelope, recoveryKey: Uint8Array, userId: string): Uint8Array {
    const k = decryptJson<string>(env, recoveryKey, { kind: 'item', itemId: 'vault-key', ownerId: userId, keyVersion: 1 });
    return unb64(k);
  }

  /** Account identity signing key, deterministic from the recovery key (so the phrase restores it). */
  function identityFromRecoveryKey(recoveryKey: Uint8Array) {
    const seed = sodium.crypto_generichash(32, sodium.from_string('giftit/identity-seed/v1'), recoveryKey);
    const kp = sodium.crypto_sign_seed_keypair(seed);
    sodium.memzero(seed);
    return { publicKey: kp.publicKey, privateKey: kp.privateKey };
  }

  /** Rebuild the identity key from its 32-byte seed (how it is shared between your own phones). */
  function identityFromSeed(seed: Uint8Array) {
    const kp = sodium.crypto_sign_seed_keypair(seed);
    return { publicKey: kp.publicKey, privateKey: kp.privateKey };
  }

  function certMessage(userId: string, deviceId: string, devicePublicKey: Uint8Array) {
    return sodium.from_string(`giftit/device-cert/v1|${userId}|${deviceId}|${b64(devicePublicKey)}`);
  }

  /** Signed statement: "this device key belongs to this account". */
  function certifyDevice(identityPrivateKey: Uint8Array, userId: string, deviceId: string, devicePublicKey: Uint8Array): string {
    return b64(sodium.crypto_sign_detached(certMessage(userId, deviceId, devicePublicKey), identityPrivateKey));
  }

  function verifyDeviceCert(
    identityPublicKey: Uint8Array,
    userId: string,
    deviceId: string,
    devicePublicKey: Uint8Array,
    cert: string,
  ): boolean {
    try {
      return sodium.crypto_sign_verify_detached(unb64(cert), certMessage(userId, deviceId, devicePublicKey), identityPublicKey);
    } catch {
      return false;
    }
  }

  /**
   * Safety number two people compare in person (or on a call) before a circle key is sealed
   * to a new member. Computed over both account identity keys. Order-independent; 30 digits in 6 groups.
   */
  function safetyNumber(publicKeyA: Uint8Array, publicKeyB: Uint8Array): string {
    const [first, second] = [b64(publicKeyA), b64(publicKeyB)].sort();
    const digest = sodium.crypto_generichash(32, sodium.from_string(`giftit-safety|${first}|${second}`));
    const groups: string[] = [];
    for (let i = 0; i < 6; i++) {
      const view = new DataView(digest.buffer, digest.byteOffset + i * 4, 4);
      groups.push(String(view.getUint32(0) % 100000).padStart(5, '0'));
    }
    return groups.join(' ');
  }

  function assertKey(key: Uint8Array) {
    if (!(key instanceof Uint8Array) || key.length !== sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES) {
      throw new Error('Bad symmetric key');
    }
  }

  return {
    newSymmetricKey,
    newDeviceKeyPair,
    encryptJson,
    decryptJson,
    sealKey,
    openSealedKey,
    deriveRecoveryKey,
    newRecoverySalt,
    wrapVaultKey,
    unwrapVaultKey,
    identityFromRecoveryKey,
    identityFromSeed,
    certifyDevice,
    verifyDeviceCert,
    safetyNumber,
    toB64: b64,
    fromB64: unb64,
    wipe: (b: Uint8Array) => sodium.memzero(b),
  };
}

export type GiftItCrypto = ReturnType<typeof createCrypto>;
