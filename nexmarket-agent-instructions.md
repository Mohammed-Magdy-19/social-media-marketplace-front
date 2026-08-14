# NexMarket Engine — Library-Specific Agent Instructions
**Target Version:** v1.0.0-Production
**Scope:** Implementation directives for coding agents (human or AI) generating front-end code for NexMarket. These instructions translate the PSD into concrete, per-library rules. They are binding — any generated code that violates a rule below must be rejected and regenerated.

Stack: React 19 (TS) · Tailwind CSS v4.3 · shadcn/ui · React Hook Form + Zod · Zustand · TanStack Query · Axios · react-router-dom · Socket.io Client · `@tanstack/react-virtual`

---

## 0. Global Rules (apply to every file)

- TypeScript strict mode. No `any`. No implicit `unknown` left unnarrowed.
- One concern per layer: **Zustand** = ephemeral client/UI state only. **TanStack Query** = all server-cache state. **Axios** = transport only (no business logic in interceptors beyond auth). Never duplicate server data into a Zustand store "for convenience."
- All REST calls go through the single shared Axios instance (`/lib/api/client.ts`). No raw `fetch` calls.
- All Socket.io events go through the single shared socket singleton (`/lib/socket/client.ts`). No component may call `io()` directly.
- File/module boundaries mirror PSD section letters (A–D) so any engineer can trace a file back to its spec clause.
- **Performance is a first-class constraint, not a cleanup pass.** Every rule in §1–§9 below is written assuming the budgets and techniques in §10 (Performance Engineering Directives) — read §10 before implementing any list view, route, or real-time feature, not after.

---

## 1. Axios — Transport Layer

**File:** `src/lib/api/client.ts`

Rules:
- Single `axios.create()` instance, `baseURL` from env var, `withCredentials: true` (required for the HttpOnly refresh cookie in PSD §4A).
- Implement the **Silent Token Interceptor** as a response interceptor:
  - On `401`, pause the failing request, call `POST /api/auth/refresh-token` exactly once (use a mutex/in-flight promise to prevent parallel refresh storms), then retry the original request with the new token.
  - On refresh failure, clear auth state (via Zustand `authStore.logout()`) and redirect to `/login` through the router, not a hard `window.location` reload.
- Request interceptor attaches the access token from the Zustand `authStore` (never read tokens from `localStorage` directly inside components).
- Upload endpoints (`/api/uploads/avatar`, `/api/uploads/posts/:postId`) must use a dedicated `uploadClient` (same base instance, `Content-Type: multipart/form-data`) with client-side size guards **before** the request fires:
  - Avatar: reject client-side if file > 2 MB.
  - Post media: reject if > 5 files or any file > 10 MB. Surface these as Zod-validated form errors, not thrown exceptions.
- Every Axios function used by TanStack Query must return typed data (`Promise<T>`), never the raw `AxiosResponse`.
- **Cancellation is mandatory, not optional:** every query function accepts and forwards TanStack Query's `signal` into the Axios `config` (`axios.get(url, { signal })`). Rapid filter changes, tab switches, or unmounts must abort the in-flight request — an uncancelled stale request that resolves late and repaints the UI is a jank source, not just wasted bandwidth.
- Enable `Accept-Encoding: br, gzip` (default in modern browsers, but confirm the API responds compressed) and keep list-endpoint responses lean — request only the fields the current view renders; do not let a shared Axios function over-fetch a full entity when a card view needs six fields.
- No business logic, JSON transformation, or derived-field computation inside interceptors — interceptors run on every request/response and must stay O(1); heavier shaping belongs in the query's `select` (see §2).

---

## 2. TanStack Query — Server Cache Layer

**Folder:** `src/features/*/queries.ts` + `src/features/*/mutations.ts`, one folder per PSD domain (`auth`, `feed`, `posts`, `payments`, `conversations`, `reports`).

Query key convention: hierarchical arrays, e.g. `['posts', { category, tag, author, sort, page }]`, `['conversations', conversationId, 'messages']`.

Domain mapping (query hooks required per PSD §4):

| PSD Endpoint | Hook | Notes |
|---|---|---|
| `GET /api/auth/me` | `useCurrentUser()` | Runs on app shell mount; `staleTime: Infinity`, invalidated manually on logout/login. |
| `GET /api/users/me/feed` | `useFeedInfinite()` | **Must** use `useInfiniteQuery` (Column 2 is a scrolling timeline). |
| `GET /api/posts` | `usePostsInfinite(filters)` | `useInfiniteQuery`; filters object is the query key; drives Column 3 + Discovery filter sync (PSD §1 "Global Intent Synchronization"). |
| `GET /api/categories` | `useCategories()` | Long `staleTime` (rarely changes); shared across Col 3 and Col 4. |
| `GET /api/users/me/saved-posts` | `useSavedPosts()` | Invalidated by the save mutation below. |
| `GET /api/conversations/:id` | `useConversationMeta(id)` | Participant-only header data. |
| `GET /api/conversations/:id/messages` | `useMessagesInfinite(id)` | **Must** use `useInfiniteQuery` with cursor pagination per PSD §D.2; `getNextPageParam` reads the cursor, not offset/page. |
| `GET /api/payments/me` | `usePaymentLedger()` | Invalidated by the Stripe webhook's downstream effect — see §5 Socket.io. |

Mutation rules:

- **Likes** (`POST/DELETE /api/posts/:id/like`): implement as an **optimistic mutation**. `onMutate` flips the like state + count in the relevant query cache immediately; `onError` rolls back via the snapshot; `onSettled` invalidates. This mutation does *not* wait for the paired Socket.io broadcast — the socket event is for *other* clients' cache updates (see §5).
- **Save** (`POST /api/posts/:id/save`): `onSuccess` invalidates `['saved-posts']`. Optimistic update optional but recommended for perceived latency.
- **Comments** (`POST /api/posts/:postId/comments`, `POST /api/comments/:id/replies`): treat as a hybrid — fire the mutation for persistence, but let the **Socket.io `receive_message`-style broadcast be the source of truth for inserting the item into the cache** (avoids duplicate-render race if the REST response and socket event arrive close together). Use a dedupe key (`messageId`/`commentId`) when merging.
- **Payment intent** (`POST /api/payments/create-intent`): `useMutation` returning the Stripe client secret; no caching (mutation, not query). Never persist the returned token in Zustand or Query cache beyond the checkout component's lifetime.
- **Reports** (`POST /api/reports`): fire-and-forget mutation from the Column 4 flag control; show optimistic toast, no cache invalidation needed unless an admin-console query is open in the same session.

