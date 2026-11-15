# Vulture roadmap

## Phase 1: Foundation and presentation

- [x] Deploy the site to Cloudflare Workers on `vulturefood.org` and `www.vulturefood.org`.
- [x] Add the supplied Vulture artwork, favicon, touch icon, and app manifest.
- [x] Add the available restaurant lineup, pickup details, and motion controls.
- [ ] Verify final mobile and desktop layouts on real devices.
- [ ] Agree on the precise 60% offer and any restrictions before publishing pricing claims.

## Phase 2: Orders and crew

- [x] Create the D1 database and apply all migrations remotely.
- [x] Require an account before ordering and store every order as a private ticket.
- [x] Add cart screenshots stored privately in KV with owner and crew-only access.
- [x] Build the crew queue with claim, placing, complete, and cancel transitions plus audit events.
- [x] Add crew replies, private notes, and customer replies inside the ticket.
- [x] Add Turnstile verification and rate limits for accounts, orders, messages, and crew sign-in.
- [x] Cover order, ticket ownership, photo, account, and crew authorization paths with tests.
- [ ] Create the real crew accounts and confirm a full order in production.
- [ ] Add a password reset flow; there is no email sender configured yet.

## Phase 3: Customer experience

- [x] Add an in-page account view, order list, and ticket conversation.
- [ ] Add status notifications instead of relying on the customer to reopen the ticket.
- [ ] Decide on payment processing, refund rules, and crew workflow.
- [ ] Publish real reviews and community links when available.

## Phase 4: Launch readiness

- [ ] Add a privacy notice, terms, and contact method based on the actual service.
- [ ] Configure monitoring, backups, and recovery for D1 and KV.
- [ ] Test keyboard navigation, screen readers, reduced motion, mobile devices, and error states.
- [ ] Verify deployed assets and perform a full order end-to-end test before advertising.
