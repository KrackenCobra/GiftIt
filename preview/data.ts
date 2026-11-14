/**
 * Sample data for the browser preview, taken from the "GiftIt — App Screens" design.
 * Names, domains, prices and retailers are placeholders. Never real user data.
 */
import type { Favorite } from '../src/services/items';
import type { CircleSummary } from '../src/services/circles';
import type { GiftPlan } from '../src/services/plans';

export const ME = 'me';
export const MOM = 'u-mom';
export const DAD = 'u-dad';
export const TOM = 'u-tom';

let n = 0;
export const id = (p = 'id') => `${p}-${++n}`;

const fav = (ownerId: string, category: Favorite['category'], value: string, circleId: string | null, extra: Partial<Favorite> = {}): Favorite => ({
  id: id('item'),
  ownerId,
  category,
  value,
  scope: circleId ? 'circle' : 'private',
  circleId,
  ...extra,
});

export const db = {
  verified: new Set<string>([MOM, DAD]),
  circles: [
    {
      id: 'c-family',
      name: 'Family',
      keyVersion: 1,
      members: [
        { userId: MOM, displayName: 'Mom', pending: false },
        { userId: DAD, displayName: 'Dad', pending: false },
        { userId: 'u-kate', displayName: 'Kate R', pending: false },
        { userId: 'u-sam', displayName: 'Sam R', pending: false },
        { userId: 'u-lee', displayName: 'Lee R', pending: false },
        { userId: 'u-ann', displayName: 'Ann R', pending: false },
        { userId: 'u-denise', displayName: 'Aunt Denise', pending: true },
      ],
    },
    {
      id: 'c-close',
      name: 'Close friends',
      keyVersion: 1,
      members: [
        { userId: TOM, displayName: 'Tom J', pending: false },
        { userId: 'u-alex', displayName: 'Alex L', pending: false },
        { userId: 'u-sara', displayName: 'Sara P', pending: false },
        { userId: 'u-mia', displayName: 'Mia K', pending: false },
      ],
    },
  ] as CircleSummary[],
  friends: [
    { userId: MOM, displayName: 'Mom' },
    { userId: DAD, displayName: 'Dad' },
    { userId: TOM, displayName: 'Tom J' },
  ],
  items: [
    fav(ME, 'color', 'Teal', 'c-family'),
    fav(ME, 'flower', 'Peonies, pale pink', 'c-close', { note: 'Not roses, please' }),
    fav(ME, 'food', 'Oat-milk cortado', 'c-close'),
    fav(ME, 'size', 'Men’s L, tall', 'c-family'),
    fav(ME, 'hobby', 'Smoking brisket', 'c-close'),
    fav(ME, 'food', 'Thai, extra spicy', null),
    fav(ME, 'wishlist', 'Cast-iron skillet, 12 in', 'c-family', { url: 'https://example-kitchen.com/skillet-12' }),
    fav(MOM, 'color', 'Teal', 'c-mom'),
    fav(MOM, 'flower', 'Peonies', 'c-mom', { note: 'Not roses' }),
    fav(MOM, 'hobby', 'Gardening', 'c-mom'),
    fav(MOM, 'genre', 'Mystery novels', 'c-mom'),
    fav(MOM, 'hobby', 'Cooking', 'c-mom'),
    fav(MOM, 'wishlist', 'Teal linen garden apron', 'c-mom', { url: 'https://etsy.com/listing/apron', note: 'Size M/L' }),
    fav(MOM, 'wishlist', 'Raised cedar garden bed, 4×8', 'c-mom', { url: 'https://example-garden.com/cedar-bed', note: 'The tall one, not the low one' }),
    fav(MOM, 'wishlist', 'Mystery book box subscription', 'c-mom', { url: 'https://example-books.com/box', note: '3 months' }),
  ] as Favorite[],
  /** item id → claimer ids */
  claims: new Map<string, Set<string>>(),
  plans: [] as GiftPlan[],
};

// One of Mom's wishlist items is already claimed by someone else.
db.claims.set(db.items.find((i) => i.value.startsWith('Teal linen'))!.id, new Set(['u-dad']));

export const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
