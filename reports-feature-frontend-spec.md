# Frontend Implementation Brief: Reports & Moderation Queue

**Audience:** an engineering agent implementing the *frontend logic* for this feature.
**Stack:** React 19 + TypeScript, Tailwind CSS v4.3, shadcn/ui, React Hook Form + Zod, Zustand, TanStack Query v5, Axios, react-router-dom v6/7, Socket.io Client, `@tanstack/react-virtual`.

This document is derived directly from the backend implementation (model, controller, routes, RBAC middleware, validator). It does not invent new backend behavior. There is no Socket.io involvement anywhere in this feature — the backend routes file says so explicitly ("all pure HTTP REST... with no real-time component") — don't wire a socket listener for reports.

---

## 1. Mental Model — Two Very Different Audiences, One Resource

| Who | Can do | Route |
|---|---|---|
| **Any logged-in user** | File a report against a post, comment, or user profile | `POST /api/reports` |
| **Admin only** | View the moderation queue, triage/resolve/dismiss reports, delete report records | `GET /api/reports`, `PATCH /api/reports/:id`, `DELETE /api/reports/:id` |

This means the frontend has two essentially unrelated UI surfaces sharing one data model:

1. A **"Report" entry point** (button/menu item) that appears on posts, comments, and user profiles throughout the *regular* app — a small dialog, not a page.
2. An **admin moderation dashboard** — a full page (queue table, filters, detail/resolve panel) that a regular user should never even be able to route to, let alone see data from.

Build these as separate feature slices (`components/reports/` for the report-a-thing dialog, `components/admin/reports/` for the queue) even though they share `types/report.ts` and part of the API client.

---

## 2. Data Model (TypeScript types)

