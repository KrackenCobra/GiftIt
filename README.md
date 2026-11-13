# GiftIt

Share your favorite colors, flowers, foods and wishlist links with family and close friends, and get gift ideas that fit them. React Native (Expo) for iOS and Android, on Supabase.

**Security model in one line:** favorites are treated like credentials (they're classic security-question answers), so everything is end-to-end encrypted on the phone, the server only ever holds ciphertext, and nobody can find or read you without an invite and an in-person safety-number check.

## What's in the box

| Area | Files |
| --- | --- |
| Encryption core (libsodium) | `src/crypto/core.ts` |
| Key storage (Keychain / Keystore, biometric-gated) | `src/crypto/keystore.ts` |
| Recovery phrase (24 words) | `src/crypto/recovery.ts` |
| Anonymous gift tags | `src/crypto/tags.ts` |
| Wishlist link hygiene | `src/crypto/links.ts` |
| Passkey + email-code sign-in, device enrollment/approval, recovery | `src/services/auth.ts` |
| Favorites and wishlist (encrypted) | `src/services/items.ts`, `src/services/wishlist.ts` |
| Circles, invites, safety numbers, key rotation | `src/services/circles.ts` |
| Gift suggestions client | `src/services/suggestions.ts` |
| Screens | `src/screens/*` |
| Biometric app lock + app-switcher shield | `src/lib/appLock.tsx` |
| Database schema + row-level security | `supabase/migrations/0001_init.sql` |
| Gift suggestion proxy (Edge Function) | `supabase/functions/suggest/index.ts` |
| Tests | `tests/*` (crypto, tags, links), `supabase/tests/*` (RLS) |

## Setup

1. **Install:** `npm install`, then `npx expo install --fix` to align native module versions with your Expo SDK.
2. **Supabase project:** create one, then
   - `supabase db push` (or run `supabase/migrations/0001_init.sql` in the SQL editor)
   - Authentication → Passkeys: enable, set the relying party ID to your domain (beta feature; see [Supabase passkey docs](https://supabase.com/docs/guides/auth/passkeys))
   - Authentication → Email: enable email OTP (6-digit code); disable SMS and password sign-in
   - Schedule `select public.cleanup();` daily with pg_cron
   - `supabase functions deploy suggest`
3. **Passkeys on phones** need your domain to vouch for the app: host `apple-app-site-association` (iOS, `webcredentials`) and `assetlinks.json` (Android) on the domain in `app.json` → `associatedDomains` / `extra.passkeyRpId`.
4. **Env:** copy `.env.example` to `.env` with your project URL and anon key. Never ship the service-role key.
5. **Run:** `npx expo run:ios` / `npx expo run:android` (a dev build is required; libsodium and passkeys are native modules, so Expo Go won't work).

### iPhone without a Mac (EAS cloud builds)

```bash
npm i -g eas-cli
eas login
eas init                                   # links the project to your Expo account
# The dev Supabase URL + publishable key are already in eas.json (public values; RLS protects data).
eas device:create                          # open the link on your iPhone to register it
eas build --profile development --platform ios
```

Needs a paid Apple Developer account to install on a real iPhone. Install the build from the link EAS gives you, then run `npx expo start --dev-client` on any computer (Windows is fine) and open the project from the app.

## Tests

```bash
npm test               # 29 tests: encryption, tampering, key sealing, rotation, recovery, device certs, tags, links
npm run typecheck
PGURL=postgres://postgres@localhost:5432/postgres supabase/tests/run.sh   # 26 RLS tests
```

## How the security works

- **Encryption.** Every favorite, wishlist link, date and gift plan is encrypted on the phone with XChaCha20-Poly1305. Item ID, owner and key version are bound into each ciphertext so rows can't be swapped or replayed.
- **Keys.** Private items use your personal vault key. Each circle has its own key, sealed (X25519) to every trusted device of every approved member. Keys live in the Keychain / Keystore, device-only, never in backups.
- **Devices.** Signing in proves who you are but unlocks nothing. A new phone gets data only after an existing phone (or your recovery phrase) signs a certificate for it with your account identity key. Friends' phones check that certificate before sealing anything to it, so a stolen session or a compromised server can't add a listening device.
- **Joining a circle.** One-time invite (24 h, stored as a hash). The owner then compares a 30-digit safety number with the friend in person or on a call before approving. If a friend's identity key ever changes, the app refuses to proceed until you verify again.
- **Removing someone** rotates the circle key and re-encrypts the circle's items.
- **Wishlist.** Links are HTTPS-only, tracking parameters are stripped, and they open in the system browser. "I'll get this" claims are hidden from the wishlist owner by row-level security, so surprises hold.
- **Gift ideas.** Matching happens on the phone. The proxy receives at most 5 allow-listed tags plus a budget bucket and an occasion. It never receives names, IDs or free text, and retailers only see a request from the proxy.
- **App.** Biometric lock (launch and after 5 minutes in the background), screen shield in the app switcher, screenshot blocking on the recovery-phrase screen, no contacts or location permissions, no analytics or ad SDKs.

## Known limits / next steps

- Supabase passkeys are **beta**. Re-check method names in `src/services/auth.ts` against the current docs before release.
- The server knows the social graph (who is in whose circle) and *that* a wishlist item was claimed. It never learns what anything says.
- Items are signed by their author's identity key, so nobody (a circle member, or the server) can forge or alter them. A compromised server could still delete items or serve an older signed version of one.
- Revoking a device should be followed by rotating every circle you own; wire `revokeDevice` to `removeMemberAndRotate`-style rotation for each circle.
- The suggestion proxy ships with a search-link adapter that works today. Add affiliate partner APIs once your accounts are approved, and keep the same output shape.
- Before launch: external pen test against OWASP MASVS L2, privacy policy, App Store / Play data-safety forms, in-app data export and delete.
