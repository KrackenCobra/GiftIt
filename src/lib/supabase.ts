import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import { crypto } from '../crypto';

/**
 * Session storage: Supabase sessions exceed SecureStore's ~2 KB limit, so the session JSON
 * is encrypted with a random key that lives in the keychain, and only the ciphertext goes
 * to AsyncStorage. (Pattern recommended by Supabase for React Native.)
 */
const SESSION_KEY_SLOT = 'giftit.session.key';
const SESSION_CTX = { kind: 'item' as const, itemId: 'session', ownerId: 'local', keyVersion: 1 };

async function sessionKey(): Promise<Uint8Array> {
  const c = crypto();
  const existing = await SecureStore.getItemAsync(SESSION_KEY_SLOT, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (existing) return c.fromB64(existing);
  const key = c.newSymmetricKey();
  await SecureStore.setItemAsync(SESSION_KEY_SLOT, c.toB64(key), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return key;
}

const EncryptedSessionStorage = {
  async getItem(name: string) {
    const raw = await AsyncStorage.getItem(name);
    if (!raw) return null;
    try {
      return crypto().decryptJson<string>(JSON.parse(raw), await sessionKey(), SESSION_CTX);
    } catch {
      await AsyncStorage.removeItem(name);
      return null;
    }
  },
  async setItem(name: string, value: string) {
    const env = crypto().encryptJson(value, await sessionKey(), SESSION_CTX);
    await AsyncStorage.setItem(name, JSON.stringify(env));
  },
  async removeItem(name: string) {
    await AsyncStorage.removeItem(name);
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY');
if (!url.startsWith('https://')) throw new Error('Supabase URL must use HTTPS');

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: EncryptedSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
    // Passkeys are in beta in Supabase Auth; opt-in is required.
    // See https://supabase.com/docs/guides/auth/passkeys
    experimental: { passkey: true },
  } as never,
});