```ts
// types/report.ts
export type ReportTargetType = 'post' | 'comment' | 'user';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'resolved';

export interface Report {
  _id: string;
  reporter: UserSummary | string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  resolutionNotes: string;
  resolvedBy: UserSummary | string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Note the asymmetry in allowed status values:
- **Filing** a report always starts it at `'pending'` — the client never sends a `status` on create; don't add a status field to the create form at all.
- **Updating** a report can only set it to `'reviewed' | 'dismissed' | 'resolved'` — `'pending'` is a valid *stored* status (the initial/default one) but is **not** a valid value to PATCH *to* (the backend's `updateReportSchema` enum deliberately excludes it — you can't un-triage a report back to pending through this endpoint). Build the admin status-change control as a 3-option set (Reviewed / Dismissed / Resolved), not a 4-option one that includes Pending.

---

## 3. REST Surface

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/reports` | any authenticated user | File a report against a post/comment/user |
| GET | `/api/reports` | **admin only** | Paginated moderation queue, newest-first, filterable by `status` (and, per the schema, `targetType`, though the controller doesn't currently apply that filter — see §5.4) |
| PATCH | `/api/reports/:id` | **admin only** | Move a report to reviewed/dismissed/resolved, optionally attach `resolutionNotes` |
| DELETE | `/api/reports/:id` | **admin only** | Permanently delete a report record |

### 3.1 Query keys & hooks

```ts
export const qk = {
  reports: (page: number, status?: ReportStatus) => ['reports', 'admin', page, status ?? 'all'] as const,
};
```

- `useCreateReport()` — `useMutation`, POSTs `{ targetType, targetId, reason }`. No query invalidation needed on success in the *regular* app (the reporting user has no list of their own reports to keep fresh per this API surface) — just close the dialog and show a confirmation toast.
- `useReports(page, status?)` — `useQuery`, admin queue. Offset pagination (`buildPaginatedResponse` — server returns `limit + 1` rows as the "has more" signal, same convention as payments/conversations elsewhere in this app).
- `useUpdateReportStatus()` — `useMutation`, PATCHes `{ status, resolutionNotes? }`. On success, patch the specific report in the `qk.reports(...)` cache (update the one row) *and* invalidate the currently-active queue query, since a status change likely moves the row out of the currently-filtered view (e.g. resolving a report while viewing `?status=pending` should make it disappear from that list).
- `useDeleteReport()` — `useMutation`, DELETEs. On success, remove the row from the cached page locally (optimistic-friendly) and invalidate `qk.reports`.

---

## 4. The "Report This" Entry Point (Any User)

### 4.1 Where it lives

A small, reusable trigger + dialog, not a route. Mount it from:
- Post action menu (kebab menu on a `PostCard`) → `targetType: 'post'`, `targetId: post._id`
- Comment action menu → `targetType: 'comment'`, `targetId: comment._id`
- User profile page action menu → `targetType: 'user'`, `targetId: profileUser._id`

Build one shared `<ReportDialog targetType targetId trigger={...} />` component parameterized by the two ids rather than three near-duplicate dialogs.

### 4.2 Form

```ts
// schemas/report.schema.ts
import { z } from 'zod';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createReportFormSchema = z.object({
  targetType: z.enum(['post', 'comment', 'user']),
  targetId: z.string().regex(objectIdRegex),
  reason: z.string().trim().min(1, 'Reason is required').max(1000, 'Reason cannot exceed 1000 characters'),
});
export type CreateReportFormValues = z.infer<typeof createReportFormSchema>;
```

`targetType`/`targetId` are passed in as props, not user-editable fields — only `reason` is an actual form input (a `<Textarea>`, character-count against the 1000-char max is a nice touch given the backend hard-caps it). Consider a small fixed set of quick-pick reason chips (e.g. "Spam", "Harassment", "Fake listing") that populate the textarea, since free-text-only reporting UIs tend to get low-quality submissions — this is a UX suggestion, not a backend requirement; the backend only ever sees the final `reason` string either way.

### 4.3 Error handling specifics worth surfacing verbatim

The backend returns two distinct 400/404s the dialog should render as-is rather than a generic "something went wrong":
- 400 *"targetType must be one of: post, comment, user."* — shouldn't be reachable if the dialog is wired correctly (targetType is fixed per mount point), but don't swallow it if it somehow occurs.
- 404 *"No {targetType} found with that ID."* — genuinely reachable (e.g. the post was deleted between page load and the report submission). Show this as-is; it's already user-legible.

### 4.4 No optimistic UI needed

Filing a report has no visible effect on the content being reported (it doesn't hide it, flag it in-UI, etc. — that's a moderation decision, made later, by an admin). Just: submit → success toast ("Thanks, our team will review this") → close dialog. Don't build any "reported" badge state on the target content based on the reporter's own action; the backend doesn't expose "have I already reported this" and the frontend shouldn't infer it from local state that won't survive a refresh anyway. If a "you already reported this" indicator is wanted later, it needs a new backend query — flag it as a gap rather than faking it client-side.

---

## 5. The Moderation Queue (Admin Only)

### 5.1 Route guarding — two layers, not one

1. **Route-level**: wrap `/admin/reports` (and the whole `/admin/*` tree, presumably already established elsewhere in this app) in a role-gate that checks the current user's role client-side *before* rendering — purely for UX (don't flash the table then yank it away).
2. **Still handle the 403 from the server as the real gate.** `restrictTo('admin')` runs server-side on every one of these routes; a stale/tampered client role check is not the security boundary. Any 403 response from `useReports`/`useUpdateReportStatus`/`useDeleteReport` should redirect to a "not authorized" state, exactly like the payments feature's admin surface elsewhere in this app — don't assume the client-side gate is sufficient and skip handling the 403 case in the query/mutation error handlers.

### 5.2 Queue table

