# Vulture

Mobile-friendly preview of a food-ordering concierge. This is a static frontend: it does not submit orders, take payments, authenticate users, or provide chat.

## Develop and deploy

Run `npm install`, `npm test`, then `npm run build`. Deploy via Cloudflare Workers Git integration with build command `npm run build` and deploy command `npx wrangler deploy`. The static asset directory is configured in `wrangler.jsonc`. Pushes to the configured production branch trigger builds automatically. The Cloudflare Workers free plan applies within its limits.

The logo files in `public/` are supplied artwork. Replace them with transparent assets if available.

## Database preparation

The Worker configuration references the `vulture-orders` D1 database. The first migration creates order and order-event tables. To test locally, run `npx wrangler d1 migrations apply vulture-orders --local`. After authenticating Wrangler and verifying the selected Cloudflare account, run `npx wrangler d1 migrations apply vulture-orders --remote` to create those tables in the live database. Deploying the static site does not apply migrations.

The binding and schema do not implement an order API or a staff dashboard. Do not store customer data until authentication, authorization, and the order workflow are implemented and tested.
