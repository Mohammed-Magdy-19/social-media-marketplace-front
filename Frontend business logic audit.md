# NexMarket — Frontend Business Logic Audit

**Purpose:** Derive the frontend business logic each backend endpoint must drive (per `nexmarket-agent-instructions.md` + `vendo-pixel-spec-condensed.md`), then test that logic against the actual, corrected contract in `api_documentation.md`.

**Verdict key:**
- ✅ **Achievable** — endpoint + shape + auth rule fully support the required frontend behavior as specified.
- ⚠️ **Partial** — endpoint exists but a detail (auth scope, shape, or missing param) will break the specified behavior unless resolved.
- ❌ **Gap** — no matching backend endpoint exists for behavior the frontend spec assumes.

---

## 1. Auth Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| Silent Token Interceptor: on 401, `POST /api/auth/refresh-token` once (mutex-guarded), retry original request; on failure, `authStore.logout()` + router redirect. | `POST /api/auth/refresh-token` — Public, reads `refreshToken` cookie or body, returns `ApiResponse<{ accessToken }>`. | ✅ Achievable | Response shape (`accessToken` only, no new refresh token) matches a rotate-on-read model; interceptor must not treat `/auth/login` or `/auth/refresh-token` calls themselves as refreshable (doc's own audit prompt already flags this exclusion). |
| `useCurrentUser()` on shell mount, `staleTime: Infinity`, manual invalidation on login/logout. | `GET /api/auth/me` — Protected, `ApiResponse<{ user: User }>`. | ✅ Achievable | — |
| Register/login forms — Zod schemas must mirror backend validation exactly (password complexity, username regex). | `registerSchema`/`loginSchema` documented with exact regex/length rules in §5.1. | ✅ Achievable | Frontend Zod schema must be **copied**, not re-derived, to avoid silent drift from the backend's `Joi`/`Zod` rules. |

---

## 2. Users & Profile Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| `PATCH /api/users/me/password` form uses `currentPassword` / `newPassword` / `newPasswordConfirm`. | Matches exactly in §5.2. | ✅ Achievable | Confirmed in the prior doc audit — this is the one field-naming trap the audit prompt (§6) explicitly guards against. |
| `useFeedInfinite()` — **must** be `useInfiniteQuery`, drives Column 2 scrolling timeline. | `GET /api/users/me/feed` — `PaginatedResponse<Post>` with `page`/`limit`, not a cursor. | ⚠️ Partial | `PaginatedResponse` is **page-based** (`page`, `pages`, `hasNext`), not cursor-based. `useInfiniteQuery`'s `getNextPageParam` must compute `hasNext ? page + 1 : undefined` — works, but this is *not* the same cursor pattern used for messages (§2.12); the two infinite hooks need different `getNextPageParam` implementations. Instructions don't call this distinction out — worth flagging to avoid a copy-pasted cursor implementation that silently never pages. |
| `useSavedPosts()`, invalidated by the save mutation. | `GET /api/users/me/saved-posts` — `PaginatedResponse<Post>`. | ✅ Achievable | Same page-based caveat as above applies if this is ever made infinite. |
| Follow/unfollow optimistic-capable UI (follower/following counts). | `POST`/`DELETE /api/users/:id/follow` return only a message, no updated counts. | ⚠️ Partial | Neither response returns the new `followerCount`. An optimistic UI must locally increment/decrement `followerCount` on the cached `User` object and roll back on error — it **cannot** read a fresh count from the mutation response itself; invalidate `['users', 'detail', id]` afterward to reconcile with the backend virtual. |

---

