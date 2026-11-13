# GiftIt — working notes for coding sessions

Share favorites and wishlist links with family/friends; gift ideas. Expo (React Native, TypeScript) + Supabase.
Security is the product: favorites are credential-grade data (security-question answers).

## Non-negotiables
- Plaintext user content never leaves the phone. Encrypt with `src/crypto/core.ts` before any write; the server stores ciphertext only.
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
- App needs a dev build (`npx expo run:ios|android`); Expo Go won't work (native libsodium, passkeys).

## Layout
- `src/crypto/` pure crypto + key storage · `src/services/` Supabase calls · `src/screens/` UI · `supabase/` schema, edge function, DB tests.

## Known gaps (see README "Known limits")
Passkey API is Supabase beta; items aren't author-signed yet; device revoke should trigger rotation of owned circles.