General: every list-shaped endpoint in the PSD (`feed`, `posts`, `messages`) is cursor/paginated in the API — corresponding hooks **must** use `useInfiniteQuery`, never manual `page` state in Zustand.

### 2.0 Performance rules for this layer

- **Every list hook that can grow unbounded (feed, posts, messages, and — even though non-infinite — admin tables) must be paired with `@tanstack/react-virtual` in the consuming component.** `useInfiniteQuery`/`useQuery` solves *data* growth; it does not solve *DOM node* growth. A 500-message conversation or a 10k-post admin table rendered without virtualization is a hard reject regardless of how correct the query layer is. See §10.2 for the full virtualization matrix.
- Use the `select` option to shape/derive data (e.g. computing a formatted price, a relative timestamp) **inside the query**, not in the component body — `select` results are memoized by TanStack Query and only recompute when the underlying cache entry changes, whereas a component-level `.map()` recomputes every render.
- Prefetch on intent, not just on navigation: `queryClient.prefetchQuery` on marketplace-card `onMouseEnter`/`onFocus` for the post-detail route, and on `[Negotiate]` button hover for the conversation-meta query — this converts a click-then-spinner into a click-then-instant-paint for the common case.
- Parallelize independent queries with `useQueries` (or simply calling multiple hooks — React 19 + Query dedupes and fires them concurrently) rather than nesting a query inside another query's `enabled` chain unless there's a genuine data dependency; avoid accidental request waterfalls.
- `placeholderData: keepPreviousData` (TanStack Query v5) on every filter-driven list (`usePostsInfinite`, `useAdminUsers`, etc.) so changing a filter pill/select shows the previous page instantly instead of a full-page loading flash.
- Tune `staleTime` per data volatility instead of leaving the default: `categories` (rarely changes) → minutes; `feed`/`posts` → 10–30s; `messages` → effectively realtime, rely on the socket bridge (§5) rather than refetch; `payments`/`auditLogs` → short but non-zero to avoid refetch storms on tab refocus.

### 2.1 Admin Control Center Domain (Vendo Admin PSD §6)

The admin dashboard is a distinct query domain (`src/features/admin/queries.ts` / `mutations.ts`), gated behind `Admin` role. All list tables here are **not** cursor-infinite by spec (PSD §11 backlog explicitly defers `page`/`limit` pagination) — use standard `useQuery` with `keepPreviousData: true` so future pagination is a drop-in change, not a rewrite.

| PSD Endpoint | Hook | Notes |
|---|---|---|
| `GET /api/admin/dashboard` | `useAdminDashboard()` | Backs Overview KPI cards, metric strip, revenue chart, recent-reports feed, category activity, moderation queue, audit trail (§6.1). One aggregate query — do not fan this out into 7 separate requests. |
| `GET /api/posts` (admin view) | `useAdminPosts(filters)` | Same endpoint as the public marketplace query but a separate query key namespace (`['admin', 'posts', filters]`) since the admin table needs Draft/Pending/Flagged rows a normal user query never requests. |
| `GET /api/categories` | `useCategories()` | Reused as-is from §2 — the admin Categories view is a management UI over the same cache entry consumers read, so mutations here must invalidate the shared `['categories']` key. |
| `GET /api/admin/users` | `useAdminUsers(filters)` | Backs Users table; `filters` = search + status pill (`All/Active/Suspended/Banned`). |
| `GET /api/reports` | `useReports(filters)` | Also drives the sidebar Reports badge count — badge reads `data.filter(r => r.status === 'Pending').length` from this same query, never a separate counter endpoint. |
| `GET /api/notifications` | `useNotifications()` | Backs Notifications inbox + unread metric strip. |
| `GET /api/admin/conversations` *(assumed REST list of §D conversation resources, admin-scoped)* | `useAdminConversations()` | Thread list sorted by `lastMessage`; typing/unread indicators layer on top via socket state, not this query — see §5.1. |
| `GET /api/payments/me` (admin/global scope) | `useAdminPayments(filters)` | Reused hook name conflicts with the buyer-scoped ledger in §2 core table — disambiguate as `useAdminPayments` vs. the buyer's `usePaymentLedger`; both hit the same base endpoint with different auth scope, different query keys. |
| `GET /api/admin/audit-logs` *(assumed; PSD §6.9 specifies the UI but not the literal route — confirm with backend before shipping)* | `useAuditLogs()` | Backs the Audit Logs timeline + metric strip. |
| `GET /api/uploads/:id` | `useUploads(filters)` | Backs the Uploads asset grid + storage metric strip; PSD §6.10 implies a list variant (`GET /api/uploads` with query params) since the UI paginates a grid, not a single asset — confirm the collection route with backend and adjust the hook accordingly. |

Admin mutation rules (PSD §8 Interactions table):

- **Resolve/Dismiss report** (`resolveReport` / `dismissReport` → `PATCH /api/reports/:id`): optimistic — rewrite the row's status pill immediately, decrement the sidebar Reports badge by re-deriving from the mutated cache entry (never a manual `badge - 1`), roll back both on error.
- **User status change** (`setStatus` → `PATCH /api/admin/users/:id/status`): optimistic status-pill rewrite (`Active`/`Suspended`/`Banned`); confirm destructively via `AlertDialog` before firing for `Banned`.
- **Post status toggle** (`toggleStatus` → `PATCH /api/posts/:id`): optimistic rewrite + re-apply the currently active filter pill client-side so a row that no longer matches the filter disappears immediately, matching PSD §8's `toggleStatus` behavior.
- **Delete row** (`delRow` → `DELETE /api/<table>/:id`): generic mutation factory parameterized by table name; on success, remove the row from the relevant query cache via `setQueryData` (filter out the id) rather than a full refetch, then fire the toast.
- **Mark all read** (`markAllRead` → `POST /api/notifications/read-all`): optimistic — strip `unread` flags across the whole `['notifications']` cache entry, zero the unread metric, roll back on error.
- **Add category** (`addCategory` → `POST /api/categories`): on success, invalidate `['categories']` (shared with the public-facing categories query), reset the form via RHF `reset()`.
- Every mutation in this list triggers exactly one `Toast` per PSD §8 ("Any toast: bottom-right dark card, 2.6s auto-dismiss") — never stack multiple toasts for one user action.

