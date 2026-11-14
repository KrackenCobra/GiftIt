import type { Favorite, Scope } from '../../src/services/items';
import type { FriendWishlistItem } from '../../src/services/wishlist';
import { sanitizeProductUrl } from '../../src/crypto/links';
import { db, ME } from '../data';
import { listMyFavorites, listSharedBy, saveFavorite } from './items';

export type { FriendWishlistItem };

export async function addWishlistItem(input: { name: string; url: string; note?: string }, scope: Scope) {
  const url = sanitizeProductUrl(input.url);
  const note = input.note?.trim();
  return saveFavorite('wishlist', { value: input.name, url, ...(note ? { note } : {}) }, scope);
}

export async function myWishlist(): Promise<Favorite[]> {
  return (await listMyFavorites()).filter((f) => f.category === 'wishlist');
}

export async function friendWishlist(friendId: string): Promise<FriendWishlistItem[]> {
  const items = (await listSharedBy(friendId)).filter((f) => f.category === 'wishlist');
  return items.map((i) => {
    const who = db.claims.get(i.id) ?? new Set<string>();
    return { ...i, claimedByMe: who.has(ME), claimedBySomeone: who.size > 0 };
  });
}

export async function claimItem(itemId: string) {
  const who = db.claims.get(itemId) ?? new Set<string>();
  if (who.size > 0 && !who.has(ME)) throw new Error('Someone is already getting this');
  db.claims.set(itemId, who.add(ME));
}

export async function unclaimItem(itemId: string) {
  db.claims.get(itemId)?.delete(ME);
}

/** Preview only: product links never open. */
export async function openProductLink(url: string) {
  sanitizeProductUrl(url);
}
