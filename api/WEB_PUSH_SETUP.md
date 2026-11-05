# Web Push setup (SAMOU 4)

The application now includes Web Push subscription registration and delivery hooks. Push delivery remains **disabled** until the three VAPID environment secrets are configured on the Cloudflare Worker. No private keys belong in Git.

## Generate a stable VAPID key pair

Run locally in Node.js 22 (never commit the private output):

```sh
node - <<'NODE'
const {createECDH}=require('node:crypto');
const ecdh=createECDH('prime256v1');
ecdh.generateKeys();
const base64url=b=>b.toString('base64url');
console.log('VAPID_PUBLIC_KEY='+base64url(ecdh.getPublicKey(undefined,'uncompressed')));
console.log('VAPID_PRIVATE_KEY='+base64url(ecdh.getPrivateKey()));
NODE
```

Set these **Cloudflare Worker secrets** for `building-manager-api`:
- `VAPID_PUBLIC_KEY`: generated public key
- `VAPID_PRIVATE_KEY`: generated private key
- `VAPID_SUBJECT`: a valid contact URI, e.g. `mailto:<your-admin-email>`

With Wrangler authenticated in the `api` directory, use `npx wrangler secret put VAPID_PUBLIC_KEY`, `npx wrangler secret put VAPID_PRIVATE_KEY`, and `npx wrangler secret put VAPID_SUBJECT`. Keep the same key pair across deploys. Do not use `[vars]` for the private key.

Verify `GET /api/push/config` when authenticated: `enabled: true`. Then enable notifications in the PWA account section on each device and test a new announcement or payment review.

## Behavior

- After first PIN change, the resident is shown a notification-permission step and may continue even if permission is denied.
- Account settings for residents, owner, and admin include a push toggle.
- Payment declarations notify owner/admin reviewers; payment review results notify the affected apartment; new building announcements notify all registered users.
- Notifications intentionally contain only a generic message, to avoid exposing private financial information on lock screens.
- iOS requires installing the PWA to the Home Screen. Browser and OS permissions cannot be bypassed.
- Delivery is best effort. Expired subscriptions (404/410) are removed. Multiple devices per user are supported.

## Operational note

When a new deployment changes Cloudflare Worker environment variables, verify that the three VAPID secrets are still present. Do not rotate VAPID keys without planning for subscription re-registration.
