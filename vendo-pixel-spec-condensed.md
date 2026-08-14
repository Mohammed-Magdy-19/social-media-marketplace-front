# Vendo — Pixel Spec Summary

**Scope:** `index.html` (responsive UI) + `dashboard.html` (admin panel), plus shared design system.

## 1. `index.html` — Responsive Presentation

Single-file HTML/CSS/JS showing 3 scaled device mockups on a presentation canvas with a sticky header and "Canvas Mode" light/dark toggle.

**Desktop (1440×920, scale .72)**
- Header: logo+wordmark, search bar ("Search posts, tags, categories..."), chat/bell icons, avatar dropdown.
- Category pill bar: All / Apparel / Tech / Home / Vehicles / Digital (active = emerald fill).
- 4-column split (15/35/35/15):
  - **C1** Sidebar nav + VIP profile card
  - **C2** Feed (post cards: avatar, name, timestamp, media placeholder, like/comment/save counts, composer)
  - **C3** Marketplace (product cards, "Instant Buy"/"Negotiate" CTAs)
  - **C4** Top Deals, Report Item module, Admin Desk sparkline

**Tablet (768×960, scale .78)**
- Hamburger + icon-only logo, search, bell.
- Slide-in drawer (nav + VIP card) with scrim.
- 50/50 feed/marketplace split, no side rails.

**Mobile (375×812, scale 1.0)**
- Header: logo, search, bell.
- Segmented toggle: Feed / Shop.
- Feed = single-column cards; Shop = 2-col grid with badges (-15%, -20%, New).
- Fixed bottom tab bar (56px): Home, Market, Chat, Saved, Profile.

**JS behaviors:** canvas mode toggle, category pill switching, like/save toggles, drawer open/close, feed/shop view switch, tab/nav active states.

## 2. `dashboard.html` — Admin Control Center

**Layout:** `248px` sticky sidebar + main content grid; sidebar collapses to off-canvas drawer ≤820px.

**Sidebar:** brand row (logo, "vendo.admin", version chip) + grouped nav:
- Overview
- Content: Posts, Categories
- Community: Users, Reports, Notifications, Conversations
- Commerce: Payments
- System: Audit Logs, Uploads
- Footer: admin avatar/email/logout

**Topbar:** global search (⌘K), token chip, bell, chat, avatar.

**10 Views** (shared: header, toolbar w/ search+filters+count, stat tiles, card tables):

| View | Data |
|---|---|
| Overview | KPIs, revenue/category bars, moderation feed, audit |
| Posts | 8 posts |
| Categories | 5 + create |
| Users | 8 users |
| Reports | 5 reports |
| Notifications | 9 (7 unread) |
| Conversations | 5 threads |
| Payments | 6 txns + webhook feed |
| Audit Logs | 6 events |
| Uploads | 8 assets |

**JS behaviors:** view router, filter pills, row search, report resolve/dismiss, user status, post toggle, row delete, mark-all-read, category slug auto-gen, toast notifications (2.6s).

## 3. Shared Design System

**Colors:** brand `#00C853`, brand-2 `#009E42`, brand-3 `#2BE77E`, ink `#0B1220`, mut `#64748B`, line `#E2E8F0`, bg `#F1F5F9`, card `#FFFFFF`; status colors for ok/warn/err/info/violet each with soft variant.

**Typography:** Plus Jakarta Sans (headings), Inter (body), Satoshi/General Sans (metrics), mono for chips.

**Shape:** cards 13px · inputs/buttons 9px · icon buttons 7px · pills 999px.

**Icons:** stroke-based SVG symbols; shared logo mark with gradient.

**Media:** no raster images — geometric placeholder tiles with icon + "media preview" label.

## 4. Breakpoints
- Presentation: CSS transform scaling, flex wrap.
- Dashboard ≤1100px: KPI/metrics/uploads collapse to fewer columns.
- Dashboard ≤820px: sidebar becomes drawer, padding reduces.

