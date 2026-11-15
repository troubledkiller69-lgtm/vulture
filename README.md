# Vulture

Concierge food ordering for [vulturefood.org](https://vulturefood.org). Customers create an account, send a cart with an optional screenshot, and talk to a crew member through a private ticket until the order is placed.

## Stack

- Cloudflare Worker (`src/order-api.mjs`) serving the static site from `dist/` plus `/api/*`
- Cloudflare D1 (`vulture-orders`) for accounts, orders, ticket messages, and audit events
- Cloudflare KV (`PHOTOS`) for private cart screenshots
- Turnstile on order submission, rate limiting bindings on accounts, orders, messages, and staff sign-in
- Staff dashboard at `/staff/`, authenticated through the `staff_users` table by default; Cloudflare Access JWT verification is also supported when `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` are set

## Develop

```powershell
npm install
npx wrangler d1 migrations apply vulture-orders --local
npx wrangler dev
```

`npm test` runs the Node test suite. `npm run build` copies `public/` and `staff/` into `dist/`.

## Deploy

```powershell
npm run build
npx wrangler deploy
```

Apply schema changes remotely before deploying code that depends on them:

```powershell
npx wrangler d1 migrations apply vulture-orders --remote
```

## Create a crew account

```powershell
npm run staff:create -- crew@example.com "Crew Name"
```

The script asks for a password (12 to 128 characters) and writes the account to the remote database. For non-interactive use, set `STAFF_PASSWORD` in the environment first. Crew members sign in at `/staff/`.

## Configuration

`wrangler.jsonc` holds the D1, KV, and rate limit bindings plus the public Turnstile site key. Secrets are set separately:

```powershell
npx wrangler secret put TURNSTILE_SECRET
```

Set `ORDERS_ENABLED` and `ACCOUNTS_ENABLED` to `"false"` to close intake or registration without a code change. Optional Access settings: `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `STAFF_ACCESS_ONLY=true` to disable password sign-in once Access is in front of the Worker.

## Data handling

- Passwords are hashed with PBKDF2-SHA256 (100,000 iterations), which is the maximum Cloudflare Workers supports natively.
- Session cookies use the `__Host-` prefix, `HttpOnly`, `Secure`, and `SameSite`.
- Customer tickets are scoped to the signed-in customer; staff-only notes never appear in customer responses.
- Screenshots are limited to 2 MB JPEG or PNG, stored in KV under the order ID, and served only to the ticket owner or signed-in crew.
