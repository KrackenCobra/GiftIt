/**
 * GiftIt design tokens, taken from the "GiftIt — App Screens" canvas.
 * Coral is for primary actions only; teal is reserved for security and privacy messages.
 */
export const colors = {
  bg: '#FBF8F4',
  card: '#FFFFFF',
  line: '#EDE7DE',
  lineStrong: '#D9D2C7',
  ink: '#1F1B2D',
  ink2: '#4A4458',
  muted: '#6B6577',
  radioOff: '#B4AEA6',
  accent: '#C43D29',
  accentPressed: '#9E2F1F',
  accentSoft: '#FBE7E3',
  accentInk: '#8E2A1B',
  safe: '#0B5049',
  safeIcon: '#0F6E64',
  safeSoft: '#E3F1EE',
  warn: '#6A3F05',
  warnSoft: '#FDF1DD',
  warnLine: '#F3D9AE',
  warnButtonLine: '#D9C29A',
  neutralSoft: '#F1EEE9',
  neutralInk: '#5F5A66',
  violetSoft: '#ECE8FB',
  violetInk: '#3C2D8A',
};

/** Surprise mode flips to a dark ground to signal "private to you". */
export const dark = {
  bg: '#1F1B2D',
  card: '#2A2540',
  line: '#3A3450',
  text: '#FFFFFF',
  textSoft: '#E8E4F0',
  text2: '#CFC9DA',
  muted: '#A9A2B8',
  checkOff: '#6B6480',
  checkOn: '#0F6E64',
  alert: '#F0997B',
  bell: '#5DCAA5',
};

export const fonts = {
  heading: 'SpaceGrotesk_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
};

export const radius = { sm: 10, md: 12, lg: 16, pill: 999 };
export const space = (n: number) => n * 4;

/** Initials avatars and visibility badges cycle through these soft/ink pairs. */
export const tones = [
  { bg: colors.accentSoft, fg: colors.accentInk },
  { bg: colors.safeSoft, fg: colors.safe },
  { bg: colors.violetSoft, fg: colors.violetInk },
] as const;

export function toneFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return tones[Math.abs(h) % tones.length]!;
}

/** Swatch shown next to a favorite. Named colors use their own hue; other categories get a fixed tone. */
const NAMED: Record<string, string> = {
  red: '#D2463A', orange: '#E07B39', yellow: '#E8C547', green: '#5E9E4B', teal: '#1D9E8F', aqua: '#1D9E8F',
  turquoise: '#1D9E8F', blue: '#3D7CC9', navy: '#24386B', purple: '#7A55B8', violet: '#7A55B8', lavender: '#B9A6DE',
  pink: '#F4C0D1', brown: '#8A5A3B', black: '#2A2A2E', white: '#F4F1EC', gray: '#9C9AA0', grey: '#9C9AA0',
  gold: '#C9A23B', silver: '#BFC3C8',
};
const BY_CATEGORY: Record<string, string> = {
  flower: '#F4C0D1', food: '#DCD6CC', size: '#C9D6E8', brand: '#D9D2C7', hobby: '#D98F5B',
  scent: '#E9D8B4', genre: '#C9D6E8', custom: '#E3DCEF', wishlist: '#B98B62',
};

const PRODUCT_TILES = ['#1D9E8F', '#B98B62', '#C9D6E8', '#F4C0D1', '#D98F5B', '#97C459'];

export function swatchFor(category: string, value: string): string {
  if (category === 'wishlist') {
    let h = 0;
    for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
    return PRODUCT_TILES[Math.abs(h) % PRODUCT_TILES.length]!;
  }
  if (category === 'color') {
    const words = value.toLowerCase().split(/[^a-z]+/);
    for (const w of words) if (NAMED[w]) return NAMED[w]!;
  }
  return BY_CATEGORY[category] ?? colors.lineStrong;
}
