# Bug Report & Fix Guide: `VirtualTable` Hydration Errors + `refresh-token` 401

**Stack:** React 19 + TypeScript, Tailwind CSS v4.3, shadcn/ui, React Hook Form + Zod, Zustand, TanStack Query v5, Axios, react-router-dom v6/7, Socket.io Client, `@tanstack/react-virtual`.

**Affected component:** `AdminUsersPage` → `VirtualTable` (wrapping shadcn/ui `Table`, `TableHeader`, `TableBody`, `TableRow`)

**Severity:** High — causes React hydration mismatches, invalid DOM warnings, broken virtualization heights, and a failed auth refresh call.

---

## 1. Summary

The console log shows two unrelated problems firing at once:

1. **Invalid table DOM nesting** produced by `VirtualTable`, which renders `@tanstack/react-virtual` items as absolutely-positioned `<div>` elements *inside* a real `<tbody>`/`<tr>` structure. HTML does not allow a `<div>` to be a child of `<tbody>`, nor a `<tr>` to be a child of a `<div>`. This triggers hydration errors, DOM-nesting warnings, a `NaN` height style, and a missing `key` prop warning.
2. **A `401 Unauthorized`** on `POST /api/auth/refresh-token`, which is a separate authentication/session issue, unrelated to the rendering bug, but worth fixing in the same pass since it appeared in the same trace.

Below is a full breakdown of each warning, its root cause, and a production-grade fix.

---

## 2. Errors Observed (Raw Log Breakdown)

### 2.1 `In HTML, <div> cannot be a child of <tbody>`
```
<TableBody className="relative">
  <tbody data-slot="table-body" ...>
    <div style={{height:312}}>   <-- offending node
```
React's hydration validator flags this because the server-rendered HTML (valid `<tbody><tr>...</tr></tbody>`) doesn't match what the client tries to mount (`<tbody><div>...</div></tbody>`), or because the browser's own HTML parser silently reparents invalid children before React can reconcile them.

### 2.2 `<tbody> cannot contain a nested <div>`
Same root cause as 2.1 — this is React's DOM validator (`validateDOMNesting`) confirming the same structural violation from the browser's perspective.

### 2.3 `Each child in a list should have a unique "key" prop` (in `VirtualTable`)
The virtualizer maps over `virtualizer.getVirtualItems()` (or similar) to render rows, but the `key` prop either isn't set, is set on the wrong element (e.g., on the inner `<tr>` instead of the outer mapped node), or the custom `rowKey` function returns `undefined`/duplicate values for some rows.

### 2.4 `In HTML, <tr> cannot be a child of <div>` / `<div> cannot contain a nested <tr>`
Direct consequence of the same wrapper: each virtualized row renders
```
<div style={{height:312}}>
  <TableRow data-index={0} style={{ transform: "translateY(...)" }}>
    <tr data-slot="table-row" ...>
```
Since `<tr>` must be a **direct child of `<tbody>`, `<thead>`, `<tfoot>`, or `<table>`**, wrapping it in a positioning `<div>` is invalid HTML regardless of how it looks visually.

### 2.5 `` `NaN` is an invalid value for the `height` css style property ``
The virtualizer is computing a row/container height from a measurement that hasn't resolved yet — most commonly:
- `virtualizer.getTotalSize()` is called before the scroll container (`ref.current`) has a non-zero `clientHeight`/`clientWidth`, or
- `count` (row count) is `0` momentarily while `rows` is still loading, or
- `estimateSize` divides by a value that can be `0` (e.g., `containerHeight / rowCount`).

`NaN` silently breaks the inline style, so rows collapse or overlap, compounding the layout bugs above.

### 2.6 `social-media-marketplace.up.railway.app/api/auth/refresh-token — 401`
Unrelated to rendering: the access token expired and the refresh call itself was rejected by the server, meaning the refresh token is also invalid/expired/missing, or isn't being sent (cookie/header issue).

---

## 3. Root Cause

`VirtualTable` combines **two incompatible rendering models**:

| Model | Expectation |
|---|---|
| Semantic HTML `<table>` (via shadcn/ui `Table`) | `table > thead/tbody > tr > td`, strict nesting enforced by the HTML parser |
| Absolute-position virtualization (via `@tanstack/react-virtual`) | Wraps each item in a freely-positioned `<div style={{ position: 'absolute', transform: 'translateY(...)' }}>` inside a sized container `<div style={{ height: totalSize }}>` |

The second pattern is exactly right for `<ul>`/`<div>`-based lists, but it is **not valid inside a real `<table>`**, because the browser's HTML parser actively strips/reparents any non-`<tr>` element found directly under `<tbody>`. That reparenting is what produces the hydration mismatch (server HTML ≠ client HTML) and cascades into the rest of the warnings.