## 5. Interaction Contract
1. Exactly one active view at a time.
2. Filters compose (search ∩ pill).
3. Counters/badges recompute live on mutation.
4. Destructive actions require confirmation.
5. Every panel shows its backing API endpoint as a mono chip.
6. No hardcoded secrets — JWT auth, role/status badges only.
7. Every write action triggers a toast with HTTP verb + route.

## 6. Content Inventory
Feed posts: 3 · Users: 8 · Posts: 8 · Reports: 5 · Payments: 6 · Notifications: 9 · Conversations: 5 · Categories: 5 · Audit events: 6 · Uploads: 8.

## 7. Accessibility & Performance
- Real `<button>` elements with labels.
- ⌘K/Ctrl+K search focus, Esc to clear.
- Horizontal table scroll <1100px.
- Zero raster images; inline SVG only. Motion limited to opacity/transform, ≤400ms.

## 8. Implementation Stack (NexMarket Engine, v1.0.0)

React 19 (TS, strict) · Tailwind v4.3 + shadcn/ui · React Hook Form + Zod · Zustand · TanStack Query · Axios · react-router-dom · Socket.io Client · `@tanstack/react-virtual`.

**Layer separation:** Zustand = ephemeral UI state only; TanStack Query = all server-cache state; Axios = transport only (single shared instance, no raw `fetch`); Socket.io = single shared singleton (no direct `io()` calls). No duplicating server data into a store.

**Axios (`lib/api/client.ts`):** `withCredentials: true`; silent-refresh interceptor on 401 (mutex-guarded, single retry); upload guards (avatar ≤2MB, post media ≤5 files/≤10MB each); every query fn forwards TanStack's `signal` for cancellation.

**TanStack Query:** hierarchical query keys; feed/posts/messages use `useInfiniteQuery` (cursor-based); admin tables use `useQuery` + `keepPreviousData` (not yet paginated per PSD backlog). Likes = optimistic mutation; comments/messages = socket is source of truth, REST is dedup-merged by id. `select` shapes derived data; prefetch on hover/focus for post-detail and negotiate flows.

**Zustand stores:** `authStore`, `layoutStore` (mobile tab/drawers), `filterStore` (category/tag/author/sort), `negotiationUiStore` (typing/presence), `uploadProgressStore`, `adminUiStore` (sidebar/search/filter pills — **admin view routing lives in the router, not this store**). Always subscribe via selector/`useShallow`, never full-store destructure.

**Forms:** RHF + Zod per form (login, register, avatar/media upload, composer, comment/reply, negotiation offer, report, admin category/user-status/report-action, global search). Types via `z.infer`, never hand-duplicated.

**Socket.io events:** `send_message` / `receive_message` / `typing_message` / `stop_typing_message`; like/comment/notification broadcasts write into Query cache via a dedicated `queryBridge.ts`, batched per animation frame (never synchronous per-event writes).

**Routing:** layout routes mirror the 4-column architecture; every route is `React.lazy`; `/admin/*` is a fully isolated chunk (own nested routes per admin view, off-canvas `Sidebar`/`Sheet` ≤820px, `⌘K` resolves to a real navigation).

**Styling:** design tokens as Tailwind v4 `@theme` CSS variables (colors, fonts, radii from §3 above, plus admin-specific `brand-2/3`, `ink`, `mut`, status pairs); shadcn/ui is the mandatory primitive set for every interactive control (Button, Form, Card, Sheet, Tabs, DropdownMenu, Select, Table, AlertDialog, Sidebar, ToggleGroup, Chart, etc.) — no hand-rolled controls, no full-catalog scaffolding.

**Performance budgets:** shell ≤60KB gz, marketplace ≤90KB, checkout ≤40KB, messages ≤40KB, `/admin/*` fully separate (no shared chunk with marketplace), each admin view ≤25KB. All unbounded lists (feed, marketplace grid, messages, all admin tables, uploads grid) **must** be windowed with `@tanstack/react-virtual`, not just paginated. Targets: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1.

**Non-negotiables:** no server data in Zustand · no raw `fetch`/`io()` · destructive actions always behind `AlertDialog` · admin badges/counts always derived from query cache, never manually incremented · fixture/sample data (PSD §6 counts) only in `__fixtures__/`, never hardcoded in production components.