## 3. Posts & Feed Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| `usePostsInfinite(filters)` — `useInfiniteQuery`, filters object is the query key, drives Column 3 + Discovery filter sync. | `GET /api/posts` — `PaginatedResponse<Post>`, filters: `search, category, tag, author, sort, page, limit`. | ⚠️ Partial | Same page-based-vs-cursor caveat as §2 feed. Also: `limit` caps at **50 max** per doc — a virtualized "load more" pattern that requests large pages must respect this ceiling or the request silently gets clamped server-side, desyncing the client's expected page size. |
| Likes: optimistic mutation, `onMutate` flips state+count immediately, doesn't wait for socket broadcast. | `POST /api/posts/:id/like` → `{ liked: true, likesCount: 15 }`; `DELETE` → `{ liked: false, likesCount: 14 }`. | ✅ Achievable | Response *does* include the authoritative count, so `onSuccess` can reconcile the optimistic guess with the real server count — better than the follow case above. |
| Save: `onSuccess` invalidates `['saved-posts']`. | `POST`/`DELETE /api/posts/:id/save` → message-only response. | ✅ Achievable | No count to reconcile, so invalidation-only is correct and sufficient here. |
| Comments: hybrid — REST for persistence, Socket.io `new_comment`/`reply_created` as source of truth for cache insertion, dedupe by id. | `POST /api/posts/:postId/comments` → `ApiResponse<{ comment: Comment }>` (id present); Socket.io emits `Comment` objects on `new_comment`/`reply_created`. | ✅ Achievable | Dedupe key (`comment.id`) is present in both the REST response and the socket payload, so the merge strategy in §2 of the instructions is implementable as written. |
| Post status toggle (admin) — `PATCH /api/posts/:id`, optimistic + re-filter row out if it no longer matches active pill. | `PATCH /api/posts/:id` — **Auth: Protected (Author only)**, no admin override documented. | ❌ Gap | The admin instructions (§2.1) assume an admin can `PATCH` *any* post's status via this route, but the backend contract only grants author-level write access here (unlike `DELETE /api/posts/:id`, which explicitly allows Author **or** Admin). As written, an admin toggling another user's post status will hit a 403. This needs either a backend RBAC fix (admin override on `PATCH`) or a dedicated `PATCH /api/admin/posts/:id/status` route — flag to backend before building the admin Posts view's toggle action. |

---

## 4. Comments & Replies Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| Comment/reply forms use `text` field, never `content`. | `createCommentSchema` and `PATCH /api/comments/:id` both use `text`. | ✅ Achievable | Matches the audit prompt's explicit trap check (§6.2 of `api_documentation.md`). |
| Delete cascades to replies; UI should optimistically remove the comment **and** its reply subtree. | `DELETE /api/comments/:id` → `"Comment and X replies deleted."` (message only, no reply-id list in REST response). | ⚠️ Partial | The Socket.io `comment_deleted` event *does* carry `{ commentId, replyIds }` (§4 event catalog) — the REST response alone is insufficient to prune the reply subtree from cache; the frontend must rely on the socket event for the actual `replyIds` array, not the REST call's plain-text message. |

---

## 5. Categories Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| Admin "Add category" form has client-side slug auto-gen preview; on success, invalidate shared `['categories']`. | `POST /api/categories` [Admin] body is `{ name, description }` only — **no `slug` field accepted**; backend auto-generates it (per architecture doc §2.4). | ✅ Achievable | Correct as specified — the frontend's slug preview must be presentation-only (not submitted), since the backend is the source of truth for the actual slug and could resolve collisions differently than a naive client-side slugify. |

---

