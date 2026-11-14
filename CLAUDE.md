# GiftIt — working notes for coding sessions

Share favorites and wishlist links with family/friends; gift ideas. Expo (React Native, TypeScript) + Supabase.
Security is the product: favorites are credential-grade data (security-question answers).

## Non-negotiables
- Plaintext user content never leaves the phone. Encrypt with `src/crypto/core.ts` before any write; the server stores ciphertext only.
- Every item envelope is signed with the owner's identity key (`signEnvelope`) and verified on read (`verifyEnvelope`) against your own or a pinned identity. Drop anything that fails.
- Every new table: RLS enabled + policies + tests in `supabase/tests/rls_test.sql`. Cross-row or privileged writes go through `SECURITY DEFINER` functions with `set search_path = ''`, granted to `authenticated` only.
- Only seal keys to devices whose cert verifies against a trusted identity key (`trustedDevicesOf` in `src/services/circles.ts`). Never trust the server's device list alone.
- Gift-suggestion requests carry only allow-listed tags (`src/crypto/tags.ts`), budget and occasion. No IDs, names or free text.
- Wishlist URLs go through `sanitizeProductUrl` on save AND on open.
- No analytics/ad SDKs, no contacts/location permissions, no SMS auth, no passwords.
- Never log decrypted content, keys, tokens or invite links.

## Commands
- `npm test` — crypto, tags, links (Jest, Node + libsodium-wrappers-sumo)
- `npm run typecheck`
- `PGURL=postgres://... supabase/tests/run.sh` — RLS tests on plain Postgres (uses `supabase/tests/supabase_shim.sql`)
- `npm run preview` — real screens in a browser with sample data (web only; `metro.config.js` swaps `src/services/*` for `preview/services/*`). Design review only; `preview/check.ts` keeps the stand-ins' API identical to the real services.
- App needs a dev build (`npx expo run:ios|android`); Expo Go won't work (native libsodium, passkeys).

## Layout
- `src/crypto/` pure crypto + key storage · `src/services/` Supabase calls · `src/screens/` UI · `supabase/` schema, edge function, DB tests.
- UI follows the "GiftIt — App Screens" design: tokens in `src/theme`, shared pieces in `src/components/ui.tsx`, icons in `src/components/Icon.tsx`, routes in `src/RootNavigator.tsx` (4 tabs; Friend profile lives in the Gifts tab).

## Known gaps (see README "Known limits")
Passkey API is Supabase beta; device revoke rotates owned circles but not the vault/identity keys; server can still delete items or replay an older signed version.
