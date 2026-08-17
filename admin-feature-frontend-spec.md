# Frontend Implementation Brief: Admin Console (Users, Dashboard, Audit Log)

**Audience:** an engineering agent implementing the *frontend logic* for this feature.
**Stack:** React 19 + TypeScript, Tailwind CSS v4.3, shadcn/ui, React Hook Form + Zod, Zustand, TanStack Query v5, Axios, react-router-dom v6/7, Socket.io Client, `@tanstack/react-virtual`.

This document is derived directly from the backend implementation (`admin.controller.js`, `admin.routes.js`, `AuditLog.js`) plus the admin-relevant pieces of features already specified elsewhere in this app (`payments`, `conversations`, and a referenced-but-not-yet-specified `notifications` admin route). It does not invent new backend behavior. Every route in this file sits behind `protect + restrictTo('admin')` at the route layer — there is no partial/moderator access tier for anything covered here despite the model supporting a `'moderator'` role (see §5.1).

---

## 0. Before Writing Any Code — Audit the Existing Frontend Codebase First

**Do not assume this feature starts from zero files.** This spec may be handed to an agent working in a repo that already has partial or complete admin UI — an existing `AdminShell`, an existing `useAdminPayments` (from the payments feature, genuinely already specced and possibly already built), an existing user table component under a different name, an existing `useSearchParams`-backed filter pattern, etc. Writing net-new files without checking for this first produces duplicate components, competing state patterns, and admin panels that silently diverge from each other in behavior (e.g. two different pagination conventions across panels that are supposed to feel like one console).

**Before implementing any section of this doc, the agent must:**