---

## 3. Zustand — Client/UI State Layer

**Folder:** `src/stores/*.ts`. Each store is a separate file, separate `create()` call — no monolithic root store.

Required stores (derived from PSD, nothing more):

- `authStore`: `{ user: PublicUser | null, accessToken: string | null, isHydrated: boolean }` + actions `setSession`, `logout`. `user` here is the *client-side mirror* of the last `useCurrentUser()` result for cheap synchronous reads (e.g. route guards) — TanStack Query remains the source of truth; this store is refreshed from the query's `onSuccess`, never fetched independently.
- `layoutStore`: drives PSD §2's responsive column collapse — `{ activeMobileTab: 'social' | 'marketplace', isNavDrawerOpen: boolean, isDiscoveryDrawerOpen: boolean }`. Pure UI, no server data.
- `filterStore`: the "Global Intent Synchronization" state — `{ category, tag, author, sort }`. Changing this store is what re-keys `usePostsInfinite` and the categories tab simultaneously (PSD §1). This store holds *filter selection*, not filter *results*.
- `negotiationUiStore`: `{ activeConversationId: string | null, typingUserIds: Record<string, string[]> }` — ephemeral socket-driven presence/typing state that does not belong in the Query cache (it's not persisted server data).
- `uploadProgressStore`: transient per-upload progress percentages keyed by a client-generated upload id, cleared on completion.
- `adminUiStore` *(Vendo Admin PSD §8)*: `{ isSidebarOpen: boolean, globalSearchQuery: string, activeFilterPill: Partial<Record<AdminViewName, string>> }` + actions `toggleSidebar()`, `setGlobalSearchQuery()`, `setFilterPill(view, pillId)`. **Note the deliberate deviation from the PSD**: the vanilla spec drives view switching with a JS `go(name)` function toggling `.view.on` with no URL change (PSD §8) — in the React port, `activeView` is owned by `react-router-dom` (`/admin/:view` nested routes, §6) instead of duplicated into this store, so admin views become deep-linkable (closing PSD §11 backlog item "Deep-linkable rows" for free). `isSidebarOpen` only matters ≤820px (off-canvas drawer per PSD §3.2); ignore it above that breakpoint. `activeFilterPill` and `globalSearchQuery` remain client UI state since they filter an already-fetched query result, not a fresh request.

Rules:
- No store may hold data that is fetched via `GET` and considered authoritative from the server (posts, feed items, messages, payment ledger, categories) — that data lives exclusively in TanStack Query's cache.
- **Always subscribe with a selector, never the whole store:** `useLayoutStore(s => s.activeMobileTab)`, not `const { activeMobileTab } = useLayoutStore()` destructured from a full-store call — the latter re-renders on *any* field change in that store, including ones the component doesn't read. For multi-field selections use `useShallow` (Zustand v5) to avoid a new-object-identity re-render every tick.
- High-frequency writes (`typingUserIds`, `uploadProgressStore` percentages) must not trigger re-renders outside the small subtree that displays them — scope subscriptions tightly (per-conversation-id selector for typing, per-upload-id selector for progress) rather than one component reading the entire store and re-rendering on every other upload's progress tick.
- Use `subscribeWithSelector` middleware only where a non-React module (e.g. the socket client) needs to read store state outside React.
- Persist only `authStore`'s minimal session flags via the `persist` middleware (never persist tokens to `localStorage` in plaintext beyond what's required for optimistic UI on reload — the HttpOnly cookie remains the real source of truth for refresh).

---

## 4. React Hook Form + Zod — Form Layer

**Folder:** `src/features/*/schemas.ts` for Zod schemas, colocated with the form component.

Required schemas (minimum set from PSD-driven forms):

- `loginSchema`, `registerSchema`
- `avatarUploadSchema`: `z.object({ file: z.instanceof(File).refine(f => f.size <= 2 * 1024 * 1024, 'Max 2MB') })`
- `postMediaUploadSchema`: `z.object({ files: z.array(z.instanceof(File)).max(5, 'Max 5 files').refine(files => files.every(f => f.size <= 10 * 1024 * 1024), 'Each file max 10MB') })`
- `postComposerSchema`: caption/body text + category/tag fields matching `GET /api/categories` enum values (fetch categories, then `z.enum` dynamically or validate via `.refine` against the fetched list).
- `commentSchema` / `replySchema`: min-length text validation, shared shape.
- `negotiationOfferSchema`: numeric price offer + optional message, `z.number().positive()`.
- `reportSchema`: `reason` enum + optional free-text detail, mapping to `POST /api/reports`.
- `adminCategoryCreateSchema` *(Vendo Admin PSD §6.3)*: `z.object({ name: z.string().min(2).max(40) })`. The slug preview (`/api/categories/<slug>`) is a **derived read-only display**, computed with `slugify(name)` in the component from `form.watch('name')` — it is not a separate form field and never independently validated or submitted.
- `adminUserStatusSchema` *(§6.4)*: `z.object({ status: z.enum(['Active', 'Suspended', 'Banned']) })`, used by the `setStatus` mutation's confirming `AlertDialog`, not a free-standing form.
- `adminReportActionSchema` *(§6.5)*: `z.object({ action: z.enum(['Resolved', 'Dismissed']), note: z.string().optional() })` for the resolve/dismiss action sheet.
- `adminGlobalSearchSchema`: `z.object({ query: z.string().max(120) })` — trivial but still Zod-validated so the `⌘K` search input and its Enter-to-navigate behavior go through the same RHF pipeline as every other input, per Rule 3 (Form Validation) in the system mandate.

Rules:
- All TypeScript types for form values are inferred with `z.infer<typeof schema>` — never hand-written duplicate interfaces.
- Every form uses `useForm({ resolver: zodResolver(schema) })`.
- Async cross-field or server-side validation (e.g. duplicate check) runs in the `onSubmit` handler via a TanStack `useMutation`, with server error mapped back into RHF via `setError`, not swallowed.
- Checkout/payment forms must render the **Fee Transparency** breakdown (platform fee %, processing fee, shipping) as read-only derived fields computed from form state before enabling the submit button, per PSD §5.

