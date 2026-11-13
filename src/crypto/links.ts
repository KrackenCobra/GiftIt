/**
 * Product-link hygiene for wishlist items.
 * - HTTPS only; no embedded credentials; no IP-literal or localhost hosts; ≤ 2,048 chars.
 * - Tracking parameters are stripped so a shared link can't fingerprint who shared it.
 * Links are opened in the system browser, never in an in-app WebView.
 */

const TRACKING_PARAMS = [
  /^utm_/i, /^fbclid$/i, /^gclid$/i, /^dclid$/i, /^msclkid$/i, /^mc_(cid|eid)$/i, /^igshid$/i,
  /^_hs(enc|mi)$/i, /^yclid$/i, /^ttclid$/i, /^twclid$/i, /^si$/i, /^ref_?$/i, /^pd_rd_/i, /^pf_rd_/i,
  /^_ga$/i, /^_gl$/i, /^spm$/i, /^share_id$/i,
];

export class LinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LinkError';
  }
}

export function sanitizeProductUrl(raw: string): string {
  const input = raw.trim();
  if (input.length === 0) throw new LinkError('Paste a link');
  if (input.length > 2048) throw new LinkError('That link is too long');
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new LinkError('That is not a valid link');
  }
  if (url.protocol !== 'https:') throw new LinkError('Only secure (https) links can be shared');
  if (url.username || url.password) throw new LinkError('Links with sign-in details are not allowed');
  const host = url.hostname.toLowerCase();
  if (!host.includes('.') || host === 'localhost' || /^[\d.]+$/.test(host) || host.startsWith('[')) {
    throw new LinkError('Use a normal store link');
  }
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.some((re) => re.test(key))) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString();
}

/** "www.etsy.com" -> "etsy.com", shown under each wishlist item so people see where a link goes. */
export function displayDomain(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}
