import type { Category, Favorite, FavoritePlain, Scope } from '../../src/services/items';
import { db, id, ME, wait } from '../data';

export type { Category, Favorite, FavoritePlain, Scope };

export class NotVerifiedError extends Error {
  constructor() {
    super('Compare safety numbers with this person to see their items');
    this.name = 'NotVerifiedError';
  }
}

export const CATEGORIES = ['color', 'flower', 'food', 'size', 'brand', 'hobby', 'scent', 'genre', 'custom', 'wishlist'] as const;

export async function saveFavorite(category: Category, input: FavoritePlain, scope: Scope = { type: 'private' }) {
  await wait(300);
  const itemId = id('item');
  db.items.push({
    id: itemId,
    ownerId: ME,
    category,
    scope: scope.type,
    circleId: scope.type === 'circle' ? scope.circleId : null,
    value: input.value.trim(),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.url ? { url: input.url } : {}),
  });
  return itemId;
}

export async function listMyFavorites(): Promise<Favorite[]> {
  await wait();
  return db.items.filter((i) => i.ownerId === ME);
}

export async function listSharedBy(friendId: string): Promise<Favorite[]> {
  await wait();
  if (!db.verified.has(friendId)) throw new NotVerifiedError();
  return db.items.filter((i) => i.ownerId === friendId && i.scope === 'circle');
}

export async function deleteFavorite(itemId: string) {
  db.items = db.items.filter((i) => i.id !== itemId);
}