---

## 5. Socket.io Client — Real-Time Layer

**File:** `src/lib/socket/client.ts`

Rules:
- Singleton socket instance, connected once after `authStore` has a valid session (do not connect while unauthenticated).
- Implement exactly the event table from PSD §D.3:

| Event | Direction | Handler responsibility |
|---|---|---|
| `send_message` | emit | Called from the composer's submit handler after optimistic local insert. |
| `receive_message` | listen | Merge into the relevant `['conversations', id, 'messages']` infinite-query cache via `queryClient.setQueryData`, deduped by `messageId`. |
| `typing_message` | listen/emit | Writes into `negotiationUiStore.typingUserIds`; never touches TanStack Query cache. |
| `stop_typing_message` | listen/emit | Clears the same store entry; debounce the emit side (e.g. 2–3s of input inactivity) to avoid event spam. |

- Like-count broadcasts and comment broadcasts (PSD §4B) update TanStack Query cache directly through `queryClient.setQueryData` / `invalidateQueries` — this is the one sanctioned place where a non-React, non-Query module writes into the Query cache. Do this in a dedicated `src/lib/socket/queryBridge.ts`, not scattered across components.
- **Admin Notifications (Vendo Admin PSD §6.6):** the inbox row list explicitly labels each notification type's transport as "Socket.io" or "hybrid write" (like/comment/follow/message = hybrid REST+socket per §4B; system/moderation events = socket-only). Listen for a `notification_created` event in `queryBridge.ts` and prepend into the `['notifications']` cache with the same dedupe-by-id discipline as `receive_message`; do **not** poll `GET /api/notifications` on an interval — the unread badge and metric strip must update from the socket push, matching the PSD's live-count behavior for the sidebar Reports badge and Notifications unread metric alike.
- **Admin Conversations metric strip (§6.7)** (`Msg/min`, `Typing/min`) is a derived, client-computed rolling rate from the same `send_message`/`typing_message` event stream already defined above — do not add new socket events for it; compute the rate in a small windowed counter inside `negotiationUiStore` or a dedicated `useMessageRate()` hook, not a new server endpoint.
- Reconnection: rely on Socket.io's built-in backoff; on `connect`, re-join the currently active conversation room (`negotiationUiStore.activeConversationId`) if one is open.
- Never put the raw socket instance into Zustand or React context as a value that changes identity — export it as a stable module singleton and access it via a thin `useSocket()` hook that returns the constant reference.
- **Batch high-frequency broadcast writes.** A viral post's `like` broadcast or a busy conversation's `receive_message` stream can fire many events per second; do not call `queryClient.setQueryData` synchronously on every single socket event. Buffer incoming events for one animation frame (`requestAnimationFrame` or a small `rxjs`/manual microtask queue) in `queryBridge.ts` and flush as one batched cache write, so React 19's automatic batching isn't defeated by the socket callback running outside a React event handler.
- `typing_message` UI updates (the animated typing badge) are the one place a slight lossy/throttled update is acceptable — coalesce rapid on/off toggles from the same user within ~150ms rather than re-rendering the badge on every keystroke-driven event.

---

## 6. react-router-dom — Routing Layer

Rules:
- Route tree mirrors the four-column architecture (PSD §2) as **layout routes**, not conditional rendering inside one giant component:
  - Shell layout route renders Header + conditionally Col 1/Col 4 (drawers) based on breakpoint, with `<Outlet />` for the Col 2/Col 3 split.
  - `/` → feed + marketplace split view.
  - `/posts/:postId` → deep link into a single post (mobile "Single Tab Target View" per PSD §2).
  - `/messages/:conversationId` → negotiation workspace (PSD §D.1 flow: mount if a conversation exists, else the "Negotiate" click handler POSTs to create/reuse before navigating here).
  - `/checkout/:intentId` → payment flow, gated behind the payment-intent mutation succeeding (no direct navigation).
  - `/admin/*` → protected, role-gated (`Admin` only, per PSD §4A role clearances) using a `<RequireRole role="Admin">` guard reading from `authStore`. This replaces the single `/admin/reports` stub with the full Vendo Admin Control Center route tree below.
- Protected routes check `authStore.isHydrated` before rendering guard logic to avoid a false redirect-to-login flash on refresh.
- Data loading stays in TanStack Query hooks called from route components — do not use router `loader` functions as a second competing data-fetching mechanism; pick one (TanStack Query) and stay consistent.
- **Every route is a `React.lazy` chunk.** No route component is statically imported into the root router config — this is the single biggest lever on initial bundle size for a four-column, multi-view app like this one. Wrap the router's route elements in `<Suspense fallback={<RouteSkeleton />}>` at the layout-route level (one Suspense boundary per major layout, not one per leaf route, to avoid waterfall-y nested spinners).
- **`/admin/*` is its own top-level lazy boundary, entirely separate from the marketplace shell's chunk graph.** A buyer who never touches the admin console must never download admin JS (including `recharts`, the admin `Chart` primitive, and the admin feature module) — see §10.1 for the enforced chunk map.
- Prefetch the next likely route's chunk on link hover/focus (`<Link>`'s built-in intent-based prefetch, or a manual `import()` on `onMouseEnter`) for primary navigation paths (feed → post detail, marketplace card → checkout) so the lazy-loaded chunk is already warm by the time the click lands.

### 6.1 Admin Control Center Route Tree (Vendo Admin PSD §4.2, §6)

`/admin` is a layout route rendering the 248px sticky Sidebar + sticky Topbar shell (PSD §3.1, §4, §5), with `<Outlet />` for the active view. Nested routes mirror the sidebar's nav groups exactly so the URL, the active nav highlight, and the rendered view are always the same source of truth — no parallel `activeView` state (see `adminUiStore` note in §3):

| Route | Sidebar Group | PSD View |
|---|---|---|
| `/admin` (index) | Overview | §6.1 Overview |
| `/admin/posts` | Content | §6.2 Posts |
| `/admin/categories` | Content | §6.3 Categories |
| `/admin/users` | Community | §6.4 Users |
| `/admin/reports` | Community | §6.5 Reports |
| `/admin/notifications` | Community | §6.6 Notifications |
| `/admin/conversations` | Community | §6.7 Conversations |
| `/admin/payments` | Commerce | §6.8 Payments |
| `/admin/audit-logs` | System | §6.9 Audit Logs |
| `/admin/uploads` | System | §6.10 Uploads |

