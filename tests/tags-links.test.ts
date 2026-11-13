import { buildSuggestionQuery, favoritesToTags, isAllowedTag } from '../src/crypto/tags';
import { displayDomain, LinkError, sanitizeProductUrl } from '../src/crypto/links';

describe('gift tags', () => {
  test('maps favorites to allow-listed tags and drops everything else', () => {
    const tags = favoritesToTags([
      { category: 'color', value: 'Teal (like Grandma Rosa’s kitchen)' },
      { category: 'flower', value: 'Peonies, pale pink' },
      { category: 'hobby', value: 'Smoking brisket' },
      { category: 'food', value: 'Pappadeaux, 123 Main St' },
      { category: 'custom', value: 'My dog Biscuit' },
    ]);
    expect(tags).toEqual(['color:teal', 'flower:peony', 'color:pink', 'hobby:grilling']);
    expect(JSON.stringify(tags)).not.toMatch(/Rosa|Biscuit|Main|Pappadeaux/i);
  });

  test('caps at 5 tags', () => {
    const favs = ['red', 'blue', 'green', 'gold', 'pink', 'navy', 'gray'].map((v) => ({ category: 'color', value: v }));
    expect(favoritesToTags(favs)).toHaveLength(5);
  });

  test('query carries only tags, budget and occasion', () => {
    const q = buildSuggestionQuery([{ category: 'flower', value: 'tulips' }], '25-75', 'birthday');
    expect(Object.keys(q).sort()).toEqual(['budget', 'occasion', 'tags']);
  });

  test('server-side tag guard', () => {
    expect(isAllowedTag('color:teal')).toBe(true);
    expect(isAllowedTag('color:teal:x')).toBe(false);
    expect(isAllowedTag('name:alice')).toBe(false);
    expect(isAllowedTag('color:<script>')).toBe(false);
  });
});

describe('wishlist links', () => {
  test('strips tracking parameters and fragments, keeps real ones', () => {
    const out = sanitizeProductUrl('https://www.etsy.com/listing/123/apron?utm_source=x&ref=shop&variation=teal&fbclid=abc#reviews');
    expect(out).toBe('https://www.etsy.com/listing/123/apron?variation=teal');
    expect(displayDomain(out)).toBe('etsy.com');
  });

  test.each([
    ['http://shop.example.com/x', 'secure'],
    ['javascript:alert(1)', 'secure'],
    ['https://user:pw@shop.example.com/', 'sign-in'],
    ['https://192.168.1.10/admin', 'normal store'],
    ['https://localhost/x', 'normal store'],
    ['not a url', 'valid'],
    ['https://a.com/' + 'x'.repeat(2100), 'too long'],
  ])('rejects %s', (url, msg) => {
    expect(() => sanitizeProductUrl(url)).toThrow(LinkError);
    expect(() => sanitizeProductUrl(url)).toThrow(new RegExp(msg, 'i'));
  });
});
