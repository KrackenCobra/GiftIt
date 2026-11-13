/**
 * Turns a friend's decrypted favorites into a small set of anonymous, allow-listed tags.
 * Only these tags ever leave the phone for gift suggestions. Free text, notes, names,
 * sizes and anything not in the vocabulary are dropped.
 */

export const VOCABULARY = {
  color: ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'navy', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'gold', 'silver'],
  flower: ['rose', 'peony', 'tulip', 'lily', 'orchid', 'sunflower', 'daisy', 'hydrangea', 'lavender', 'carnation', 'succulent'],
  hobby: ['gardening', 'cooking', 'baking', 'grilling', 'reading', 'hiking', 'fishing', 'golf', 'yoga', 'running', 'gaming', 'music', 'painting', 'knitting', 'photography', 'travel', 'camping', 'coffee', 'tea', 'wine'],
  genre: ['mystery', 'romance', 'scifi', 'fantasy', 'biography', 'history', 'thriller'],
  scent: ['citrus', 'vanilla', 'floral', 'woodsy', 'fresh', 'spicy'],
} as const;

export type TagCategory = keyof typeof VOCABULARY;
export type Budget = 'under-25' | '25-75' | '75-plus';
export type Occasion = 'birthday' | 'anniversary' | 'holiday' | 'thank-you' | 'just-because';

const SYNONYMS: Record<string, string> = {
  peonies: 'peony', roses: 'rose', tulips: 'tulip', lilies: 'lily', orchids: 'orchid', sunflowers: 'sunflower',
  daisies: 'daisy', hydrangeas: 'hydrangea', succulents: 'succulent', aqua: 'teal', turquoise: 'teal',
  'sci-fi': 'scifi', 'science fiction': 'scifi', bbq: 'grilling', barbecue: 'grilling', brisket: 'grilling',
  smoking: 'grilling', books: 'reading', novels: 'reading', crochet: 'knitting', espresso: 'coffee',
  cortado: 'coffee', latte: 'coffee', violet: 'purple', grey: 'gray', lavendar: 'lavender',
};

export interface SharedFavorite {
  category: string; // plaintext category column, e.g. "color", "flower", "hobby", "food"
  value: string; // decrypted on device
}

const MAX_TAGS = 5;

function normalizeWords(text: string): string[] {
  const lower = text.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s-]/gu, ' ');
  const words = lower.split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    out.add(SYNONYMS[w] ?? w);
    const pair = i + 1 < words.length ? `${w} ${words[i + 1]}` : null;
    if (pair && SYNONYMS[pair]) out.add(SYNONYMS[pair]!);
  }
  return [...out];
}

export function favoritesToTags(favs: SharedFavorite[]): string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const fav of favs) {
    for (const word of normalizeWords(fav.value)) {
      for (const cat of Object.keys(VOCABULARY) as TagCategory[]) {
        if ((VOCABULARY[cat] as readonly string[]).includes(word)) {
          const tag = `${cat}:${word}`;
          if (!seen.has(tag)) {
            seen.add(tag);
            tags.push(tag);
          }
        }
      }
    }
    if (tags.length >= MAX_TAGS) break;
  }
  return tags.slice(0, MAX_TAGS);
}

export function buildSuggestionQuery(favs: SharedFavorite[], budget: Budget, occasion: Occasion) {
  return { tags: favoritesToTags(favs), budget, occasion };
}

/** Server-side guard mirrors this; exported so the edge function and tests share one rule. */
export function isAllowedTag(tag: string): boolean {
  const [cat, val, extra] = tag.split(':');
  if (extra !== undefined || !cat || !val) return false;
  return cat in VOCABULARY && (VOCABULARY[cat as TagCategory] as readonly string[]).includes(val);
}