- ≤820px, the Sidebar collapses to an off-canvas drawer (PSD §3.2) — implement with the shadcn `Sheet` component driven by `adminUiStore.isSidebarOpen`, triggered by the Topbar hamburger; route navigation itself still goes through `<Link>`/`navigate()`, and a successful navigation closes the drawer as a side effect (not a manual state toggle scattered in every view).
- The `⌘K` global search (PSD §5) resolves a query to a target view + row, then calls `navigate('/admin/<view>?highlight=<id>')` — it is a navigation action, not a client-side-only view swap, so a shared link to a search result works.

---

## 7. Tailwind CSS v4.3 + shadcn/ui — Styling Layer

**File:** `src/index.css` (Tailwind v4 CSS-first config, no `tailwind.config.js` theme duplication unless a JS-only plugin requires it).

Design tokens (from PSD §3) — define as CSS variables in `@theme`:

```css
@theme {
  --font-display: "Plus Jakarta Sans", "Inter Tight", sans-serif;
  --font-card: "Satoshi", "General Sans", sans-serif;
  --font-body: "Inter", "SF Pro Display", sans-serif;
  --font-mono: ui-monospace, "SF Mono", monospace; /* Vendo Admin PSD §2.2 — endpoint chips, IDs */

  --color-brand: #00C853;
  --color-brand-hover: #00A343;
  --color-surface: #FFFFFF;
  --color-surface-subtle: #F8FAFC;
  --color-border: #E2E8F0;

  /* Vendo Admin Control Center token set (PSD §2.1) — additive, does not replace the core marketplace tokens above */
  --color-brand-2: #009E42;   /* hover / active text */
  --color-brand-3: #2BE77E;   /* gradients, chart highlight */
  --color-brand-soft: #E9F9F0; /* active nav fill, icon chips */
  --color-ink: #0B1220;        /* primary text */
  --color-mut: #64748B;        /* secondary text, icons */
  --color-line-2: #EEF2F6;     /* row dividers, distinct from --color-border */
  --color-bg: #F1F5F9;         /* admin canvas background */
  --color-soft: #F8FAFC;       /* hover fills, search inputs */
  --color-ok: #16A34A;         --color-ok-soft: #ECFDF3;
  --color-warn: #F59E0B;       --color-warn-soft: #FFF8EB;
  --color-err: #EF4444;        --color-err-soft: #FEF2F2;
  --color-info: #3B82F6;       --color-info-soft: #EFF6FF;
  --color-violet: #7C3AED;     --color-violet-soft: #F3EEFF;

  --radius-card: 13px;
  --radius-input: 9px;
  --radius-button: 9px;
  --radius-pill: 999px;
  --radius-icon-btn: 7px;
}
```

Rules:
- Display/heading elements: `font-display font-bold tracking-[-0.02em]`.
- Card/product typography: `font-card font-semibold`.
- Body/micro-copy: `font-body font-normal leading-[1.5]`.
- Endpoint chips, transaction/report IDs, and mono-labeled values in the admin dashboard use `font-mono` at 9.5–11px, matching Vendo PSD §2.2 exactly — never fall back to `font-body` for these.
- Primary actions (`Buy Now`, `Negotiate`, submit buttons) use `bg-brand hover:bg-brand-hover` — never hardcode the hex values inline; always reference the token.
- Borders use `border-border` (1px) consistently across cards, inputs, and dividers; **inside the admin dashboard specifically**, use `border-line-2` for row dividers vs. `border-border` for card/panel outlines — the PSD distinguishes these as two separate tokens and they must not collapse into one in the Tailwind config.
- Status semantics (admin dashboard) always pair a solid and `-soft` variant from the same family — e.g. a "Suspended" pill is `text-warn bg-warn-soft`, never a bespoke amber. Status→token mapping is fixed: Success/Published/Resolved/Active = `ok`; Pending/Suspended = `warn`; Danger/Banned/Flagged/Dismissed = `err`; Neutral/Profile type/Reviewed = `info`; Admin role/Post-report type = `violet`.
- Responsive column collapse (PSD §2 table) is implemented with Tailwind breakpoints `md:` (768px) and `xl:` (1280px) matching the PSD's Tablet/Desktop thresholds exactly — do not introduce custom breakpoints for this layout. The admin dashboard's own breakpoints (>1100px, ≤1100px, ≤820px per Vendo PSD §3.2) are a **separate, page-scoped breakpoint set** — define them as Tailwind arbitrary breakpoints (`min-[1100px]:`, `max-[820px]:`) scoped to `src/features/admin/**` rather than altering the app-wide `md`/`xl` tokens used by the marketplace shell.
- Card radius/shadow follow the token set above (`rounded-[--radius-card]` etc.) rather than ad hoc Tailwind radius utilities, so the admin dashboard's slightly different shape language (13px cards vs. shadcn defaults) stays centralized and themeable.
- shadcn/ui primitives are the base for **every** interactive control. Do not hand-roll a control that shadcn already provides. The full inventory below is derived line-by-line from the PSD and is the authoritative component list for this project — do not introduce a shadcn component outside this list without updating this document first, and do not skip a listed component in favor of a custom one.
- The Column 4 report/flag trigger uses a destructive-variant treatment (red-tinted) distinct from the brand accent, per PSD §5 — use shadcn's `destructive` button variant rather than a one-off custom class.

### shadcn/ui Component Inventory (mapped to PSD sections)

