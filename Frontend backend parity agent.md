# NexMarket — Frontend/Backend Parity Agent Instructions

**Role:** You are a coding agent auditing and fixing an existing NexMarket frontend (`src/`) so it is a byte-exact behavioral match of the backend contract below. You do not modify backend code — the backend is the source of truth. Every mismatch you find gets fixed on the frontend side only.

**Inputs you are working from** (all four prior docs, reconciled into one contract):
- `api_documentation.md` — the authoritative endpoint/DTO contract (now current as of this session's 6 backend additions).
- `frontend-business-logic-audit.md` — the prior audit; several of its ❌/⚠️ items are now ✅ (see §0 below) and no longer need fixing — don't re-flag them.
- `nexmarket-agent-instructions.md` — binding per-library implementation rules (Axios/TanStack/Zustand/Socket.io/shadcn/performance).
- `vendo-pixel-spec-condensed.md` — the pixel/UX spec the components must visually and behaviorally satisfy.

**Definition of done:** zero syntax errors (`tsc --noEmit` clean, ESLint clean), zero logic errors (every frontend assumption about a route/field/response-shape/auth-scope matches the backend contract exactly), and every rule in `nexmarket-agent-instructions.md` §0–§11 is satisfied for any file you touch.

---

## 0. Start here: what changed since the last audit

The prior audit (`frontend-business-logic-audit.md`) found 5 backend gaps. All 5 are now closed — if the frontend was built to work around any of these, that workaround is now dead code and must be removed:

| Was | Now |
|---|---|
| No `GET /api/uploads` collection route | Exists — `owner`-filterable for admins, self-scoped for regular users |
| No admin Payments listing | `GET /api/admin/payments` exists (`status?`, `page?`, `limit?`) |
| No admin Conversations listing | `GET /api/admin/conversations` exists |
| `PATCH /api/posts/:id` was author-only | Now Author **or** Admin |
| No `payment_updated` socket event | Emitted to `user_<buyerId>` on webhook confirm/fail and on admin refund |
| *(bonus, previously undiscovered)* `refundPayment` controller had no route | Now `POST /api/admin/payments/:id/refund` |

If any frontend code currently shows a "coming soon" / disabled state for admin Uploads, admin Payments, admin Conversations, or the admin post-status toggle because these were previously unbuildable — that gating logic must now be removed and the real hook wired in.

---

## 1. Audit procedure (run this for every domain, in order)

For each of the 12 endpoint groups in `api_documentation.md` §5 (Auth, Users, Posts, Comments, Categories, Conversations, Notifications, Payments, Uploads, Reports, Admin, Health):

1. **Locate** the frontend query/mutation hook(s) that call it (`src/features/*/queries.ts`, `mutations.ts`).
2. **Diff the contract**, checking every one of these against `api_documentation.md`:
   - HTTP method + exact path (including path params).
   - Auth requirement — does the frontend gate this call/route behind the correct role, or does it assume a broader/narrower scope than the backend actually enforces?
   - Request body / multipart field names — cross-check against the Zod schema block in the doc verbatim, not from memory.
   - Response envelope shape — `ApiResponse<T>` vs `PaginatedResponse<T>` vs a bare message object; check the exact data key (`file` not `upload`, `avatar`+`file` not `url`, `media`+`files` not `urls` — these were real bugs fixed in a prior session, re-verify they haven't regressed).
   - Status code (`201` vs `200`) if the component branches on it.
3. **Locate the corresponding UI surface** in `vendo-pixel-spec-condensed.md` (which column/view/panel renders this data) and confirm the component actually consumes the hook's real shape, not a stale mock shape left over from before the endpoint existed.
4. **Apply the per-library rules** from `nexmarket-agent-instructions.md` relevant to that hook (see §2 checklist below) and fix any violation found, even if the data itself was correct.
5. **Record the fix** in the PR/commit description as `endpoint → file → what was wrong → what changed`, so the change is traceable back to a specific contract line.

Do not skip a domain because it "looks fine" — several previously-correct-looking hooks in the prior audit turned out to have subtle envelope-key mismatches (`upload` vs `file`) that only a line-by-line diff against the doc catches.

---

## 2. Per-library correctness checklist (apply while fixing, not after)

Pull the exact rule text from `nexmarket-agent-instructions.md` for each — this is the condensed checklist, not a replacement for reading the source sections:

- **Axios (§1):** single instance, `withCredentials: true`, silent-refresh interceptor excludes `/auth/login` and `/auth/refresh-token` from retry, every query fn forwards `signal`, upload client enforces client-side size/count guards *before* the request fires (avatar ≤2MB single file field `avatar`; post media ≤5 files/≤10MB field `images` — note these are the corrected field names, not `file`/`files`).
- **TanStack Query (§2):**
  - Feed (`GET /api/users/me/feed`) and Posts (`GET /api/posts`) are **page-based** (`page`/`pages`/`hasNext` in `PaginatedResponse`) — `getNextPageParam` must compute `hasNext ? page + 1 : undefined`.
  - Messages (`GET /api/conversations/:id/messages`) is **cursor-based** (`nextCursor` field) — `getNextPageParam` reads the cursor, never offset math. Do not share one generic `getNextPageParam` implementation between these two families; verify each hook uses the right one.
  - Admin tables use `useQuery` + `keepPreviousData`, not `useInfiniteQuery` (PSD backlog explicitly defers admin pagination) — including the *newly available* `useUploads`, `useAdminPayments`, `useAdminConversations` hooks; don't build these as infinite queries just because their non-admin siblings are.
  - Likes optimistic mutation reconciles against the response's real `likesCount` on success (the endpoint returns it) — follow/unfollow does **not** return an updated count, so that mutation must locally increment/decrement and reconcile via cache invalidation instead, never assume a count comes back.
  - Comments/replies: REST persists, Socket.io `new_comment`/`reply_created` is the cache-insertion source of truth, dedupe by `id`.
  - `select` for derived fields, never a component-body `.map()` recompute.
- **Zustand (§3):** no server data in any store; selector-only subscriptions (`useShallow` for multi-field); `adminUiStore` never owns `activeView` (that's `react-router-dom`'s job).
- **Socket.io (§4 catalog + agent §5):** single shared singleton, no raw `io()`; verify the client now listens for `payment_updated` and invalidates/refetches `usePaymentLedger`/`useAdminPayments` on receipt — this is a **new** event as of this session, check it isn't silently unhandled.
- **shadcn/ui (§7):** every interactive control is a shadcn primitive from the approved inventory, not hand-rolled; icon-only buttons have a `Tooltip` accessible name; destructive actions (`delRow`, `Banned` status, refund) are behind `AlertDialog` — this now explicitly includes the **new** `POST /api/admin/payments/:id/refund` action, which moves real money and must not ship without confirmation.
- **Admin module (§8):** fully isolated lazy chunk; new admin views (Uploads grid, Payments table, Conversations list) each get their own `React.lazy` split (§8, §10.1 ≤25KB/view) — don't bolt them onto an existing admin chunk as an afterthought.
- **Virtualization (§10.2):** the newly-buildable Uploads grid, admin Payments table, and admin Conversations list all belong in the virtualization matrix now — verify each is wrapped in `@tanstack/react-virtual`, since they were previously stubbed/absent and may have been scaffolded without it.
- **Bundle budgets (§10.1):** re-run the bundle analyzer after wiring the 3 newly-available admin views — each must independently stay ≤25KB gzip; a naive "unstub and ship" pass is a common source of budget regression.

---

## 3. Specific known-fix list (apply these explicitly, don't rediscover them)

These are concrete, confirmed frontend changes required by the backend contract as it now stands — treat as a checklist, not just guidance:

1. **`useUploads` hook** — point at `GET /api/uploads` (not `GET /api/uploads/:id` reused with fabricated params). Response is `PaginatedResponse<File>`; regular users get self-scoped results automatically (don't pass `owner` for non-admin callers — the backend ignores it anyway, but sending it is a signal of a misunderstood contract).
2. **`useAdminPayments` hook** — point at `GET /api/admin/payments`, **not** `GET /api/payments/me` with a spoofed scope param (`/me` was never admin-capable). Wire the `status` filter to the admin table's filter pill.
3. **`useAdminConversations` hook** — point at `GET /api/admin/conversations`.
4. **Admin Post status/moderation toggle mutation** — `PATCH /api/posts/:id` no longer 403s for a non-author admin; remove any client-side workaround (e.g., a disabled button, a "not yet supported" toast) that was built around the old author-only restriction.
5. **Admin refund action** — wire to `POST /api/admin/payments/:id/refund`, gated behind `AlertDialog`, `onSuccess` invalidates the relevant payments query. This is a brand-new action with no prior frontend implementation to check against — build it fresh per §2's shadcn/mutation rules, not by copying an existing pattern that lacks the confirmation gate.
6. **Payments query bridge** — add a `payment_updated` socket listener (in `queryBridge.ts`, batched per animation frame per §10.4) that invalidates `usePaymentLedger` (buyer) and `useAdminPayments` (admin) using `paymentId`/`status` from the event payload.
7. **`File` TypeScript interface** — confirm `src/types/api.ts` has been updated to include the `File` interface (see `api_documentation.md` §1); every one of the hooks in items 1–3 above types its data as `File`/`PaginatedResponse<File>`, so a missing/stale type here will surface as `any` leaking through `select`, which violates the `no any` global rule (§0 of the agent instructions).

---

## 4. Verification gates (run after fixes, before declaring done)

1. **Type-check:** `tsc --noEmit` — zero errors, zero `any`, zero implicit `unknown` left unnarrowed (§0 global rule).
2. **Lint:** project ESLint config clean — this also catches the "no raw `fetch`", "no raw `io()`", "no namespace icon import" rules mechanically.
3. **Contract re-diff:** for every hook touched in §3, re-read the corresponding `api_documentation.md` section one more time side-by-side with the final hook code — confirm method, path, field names, and response envelope key match exactly. This is the same line-by-line diff from §1 step 2, run again post-fix as a regression check.
4. **Cross-cutting checklist:** walk `nexmarket-agent-instructions.md` §11 (Cross-Cutting Acceptance Checklist) top to bottom against every file changed in this pass — do not merge with any box unchecked.
5. **Mono-chip check (PSD §5 Interaction Contract rule 5):** every admin panel now has a *real* backing endpoint (Uploads, Payments, Conversations are no longer gaps) — confirm each panel's mono chip prints the actual route it calls, and that no panel is still showing a placeholder/fabricated route string left over from when the endpoint didn't exist.
6. **No behavior regression on already-correct domains:** Auth, Users/Profile, core Posts/Feed, Comments, Categories, Reports, and standard Admin user/dashboard/audit-log management were already verified correct in the prior audit — confirm this pass didn't touch or regress them; if a shared file (e.g., `queryKeys.ts`, `client.ts`) was edited to add the new hooks, diff it to ensure existing keys/behavior are untouched.

**If any gate fails, do not report done — fix and re-run the full gate list, not just the failing gate**, since fixes in one domain (e.g., adding a new query key) can silently collide with an existing one.