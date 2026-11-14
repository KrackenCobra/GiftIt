import type { Budget, Occasion, SharedFavorite } from '../../src/crypto/tags';
import { buildSuggestionQuery } from '../../src/crypto/tags';
import type { Product } from '../../src/services/suggestions';
import { wait } from '../data';

export type { Product };

const p = (title: string, matchedTags: string[]): Product => ({ title, matchedTags, url: 'https://example.com/', priceText: '[PRICE]', retailer: '[RETAILER]' });

const SETS: Record<Budget, Product[]> = {
  'under-25': [p('Peony-scented hand cream', ['flower:peony']), p('Teal ceramic mug', ['color:teal', 'hobby:coffee'])],
  '25-75': [p('Pale pink peony bouquet', ['flower:peony']), p('Teal linen garden apron', ['color:teal', 'hobby:gardening'])],
  '75-plus': [p('Raised cedar garden bed', ['hobby:gardening']), p('Teal enameled Dutch oven', ['color:teal', 'hobby:cooking'])],
};

/** Same tag filtering as the real service; returns canned products instead of calling the server. */
export async function getGiftIdeas(friendFavorites: SharedFavorite[], budget: Budget, occasion: Occasion): Promise<Product[]> {
  const query = buildSuggestionQuery(friendFavorites, budget, occasion);
  if (query.tags.length === 0) return [];
  await wait(200);
  return SETS[budget];
}
