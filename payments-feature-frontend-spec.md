# Frontend Implementation Brief: Payments (Stripe Checkout)

**Audience:** an engineering agent implementing the *frontend logic* for this feature.
**Stack:** React 19 + TypeScript, Tailwind CSS v4.3, shadcn/ui, React Hook Form + Zod, Zustand, TanStack Query v5, Axios, react-router-dom v6/7, Socket.io Client, `@tanstack/react-virtual`.
**Payment SDK:** `@stripe/stripe-js` + `@stripe/react-stripe-js` (Stripe Elements) — required by the backend's PCI-scope boundary, see §1.

This document is derived directly from the backend implementation (model, controller, routes, service, Stripe integration, validator). It does not invent new backend behavior. Read §1 fully before writing any code — it is a hard security boundary, not a style preference.

---

## 1. The One Rule That Shapes Everything: Card Data Never Touches This Backend

> *"the frontend tokenizes card details directly with Stripe, so raw card numbers never touch this backend (avoiding PCI-DSS scope)."* — backend controller header comment.

Consequences for the frontend agent:

1. **Never** build a form field bound to a raw card number / CVC / expiry that gets serialized into a `fetch`/`axios` call to our API. There is no backend endpoint that accepts one — `payment.validator.js` only ever validates `amount`, `currency`, `postId`. Sending raw card data anywhere but Stripe's own hosted iframe is a compliance violation, not just a bug.
2. Card capture **must** go through Stripe Elements (`<PaymentElement>` / `<CardElement>`) mounted client-side, using `stripe.confirmPayment()` / `stripe.confirmCardPayment()` from `@stripe/stripe-js`. Stripe's iframe owns the card fields; our React form only owns amount/shipping/promo-adjacent fields, if any.
3. **Payment status is never trusted from the client.** The backend explicitly states only its Stripe webhook handler and the admin refund flow may move a `Payment` out of `pending`. The frontend must never optimistically render "Payment successful" purely because `stripe.confirmPayment()` resolved without error on the client — that only means Stripe *accepted the confirmation attempt*, not that the webhook (source of truth) has landed yet. See §4 for the correct pattern (poll/socket the backend's own record, don't trust the client-side Stripe.js result as final).

---

## 2. Data Model (TypeScript types)

```ts
// types/payment.ts
export type PaymentProvider = 'stripe' | 'paypal';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  _id: string;
  amount: number;          // smallest currency unit (e.g. cents)
  currency: string;        // uppercase 3-letter ISO, e.g. "USD"
  provider: PaymentProvider;
  status: PaymentStatus;
  transactionId: string;   // Stripe PaymentIntent id — opaque, never parse it
  buyer: UserSummary | string;
  seller?: UserSummary | string | null;
  post?: { _id: string; title: string; media?: string[] } | string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

`amount` is **always integer smallest-currency-unit** (cents for USD) end-to-end — the same convention used by the offers feature elsewhere in this app. Never store or transmit a decimal dollar amount; convert at the form boundary only (§6).

Note: `refundPayment` in the service currently sets a refunded payment's `status` back to `"failed"` (the schema has a `'refunded'` enum value, but the service doesn't use it yet — see the code comment `// or add a dedicated "refunded" enum value...`). **Render `status === 'failed'` on a payment that has a `refundedAt`-like signal cautiously** — until the backend is updated to actually set `'refunded'`, the frontend cannot reliably distinguish "declined" from "refunded" by status alone. Treat this as a known backend gap; don't build UI that assumes `'refunded'` will ever actually appear from this service, but keep the type since the schema allows it and the admin panel or a future fix may rely on it. Flag this back rather than silently working around it with guesses.

---

## 3. REST Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/payments/create-intent` | buyer (any authenticated user) | Creates a Stripe PaymentIntent + a `pending` Payment row; returns `{ clientSecret, paymentId }` |
| POST | `/api/payments/webhook` | none (Stripe-signed) | **Not called by the frontend at all.** Server-to-server only. Do not build any client code that hits this route. |
| GET | `/api/payments/me` | any authenticated user | The current user's own purchase history, offset-paginated |
| GET | `/api/payments/:id` | buyer, seller, or admin | Single payment detail (403 for anyone else) |
| GET | `/api/admin/payments` | admin | Global transaction ledger, filterable by `status`, offset-paginated |
| POST | `/api/payments/:id/refund` | admin | Refunds a completed payment via Stripe |

### 3.1 Query hooks to build