1. **Search the repo for existing admin surface.** Look for a directory resembling `components/admin/`, `routes/admin/`, or any file matching `Admin*`, `useAdmin*`, `admin.api.ts`, `admin.schema.ts` — the exact names in §9's suggested file structure are a *suggestion*, not a contract; existing code may use different names for the same responsibilities.
2. **If an `AdminShell` / admin route-guard already exists** (very likely, since the payments and reports features' specs both assume one), reuse it as-is. Do not build a second guard component or a second admin layout — confirm the existing one's gating mechanism (role check source, redirect behavior) matches §7 rule 1 and §8's guidance, and only patch it if it doesn't, rather than replacing it.
3. **If `useAdminPayments`/`AdminPaymentsTable` (from the payments feature spec) already exist**, treat them as already-done — link/import them into the shell built here rather than re-reading their originating spec and re-implementing. Same for any reports-admin components if that feature has already been built.
4. **If any of §4/§5/§6's panels (Users, Dashboard, Audit Log) partially exist**, diff the existing implementation against this spec's business rules (§7) specifically — those are the parts most likely to have been missed or gotten wrong in an earlier pass (self-role/self-status guards, currency-grouped sales rendering, audit-log immutability) rather than the scaffolding (table components, routes), which is more likely already correct if it exists at all.
5. **Only write new files for genuinely missing pieces.** If a search turns up nothing for a given panel, proceed with §9/§10 as written. If it turns up something, the deliverable for that panel becomes a targeted patch against the existing file(s), not a fresh implementation — call out specifically what was found and what was changed, the same way this spec's own backend-fix history in this conversation documents what was audited versus what was actually patched.

This mirrors how the backend side of this app has been handled throughout this project: before "fixing" something, confirm what's actually there and whether it's already correct, rather than presuming a gap exists.

---

## 1. Mental Model — This Is the Admin Shell's Home Feature

Unlike the other features specced so far (which each own one resource), `admin.routes.js` is a **router aggregating admin-only endpoints from multiple controllers** — some genuinely new (`admin.controller.js`'s users/dashboard/audit-log endpoints), others just admin-scoped re-exports of controllers already specced elsewhere:

| Route | Owning controller | Covered here or elsewhere |
|---|---|---|
| `GET /api/admin/users` | `admin.controller.js` | **This doc** |
| `PATCH /api/admin/users/:id/role` | `admin.controller.js` | **This doc** |
| `PATCH /api/admin/users/:id/status` | `admin.controller.js` | **This doc** |
| `GET /api/admin/dashboard` | `admin.controller.js` | **This doc** |
| `GET /api/admin/audit-logs` | `admin.controller.js` | **This doc** |
| `GET /api/admin/payments` | `payment.controller.js` | Already specced — see the payments feature doc's §3, §7 (`useAdminPayments`, `AdminPaymentsTable`) |
| `POST /api/admin/payments/:id/refund` | `payment.controller.js` | Already specced — see the payments feature doc's §5.5, §8 (`useRefundPayment`) |
| `GET /api/admin/conversations` | `conversation.controller.js` | Not yet specced in detail (no admin conversations doc has been written); build as a straightforward admin-scoped list mirroring `useConversations` but hitting `/api/admin/conversations` — same shape, no unread/participant scoping |
| `GET /api/admin/notifications` | `notification.controller.js` | **Not specced — flagged in §9.1, do not build blind** |

This means the practical deliverable is: **one admin shell** (nav, route guard, layout) hosting several **feature-specific admin panels**, some built fresh here (Users, Dashboard, Audit Log) and some importing hooks/components already defined by other features' specs (Payments, and eventually Conversations/Notifications) rather than re-implementing them. Don't duplicate `useAdminPayments`/`AdminPaymentsTable` — reuse them.

---

## 2. Data Model

```ts
// types/admin.ts
export type UserRole = 'user' | 'moderator' | 'admin'; // matches types/user.ts's UserRole from the auth feature
export type UserAccountStatus = 'active' | 'suspended' | 'banned'; // matches AuthUser's UserStatus

export interface AdminUserRow {
  _id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  avatar: string;
  bio: string;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  // Note: unlike the auth feature's AuthUser (toPublicUser), this comes
  // straight off User.find(...).lean() with no field-stripping — so it
  // may include fields beyond AuthUser's shape (e.g. anything added to
  // the schema later). Treat AdminUserRow as its own type, don't alias
  // it to AuthUser even though the overlapping fields match today.
}

export interface DashboardStats {
  users: { total: number; active: number; suspended: number; banned: number };
  posts: { total: number };
  reports: { pending: number };
  sales: Array<{ _id: string /* currency code, e.g. "USD" */; totalAmount: number; count: number }>;
}

export type AuditAction =
  | 'USER_BAN' | 'USER_SUSPEND' | 'USER_REACTIVATE' | 'ROLE_CHANGE'
  | 'CATEGORY_CREATE' | 'CATEGORY_UPDATE' | 'CATEGORY_DELETE'
  | 'REPORT_RESOLVE' | 'REPORT_DISMISS'
  | 'POST_DELETE' | 'COMMENT_DELETE';

export type AuditTargetType = 'user' | 'post' | 'comment' | 'category' | 'report' | 'system';

export interface AuditLogEntry {
  _id: string;
  actor: { _id: string; username: string; avatar: string; role: UserRole } | string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string | null;
  details: Record<string, unknown>; // Mixed on the backend — shape varies per action, see §5.3
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}
```

`sales` is grouped by currency (an array, not a single number) — **never sum across entries directly**; a naive `sales.reduce((a, s) => a + s.totalAmount, 0)` would silently add USD cents to EUR cents and produce a meaningless figure. Render each currency as its own stat/line, or a small per-currency breakdown list, never a single blended total.

---

## 3. REST Surface (this doc's portion)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/users` | Paginated user list, filterable by `search`, `role`, `status` |
| PATCH | `/api/admin/users/:id/role` | Change a user's role (whitelist-enforced) |
| PATCH | `/api/admin/users/:id/status` | Ban / suspend / reactivate a user |
| GET | `/api/admin/dashboard` | Aggregate stats for the admin landing panel |
| GET | `/api/admin/audit-logs` | Paginated accountability trail, filterable by `actor`, `action` |

### 3.1 Query keys & hooks

```ts
export const qk = {
  adminUsers: (page: number, filters: { search?: string; role?: string; status?: string }) =>
    ['admin', 'users', page, filters] as const,
  dashboardStats: () => ['admin', 'dashboard'] as const,
  auditLogs: (page: number, filters: { actor?: string; action?: string }) =>
    ['admin', 'audit-logs', page, filters] as const,
};
```

- `useAdminUsers(page, { search, role, status })` — `useQuery`, offset pagination (same `buildPaginatedResponse` convention used throughout this app: server returns `limit + 1` rows as the "has more" signal). Debounce `search` (≈300ms) before it hits the query key — this is a `$regex` scan on the backend, not an indexed exact match; don't fire a request per keystroke. **Send `search` as plain, unmodified text from the input** — the backend now escapes regex metacharacters server-side (`admin.controller.js`'s `getAllUsers` was patched to run user input through `escapeRegExp` before building the `$regex`, closing a regex-injection/ReDoS gap). Do not add any client-side regex-escaping of your own before sending `search`; doing so would double-escape it against a backend that already escapes once, corrupting searches containing characters like `.` or `+` (e.g. a search for an email address, which legitimately contains `.` and `@`).
- `useUpdateUserRole()` — `useMutation`, PATCHes `{ role }`. On success, patch the specific row in the currently-cached `qk.adminUsers(...)` page rather than a full invalidate, since the row's `role` is the only thing that changed and a full refetch would just re-fetch the same page for one field.
- `useUpdateUserStatus()` — `useMutation`, PATCHes `{ status }`. Same patch-in-place strategy, but also invalidate `qk.dashboardStats()` on success — the dashboard's `users.active/suspended/banned` counts are now stale the instant a status changes, and this is a cheap enough query to just refetch rather than trying to hand-patch four derived counters client-side.
- `useDashboardStats()` — `useQuery`, no params. Reasonable to set a modest `staleTime` (e.g. 60s) with manual refetch-on-focus, since the backend comment notes this route "may be opened frequently by staff" and is deliberately kept cheap — but there's no reason to hammer it on every tab focus if the numbers were fetched seconds ago.
- `useAuditLogs(page, { actor, action })` — `useQuery`, offset pagination, read-only (no mutations — the whole point of an audit log is that it's immutable, per the schema's own doc comment "Immutable record"). Don't build any edit/delete UI for audit log rows, ever.

---

## 4. The Users Panel

### 4.1 Table

- Columns: avatar+username, email, role (badge), status (badge), verified (icon), joined (`createdAt`), actions (role/status change triggers).
- Filters, all URL-search-param-backed (`useSearchParams`) so views are bookmarkable, matching the convention established in the payments/reports admin docs: `search` (debounced text input), `role` (`<Select>`: All / User / Moderator / Admin), `status` (`<Select>`: All / Active / Suspended / Banned).
- Pagination: same offset pattern as elsewhere — `page` in the URL, `limit + 1`-row "has more" signal.

### 4.2 Role change

```ts
// schemas/admin.schema.ts
import { z } from 'zod';

export const updateUserRoleSchema = z.object({
  role: z.enum(['user', 'moderator', 'admin']),
});
export type UpdateUserRoleFormValues = z.infer<typeof updateUserRoleSchema>;
```

- A row-level `<Select>` or small dialog offering the three roles. On change, call `useUpdateUserRole()`.
- **Self-role-change is blocked server-side** (`"You cannot change your own role."`, 400) — disable the role control entirely on the row matching the currently-logged-in admin's own id (`row._id === currentUser.id`, read from the auth feature's `useAuthStore`) rather than letting the request round-trip and fail. This is a straightforward client-side mirror of a real backend rule, not a redundant guess — implement both.
- No confirm dialog needed for role changes per se (it's reversible by another role change), but consider requiring a second click/confirm specifically for granting `'admin'` — a product-level safety nicety, not a backend requirement.

### 4.3 Status change (ban / suspend / reactivate)

```ts
export const updateUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended', 'banned']),
});
export type UpdateUserStatusFormValues = z.infer<typeof updateUserStatusSchema>;
```

- Same self-action block applies (`"You cannot change your own account status."`, 400) — disable status controls on the admin's own row.
- **This is the one action in this feature that deserves a real confirm dialog**, and the copy should say what actually happens, not just "are you sure": banning a user immediately revokes every one of their active sessions server-side (`RefreshToken.deleteMany`) — mention that in the `<AlertDialog>` body ("They will be signed out of all devices immediately"), since it's a meaningfully bigger action than a typical status toggle and the admin should know it's not just a label change.
- Render status as a 3-state control (Active / Suspended / Banned), not a binary ban toggle — `'active'` is itself a settable target (reactivation), not just a default.
- This mutation's cross-feature effect: the banned user's *own* open tabs will hit the auth feature's 403-handling path (`"This account has been banned. Access denied."`) on their very next request or token refresh, per the auth spec's §4.4 — nothing to build here for that side, just worth knowing the two features connect at that seam if you're debugging a "why did this user get logged out" question later.

---

## 5. The Dashboard Panel

### 5.1 Layout

A stat-card grid (shadcn `<Card>` grid, 4–6 cards) is enough — this is a summary landing view, not a full analytics suite:
- **Users**: total, with active/suspended/banned as a secondary breakdown (e.g. a small 3-segment bar or three sub-numbers under the total card) — don't build separate top-level cards for each status; they're one logical stat cluster.
- **Posts**: total.
- **Reports**: pending count — this is the number that should visually stand out most (it's the one that maps to "there's a queue an admin should look at"), and it's worth deep-linking this card to `/admin/reports?status=pending` if the reports admin feature (specced separately) is wired into the same shell.
- **Sales**: one line/stat per currency from the `sales` array (§2's warning about not summing across currencies) — if the account only ever transacts in one currency this degenerates to a single number naturally; don't hardcode a single-currency assumption into the component regardless, since the backend already returns an array specifically to support more than one.

### 5.2 Refresh behavior

- `useDashboardStats()` on mount; a manual refresh button is a reasonable addition given the backend explicitly optimized this route to be cheap ("no full-document scans... may be opened frequently by staff") — the backend is telling you it's fine to hit this often, so don't over-engineer caching/staleness here.
- No socket-driven live updates for this panel — none of the underlying collections emit anything this feature would subscribe to for dashboard purposes specifically (the payments feature's `payment_updated` event is scoped to a single buyer's own record, not a global counter). Treat this as poll-or-manual-refresh only, not real-time.

---

## 6. The Audit Log Panel

### 6.1 Table

- Columns: actor (avatar+username, populated), action (badge — see §6.2 for a label map), target (type + id, see §6.3 for linking), timestamp, and a "details" expand.
- Filters, URL-param-backed: `actor` (likely a user-search-typeahead if this app doesn't already have one from another feature — reuse it rather than building a new one; otherwise a plain "actor user ID" text input is an acceptable v1) and `action` (`<Select>` populated from the fixed `AuditAction` enum in §2 — don't hardcode a duplicate list anywhere else in the codebase; derive select options from this one shared union type).
- Read-only, full stop (§3.1) — no row actions beyond "view details."

### 6.2 Human-readable action labels

The raw `action` enum values are backend-shaped constants, not copy — map them to readable labels for the badge/table rather than rendering `USER_BAN` verbatim:

```ts
// lib/audit-action-labels.ts
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  USER_BAN: 'Banned user',
  USER_SUSPEND: 'Suspended user',
  USER_REACTIVATE: 'Reactivated user',
  ROLE_CHANGE: 'Changed role',
  CATEGORY_CREATE: 'Created category',
  CATEGORY_UPDATE: 'Updated category',
  CATEGORY_DELETE: 'Deleted category',
  REPORT_RESOLVE: 'Resolved report',
  REPORT_DISMISS: 'Dismissed report',
  POST_DELETE: 'Deleted post',
  COMMENT_DELETE: 'Deleted comment',
};
```

Notice not every action in this enum is actually emitted by code covered in this doc set so far — `USER_BAN`/`USER_SUSPEND`/`USER_REACTIVATE`/`ROLE_CHANGE` come from `admin.controller.js` (this doc); `REPORT_RESOLVE`/`REPORT_DISMISS` come from `report.controller.js` (already specced in the reports feature doc); `CATEGORY_*` and `POST_DELETE`/`COMMENT_DELETE` are written by controllers not included in any file set seen so far. **Build the label map and filter dropdown from the full enum regardless** — the audit log table will start showing those other action types the moment their owning controllers write to it, and there's no reason for the frontend to lag behind just because this pass hasn't seen those controllers yet.

### 6.3 Rendering `details` and linking to `targetId`

`details` is `Schema.Types.Mixed` — its shape is different per action (e.g. `ROLE_CHANGE` writes `{ previousRole, newRole }`; `USER_BAN`/`USER_SUSPEND`/`USER_REACTIVATE` write `{ previousStatus, newStatus }`; other actions not covered in this file set presumably write their own shapes). Two reasonable approaches, pick based on how polished v1 needs to be:
- **Minimal/robust**: render `details` as a collapsible `<pre>{JSON.stringify(details, null, 2)}</pre>` block unconditionally — always correct, never breaks on an unfamiliar action's shape, zero maintenance when new action types appear.
- **Polished**: switch on `action` for the handful of shapes actually known from this doc set (`ROLE_CHANGE` → "changed from **{previousRole}** to **{newRole}**"; `USER_BAN`/`USER_SUSPEND`/`USER_REACTIVATE` → "status changed from **{previousStatus}** to **{newStatus}**") and fall back to the raw JSON block for anything else. Don't guess at the shape of `CATEGORY_*`/`POST_DELETE`/`COMMENT_DELETE`/`REPORT_*` entries beyond what's confirmed in the report feature's own spec — fall through to raw JSON for those rather than inventing a formatted sentence for a shape you haven't actually seen.

`targetId` is optional (`required: false` on the schema) and, like the reports feature's own polymorphic reference, has no populated view from this endpoint — only `actor` is populated. Link to the target using `targetType` + `targetId` the same way the reports feature doc's §5.5 already established (reuse existing per-resource detail hooks/routes — `usePost(id)`, user profile route, etc. — never a new speculative fetch built just for this table), and handle `targetId` being `null` (e.g. for `targetType: 'system'` entries) by simply not rendering a link.

---

## 7. Business Rules Summary (mirrored from backend)

1. Every route in this file requires `protect + restrictTo('admin')` — no moderator-tier access despite the role enum including `'moderator'`. Gate the entire admin shell (not just individual panels) on `role === 'admin'` exactly as established in the payments/reports admin docs; don't build a partial moderator view against these endpoints, since the backend would 403 it anyway.
2. An admin cannot change their own role or their own status — disable both controls client-side on the admin's own row, in addition to (not instead of) handling the 400 if somehow bypassed.
3. Banning a user immediately revokes all of that user's refresh tokens — surface this consequence in the confirm dialog copy, not just a generic "are you sure."
4. `sales` in the dashboard stats is grouped by currency — never sum across the array into one number.
5. Audit log entries are immutable and read-only from this feature's perspective — no edit/delete UI, ever, for any row here.
6. `role`/`status` PATCH bodies are validated against strict whitelists server-side (`ALLOWED_ROLES`/`ALLOWED_STATUSES`) — mirror both enums exactly in the Zod schemas (§4.2, §4.3) so client-side selects can't even construct an invalid value.
7. `search` on the user list is a case-insensitive regex scan across `username`/`email` — debounce it; it is not a cheap indexed lookup like the `role`/`status` filters are. It is safe to send raw, unescaped text: the backend escapes regex metacharacters before the value ever reaches `$regex` (fixed in `admin.controller.js`) — don't pre-escape client-side, that would double-escape and break legitimate searches.

---

## 8. State Management Split

| Concern | Owner |
|---|---|
| Admin users list, dashboard stats, audit log entries | **TanStack Query** |
| Table filters (`search`, `role`, `status`, `actor`, `action`, `page`) for both panels | **URL search params**, per-panel (`useSearchParams`), not Zustand — consistent with every other admin table in this app |
| "Is the current row the logged-in admin's own row" check | Read directly from the auth feature's `useAuthStore` (`user.id`) — no new store needed |
| Confirm-dialog open state (ban/suspend confirm) | Local component state at the row/dialog level |

Nothing here justifies a dedicated Zustand slice — this feature is pure server-state-plus-URL-params, same shape as the reports and payments admin panels already specced.

---

## 9. Suggested File Structure

```
src/
  types/
    admin.ts
  schemas/
    admin.schema.ts            # updateUserRoleSchema, updateUserStatusSchema
  api/
    admin.api.ts                 # axios wrappers: getUsers, updateRole, updateStatus, getDashboard, getAuditLogs
  lib/
    audit-action-labels.ts       # AUDIT_ACTION_LABELS map, §6.2
  hooks/
    useAdminUsers.ts
    useUpdateUserRole.ts
    useUpdateUserStatus.ts
    useDashboardStats.ts
    useAuditLogs.ts
  components/
    admin/
      shell/
        AdminShell.tsx            # nav + RequireAdmin guard wrapper, reused by every admin panel
      users/
        AdminUsersTable.tsx
        UserRoleSelect.tsx
        UserStatusDialog.tsx      # ban/suspend/reactivate confirm, §4.3
      dashboard/
        DashboardStatsGrid.tsx
        SalesByCurrencyCard.tsx
      audit/
        AuditLogTable.tsx
        AuditActionFilter.tsx
        AuditDetailPopover.tsx    # §6.3
  routes/
    admin/
      AdminDashboardPage.tsx      # likely the default /admin landing route
      AdminUsersPage.tsx
      AdminAuditLogPage.tsx
      # AdminPaymentsPage, AdminReportsPage, AdminConversationsPage
      # already covered by their own features' specs — mount them into
      # the same AdminShell nav rather than re-speccing here.
```

---

## 10. Implementation Order (recommended)

0. **Audit the existing codebase per §0 before anything else** — search for existing `Admin*`/`useAdmin*` files, an existing shell/guard, and existing payments/reports admin components. Only proceed to step 1 for pieces confirmed missing.
1. Types + Zod schemas + `admin.api.ts` (§2, §3, §4.2, §4.3).
2. `AdminShell` + route guard — confirm this reuses the exact same admin-gating pattern already established by the payments/reports admin docs rather than inventing a third variant; this is the one piece worth getting consistent across all admin panels before building any individual one.
3. `useDashboardStats` + `DashboardStatsGrid` — good first panel to build since it's read-only and has no forms, useful to validate the shell/layout before tackling mutations.
4. `useAdminUsers` + `AdminUsersTable` with `search`/`role`/`status` filters (§4.1) — `search` is sent as raw text (§7 rule 7); no client-side escaping needed, the backend handles it.
5. `useUpdateUserRole` + `UserRoleSelect`, including the self-row disable logic (§4.2, §7.2).
6. `useUpdateUserStatus` + `UserStatusDialog` with the ban-consequence confirm copy (§4.3).
7. `useAuditLogs` + `AuditLogTable`, `AUDIT_ACTION_LABELS`, and the details renderer (§6) — build the minimal JSON-fallback version first, layer on the per-action formatted sentences only for the handful of confirmed shapes.
8. Wire the admin nav to also surface the already-specced Payments/Reports panels (and Conversations once needed) inside the same `AdminShell`, rather than leaving them as orphaned routes outside the shell.

---

## 11. Open Items to Confirm Before/While Coding

- ~~**User-search regex injection**~~ — **resolved, backend fixed.** `admin.controller.js`'s `getAllUsers` now runs `search` through `escapeRegExp()` before building the `$regex` filter, closing a regex-injection/ReDoS gap where unescaped input could throw on malformed patterns or cause catastrophic backtracking. No frontend change needed beyond *not* adding a redundant client-side escape (§7 rule 7).
- **`user.validator.js` wasn't included in this file set.** `updateUserRoleSchema`/`updateUserStatusSchema` on the backend presumably validate the same `role`/`status` whitelists shown in the controller (`ALLOWED_ROLES`/`ALLOWED_STATUSES`) plus an ObjectId check on `:id`, matching every other validator pattern seen across this app's other features — but confirm the exact Zod shape (e.g. whether it wraps `params`/`body` the same way `offer.validator.js`/`report.validator.js` do) before assuming the client-side schemas in §4.2/§4.3 need nothing further.
- **`notification.controller.js` / `GET /api/admin/notifications` is unspecced.** `admin.routes.js`'s own comment on that route flags genuine ambiguity ("Only meaningful if the admin Notifications page is meant to be a genuine cross-user moderation feed rather than the admin's own personal inbox — confirm intent before pointing the frontend at this instead of the existing self-scoped hook"). **Do not build an admin notifications panel from this doc** — get the controller file and product intent confirmed first; it may turn out `/api/admin/notifications` isn't meant to back a distinct UI at all.
- **`GET /api/admin/conversations` admin panel** has no dedicated spec yet (§1's table) — if it's needed in this pass, it's a near-identical port of the messaging feature's `useConversations`/`ConversationList` pattern pointed at the admin endpoint; confirm whether that's in scope before building it speculatively.
- **Moderator role's actual permissions**: the `User` schema and `ALLOWED_ROLES` both include `'moderator'`, but every route in `admin.routes.js` requires the `'admin'` role specifically — confirm whether a moderator-tier admin surface is planned elsewhere (a different route file not yet seen) before assuming `'moderator'` is currently a dead role with no UI of its own.
