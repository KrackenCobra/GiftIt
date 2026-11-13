import { randomUUID } from 'expo-crypto';
import { supabase } from '../lib/supabase';
import { crypto, type Envelope } from '../crypto';
import { getCircleKey, getVaultKey } from './keys';

export const CATEGORIES = ['color', 'flower', 'food', 'size', 'brand', 'hobby', 'scent', 'genre', 'custom', 'wishlist'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface FavoritePlain {
  value: string; // for wishlist items: the product name
  note?: string;
  url?: string; // wishlist items only; already sanitized
}

export interface Favorite extends FavoritePlain {
  id: string;
  ownerId: string;
  category: Category;
  scope: 'private' | 'circle';
  circleId: string | null;
}

export type Scope = { type: 'private' } | { type: 'circle'; circleId: string };

const MAX_VALUE = 120;
const MAX_NOTE = 280;

function clean(input: FavoritePlain): FavoritePlain {
  const value = input.value.trim().slice(0, MAX_VALUE);
  if (!value) throw new Error('Enter a favorite');
  const note = input.note?.trim().slice(0, MAX_NOTE);
  const out: FavoritePlain = { value };
  if (note) out.note = note;
  if (input.url) out.url = input.url;
  return out;
}

async function myId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Not signed in');
  return data.user.id;
}

async function currentCircleVersion(circleId: string): Promise<number> {
  const { data, error } = await supabase.from('circles').select('key_version').eq('id', circleId).single();
  if (error || !data) throw error ?? new Error('Circle not found');
  return data.key_version as number;
}

/** Encrypts on this phone, then stores ciphertext only. Default scope is Private. */
export async function saveFavorite(category: Category, input: FavoritePlain, scope: Scope = { type: 'private' }) {
  const c = crypto();
  const ownerId = await myId();
  const id = randomUUID();
  const plain = clean(input);

  let key: Uint8Array;
  let keyVersion = 1;
  if (scope.type === 'private') {
    key = await getVaultKey();
  } else {
    keyVersion = await currentCircleVersion(scope.circleId);
    key = await getCircleKey(scope.circleId, keyVersion);
  }
  const ciphertext = c.encryptJson(plain, key, { kind: 'item', itemId: id, ownerId, keyVersion });

  const { error } = await supabase.from('items').insert({
    id,
    owner_id: ownerId,
    category,
    scope: scope.type,
    circle_id: scope.type === 'circle' ? scope.circleId : null,
    key_version: keyVersion,
    ciphertext,
  });
  if (error) throw error;
  return id;
}

type ItemRow = {
  id: string;
  owner_id: string;
  category: Category;
  scope: 'private' | 'circle';
  circle_id: string | null;
  key_version: number;
  ciphertext: Envelope;
};

async function decryptRow(row: ItemRow): Promise<Favorite | null> {
  try {
    const key = row.scope === 'private' ? await getVaultKey() : await getCircleKey(row.circle_id!, row.key_version);
    const plain = crypto().decryptJson<FavoritePlain>(row.ciphertext, key, {
      kind: 'item',
      itemId: row.id,
      ownerId: row.owner_id,
      keyVersion: row.key_version,
    });
    return { id: row.id, ownerId: row.owner_id, category: row.category, scope: row.scope, circleId: row.circle_id, ...plain };
  } catch {
    // Tampered, rotated-away or not-yet-shared item: skip rather than show garbage.
    return null;
  }
}

const COLS = 'id, owner_id, category, scope, circle_id, key_version, ciphertext';

export async function listMyFavorites(): Promise<Favorite[]> {
  const uid = await myId();
  const { data, error } = await supabase.from('items').select(COLS).eq('owner_id', uid).order('created_at');
  if (error) throw error;
  const out = await Promise.all((data as ItemRow[]).map(decryptRow));
  return out.filter((x): x is Favorite => x !== null);
}

/** What a friend has shared with you. RLS returns only rows in circles you're an approved member of. */
export async function listSharedBy(friendId: string): Promise<Favorite[]> {
  const { data, error } = await supabase.from('items').select(COLS).eq('owner_id', friendId).eq('scope', 'circle');
  if (error) throw error;
  const out = await Promise.all((data as ItemRow[]).map(decryptRow));
  return out.filter((x): x is Favorite => x !== null);
}

export async function deleteFavorite(id: string) {
  const { error } = await supabase.from('items').delete().eq('id', id);
  if (error) throw error;
}
