# RESMAGNA 2027 · PayU Hosted Checkout + Supabase

This project preserves the existing RESMAGNA 2027 page and its 20 selectable activities, cart, participant fields, food pass, and accommodation options. It replaces the Cashfree/demo flow with PayU's hosted checkout and stores registrations/payment status in Supabase.

## Before deployment

**All event/add-on prices in this project are illustrative sample prices from the existing HTML. Confirm and replace them before accepting real registrations.** Update `EVENTS` and `ADDONS` in `api/_shared.js`; keep browser display prices aligned in `index.html`. The server calculates the payable amount independently and ignores any client-supplied amount.

## 1. Supabase

1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. In Project Settings → API, copy the Project URL and the `service_role` secret. The service-role secret belongs only in Vercel environment variables.

## 2. Vercel environment variables

Set these in Project → Settings → Environment Variables, for Preview and Production as appropriate:

- `PAYU_KEY` = your PayU merchant key for the selected environment
- `PAYU_SALT` = the matching salt (server-side only)
- `PAYU_MODE` = `test` initially; use `production` only after successful testing and PayU activation
- `APP_BASE_URL` = full HTTPS deployment origin, e.g. `https://your-project.vercel.app` (no trailing slash)
- `SUPABASE_URL` = Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` = Supabase service-role secret

Do not add the salt or service-role secret to HTML, frontend code, or GitHub. If a secret was committed, rotate it.

## 3. Deploy

1. Upload the contents of this folder to the root of your GitHub repository. `index.html`, `package.json`, `vercel.json`, `api/`, and `supabase/` should be at repository root.
2. Import/connect the repository in Vercel and deploy.
3. Add environment variables, redeploy after saving them.
4. Test with PayU test key/salt and test checkout URL. PayU hosted checkout uses `https://test.payu.in/_payment`; production uses `https://secure.payu.in/_payment`.
5. Configure a PayU payment webhook/notification URL as `https://YOUR-DOMAIN/api/webhook` in the PayU dashboard if supported for your account/product. This endpoint validates the PayU reverse hash and reconciles status.

## API routes

- `POST /api/create-payment`: validates participant and selected event IDs, calculates authoritative server-side pricing, creates a pending Supabase record, computes PayU SHA-512 request hash, returns hosted checkout form fields.
- `POST /api/response`: receives PayU success/failure redirect, validates reverse hash, transaction ID and amount, then updates the registration.
- `POST /api/webhook`: server-to-server notification handler with the same validation.
- `GET /api/payment-status?txnid=...`: returns the minimal status for the exact transaction reference. Do not use the browser return alone as proof of payment.

## Important production checks

- Confirm actual event/add-on fees, capacity, refunds, and event terms before launch.
- Confirm the merchant key/salt correspond to the selected test/live environment.
- A payment is marked `success` only after a valid PayU response hash and matching amount/transaction ID. For high assurance, also enable PayU's Verify Payment API/reconciliation according to your merchant account's official integration requirements.
- This starter records participant details. Restrict database access to the server role; never expose service-role credentials.
- PayU may require HTTPS, merchant onboarding/activation, and dashboard URL/webhook configuration before live payments work.
