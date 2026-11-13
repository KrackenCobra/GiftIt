// GiftIt gift-suggestion proxy (Supabase Edge Function, Deno).
//
// Receives ONLY: up to 5 allow-listed tags, a budget bucket and an occasion.
// Never receives or logs user IDs (beyond the JWT check), names, friend IDs or free text.
// Partners see a plain tag query from our server, never the user's IP or identity.
//
// Deploy: supabase functions deploy suggest   (JWT verification stays ON, the default)

import { createClient } from 'npm:@supabase/supabase-js@2';

const VOCAB: Record<string, string[]> = {
  color: ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'navy', 'purple', 'pink', 'brown', 'black', 'white', 'gray', 'gold', 'silver'],
  flower: ['rose', 'peony', 'tulip', 'lily', 'orchid', 'sunflower', 'daisy', 'hydrangea', 'lavender', 'carnation', 'succulent'],
  hobby: ['gardening', 'cooking', 'baking', 'grilling', 'reading', 'hiking', 'fishing', 'golf', 'yoga', 'running', 'gaming', 'music', 'painting', 'knitting', 'photography', 'travel', 'camping', 'coffee', 'tea', 'wine'],
  genre: ['mystery', 'romance', 'scifi', 'fantasy', 'biography', 'history', 'thriller'],
  scent: ['citrus', 'vanilla', 'floral', 'woodsy', 'fresh', 'spicy'],
};
const BUDGETS = new Set(['under-25', '25-75', '75-plus']);
const OCCASIONS = new Set(['birthday', 'anniversary', 'holiday', 'thank-you', 'just-because']);

const isAllowedTag = (t: unknown): t is string => {
  if (typeof t !== 'string') return false;
  const parts = t.split(':');
  return parts.length === 2 && (VOCAB[parts[0]!] ?? []).includes(parts[1]!);
};

interface Product {
  title: string;
  url: string;
  priceText: string;
  retailer: string;
  matchedTags: string[];
}

// 24 h cache keyed only by the tag set (shared across users: more privacy, fewer partner calls).
const cache = new Map<string, { at: number; products: Product[] }>();
const TTL = 24 * 60 * 60 * 1000;

/**
 * Partner adapter. Default: retailer search links (no partner API key needed, works today).
 * Replace/extend with affiliate APIs once accounts are approved; keep the same output shape.
 */
function searchLinkAdapter(tags: string[], budget: string): Product[] {
  const words = tags.map((t) => t.split(':')[1]!);
  const q = encodeURIComponent(words.join(' ') + ' gift');
  const affiliate = Deno.env.get('ETSY_AFFILIATE_PARAM'); // e.g. "utm_source=..." per your affiliate terms
  const etsy = `https://www.etsy.com/search?q=${q}${affiliate ? `&${affiliate}` : ''}`;
  const priceText = budget === 'under-25' ? 'Under $25' : budget === '25-75' ? '$25–$75' : '$75+';
  return [{ title: `${words.join(', ')} gift ideas`, url: etsy, priceText, retailer: 'Etsy', matchedTags: tags }];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Per-user quota, enforced in Postgres with the caller's own JWT.
  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const quota = await sb.rpc('suggest_quota');
  if (quota.error) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 });

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 1024) return new Response('Too large', { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const { tags, budget, occasion } = (body ?? {}) as Record<string, unknown>;
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 5 || !tags.every(isAllowedTag)) {
    return new Response('Bad tags', { status: 400 });
  }
  if (typeof budget !== 'string' || !BUDGETS.has(budget) || typeof occasion !== 'string' || !OCCASIONS.has(occasion)) {
    return new Response('Bad request', { status: 400 });
  }

  const key = [...tags].sort().join(',') + '|' + budget + '|' + occasion;
  const hit = cache.get(key);
  let products: Product[];
  if (hit && Date.now() - hit.at < TTL) {
    products = hit.products;
  } else {
    products = searchLinkAdapter(tags as string[], budget);
    cache.set(key, { at: Date.now(), products });
  }

  return new Response(JSON.stringify({ products }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
});