```ts
export const qk = {
  myPayments: (page: number) => ['payments', 'me', page] as const,
  payment: (id: string) => ['payments', id] as const,
  adminPayments: (page: number, status?: string) => ['payments', 'admin', page, status ?? 'all'] as const,
};
```

- `useMyPayments(page)` — `useQuery`, offset pagination (same `buildPaginatedResponse` shape as the conversations feature: server returns `limit + 1` rows as a "has more" signal).
- `usePayment(id)` — `useQuery`, used on a payment-detail / order-confirmation screen. Poll this while `status === 'pending'` (see §4.2) rather than treating a single fetch as final.
- `useAdminPayments(page, status?)` — admin table, `status` as a controlled filter (`'pending' | 'completed' | 'failed' | 'refunded' | undefined`) mapped straight to the `?status=` query param.
- `useCreatePaymentIntent()` — `useMutation`, POSTs `{ amount, currency, postId? }`, returns `{ clientSecret, paymentId }`. This is the *only* mutation in this feature that hits our backend directly with money-shaped input; everything past this point is between the browser and Stripe until the webhook lands.
- `useRefundPayment()` — `useMutation` (admin only), POSTs to `/api/payments/:id/refund`, invalidates `qk.payment(id)` and `qk.adminPayments`.

There is deliberately **no** `useConfirmPayment` REST hook — confirmation happens via Stripe.js in the browser, not our API (§4).

---

## 4. The Checkout Flow (End-to-End)

This is the sequence the agent must implement across a `CheckoutForm` component (Stripe Elements) and its parent screen.

### 4.1 Step-by-step

1. Parent screen calls `useCreatePaymentIntent().mutateAsync({ amount, currency, postId })`.
   - `amount` must already be integer cents by this point (§6) — don't pass a raw form-bound dollar float.
   - Store the returned `clientSecret` and `paymentId` in local component state (or a short-lived Zustand slice if the checkout spans multiple routed steps, e.g. shipping → review → pay).
2. Wrap the payment step in Stripe's `<Elements stripe={stripePromise} options={{ clientSecret }}>` from `@stripe/react-stripe-js`. `stripePromise` = `loadStripe(PUBLISHABLE_KEY)`, created once at module scope (never inside a render).
3. Render `<PaymentElement />` inside `<Elements>`. This is Stripe's hosted card UI — it is the *only* thing allowed to hold card data.
4. On submit, call `stripe.confirmPayment({ elements, confirmParams: { return_url } })`.
   - `return_url` is needed for redirect-based methods (3DS, many wallets); Stripe redirects back to that URL with `payment_intent` / `payment_intent_client_secret` query params on completion — the confirmation screen route must read those and reconcile (see §4.3).
   - For card-only flows Stripe may resolve without a redirect; handle both paths.
5. **Do not mark the order as paid in the UI based solely on step 4 resolving successfully.** A resolved `confirmPayment` call means Stripe *accepted* the confirmation, not that our backend's ledger (`Payment.status`) has moved to `'completed'` — that only happens when the webhook in `payment.service.js`'s `processWebhookEvent` runs. Move to a "confirming…" state instead.

### 4.2 Reconciling the real status (poll or socket)

After `confirmPayment` resolves (or after redirect-back), the frontend needs `Payment.status` to actually become `'completed'`/`'failed'` before showing a final result. Two complementary mechanisms, both already supported by the backend — use both:

- **Socket** (`payment_updated`, room `user_<buyerId>`): the backend already joins each user's socket to a personal room via the existing `register_user` handler (referenced in `payment.service.js`) and emits `{ paymentId, status }` the instant the webhook processes. Subscribe to this on the checkout/confirmation screen:
  ```ts
  socket.on('payment_updated', ({ paymentId, status }) => {
    if (paymentId === currentPaymentId) {
      queryClient.setQueryData(qk.payment(paymentId), (old) => old ? { ...old, status } : old);
    }
  });
  ```
  This is the fast path — typically arrives within a second or two of `confirmPayment` resolving.
- **Poll fallback** (`usePayment(paymentId)` with `refetchInterval`): sockets can drop, tabs can background, `register_user`/room-join can race with the webhook on a slow network. While `status === 'pending'`, poll `GET /api/payments/:id` every ~2–3s as a backstop, and stop polling once status leaves `'pending'` or after a reasonable timeout (e.g. 60s) — past that, show a "still processing, we'll email you" state rather than spinning forever.

  ```ts
  useQuery({
    queryKey: qk.payment(paymentId),
    queryFn: () => fetchPayment(paymentId),
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? 2500 : false),
  });
  ```

### 4.3 Redirect-back reconciliation