- `useReports(page, status)` feeds a shadcn `<Table>` (or a virtualized list via `@tanstack/react-virtual` if queues can run large — moderation queues are usually modest in row count per page, so plain pagination is likely fine; virtualize only if product feedback says otherwise).
- Columns: reporter (avatar+username via the populated field), target type + a link/preview into the actual target (see §5.5), reason (truncated with a "view full" expand — up to 1000 chars won't fit a table cell), status (badge), filed date (`createdAt`), resolved-by/resolved-at (populated `resolvedBy.username` + `resolvedAt`, blank for pending/reviewed).
- **Status filter** is a controlled `<Select>` bound to a `?status=` URL search param (`useSearchParams`), not local component state — admins will want to bookmark/share "show me pending reports." Default view on first load: `status=pending`, since that's the actionable queue; expose "All" as an explicit option that omits the param.

### 5.3 Resolve/Dismiss action

- A row-level action (dropdown or a detail drawer/dialog opened from the row) offering exactly the three PATCH-able statuses: **Reviewed**, **Dismissed**, **Resolved**.
- `resolutionNotes` is optional on the backend (`.optional().or(z.literal(''))`) — don't force it, but strongly encourage it in the UI (e.g. required only when choosing "Resolved" or "Dismissed" as a *product* decision layered on top of the backend's more permissive rule — the backend allows an empty string either way, so this would be client-side-only enforcement, not a server constraint. Make this optional-but-encouraged rather than blocking submission, since the backend won't reject an empty string).
- Mirror the backend's Zod enum exactly for the PATCH form — **do not include `'pending'` as a selectable target status** (§2).

```ts
// schemas/report.schema.ts (cont.)
export const updateReportFormSchema = z.object({
  status: z.enum(['reviewed', 'dismissed', 'resolved']),
  resolutionNotes: z.string().trim().max(2000, 'Resolution notes cannot exceed 2000 characters').optional().or(z.literal('')),
});
export type UpdateReportFormValues = z.infer<typeof updateReportFormSchema>;
```

- On success, since `resolvedBy`/`resolvedAt` are only ever set server-side when status becomes `'resolved'` or `'dismissed'` (not `'reviewed'`), don't try to guess/render those fields optimistically from the current admin user — wait for the server response and use the returned `report.resolvedBy`/`report.resolvedAt` verbatim.

### 5.4 Known backend gap: `targetType` filter isn't wired up

`listReportsSchema` validates an optional `targetType` query param, but `getReports` in the controller **never reads `req.query.targetType`** — only `status` is applied to the Mongo filter. **Do not build a `targetType` filter control in the queue UI** that silently no-ops; either omit it entirely for now, or if the product genuinely needs it, flag this back as a backend gap to fix before building client UI around a param the server will accept-but-ignore.

### 5.5 Linking to the actual reported content

`targetId` + `targetType` is a polymorphic reference — the Report document itself has no populated view of the actual post/comment/user being reported (the controller only populates `reporter` and `resolvedBy`). To let an admin actually *see what was reported*:
- `targetType === 'post'` → link to the existing post detail route (`/posts/:targetId}` or whatever it's called elsewhere in this app).
- `targetType === 'comment'` → comments typically don't have their own standalone route; link to the parent post if that's resolvable elsewhere, or — if no such lookup exists yet — render just the target type + raw id with a copy-id affordance rather than inventing a fetch this backend doesn't support.
- `targetType === 'user'` → link to the profile route (`/profile/:targetId` or equivalent).
- Do **not** add a new fetch-by-id call against Post/Comment/User models speculatively from this feature's frontend code — reuse whatever detail-fetch hooks those other features already expose (`usePost(id)`, `useUser(id)`, etc.) rather than duplicating them here. If a target has since been deleted, expect that linked-to page to itself 404 — handle that gracefully (e.g. "This content no longer exists") rather than crashing.

### 5.6 Delete

- A destructive action, admin-only, described by the backend as "typically for cleanup of duplicate filings" — not a routine moderation action. Gate it behind a confirm dialog (shadcn `<AlertDialog>`), and consider putting it in a secondary/overflow menu position relative to the more common Resolve/Dismiss actions so it isn't the easiest thing to misclick.
- No soft-delete/undo on the backend (`report.deleteOne()` is permanent) — the confirm copy should say so plainly ("This can't be undone").

---

## 6. Business Rules Summary (mirrored from backend)

1. Any authenticated user may file a report; there is no per-user rate limit or "already reported" check visible in this backend — don't invent client-side throttling that implies a guarantee the server doesn't provide.
2. Reports always start `pending`; the create form never sends `status`.
3. `targetType` must be exactly `post | comment | user`; the backend verifies the target actually exists via `TargetModel.exists()` before creating the report — expect and handle the 404 case (§4.3).
4. Status transitions via PATCH are limited to `reviewed | dismissed | resolved` — `pending` is a valid stored value but not a settable one via this endpoint.
5. `resolvedBy`/`resolvedAt` are set automatically (server-side, from `req.user.id` + `new Date()`) only when the new status is `resolved` or `dismissed` — never send these from the client, and don't render them until the server returns them.
6. Every `resolved`/`dismissed` transition writes an `AuditLog` entry server-side (`REPORT_RESOLVE`/`REPORT_DISMISS`) — moving to `reviewed` does not. If this app has an audit-log viewer elsewhere, no frontend action is needed here beyond knowing that resolve/dismiss actions will show up there; nothing to build in *this* feature for it.
7. All four endpoints require `protect` (authentication); three of the four additionally require `restrictTo('admin')`. Filing (`POST`) is the only one open to non-admins.
8. `reason` ≤ 1000 chars, `resolutionNotes` ≤ 2000 chars — enforce both client-side with the shared Zod schemas (§4.2, §5.3) so the character-count UI and the actual submit-blocking validation use the same source of truth.

---

## 7. State Management Split

| Concern | Owner |
|---|---|
| Moderation queue data (`Report[]`, pagination) | **TanStack Query** (`useReports`) |
| Report-dialog open/closed state, which target it's reporting | Local component state at the mount point (post card / comment / profile) — no global store needed, it's a single ephemeral dialog |
| Admin queue filters (`status`, `page`) | **URL search params**, not Zustand — bookmarkable/shareable admin views, consistent with the payments admin table pattern elsewhere in this app |
| Anything else | Nothing else is needed — this feature has no sockets, no optimistic multi-step flows, and no cross-route ephemeral state to justify a Zustand slice |

---

## 8. Suggested File Structure

```
src/
  types/
    report.ts
  schemas/
    report.schema.ts          # createReportFormSchema + updateReportFormSchema
  api/
    reports.api.ts             # axios wrappers: create, list, updateStatus, remove
  hooks/
    useCreateReport.ts
    useReports.ts
    useUpdateReportStatus.ts
    useDeleteReport.ts
  components/
    reports/
      ReportDialog.tsx          # shared "report this" trigger + form, any user
    admin/
      reports/
        ReportsQueueTable.tsx
        ReportStatusBadge.tsx
        ReportStatusFilter.tsx  # bound to ?status= URL param
        ReportDetailDrawer.tsx  # reason (full), resolve/dismiss/review form
        DeleteReportDialog.tsx
  routes/
    admin/
      reports/
        AdminReportsPage.tsx    # role-gated, hosts ReportsQueueTable
```

---

## 9. Implementation Order (recommended)

1. Types + Zod schemas + `reports.api.ts` (§2, §3, §4.2, §5.3).
2. `useCreateReport` + `ReportDialog` — wire into one mount point first (e.g. post action menu) to validate the flow end-to-end, then replicate for comment/user mount points.
3. Admin route guard scaffolding (client-side role check + 403-redirect handling per §5.1) before building any admin UI behind it.
4. `useReports` + `ReportsQueueTable` with the `status` URL-param filter (§5.2) — read-only queue first.
5. `ReportStatusBadge` + row detail view, including the target-linking logic (§5.5) reusing existing post/user detail hooks.
6. `useUpdateReportStatus` + resolve/dismiss/review form (§5.3), confirming the cache-patch-and-invalidate behavior removes rows from a filtered view correctly.
7. `useDeleteReport` + confirm dialog (§5.6).
8. Polish: reason quick-pick chips on the report dialog (§4.2, optional), empty/loading states, char-count UI on both forms.

---

## 10. Open Items to Confirm Before/While Coding

- **`targetType` filter**: confirm with backend whether wiring the currently-inert `targetType` query param is in scope for this pass, or explicitly out of scope (§5.4) — don't build UI for it silently assuming it works.
- **Target-content detail hooks**: confirm the exact existing hooks/routes for post detail, comment context, and user profile detail elsewhere in this app so §5.5's linking doesn't duplicate fetch logic that already exists.
- **Admin shell/role-check pattern**: confirm the existing convention for gating `/admin/*` routes (likely already established by the payments admin table or another existing admin surface) and reuse it rather than inventing a second pattern.
