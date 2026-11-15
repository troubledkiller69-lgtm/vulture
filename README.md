# Vulture

Mobile-friendly preview of a food-ordering concierge. This is a static frontend: it does not submit orders, take payments, authenticate users, or provide chat.

## Develop and deploy

Run `npm install`, `npm test`, then `npm run build`. Deploy via Cloudflare Workers Git integration with build command `npm run build` and deploy command `npx wrangler deploy`. The static asset directory is configured in `wrangler.jsonc`. Pushes to the configured production branch trigger builds automatically. The Cloudflare Workers free plan applies within its limits.

The logo files in `public/` are supplied artwork. Replace them with transparent assets if available.
