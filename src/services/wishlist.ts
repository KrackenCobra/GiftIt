import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { sanitizeProductUrl } from '../crypto/links';
import { listMyFavorites, listSharedBy, saveFavorite, type Favorite, type Scope } from './items';

/**
 * Wishlist = items with category 'wishlist'. The product name, link and note are encrypted
 * exactly like favorites (vault key for Private, circle key when shared).
 *
 * Claims ("I'll get this") let gift-givers avoid duplicates. A claim row holds only
 * (item id, claimer id); row-level security hides claims on your own items from you,
 * so the surprise survives. Claims are not end-to-end encrypted: the server knows that
 * someone claimed an item, but never what the item is.
 */

export async function addWishlistItem(input: { name: string; url: string; note?: string }, scope: Scope) {
  const url = sanitizeProductUrl(input.url); // throws LinkError with a user-facing message
  const note = input.note?.trim();
  return saveFavorite('wishlist', { value: input.name, url, ...(note ? { note } : {}) }, scope);
}

export async function myWishlist(): Promise<Favorite[]> {
  return (await listMyFavorites()).filter((f) => f.category === 'wishlist');
}

export interface FriendWishlistItem extends Favorite {
  claimedByMe: boolean;
  claimedBySomeone: boolean;
}

export async function friendWishlist(friendId: string): Promise<FriendWishlistItem[]> {
  const items = (await listSharedBy(friendId)).filter((f) => f.category === 'wishlist');
  if (items.length === 0) return [];
  const { data: me } = await supabase.auth.getUser();
  const { data: claims, error } = await supabase
    .from('item_claims')
    .select('item_id, claimer_id')
    .in('item_id', items.map((i) => i.id));
  if (error) throw error;
  return items.map((i) => {
    const forItem = (claims ?? []).filter((cl) => cl.item_id === i.id);
    return {
      ...i,
      claimedByMe: forItem.some((cl) => cl.claimer_id === me.user?.id),
      claimedBySomeone: forItem.length > 0,
    };
  });
}

export async function claimItem(itemId: string) {
  const { error } = await supabase.rpc('claim_item', { p_item_id: itemId });
  if (error) throw error;
}

export async function unclaimItem(itemId: string) {
  const { error } = await supabase.rpc('unclaim_item', { p_item_id: itemId });
  if (error) throw error;
}

/** Re-validates before opening: a link from storage is never trusted blindly. System browser only. */
export async function openProductLink(url: string) {
  await WebBrowser.openBrowserAsync(sanitizeProductUrl(url));
}