## 6. Conversations & Messages Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| `useMessagesInfinite(id)` — **must** use cursor pagination, `getNextPageParam` reads the cursor, not offset/page. | `GET /api/conversations/:conversationId/messages` — `cursor?`, `limit?`, response includes `nextCursor`. | ✅ Achievable | This is the one genuinely cursor-based list endpoint in the whole API — correctly distinguished from the page-based feed/posts endpoints flagged above. |
| Messages: Socket.io is source of truth, REST is dedup-merged by id. | `Message.id` present in both the REST shape and would need to be present in the `send_message`/`receive_message` socket payload (not explicitly itemized in the event catalog's payload column). | ⚠️ Partial | The Socket.io event catalog (§4) documents `new_comment`-family payloads in detail but never specifies the exact `send_message`/`receive_message` payload shape — confirm it includes `id`, `conversation`, and `createdAt` matching the `Message` interface before wiring the dedupe-by-id merge, or the merge logic has nothing reliable to key on. |
| Admin "Conversations" view: `useAdminConversations()` → assumed `GET /api/admin/conversations`. | No such route exists anywhere in `api_documentation.md` §5.6 or §5.11 — only participant-scoped `GET /api/conversations`. | ❌ Gap | The agent instructions flag this themselves as *"assumed... confirm with backend"* (§2.1) — confirmed here: **it does not exist**. The admin Conversations view (Vendo PSD §6, "5 threads") has no backing endpoint today. Needs a new admin-scoped route before that view can be built against real data. |

---

## 7. Notifications Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| Badge count reads from `useNotifications()` cache (`data.filter(...)`), never a separate counter endpoint — *except* the instructions also reference a dedicated unread-count query elsewhere in the broader system. | `GET /api/notifications` → `PaginatedResponse<Notification>`; separately, `GET /api/notifications/unread-count` → `ApiResponse<{ unreadCount: number }>` exists. | ⚠️ Partial | Two valid strategies exist and the instructions pick the "derive from the list" approach for the **admin** badge specifically (§2.1) — that's fine as written since admin already fetches the full list. But it's worth being explicit: the lighter-weight `unread-count` endpoint should still back the **buyer-facing** bell badge (which doesn't need the full notification list mounted), so the two badges intentionally use different data sources — not a bug, but undocumented enough to cause confusion if a future contributor "fixes" one to match the other. |
| Mark-all-read: optimistic, strip `unread` flags, zero the metric, roll back on error. | `PATCH /api/notifications/read-all` → message-only response, no updated list returned. | ✅ Achievable | Optimistic cache rewrite is the *only* viable approach here since the response carries no data to reconcile with — correctly identified as such in the instructions. |

---

## 8. Payments Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| `usePaymentLedger()` (buyer-scoped) vs. `useAdminPayments(filters)` (admin/global scope) hitting "the same base endpoint with different auth scope." | Only one route documented: `GET /api/payments/me` — Protected, buyer's own payments only. No admin/global-scope payments listing route exists in §5.8 or §5.11. | ❌ Gap | The instructions assert both hooks hit the same endpoint with different scope, but `/me` is inherently self-scoped by design (reads `req.user.id`) — there is no query param or alternate route (`GET /api/admin/payments`) that returns *all* users' transactions for the admin table. The admin Payments view (Vendo PSD §6, "6 txns + webhook feed") has no backing collection endpoint. |
| Payment intent mutation never persisted beyond checkout lifetime. | `POST /api/payments/create-intent` → `{ clientSecret, paymentId }`, no caching implied. | ✅ Achievable | — |
| Webhook-driven ledger invalidation. | `POST /api/payments/webhook` — Unauthenticated, Stripe-signature verified; no REST response consumed by the frontend directly. | ✅ Achievable | Frontend never calls this route directly — it's a backend-to-backend hook. The instructions' framing ("invalidated by the Stripe webhook's downstream effect") should really route through a `payment_updated` Socket.io event (not currently in the §4 event catalog) rather than an unspecified mechanism — worth adding that event to the catalog. |

---

## 9. Uploads & Media Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| Avatar upload: reject client-side if file > 2 MB; multipart field matches backend. | `POST /api/uploads/avatar` — field `avatar` (Multer `.single("avatar")`), 2 MB hard limit server-side. | ✅ Achievable | Confirmed against the corrected `api_documentation.md` (this session's earlier fix) — field name and size ceiling now match the real `upload.middleware.js`. |
| Post media upload: reject if > 5 files or any file > 10 MB; multipart field matches backend. | `POST /api/uploads/posts/:postId` — field `images` (Multer `.array("images", 5)`), 10 MB/file. | ✅ Achievable | Same — corrected field name (`images`, not `files`) now matches. |
| `useUploads(filters)` backing a paginated/virtualized Uploads asset grid (admin view, "8 assets"). | Only `GET /api/uploads/:id` exists — single-asset metadata lookup by id. **No `GET /api/uploads` collection route with filters/pagination.** | ❌ Gap | The instructions flag this themselves as needing confirmation (§2.1: *"implies a list variant... confirm the collection route"*) — confirmed: **no such route exists**. The admin Uploads grid (Vendo PSD §6.10, virtualized per §10.2) cannot be built against the current API without a new `GET /api/uploads?owner=&resourceType=&page=&limit=` route. This is the single largest concrete backend gap in this audit — the admin Uploads view is entirely unbuildable as specified today. |

---

## 10. Reports & Admin Domain

| Frontend requirement | Backend contract | Verdict | Notes |
|---|---|---|---|
| Reports: fire-and-forget mutation, optimistic toast, no cache invalidation unless admin console is open. | `POST /api/reports` → message-only `201`. | ✅ Achievable | — |
| Resolve/Dismiss report: optimistic status-pill rewrite, sidebar badge re-derived from mutated cache. | `PATCH /api/reports/:id` [Admin] → `ApiResponse<{ report: Report }>` (returns updated entity). | ✅ Achievable | Unlike several mutations above, this one *does* return the updated resource, so the optimistic write can be reconciled precisely rather than just invalidated blind. |
| User status change (`Active`/`Suspended`/`Banned`), `AlertDialog`-gated for `Banned`. | `PATCH /api/admin/users/:id/status` [Admin] → `ApiResponse<{ user: User }>`. | ✅ Achievable | Per the backend architecture doc, banning also invalidates the user's refresh tokens server-side — frontend should treat a self-ban edge case (admin banning their own session) as a forced logout, which isn't currently called out in the instructions. |
| Audit Logs view backed by `useAuditLogs()`, flagged in instructions as *"assumed... confirm with backend."* | `GET /api/admin/audit-logs` [Admin] — **does exist**, `PaginatedResponse<object>`, query params `actor?, action?, page?, limit?`. | ✅ Achievable (resolved) | This one was flagged as uncertain in the instructions but is actually documented and correct — no gap. Worth updating the instructions doc to remove the "confirm with backend" caveat here since it's now verified. |

---

## 11. Cross-Cutting Verdicts

| Cross-cutting rule (Instructions §11 checklist) | Verdict | Notes |
|---|---|---|
| All list views backed by paginated endpoints use `useInfiniteQuery`. | ⚠️ Partial | True for feed/posts/messages, but "paginated" here means two *different* pagination styles (page-based vs. cursor-based) that need different `getNextPageParam` logic — see §2/§3/§6 above. A single generic `useInfiniteQuery` wrapper assuming one shape will silently break on the other. |
| Every unbounded list is windowed with `@tanstack/react-virtual`. | ✅ Achievable (mechanically) | Not blocked by the backend — this is a pure frontend implementation detail, independent of API shape, for every endpoint confirmed to exist above. |
| Every panel shows its backing API endpoint as a mono chip (Vendo PSD §5 Interaction Contract). | ❌ Gap (for 3 panels) | This rule can't be satisfied honestly for **Admin Conversations**, **Admin Payments**, and **Admin Uploads grid** — there is no real endpoint to print in the chip for any of the three, per §6/§8/§9 above. Either stub these views behind a "coming soon" state or resolve the three backend gaps first. |
| No manual counter in a store; all badges/counts derived from query cache. | ✅ Achievable | Confirmed compatible with every response shape reviewed (likes, reports, notifications all return or can derive live counts). |

---

## 12. Summary — Backend Gaps to Resolve Before Full Build-Out

1. **`GET /api/uploads` (collection route)** — required for the admin Uploads grid; currently only single-asset `GET /api/uploads/:id` exists.
2. **Admin-scoped Payments listing** (`GET /api/admin/payments` or a scope param on `/me`) — required for `useAdminPayments`; currently only self-scoped `/api/payments/me` exists.
3. **Admin-scoped Conversations listing** (`GET /api/admin/conversations`) — required for the admin Conversations view; no route exists today.
4. **Admin override on `PATCH /api/posts/:id`** — currently author-only; the admin Post status toggle will 403 for non-author admins.
5. **`payment_updated` Socket.io event** — not in the current event catalog; needed to make webhook-driven ledger invalidation concrete rather than implied.

Everything else audited above (Auth, Users, Posts/Feed core, Comments, Categories, Reports, standard Admin management, and the corrected Uploads field names/response shapes) is achievable as specified against the current backend contract.