---

## 4. Fix — Two Supported Approaches

Pick one depending on how much of the existing shadcn `Table` markup you want to keep.

### Approach A (Recommended): Keep semantic `<table>`, virtualize with "padding rows"

Instead of absolutely positioning each row inside a wrapper `<div>`, render **only the visible `<tr>` rows** as direct children of `<tbody>`, and use two spacer `<tr>` elements (top/bottom) whose height fills the space of the rows that are scrolled out of view. This keeps the DOM 100% valid HTML while still virtualizing.

```tsx
// VirtualTable.tsx
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "@/components/ui/table";

interface VirtualTableProps<T> {
  rows: T[];
  columns: ColumnDef<T>[];
  rowKey: (row: T) => string;
  emptyState?: string;
}

export function VirtualTable<T>({ rows, columns, rowKey, emptyState }: VirtualTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52, // fixed row height fallback
    overscan: 8,
    // Guard against measuring before mount
    enabled: rows.length > 0,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  // Guard against NaN when there are 0 rows or container isn't measured yet
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = virtualRows.length > 0
    ? Math.max(0, totalSize - virtualRows[virtualRows.length - 1].end)
    : 0;

  if (rows.length === 0) {
    return <div className="p-6 text-center text-muted-foreground">{emptyState}</div>;
  }

  return (
    <div ref={scrollRef} className="relative overflow-auto max-h-[600px]">
      <Table>
        <TableHeader>{/* ...column headers... */}</TableHeader>
        <TableBody>
          {paddingTop > 0 && (
            <tr aria-hidden style={{ height: paddingTop }}>
              <td style={{ padding: 0, border: 0 }} colSpan={columns.length} />
            </tr>
          )}

          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <TableRow key={rowKey(row)} data-index={virtualRow.index}>
                {columns.map((col) => (
                  <TableCell key={col.id}>{col.cell(row)}</TableCell>
                ))}
              </TableRow>
            );
          })}

          {paddingBottom > 0 && (
            <tr aria-hidden style={{ height: paddingBottom }}>
              <td style={{ padding: 0, border: 0 }} colSpan={columns.length} />
            </tr>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

Key changes vs. the current implementation:

- **No wrapping `<div>` inside `<tbody>`.** Only `<tr>` elements are direct children.
- **`key` is explicitly set** on the outer mapped element (`TableRow`), using the real `rowKey(row)` result — not `virtualRow.index`, and not left unset.
- **Padding rows replace absolute positioning.** `paddingTop`/`paddingBottom` are computed from `virtualRows[0].start` and the total size, so there's no `transform: translateY()` on the `<tr>` itself.
- **`NaN` guard:** `totalSize` and padding values default to `0` when `virtualRows.length === 0`, and `enabled: rows.length > 0` prevents `useVirtualizer` from measuring against an empty/un-mounted scroll container.

### Approach B: Drop semantic `<table>`, use a CSS Grid "faux table"

If you need absolute-position virtualization (e.g. variable row heights measured via `measureElement`), don't use real `<table>`/`<tbody>`/`<tr>` at all — use `role="table"` on styled `<div>`s with CSS Grid columns. This is the pattern TanStack's own virtualization examples use for large, variable-height tables.

```tsx
<div role="table" className="grid" style={{ position: "relative" }}>
  <div role="rowgroup" style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
    {virtualRows.map((virtualRow) => (
      <div
        key={rowKey(rows[virtualRow.index])}
        role="row"
        style={{
          position: "absolute",
          top: 0,
          transform: `translateY(${virtualRow.start}px)`,
          display: "grid",
          gridTemplateColumns: "minmax(15rem, 1fr) ...",
          height: virtualRow.size,
        }}
      >
        {columns.map((col) => (
          <div role="cell" key={col.id}>{col.cell(rows[virtualRow.index])}</div>
        ))}
      </div>
    ))}
  </div>
