import sodium, { ready } from 'react-native-libsodium';
import { createCrypto, type GiftItCrypto, type SodiumLike } from './core';

let instance: GiftItCrypto | null = null;

/** Call once at startup before any crypto use. */
export async function initCrypto(): Promise<GiftItCrypto> {
  if (instance) return instance;
  await ready;
  instance = createCrypto(sodium as unknown as SodiumLike);
  return instance;
}

export function crypto(): GiftItCrypto {
  if (!instance) throw new Error('initCrypto() has not finished');
  return instance;
}

export * from './core';
