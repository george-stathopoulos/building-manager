# SAMOU 4 — project state

Updated 2026-11-12.

## A3 regular communal expense setting — published

- Settings are under **Λογαριασμός** (gear icon), for admin and users with an A3 membership only. The B3 owner role alone does not grant access.
- `GET/POST /api/settings/a3-common-credit` enforce session authorization and A3 membership/admin checks on the server. POST accepts a boolean `enabled`, ignores client apartment claims, persists the shared state and audits the change atomically.
- Migration `0025_common_expense_settings.sql` creates a singleton D1 setting, enabled by default, preserving the previous €10 deduction. Reapplying the migration does not reset a saved choice.
- `api/src/common-model.ts` supplies a request-scoped calculator, shared with the admin statement preview/print. Every existing communal expense path uses that request's setting: detail, summaries, payments, declarations, confirmations and owner outstanding balances.
- Off means ordinary A3 allocation with no credit. Other apartments, allocation rounding, gross building expenses and heating formulas are unchanged. The €10 credit remains capped at A3's gross monthly charge when enabled.
- The choice applies to all saved months, not only future months. Existing recorded payments and declarations are not rewritten on toggle. Turning off can reveal an unpaid balance where a discounted charge was previously paid. Re-enabling restores discounted charges.
- Resident breakdowns, PDF previews, print markup and generated PDFs include credit fields only for a positive server-provided credit. Hard-coded €10 fallbacks were removed. The authorized settings control remains visible so A3/admin can restore the choice.
- After a save, summaries and payment rows reload; A3 breakdown/PDF state remounts when the setting changes. Other active sessions refresh their data when returning to the app and every 60 seconds while visible.

## Published release

User authorized publication on 2026-11-12. Feature commit `cf94b893a84bb37c12a7edb4365370334e712125` is on main.

- API-first deployment: [43200966888](https://github.com/george-stathopoulos/building-manager/actions/runs/43200966888), successful, including migration and authenticated read-only checks.
- Main API deployment: [43201114708](https://github.com/george-stathopoulos/building-manager/actions/runs/43201114708), successful.
- App deployment: [43201114502](https://github.com/george-stathopoulos/building-manager/actions/runs/43201114502), successful, including all 17 tests, API check and production build.
- Verified live app HTTP 200 and deployed script `/building-manager/assets/index-CoMtSXSE.js` containing the new setting route/state. API health returned `{"ok":true}`; unauthenticated setting access returned 401. Authenticated deployment checks verified persisted setting and matching detail/summary/payment calculations.
- The live toggle was not changed for testing. Interactive A3/admin testing, PDF inspection and a second-session off/on check remain for the user. Access the toggle in **Λογαριασμός**.

## Automatic refresh on reopening — 2026-11-12

- The installed app may resume an old document from memory. `src/appUpdates.ts` checks the published module entry on launch, return to the foreground, page restoration and reconnect. A changed entry reloads the app; the saved login is retained. The check uses no-store plus a unique query so even the previous v1 worker cannot serve a cached version check.
- Service worker v2 installs a fresh app shell, claims clients and navigates existing app windows once when replacing the v1 cache. This bootstraps the update checker in old running screens. Other apps' windows and caches are left alone. Navigation uses fresh network HTML with an offline shell fallback. Explicit no-store requests and financial data bypass app caches.
- Data refresh now includes overview, statements, summaries, fuel accounts and notifications on resume/reconnect, plus active payment/owner views. Cached resident breakdown/PDF components reset on resume so they fetch current details. The background visible refresh remains every 60 seconds. Heating calculation rules and the saved A3 setting are unchanged.
- 24 tests pass, including targeted update detection, unchanged/offline/error cases, service-worker cache bypass, scoped upgrades and offline navigation fallback. Production app build passes.

## Verification

- 17 tests pass, including real Worker handlers using SQLite: defaults, persisted cross-user changes, audit entries, forbidden users/owner/anonymous, boolean validation, details, summary totals, payment balances, owner unpaid amounts, capped credits and disabled breakdown/print/PDF fields.
- Existing fuel/accounting tests pass. Frontend production build and API TypeScript check pass.
- No screenshots were needed. No production setting or financial data was changed during verification.
- Baseline before editing: local/remote main `9094d455c8ead8909062932a3ef83ed0ee720bf2`; latest successful Pages run at that commit; latest successful API run at `994ecacc6c4ecee900aa7fea0ba91eb9198f7207`.
- Existing live checks: app `https://george-stathopoulos.github.io/building-manager/` returned HTTP 200; API `/api/health` returned `{"ok":true}`. These checks verify the existing release, not this local implementation.

## Release procedure

1. Obtain permission to push/publish. API workflow deploys on pushes affecting `api/**` (including feature branches); do not push this work before release authorization.
2. Review the local diff. Run `npm test`, `npm run build`, and `cd api && npm run check`.
3. Push the approved feature branch first: this triggers the API workflow without Pages. Existing Cloudflare workflow applies migration 0025 before deploying the API. Wait for its authenticated checks to succeed, then merge/push main to release Pages. Never deploy frontend alone against the older API.
4. Verify Pages deployment finishes for the approved commit. The API deployment workflow now performs read-only authenticated setting and cross-endpoint calculation checks plus unauthenticated denial, without flipping production state.
5. Confirm live app/API health and the authorized A3/admin control. With explicit approval for a live setting change, test off/on and restored state across A3 UI, breakdown, PDF, reports and a second session; verify another resident cannot access the setting. Do not change the live setting just for an automated smoke test.
6. Update this file with deployed commit/run evidence. Roll back app/API code together if needed; retain the additive setting table and do not reset its saved value.

Working rules: no outward push, publication, sending or deletion without user authorization; keep checks targeted and avoid screenshots unless a visual issue appears. Substantial future work after a long discussion should be specified in git-ignored `dev/specs/` and handed to a fresh local session under the user's project rules.