| shadcn/ui Component | PSD Reference | Usage |
|---|---|---|
| `Button` | §1, §2, §4C, §D.1 | Buy Now, Negotiate, Like/Save toggles, submit actions. `destructive` variant reserved for the report/flag trigger (§5). |
| `Input` | §4A, §4B, §D.2 | Search (Header fluid search), post composer text, message composer, filter text fields. |
| `Textarea` | §4B, §5 | Comment/reply bodies, negotiation offer message, report detail free-text. |
| `Form` (+ `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`) | §4A–§4C, §5 | Wraps every React Hook Form + Zod form: login/register, avatar upload, post composer, comment/reply, negotiation offer, report, checkout. |
| `Card` | §2 Col 2/Col 3, §4B | Marketplace item cards, social feed post cards, discovery grid cards. |
| `Avatar` (+ `AvatarImage`, `AvatarFallback`) | §4A | Profile Asset Hydration display across Header, feed posts, comments, conversation headers. |
| `Dialog` | §D.1, §4C | Negotiation conversation launch confirmation, checkout confirmation modal, generic desktop modals. |
| `Sheet` | §2 (Drawer Container states) | Col 1 Navigation drawer and Col 4 Discovery drawer on Tablet; mobile Discovery "Contextual Modal" uses `Sheet` (bottom sheet variant) rather than `Dialog` to match native mobile drawer feel. |
| `Drawer` | §2 (Mobile) | Bottom Navbar overflow / contextual mobile panels where a `Sheet` is too heavy (e.g. quick actions on a marketplace card). |
| `Tabs` | §2 (Mobile "Single Tab Target View") | Mobile toggle between Social Feed and Marketplace single-tab views; also used for Column 3 category tabs fed by `GET /api/categories`. |
| `NavigationMenu` | §2 Col 1 | Desktop-visible primary navigation (15% screen span). |
| `DropdownMenu` | §4A, §4B | User/role menu (Admin console entry point), post card overflow menu (report, save, share), feed sort selector. |
| `Select` | §4B | `sort`, `category`, `tag`, `author` filter controls driving `GET /api/posts` query params and `filterStore`. |
| `Popover` | §4B | Lightweight filter/date pickers and the fee-breakdown info popover on checkout (§5 Fee Transparency). |
| `Command` (Command palette / combobox) | §4B | Author/tag typeahead search within Discovery Grid Filters. |
| `Badge` | §4B, §4C, §D.3 | Category/tag chips, unread message count, "typing…" indicator badge, order/payment status chips. |
| `Skeleton` | §4B, §D.2 | Loading states for `useInfiniteQuery`-backed feed, marketplace grid, and message history while fetching/paginating. |
| `Toast` (via `Sonner` or shadcn `Toaster`) | §4B, §5, §D.3 | Optimistic mutation feedback (like/save/report submitted), socket reconnect notices, payment success/failure. |
| `Tooltip` | §3, §5 | Icon-only compressed header controls (Tablet), fee-line explanations in checkout breakdown. |
| `Separator` | §2, §5 | Structural 1px slate borders between grid columns and checkout fee-breakdown line items. |
| `ScrollArea` | §D.2 | Cursor-paginated message history and infinite feed/marketplace columns, to keep native scrollbars consistent cross-browser. |
| `Progress` | §4A, §4B | Avatar/media upload progress, sourced from `uploadProgressStore`. |
| `Alert` | §D.3, §5 | Non-blocking inline warnings — e.g. "connection lost, reconnecting" for the socket layer, payment webhook failure states. |
| `AlertDialog` | §5, §D.1 | Destructive/irreversible confirmations — submitting a report, canceling a negotiation, confirming a purchase before the Stripe intent fires. |
| `Table` | §4C, §5 | Admin Console moderation queue (reports list) and payment ledger (`GET /api/payments/me`) history view. |
| `Checkbox` / `RadioGroup` | §5 | Report reason selection, checkout terms acknowledgment. |
| `Switch` | §3 (implied preference controls) | Any binary user preference toggle (e.g. notification settings) surfaced from the profile area. |
| `Pagination` | — | Not used for feed/posts/messages (those are infinite-scroll per §4B/§D.2); reserved only for the Admin Console reports/ledger tables in `Table` above, which are not infinite-scrolled by spec. |
| `Sidebar` | Vendo Admin PSD §3.1, §4 | The 248px sticky admin navigation shell (brand row, nav groups, footer). Use shadcn's `Sidebar` primitive rather than a hand-rolled `<aside>` — it already handles the sticky/full-height/collapsible behavior this spec needs; collapses into `Sheet` ≤820px per its built-in responsive mode. |
| `ToggleGroup` | §6.2, §6.4 | Filter pills (`All/Published/Drafts/Pending/Flagged`, `All/Active/Suspended/Banned`) — single-select toggle group, not a row of individually-styled `Button`s. |
| `Command` (extended) | §5 (`⌘K` global search) | Same primitive as the marketplace's Command usage (row above) — the admin Topbar's `⌘K` global search is a `CommandDialog` instance searching across views, reusing this component rather than a bespoke search overlay. |
| `HoverCard` | §6.7 | Conversation thread preview-on-hover (snippet + typing indicator) where a full `Popover` click-to-open would slow down triage scanning. |
| `Chart` (shadcn chart wrapper over Recharts) | §6.1 | Revenue chart (7-day bars) and KPI sparklines. The PSD's reference implementation is inline CSS/SVG (zero-build constraint); the React port uses shadcn's `Chart` components over `recharts` instead — do not hand-roll SVG bar math when this primitive already exists in the stack. |
| `Kbd` (via `Badge` `outline` variant, shadcn has no dedicated Kbd) | §5 | The `⌘K` and `⌘F` keyboard-shortcut chips — compose from `Badge` with `variant="outline"` and monospace text; do not add a new one-off component for this. |

