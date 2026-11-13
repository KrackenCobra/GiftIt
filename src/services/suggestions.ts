import { supabase } from '../lib/supabase';
import { buildSuggestionQuery, type Budget, type Occasion, type SharedFavorite } from '../crypto/tags';

export interface Product {
  title: string;
  url: string; // affiliate link, opened in the system browser
  priceText: string;
  retailer: string;
  matchedTags: string[];
}

/**
 * Gift ideas for a friend. Their favorites were decrypted on this phone; only allow-listed
 * tags + budget + occasion are sent. No friend ID, name or free text leaves the device.
 */
export async function getGiftIdeas(friendFavorites: SharedFavorite[], budget: Budget, occasion: Occasion): Promise<Product[]> {
  const query = buildSuggestionQuery(friendFavorites, budget, occasion);
  if (query.tags.length === 0) return [];
  const { data, error } = await supabase.functions.invoke<{ products: Product[] }>('suggest', { body: query });
  if (error) throw error;
  const products = data?.products ?? [];
  // Rank locally against the full private picture: more matched tags first.
  return products.sort((a, b) => b.matchedTags.length - a.matchedTags.length);
}