If `confirmPayment` triggered a redirect (3DS, wallets), the `return_url` route must, on mount:
1. Read `payment_intent_client_secret` from the URL.
2. Call `stripe.retrievePaymentIntent(clientSecret)` to read Stripe's own status for display purposes only (e.g. immediate "processing" vs. "requires action" UI feedback).
3. Still rely on §4.2's socket/poll against **our backend's** `Payment.status` as the actual source of truth for order fulfillment UI (e.g. "your listing is now marked sold", "receipt emailed") — Stripe's client-side status and our ledger's status can be momentarily out of sync by design (webhook latency).

---

## 5. Business Rules to Enforce / Reflect

1. **Amount is smallest-currency-unit, integer, positive.** Mirror the backend Zod schema exactly (§6) — `amount` must be a positive integer, not a float, before it's ever sent to `create-intent`.
2. **Currency defaults to `"usd"`** if omitted; the backend regex accepts any case but the *Payment model* itself uppercases and enforces exactly 3 letters. If exposing a currency selector, constrain it to a fixed known-supported list rather than free text — no reason to hand the backend something that will 400.
3. **`postId` is optional** — not every payment is a marketplace purchase (per `Payment.js`'s comment: `seller`/`post` are optional). Don't require a listing context to build/test the checkout flow; support a standalone "top-up"/generic payment path too if the product needs one, but only wire `postId` through when checkout was entered from a listing.
4. **No client-side "mark as paid."** There is no endpoint for it, deliberately. Any UI state that says "Paid" must be sourced from `Payment.status === 'completed'` as read from our backend (§4.2), never inferred from a Stripe.js promise resolving or from local component state.
5. **Refunds are admin-only, and only for `status === 'completed'` payments.** In the admin payments table, only show a "Refund" action when `payment.status === 'completed'`; disable/hide it for `pending`/`failed`/already-`refunded`-looking rows (backend 400s otherwise: *"Only completed payments can be refunded"*). Non-admin users should never see a refund control at all — gate on role, not just on hiding a button (route-level guard, not just UI hiding, since `/api/payments/:id/refund` will 403/`restrictTo('admin')` regardless).
6. **Payment detail access is participant/admin-scoped.** `GET /api/payments/:id` 403s for anyone who isn't the buyer, the seller, or an admin. Treat a 403 there as "not visible to you" and redirect away — don't build a client-side check that tries to replicate this from possibly-stale cached data instead of trusting the server's answer.
7. **Webhook route is entirely out of frontend scope.** No hook, no fetch, no reference to `/api/payments/webhook` anywhere in frontend code — it's Stripe-to-server only and doesn't accept normal auth anyway.
8. **`transactionId` is opaque.** Never parse, format, or derive UI meaning from the Stripe PaymentIntent id string beyond displaying it verbatim (e.g. in an admin detail view or a support/receipt context) — treat it like a UUID, not a structured value.
9. **Metadata is Mixed/free-form** on the backend — if surfaced in an admin UI, render it defensively (e.g. `JSON.stringify` in a collapsible block), don't assume specific keys exist.

---

## 6. Validation (React Hook Form + Zod)

Mirror `payment.validator.js` exactly, including its comment that dollars vs. cents is a deliberate distinction:

```ts
// schemas/payment.schema.ts
import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createPaymentIntentSchema = z.object({
  amount: z
    .number({ required_error: 'amount is required.' })
    .int('amount must be an integer in the smallest currency unit (e.g. cents).')
    .positive("A positive amount (in the smallest currency unit) is required."),
  currency: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{3}$/, 'Currency must be a valid 3-letter ISO code.')
    .optional()
    .default('usd'),
  postId: z.string().regex(objectIdRegex, 'postId must be a valid post ID.').optional(),
});
export type CreatePaymentIntentFormValues = z.infer<typeof createPaymentIntentSchema>;
```

**Dollars → cents conversion belongs at the form boundary, not in this schema.** If the checkout UI shows a human price like `$25.00` (e.g. read from `post.price`, which — per the offers feature elsewhere in this app — is *also* stored as integer cents), the amount passed into `createPaymentIntentSchema`/the mutation should already be the integer cents value pulled from that source of truth. Don't round-trip through a text input parsing dollars back into cents unless the flow genuinely lets a user type a custom amount (e.g. a tip or a "make an offer"-adjacent flow) — and if it does, convert with a fixed-point-safe helper (`Math.round(dollars * 100)`), never a naive float multiply left unrounded.

---

## 7. State Management Split

| Concern | Owner |
|---|---|
| `Payment` records (`me`, `:id`, admin list) | **TanStack Query** |
| Stripe.js instance (`loadStripe(...)` promise) | Module-level singleton, not component state — created once, imported wherever `<Elements>` is used |
| In-progress checkout step (shipping → review → pay), `clientSecret`/`paymentId` for the active checkout | Local component state if single-route, or a short-lived Zustand `checkout.store.ts` slice if the flow spans multiple routes — **clear it on successful completion or on leaving the flow**, never persist it across sessions (it's transient, and a stale `clientSecret` must not be reused for a new attempt) |
| Socket connection / `payment_updated` subscription | Reuse the same `useSocketStore` / socket client already established for the messaging feature — don't create a second socket instance |
| Admin table filters (`status`, `page`) | URL search params (shareable/bookmarkable admin views) via `useSearchParams`, not Zustand |

---

## 8. Suggested File Structure

```
src/
  types/
    payment.ts
  schemas/
    payment.schema.ts
  lib/
    stripe-client.ts        # export const stripePromise = loadStripe(PUBLISHABLE_KEY)
  api/
    payments.api.ts         # axios wrappers: createIntent, getMe, getById, refund, adminList
  hooks/
    useCreatePaymentIntent.ts
    useMyPayments.ts
    usePayment.ts            # polling variant while pending, per §4.2
    useAdminPayments.ts
    useRefundPayment.ts
    usePaymentSocketSync.ts  # subscribes to `payment_updated`, patches qk.payment cache
  store/
    checkout.store.ts        # only if checkout spans multiple routes
  components/
    payments/
      CheckoutForm.tsx        # <Elements> + <PaymentElement> + confirm button
      PaymentStatusBadge.tsx  # status -> shadcn Badge variant mapping
      PaymentHistoryList.tsx  # useMyPayments + virtualized/paginated list
      PaymentDetailCard.tsx
    admin/
      payments/
        AdminPaymentsTable.tsx
        RefundConfirmDialog.tsx
  routes/
    checkout/
      CheckoutPage.tsx         # step 1–4 of §4.1
      CheckoutConfirmationPage.tsx  # handles return_url redirect-back, §4.3
    payments/
      MyPaymentsPage.tsx
      PaymentDetailPage.tsx
    admin/
      AdminPaymentsPage.tsx
```

---

## 9. Implementation Order (recommended)

1. Types, Zod schema, `lib/stripe-client.ts` singleton, `payments.api.ts` (§2, §3, §6).
2. `useCreatePaymentIntent` + a minimal `CheckoutForm` wrapping `<Elements>`/`<PaymentElement>` — get a real PaymentIntent created and a card confirmable in Stripe's test mode before building any status UI.
3. `usePayment(paymentId)` with the polling `refetchInterval` from §4.2 — verify you can observe `pending → completed` purely by polling before adding sockets.
4. `usePaymentSocketSync` (`payment_updated` listener patching the query cache) layered on top of the poll — confirm the socket update arrives and the poll naturally stops once status flips.
5. `CheckoutConfirmationPage` handling the `return_url` redirect-back case (§4.3) — test with a 3DS test card to force the redirect path.
6. `useMyPayments` + `PaymentHistoryList` (offset pagination, reuse the same pattern as the conversations list elsewhere in this app).
7. `PaymentDetailCard` / `PaymentDetailPage` — handle the 403 "not a party to this payment" redirect (§5.6).
8. Admin: `useAdminPayments` (status filter via URL params) + `AdminPaymentsTable` + `useRefundPayment` + `RefundConfirmDialog`, gated to admin role at the route level.

---

## 10. Environment / Setup Items to Confirm Before Coding

- **Publishable key**: `VITE_STRIPE_PUBLISHABLE_KEY` (or equivalent) must be exposed to the frontend build — confirm the exact env var name used elsewhere in this repo's frontend config before hardcoding one.
- **`return_url` value**: must be an absolute URL the deployed frontend actually serves (e.g. `${window.location.origin}/checkout/confirm`) — confirm the intended confirmation route path with whoever owns routing before wiring `confirmParams.return_url`.
- **Socket auth/room join**: confirm the exact client-side call needed to trigger the backend's `register_user` handler (referenced in `payment.service.js` but not included in the provided files) so the browser actually lands in the `user_<buyerId>` room before relying on `payment_updated` — likely an emit fired once on socket connect/login, shared with (or the same as) whatever the messaging feature already does for its own socket lifecycle.
- **Currency list**: confirm which currencies the product actually supports (Stripe account config, not just the regex) before building a currency selector — the backend will accept any well-formed 3-letter code even if the Stripe account can't actually charge in it.