Rules for the inventory:
- Every row's "Usage" column is the *only* sanctioned place that component is used unless this table is updated — this keeps UI patterns consistent across the four-column layout.
- Prefer composing these primitives over adding new shadcn components; if a PSD feature seems to need something not listed here, treat that as a signal to re-check the PSD mapping before installing a new primitive.
- **shadcn/ui components are copied into the repo, not installed as a package — only copy in the primitives actually listed in the inventory above.** Do not scaffold the full shadcn catalog "for convenience"; every unused primitive is dead weight in the Tailwind content scan and a maintenance liability.
- Icons: import individually from `lucide-react` (`import { Heart } from 'lucide-react'`), never a namespace import (`import * as Icons`) — the latter defeats tree-shaking even though the library is technically tree-shakeable, because bundlers can't statically prove which icons are used through a namespace object.
- Every image, avatar, and card-media slot reserves its box size **before** content loads (explicit `width`/`height` or `aspect-ratio` utility, matched by the `Skeleton` loading state's dimensions) — this is a hard CLS (Cumulative Layout Shift) requirement, not a nice-to-have, given the feed/marketplace columns are the app's primary scroll surfaces.
- Fonts (`Plus Jakarta Sans`, `Inter`, `Satoshi`/`General Sans`) are self-hosted and subsetted (Latin, the weights actually used — 400/600/700/900, not the full variable-font range) with `font-display: swap` and a `<link rel="preload">` for the above-the-fold display/body weights only; do not load every weight of every family on first paint.

---

## 8. Admin Control Center — Page-Specific Notes (Vendo Admin PSD)

The Admin Control Center (`/admin/*`) is a self-contained feature module (`src/features/admin/`) that consumes the same seven libraries as the rest of the app, but its PSD is pixel-level and vanilla-JS-authored (zero-build reference implementation), so the notes below exist specifically to prevent a literal 1:1 port of DOM/JS patterns that don't belong in the React stack. **This entire module is one isolated lazy chunk per §10.1 — a marketplace buyer's bundle must never include it, and every table listed in the domain mapping above is virtualized per §10.2.**

### 8.1 Layout Grid
- Root `.dash` grid (`248px 1fr`, min-height `100vh`) is the `/admin` layout route's top-level element — implement as a CSS Grid in the layout route component, not per-view repetition.
- Content grid gap `20px`, padding `22px` (`16px` ≤820px per §3.2) belongs on the `<Outlet />` wrapper, so every nested view inherits it automatically instead of each view redeclaring padding.

### 8.2 Sidebar Badge & Live Counts
- The Reports sidebar badge, the Notifications unread count, and every KPI trend chip are **always derived values** read from TanStack Query cache (`useReports`, `useNotifications`, `useAdminDashboard`) — never a Zustand counter incremented/decremented by hand. The PSD's vanilla JS manually decrements a DOM node; the React port instead lets the mutation's cache update (§2.1) flow down through the same query that renders the badge, so the badge can never drift from the underlying data.

### 8.3 Accessibility (PSD §9, carried forward as hard requirements)
- Every icon-only button (`Icon buttons (.ia)`, Topbar bell/chat) renders a shadcn `Tooltip` with the equivalent of the PSD's `title` attribute — do not ship an icon button with no accessible name.
- Nav items and all action buttons are real `<button>`/`<Link>` elements (shadcn `Sidebar`/`Button`/`NavigationMenu` already guarantee this) — never a `<div onClick>`.
- Tables horizontally scroll under 1100px (PSD `.h-scroll`) — wrap `Table` in the shadcn `ScrollArea` (already in the inventory) rather than raw `overflow-x-auto` on the table itself, for consistent scrollbar styling with the rest of the app.
- Respect `prefers-reduced-motion`: all Tailwind transition utilities used in this module stay ≤400ms and animate only `transform`/`opacity`, matching PSD §9.
- No external avatar/thumbnail images (PSD §9 "zero network requests beyond font CDNs") — generate avatar/thumbnail placeholders as inline SVG (e.g. via a small deterministic-gradient-from-string helper), not `<img src={remoteUrl}>`, to preserve this constraint in the React port.

### 8.4 Content Inventory → Mock/Seed Data
PSD §10's sample row counts (8 posts, 8 users, 5 reports, 6 payments, 9 notifications, 5 conversations) are **fixture data for local development and Storybook only** — they must not be hardcoded into any production component. Put them in `src/features/admin/__fixtures__/` and wire real components exclusively to the TanStack Query hooks in §2.1; fixtures back MSW handlers / Storybook stories, never a fallback default in a hook.

### 8.5 Backlog Awareness (PSD §11)
The following PSD-flagged backlog items should be designed around, not against, even though they're out of scope for v1:
- **Pagination**: admin `useQuery` hooks (§2.1) are already parameterized with `filters` objects that can absorb `page`/`limit` without a signature change — don't paint into a corner with a non-parameterized fetch function.
- **Deep-linkable rows**: already satisfied by the route tree in §6.1 plus the `?highlight=<id>` search-result convention; extend the same query-param pattern for notification→comment and report→target deep links when built.
- **Confirmation modal before destructive DELETE**: `delRow` (§2.1) must route through shadcn `AlertDialog` from day one in the React port even though the PSD's vanilla reference ships without it — treat this backlog item as already required, not deferred, since the component (`AlertDialog`) is already in this project's inventory.
- **CSV export**: when built, implement as a client-side blob from already-fetched TanStack Query data (matching the PSD's stated approach) rather than a new server endpoint — no action needed now beyond keeping query hooks returning plain serializable data.

---

## 10. Performance Engineering Directives

This section is binding across every layer above. Where a rule here conflicts with a convenience pattern used elsewhere in this document, this section wins.

### 10.1 Bundle Size Budgets & Chunk Map

| Chunk | Budget (gzip) | Contents | Load timing |
|---|---|---|---|
| App shell (root) | ≤ 60 KB | React 19 runtime, router, Zustand core, Axios client, socket singleton, design tokens/CSS | Initial load, blocking |
| Marketplace route group | ≤ 90 KB | Feed/marketplace/discovery views, TanStack Query, shadcn primitives actually used there | Lazy, prefetched on shell mount |
| Checkout/payments | ≤ 40 KB | Stripe Elements wrapper, checkout form, fee-breakdown component | Lazy, loaded only on `/checkout/:intentId` |
| Negotiation/messages | ≤ 40 KB | Conversation workspace, `@tanstack/react-virtual` message list | Lazy, loaded on first `/messages/*` visit |
| `/admin/*` (entire) | No shared budget with the above — fully isolated chunk | Admin shell, all ten admin views, `recharts`/`Chart`, admin-only mutations | Lazy, only ever requested by an authenticated Admin navigating to `/admin` |
| Per-view admin chunks | ≤ 25 KB each | Each of the ten admin views (`Overview`, `Posts`, `Categories`, …) is itself a further `React.lazy` split under the `/admin` boundary | Lazy per nested route |

- Enforce these budgets in CI with a bundle-analyzer gate (e.g. `size-limit` or `rollup-plugin-visualizer` thresholds) that fails the build on regression — a budget that isn't enforced in CI isn't a budget, it's a suggestion.
- Heavy, page-scoped libraries (`recharts`, any future rich-text or chart library) are **dynamic `import()`s inside the component that renders them**, never a top-level static import in a shared file, even if that file is itself lazy — this prevents a heavy library from silently attaching itself to a lighter chunk via a shared barrel export.
- Barrel files (`index.ts` re-exporting an entire feature folder) are banned for anything crossing a lazy-boundary — import the specific hook/component path directly so bundlers can shake unused siblings.

### 10.2 Virtualization Matrix

Every one of these surfaces renders a potentially-unbounded list and **must** use `@tanstack/react-virtual` (windowing) — this is not optional and not satisfied by `useInfiniteQuery` alone, since infinite-query solves data fetching, not DOM size:

| Surface | Backing hook | Notes |
|---|---|---|
| Social Feed (Col 2) | `useFeedInfinite` | Variable-height cards — use `estimateSize` with measured-element fallback (`measureElement`), not a fixed row height. |
| Marketplace Grid (Col 3) | `usePostsInfinite` | Grid virtualization (virtual rows of N cards each), not row-per-item. |
| Conversation message history | `useMessagesInfinite` | Virtualize with reverse/bottom-anchored scroll semantics (new messages append at the visually-anchored end without a scroll jump). |
| Admin Posts / Users / Reports / Payments / Notifications / Audit Logs tables | `useAdminPosts` / `useAdminUsers` / `useReports` / `useAdminPayments` / `useNotifications` / `useAuditLogs` | Even though not cursor-infinite today (§2.1), virtualize the rendered rows now — the PSD's own sample data is small, but production admin tables will not be, and retrofitting virtualization after ship is expensive. |
| Uploads asset grid | `useUploads` | Virtualize as a virtual grid, same pattern as the marketplace grid. |

Rules:
- List item components passed into the virtualizer are wrapped in `React.memo` with a shallow-equal custom comparator on the fields that actually change (like count, save state) — not the default reference-equality memo, since a parent re-render otherwise still blows through memoization if a new object literal is passed as props.
- Never put an inline arrow function or object literal directly on a virtualized item's props in the parent's render — hoist or `useCallback`/`useMemo` it, or every visible row re-renders on every parent tick regardless of the `React.memo` wrapper.

### 10.3 Rendering & Memoization Discipline

- **Prefer React 19's compiler-driven memoization where the toolchain supports it** (React Compiler) over hand-written `useMemo`/`useCallback` sprinkled defensively; where the compiler isn't in play for a given file, apply `useMemo`/`useCallback` surgically — only around genuinely expensive computations or values passed to memoized children, not as a reflexive habit that adds its own overhead.
- Derived/computed values that depend only on server data belong in a TanStack Query `select` (§2.0), not a component-level `useMemo` recomputed on every render of every consumer.
- No `useEffect` for data fetching, ever — that's what TanStack Query is for (§0 already forbids raw `fetch`; this extends the same principle to effect-driven fetching). `useEffect` is reserved for genuine side effects (subscriptions, DOM measurement, imperative third-party integration).
- Context providers (if any are introduced beyond what shadcn requires) must split frequently-changing values from stable ones into separate providers — a single context object mixing a rarely-changing theme value with a rapidly-changing cursor position re-renders every consumer of both on either change.

### 10.4 Real-Time & Network Efficiency

- Socket.io payloads stay minimal — send IDs and deltas (`{ postId, likeCount }`), not full re-serialized entities; let the client merge the delta into its existing cached entity rather than replacing it wholesale (cheaper to construct, cheaper to diff in React).
- Debounce the admin global search (`⌘K`) and any table search input at ~200–250ms before it drives a query-key change, so keystroke cadence doesn't fan out a request per character.
- Respect `prefers-reduced-data`/save-data hints where feasible (e.g. skip prefetch-on-hover, reduce sparkline/chart detail) — not a hard requirement across the whole app, but apply it at minimum to the heaviest surfaces (admin `Chart`, media-heavy feed cards).

### 10.5 Web Vitals Targets

These are the acceptance thresholds for any shipped view, measured on a mid-tier mobile profile:

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | ≤ 2.5s |
| INP (Interaction to Next Paint) | ≤ 200ms |
| CLS (Cumulative Layout Shift) | ≤ 0.1 |
| Initial JS (shell + first route) | within the §10.1 chunk budgets |

A feature that meets its functional spec but regresses any of the above on the surfaces it touches is not done — performance regressions block merge the same as a failed test.

---

## 11. Cross-Cutting Acceptance Checklist

Before merging any feature branch touching the above layers, confirm:

- [ ] No server data lives in a Zustand store.
- [ ] No manual `fetch`/raw `axios()` calls outside `src/lib/api/client.ts` consumers.
- [ ] No manual `io()` calls outside `src/lib/socket/client.ts`.
- [ ] All list views backed by paginated endpoints use `useInfiniteQuery`.
- [ ] All forms are Zod-validated with inferred types, zero duplicate hand-written interfaces.
- [ ] All monetary/fee UI renders the explicit fee breakdown before submit is enabled.
- [ ] All color/font usage traces back to a token in `@theme`, never a raw hex/font-family string in a component.
- [ ] Optimistic mutations (`like`, `save`) have working `onError` rollbacks.
- [ ] Admin sidebar Reports badge, Notifications unread count, and KPI trend chips are all derived from query cache — no manually incremented/decremented counter in a store.
- [ ] Every admin `delRow`-style destructive action is gated behind `AlertDialog` confirmation.
- [ ] Admin view routing lives in `react-router-dom` nested routes under `/admin/*`, not a duplicated `activeView` string in Zustand.
- [ ] No PSD §10 sample/fixture data is hardcoded into a production admin component — fixtures live under `__fixtures__/` only.
- [ ] Admin dashboard status pills use only the fixed status→token mapping (§7) — no bespoke color per pill.
- [ ] Every unbounded list (§10.2 matrix) is windowed with `@tanstack/react-virtual`, not just paginated/infinite-queried.
- [ ] Every route is a `React.lazy` chunk; `/admin/*` shares zero code with the marketplace shell bundle.
- [ ] No static top-level import of `recharts` or any admin-only heavy library outside the admin chunk boundary.
- [ ] Zustand reads use selectors (or `useShallow`), never a full-store destructure, in any component that re-renders on a hot path.
- [ ] Socket-driven cache writes are batched per animation frame, not applied synchronously per event.
- [ ] All media/card slots reserve layout space before load (no CLS from late-loading images/avatars).
- [ ] Bundle-analyzer budgets from §10.1 are enforced in CI, not just documented.