</div>
```

Trade-off: you lose native `<table>` semantics (accessibility, `Ctrl+F` browser find, default styling from shadcn's `Table` primitives) and must re-implement `role="table"/"row"/"cell"` ARIA attributes and grid-based column alignment yourself. **Approach A is preferred** unless you specifically need per-row dynamic measurement (`measureElement`) that padding rows can't express cleanly.

---

## 5. Fixing the Missing `key` Prop Warning

Regardless of which approach you pick:

- Set `key` on the **outermost element returned by the `.map()` callback** — not on a child several levels deep.
- Never fall back to `virtualRow.index` as the key if `rowKey` is meant to reflect row identity (e.g. `user.id`) — index-based keys break state/identity when the underlying list is sorted, filtered, or has items removed mid-scroll, causing subtle re-render bugs on top of the warning.
- If `rowKey` can legitimately return `undefined` (e.g. a row without an `id` yet, like an optimistic/pending row), fall back to a stable synthetic key such as `` `pending-${virtualRow.index}` `` rather than leaving it unset.

---

## 6. Fixing the `NaN` Height

`NaN` height style values come from a numeric expression that resolved to `NaN` before your data/measurements were ready. Checklist:

1. **Guard `useVirtualizer` against an empty list:**
   ```ts
   const rowVirtualizer = useVirtualizer({
     count: rows.length,
     enabled: rows.length > 0,
     // ...
   });
   ```
2. **Never divide by a value that can be zero** in `estimateSize` (e.g. `containerHeight / rowCount` when `rowCount === 0`).
3. **Don't read `getTotalSize()` / `virtualRow.start` until `scrollRef.current` is mounted.** `useVirtualizer` handles this internally as long as `getScrollElement` returns `null` safely before mount — just make sure you're not overriding `estimateSize`/`measureElement` with your own arithmetic that assumes a non-null ref.
4. Add a lightweight runtime assertion in development:
   ```ts
   if (process.env.NODE_ENV === "development" && Number.isNaN(totalSize)) {
     console.warn("[VirtualTable] totalSize resolved to NaN — check rows.length and estimateSize()");
   }
   ```

---

## 7. Fixing the `401` on `/api/auth/refresh-token`

This is unrelated to the table bug but appeared in the same session, so it's worth resolving together.

**Likely causes, in order of probability:**

1. **Refresh token itself is expired or was already rotated/invalidated** (e.g. single-use refresh tokens — a second call with the same token after one successful rotation will always 401).
2. **The refresh token isn't being sent.** If it's stored in an `httpOnly` cookie, confirm the Axios request includes `withCredentials: true` and that the cookie's `SameSite`/`Secure`/domain attributes match the deployed origin (`social-media-marketplace.up.railway.app`).
3. **Race condition / duplicate refresh calls.** If multiple components independently detect a `401` and each fire their own refresh request concurrently, the second request may hit an already-rotated (and thus now-invalid) refresh token. Fix by de-duplicating refresh calls behind a single in-flight promise in your Axios interceptor:

```ts
let refreshPromise: Promise<string> | null = null;

async function getRefreshedToken() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post("/api/auth/refresh-token", null, { withCredentials: true })
      .then((res) => res.data.accessToken)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}
```

4. **Server clock skew or TTL mismatch** — verify the refresh token's expiry window on the backend matches what the client expects, and that expired sessions redirect to `/login` instead of retrying indefinitely (an interceptor retry loop against a dead refresh token will keep producing `401`s).

**Recommended interceptor pattern (Axios + TanStack Query):**
```ts
axiosInstance.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const token = await getRefreshedToken();
        original.headers.Authorization = `Bearer ${token}`;
        return axiosInstance(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);
```
The `_retry` flag prevents infinite retry loops; the shared `refreshPromise` prevents duplicate refresh calls from racing each other and invalidating a just-rotated token.

---

## 8. Verification Checklist

After applying the fixes:

- [ ] `<tbody>` in the rendered DOM contains only `<tr>` elements (inspect via DevTools Elements tab, not just source).
- [ ] No hydration warnings in the console on initial SSR/CSR mount of `AdminUsersPage`.
- [ ] No `"Each child in a list should have a unique key"` warning when `VirtualTable` re-renders with sorted/filtered data.
- [ ] Scrolling a large user list (1,000+ rows) shows no layout jump, no `NaN` in computed styles (check `getComputedStyle` in DevTools).
- [ ] Simulate an expired access token and confirm exactly **one** `refresh-token` request fires even when multiple TanStack Query hooks 401 simultaneously.
- [ ] Confirm refresh token cookie attributes (`Secure`, `SameSite`, `Domain`) are correct for the Railway deployment origin.

---

## 9. Summary Table

| Issue | Root Cause | Fix |
|---|---|---|
| `<div>` in `<tbody>` / hydration mismatch | Virtualizer wraps rows in absolute-positioned `<div>` inside a real `<table>` | Use padding-row virtualization (Approach A) or switch to a CSS Grid faux-table (Approach B) |
| `<tr>` inside `<div>` | Same wrapper div issue | Same as above |
| Missing `key` prop | Key not set on outer mapped node / `rowKey` returns `undefined` | Set `key={rowKey(row)}` on the outermost mapped element; add fallback for missing IDs |
| `NaN` height | Virtualizer measured before mount / division by zero row count | `enabled: rows.length > 0`, guard `estimateSize`, clamp padding values to `0` |
| `401` on `refresh-token` | Expired/rotated refresh token, missing credentials, or race condition between concurrent refresh calls | De-duplicate refresh calls with a shared in-flight promise, verify cookie attributes, add `_retry` guard |
