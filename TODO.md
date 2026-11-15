# Vulture roadmap

## Phase 1: Foundation and presentation

- [x] Deploy the preview from GitHub to Cloudflare Workers.
- [x] Add the supplied Vulture artwork, favicon, touch icon, and app manifest.
- [x] Add the available restaurant lineup, pickup details, and motion controls.
- [ ] Verify the live deployment, share preview, and mobile layouts on real devices.
- [ ] Agree on the precise 60% offer and any restrictions before publishing pricing claims.

## Phase 2: Orders and staff access

- [x] Create the D1 database and apply the initial migration.
- [ ] Build and validate the order submission API and order fields.
- [ ] Set up a separate staff Worker protected by Cloudflare Access, including all alternate hostnames and previews.
- [ ] Build an order queue with assignment, status changes, and an audit history.
- [ ] Test unauthenticated access, staff permissions, concurrent claims, and failure handling.

## Phase 3: Customer experience

- [ ] Add private order tracking and customer messaging with proper authorization.
- [ ] Add image uploads and retention controls if needed.
- [ ] Decide on payment processing, refund rules, and staff workflow.
- [ ] Publish real reviews and community links when available.

## Phase 4: Launch readiness

- [ ] Add a privacy notice, terms, and contact method based on the actual service.
- [ ] Configure production domain, social share image, monitoring, backups, and recovery.
- [ ] Test keyboard navigation, screen readers, reduced motion, mobile devices, and error states.
- [ ] Verify deployed assets and perform end-to-end tests before accepting live orders.
