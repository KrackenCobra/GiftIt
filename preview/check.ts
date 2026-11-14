/**
 * Compile-time guard: each preview service must expose exactly the real module's API,
 * so the preview can't drift from the app. Type-only imports; nothing here runs.
 */
import type * as RealAuth from '../src/services/auth';
import type * as RealCircles from '../src/services/circles';
import type * as RealItems from '../src/services/items';
import type * as RealPlans from '../src/services/plans';
import type * as RealSuggestions from '../src/services/suggestions';
import type * as RealWishlist from '../src/services/wishlist';
import type * as Auth from './services/auth';
import type * as Circles from './services/circles';
import type * as Items from './services/items';
import type * as Plans from './services/plans';
import type * as Suggestions from './services/suggestions';
import type * as Wishlist from './services/wishlist';

type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Keys<T> = keyof T;

export const parity: [
  Same<Keys<typeof Auth>, Keys<typeof RealAuth>>,
  Same<Keys<typeof Circles>, Keys<typeof RealCircles>>,
  Same<Keys<typeof Items>, Keys<typeof RealItems>>,
  Same<Keys<typeof Plans>, Keys<typeof RealPlans>>,
  Same<Keys<typeof Suggestions>, Keys<typeof RealSuggestions>>,
  Same<Keys<typeof Wishlist>, Keys<typeof RealWishlist>>,
] = [true, true, true, true, true, true];

// Each preview function must be callable wherever the real one is.
export const signatures: [typeof RealAuth, typeof RealCircles, typeof RealItems, typeof RealPlans, typeof RealSuggestions, typeof RealWishlist] = [
  {} as typeof Auth,
  {} as typeof Circles,
  {} as typeof Items,
  {} as typeof Plans,
  {} as typeof Suggestions,
  {} as typeof Wishlist,
];
