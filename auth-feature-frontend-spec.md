# Frontend Implementation Brief: Authentication

**Audience:** an engineering agent implementing the *frontend logic* for this feature.
**Stack:** React 19 + TypeScript, Tailwind CSS v4.3, shadcn/ui, React Hook Form + Zod, Zustand, TanStack Query v5, Axios, react-router-dom v6/7, Socket.io Client, `@tanstack/react-virtual`.

This document is derived directly from the backend implementation (model, controller, middleware, routes, validator, and `config/socket.js`). It does not invent new backend behavior. This is the foundation every other feature in this app depends on (Axios auth headers, route guards, socket identity, the current-user identity used by every other query) — get this right before other features are wired to it.

---

## 1. Token Strategy — Read This Before Writing Any Auth Code

The backend uses a **dual-token, dual-transport** design. The frontend must match it exactly or sessions will silently break.

| Token | Shape | Lifetime | Where it lives | How it's sent |
|---|---|---|---|---|
| **Access token** | JWT | short-lived (`env.jwtExpiresIn`) | Returned in the JSON response body only | Client sends it as `Authorization: Bearer <token>` on every request |
| **Refresh token** | opaque random hex string (NOT a JWT — never decode it) | 7 days | **Both**: (a) an `httpOnly` cookie the browser manages automatically, scoped to `path: /api/auth`, and (b) also returned in the JSON body for non-cookie clients | Sent automatically via cookie for web *if* `withCredentials` is on, **or** explicitly in `{ refreshToken }` request body — the backend accepts either (`req.body.refreshToken || req.cookies?.refreshToken`) |

**Implication for the frontend agent:**
- The access token is **never** persisted in `localStorage`. Because `protect` middleware also accepts an `accessToken` cookie as a fallback, don't assume you need to manage the access token by hand end-to-end — but the backend's login/register/refresh responses only ever *set* the refresh-token cookie server-side (see `refreshCookieOptions` — only `"refreshToken"` is `res.cookie`'d). **The access token is not automatically cookied by the server.** So the frontend is responsible for holding the access token in memory (a Zustand store, not localStorage — see §5) and attaching it via the `Authorization` header on every request. Don't rely on a cookie carrying the access token; it doesn't exist unless a proxy/BFF layer adds one, which isn't in scope here.
- The refresh token, by contrast, **is** handled for you via the httpOnly cookie **as long as the Axios client sends `withCredentials: true`** — configure this once in `lib/api-client.ts`. Also keep a copy from the JSON response body in memory only if you need to support a non-cookie client path (e.g. a future native app) — for the web app, prefer relying on the cookie exclusively and treat the body's `refreshToken` field as write-only/ignorable rather than something to store client-side, since storing a long-lived bearer credential in JS-reachable memory/storage widens XSS blast radius for no benefit when the cookie already does the job.
- **Never** put either token in `localStorage`/`sessionStorage`. Access token → in-memory Zustand state (cleared on refresh, re-derived via `/me` or a silent refresh on app boot — §4.3). Refresh token → httpOnly cookie, invisible to JS by design; that's the point.

---

## 2. Data Model

```ts
// types/user.ts
export type UserRole = 'user' | 'moderator' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar: string;
  bio: string;
  isVerified: boolean;
  createdAt: string;
}
```

This is the exact shape of `toPublicUser()` — the backend never sends `password` (schema `select: false` anyway), and this is the full set of fields available on the client. Don't invent additional fields (e.g. `followerCount`/`followingCount` are Mongoose virtuals on the model but are **not** included in `toPublicUser()`'s auth responses — if the profile UI needs those, they come from a separate user/profile endpoint outside this feature, not from `/api/auth/me`).

---

## 3. REST Surface

| Method | Path | Auth | Rate-limited | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/register` | none | no | Create account, send verification email |
| POST | `/api/auth/login` | none | **yes** (`authLimiter`) | Verify credentials, issue token pair |
| POST | `/api/auth/refresh-token` | none (uses refresh token itself as auth) | no | Silently renew the access token |
| POST | `/api/auth/logout` | none | no | Revoke refresh token, clear cookie |
| POST | `/api/auth/forgot-password` | none | **yes** (`passwordResetLimiter`) | Email a reset link (always 200, enumeration-safe) |
| POST | `/api/auth/reset-password/:token` | none (token is the auth) | no | Set new password, force-logout all sessions |
| POST | `/api/auth/verify-email/:token` | none (token is the auth) | no | Mark account verified |
| POST | `/api/auth/resend-verification` | none | **yes** (`authLimiter`) | Re-send verification email (always 200, enumeration-safe) |
| GET | `/api/auth/me` | **required** | no | Current user's own profile |

### 3.1 Enumeration-safe endpoints — don't build UI that contradicts this

`forgotPassword` and `resendVerification` **always** return the same 200 + generic message regardless of whether the email exists or is already verified — this is a deliberate anti-enumeration measure. The frontend must:
- Show that generic success message unconditionally on a 200 — never say "Email not found" or "Account already verified" (the backend structurally cannot tell you that, and inventing a client-side check would defeat the purpose).
- Not add a client-side "check if this email exists" pre-flight before showing the forgot-password form — there's no endpoint for that, deliberately.

### 3.2 Rate-limited endpoints — expect and surface 429s

`login`, `resendVerification` (both via `authLimiter`), and `forgotPassword` (`passwordResetLimiter`) can return 429. Build a generic rate-limit toast/inline message ("Too many attempts — please try again shortly") reused across these three forms rather than treating a 429 as an unexpected error state.

---

## 4. Hooks (TanStack Query + Axios)

### 4.1 Mutations (one per POST endpoint)

```ts
useRegister()             // POST /register
useLogin()                 // POST /login
useLogout()                 // POST /logout
useForgotPassword()         // POST /forgot-password
useResetPassword()          // POST /reset-password/:token
useVerifyEmail()            // POST /verify-email/:token
useResendVerification()     // POST /resend-verification
```

None of these are `useQuery` — they're all one-shot `useMutation`s. `refreshAccessToken` is deliberately **not** exposed as a component-callable hook (§4.2) — it's plumbing inside the Axios layer, not something a component calls directly.

### 4.2 `refresh-token` lives in the Axios interceptor, not a hook

Because token refresh must transparently retry *any* failed request (not just ones a specific component initiated), implement it as a response interceptor in `lib/api-client.ts`:

```ts
// lib/api-client.ts (sketch)
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry && !original.url?.includes('/auth/')) {
      original._retry = true;
      try {
        const { data } = await apiClient.post('/auth/refresh-token'); // cookie carries the refresh token
        useAuthStore.getState().setAccessToken(data.data.accessToken);
        original.headers.Authorization = `Bearer ${data.data.accessToken}`;
        return apiClient(original);
      } catch {
        useAuthStore.getState().clear();
        // redirect to /login, see §6
      }
    }
    return Promise.reject(error);
  }
);
```

Key details pulled straight from the backend:
- Exclude `/auth/*` requests themselves from the retry-on-401 logic (`!original.url?.includes('/auth/')`) — otherwise a genuinely bad login attempt (401 from *wrong password*, not an expired token) would trigger an infinite refresh loop.
- The refresh call needs no body/header from the client beyond the cookie — `withCredentials: true` on the Axios instance is what makes this work; don't manually attach a token to this specific call.
- `original._retry` guards against retry loops if the refreshed token is itself immediately rejected (e.g. account got banned mid-session — see §4.4).
- On refresh failure, clear all client auth state and treat the user as logged out (§6) — don't leave stale UI showing a logged-in state with a dead session.

### 4.3 Boot-time session restore

On app mount (before rendering protected routes), attempt a silent session restore:
```ts
// once, at app root
useQuery({
  queryKey: ['auth', 'me'],
  queryFn: () => apiClient.get('/auth/me').then(r => r.data.data.user),
  retry: false,
  // on success: useAuthStore.setState({ user, status: 'authenticated' })
  // on 401: attempt one refresh-token call; if that also fails, status: 'unauthenticated'
});
```
Show an app-level splash/skeleton while this resolves — don't flash the login page before this check completes, and don't flash protected content before it resolves either (§6 covers the guard component this feeds).

### 4.4 Banned/suspended mid-session

Both `protect` middleware and `refreshAccessToken` explicitly check `status === 'banned' | 'suspended'` and 403 even with an otherwise-valid token — meaning a user can be logged in, get banned by an admin, and their *next* request (or next token refresh) will fail with a 403 carrying a specific message ("This account has been banned. Access denied." / "This account is currently suspended."). Handle 403 with this message shape as a **hard logout**: clear auth state, redirect to login, and show the server's message on the login screen (don't generalize it into a generic "session expired" — the specific reason matters to the user here). Same treatment applies to the `refreshAccessToken` flow's own 403 for banned/suspended (`"This account no longer has access."`).

### 4.5 Socket identity — `config/socket.js` now does handshake auth

Two earlier drafts of this section disagreed with each other, so to be explicit about where things landed: `config/socket.js` has been patched to add real handshake authentication (an `io.use(...)` middleware that verifies the same access-token JWT `protect` checks, run once per connection attempt before `connection` fires). This closes the previous gap where `register_user(userId)` let any connected client join *any* user's personal notification room just by claiming that id — the server now derives `socket.userId` from a verified token and ignores whatever id (if any) a `register_user` emit still sends. **Frontend consequences follow directly from this backend change:**

1. **The socket connection must carry the access token at connect time**, the same way REST calls carry it via the `Authorization` header:

   ```ts
   // lib/socket-client.ts
   const socket = io(SOCKET_URL, {
     withCredentials: true,
     auth: { token: useAuthStore.getState().accessToken },
   });
   ```

   If there's no access token yet when the socket module first loads (e.g. app boot hasn't resolved `/auth/me` — §4.3), delay the initial `socket.connect()` call until `useAuthStore`'s `status` reaches `'authenticated'`, rather than connecting with `auth: { token: null }` and expecting a retry — the handshake middleware rejects a missing/invalid token outright (`"Authentication required."` / `"Invalid authentication token."` / `"Session expired."`), and Socket.io does not automatically retry a failed handshake with fresh auth data on its own.

2. **The personal notification room (`user_<id>`) is now joined automatically server-side** the instant the handshake succeeds. Drop any client-side `socket.emit('register_user', ...)` call entirely — it's a no-op on the backend now and there's nothing for the frontend to do here beyond connecting with a valid token in the first place.

3. **This access token *does* need to be kept in sync with the Axios interceptor's silent refresh** — the original (initially incorrect, now correct-again) concern from earlier in this conversation applies here after all, precisely because the backend now performs real handshake auth. Whenever `useAuthStore`'s `setAccessToken` runs (called both on login and by the refresh interceptor in §4.2), push the new token to the socket and force a clean re-handshake:

   ```ts
   // store/auth.store.ts (sketch, inside setAccessToken)
   setAccessToken: (token) => {
     set({ accessToken: token });
     socket.auth = { token };
     if (socket.connected) socket.disconnect().connect(); // forces a fresh handshake with the new token
   },
   ```

   A disconnect-and-reconnect here is intentional, not a shortcut — see point 4.

4. **Reconnects (including this deliberate one) still need every room re-joined**, and this part of the earlier guidance was correct and still applies: Socket.io reconnects produce a brand-new `connection` event server-side with zero room memberships beyond the now-automatic personal room. `register_following_rooms`, `join_conversation`, and `join_post_room` still don't persist across a reconnect — only `user_<id>` does, because that join now lives inside the `connection` handler itself and re-derives from the handshake every time. Keep the "re-run on every `connect` event" pattern for everything *except* the personal room:

   ```ts
   // lib/socket-client.ts (cont.)
   function registerFollowingRooms() {
     const followingIds = /* read from the social/follow feature's existing cache */ [];
     socket.emit('register_following_rooms', followingIds);
   }
   socket.on('connect', registerFollowingRooms); // fires on first connect AND every reconnect
   ```

   Per-screen rooms (`join_conversation`, `join_post_room`) still belong in their owning feature's socket-sync hook (e.g. `useConversationSocketSync`), which itself needs a `'connect'` listener alongside its mount-time join so a mid-session reconnect while that screen is open re-issues the join — this guidance is unchanged from before.

5. **Handshake rejection needs explicit handling.** A failed `io.use()` middleware surfaces to the client as a `connect_error` event with the message string the backend passed to `next(new Error(...))`. Listen for it and route the known messages the same way §4.4 routes their REST equivalents:

   ```ts
   socket.on('connect_error', (err) => {
     if (['This account has been banned. Access denied.', 'This account is currently suspended.'].includes(err.message)) {
       useAuthStore.getState().clear(); // hard logout, same treatment as §4.4
     }
     // "Session expired." / "Invalid authentication token." — don't hard-logout here;
     // the Axios interceptor's refresh flow (§4.2) is the source of truth for token
     // renewal, and typically fires from a REST call around the same time. Let it
     // handle the refresh-and-retry; the socket will pick up the new token via
     // setAccessToken's forced reconnect (point 3) once that resolves.
   });
   ```

---

## 5. State Management — Zustand Auth Store

```ts
// store/auth.store.ts
interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';
  setSession: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (token: string) => void; // used by the refresh interceptor
  clear: () => void;
}
```

- **`accessToken` lives here, in memory, never persisted** (no `persist` middleware for this field — see §1).
- `user` *can* be persisted (e.g. via Zustand's `persist` to sessionStorage, not localStorage, and only the non-sensitive profile fields) purely to avoid a UI flash on reload, **but treat it as untrusted display-only cache** — always reconcile against a fresh `/auth/me` call on boot (§4.3) rather than trusting persisted `user` as proof of an active session. The actual session validity is only ever proven by a successful `/me` or `/refresh-token` call.
- This store is what every other feature's Axios calls and Socket.io connection depend on (`Authorization` header sourced from `accessToken` here; the socket's auth handshake — referenced in other features' specs — also reads the current access token from this store). Build this first.

---

## 6. Route Guarding

```tsx
// components/auth/RequireAuth.tsx
function RequireAuth({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === 'idle' || status === 'authenticating') return <FullScreenSpinner />;
  if (status === 'unauthenticated') return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}
```

- Wrap every protected route tree (i.e. everything except `/login`, `/register`, `/forgot-password`, `/reset-password/:token`, `/verify-email/:token`) in this guard, driven purely by the Zustand `status`, which itself is only ever set by real server responses (§4.3, §4.4) — never derive `status` from "a token exists in memory" alone without having actually validated it.
- On successful login, redirect back to `location.state.from` if present, else a default landing route.
- Role-gated sub-trees (admin panels referenced in other features' specs) layer a second check on `user.role` on top of this, exactly as noted in those specs — `RequireAuth` only proves "logged in," not "authorized for this role."

### 6.1 Email verification — gate or nudge?

`isVerified` is present on `AuthUser` but **no backend route in this file blocks access based on it** — `protect` only checks `status` (banned/suspended), not `isVerified`. So: **do not build a hard route-block for unverified users** unless another feature's backend explicitly requires it (none shown here do). Instead, surface a persistent-but-dismissible banner ("Verify your email — resend link") when `user.isVerified === false`, wired to `useResendVerification()`. This is a UX nudge, not a security gate, per the backend as given — don't over-build this into a wall the backend doesn't enforce.

---

## 7. Forms (React Hook Form + Zod) — Mirror the Backend Exactly

The backend's password/email/username rules are unusually specific — replicate them **verbatim**, not approximately, so client-side errors always agree with server-side ones.

```ts
// schemas/auth.schema.ts
import { z } from 'zod';

export const passwordRules = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const emailRules = z
  .string()
  .min(1, 'Email is required')
  .email('Please provide a valid email address')
  .max(254, 'Email cannot exceed 254 characters')
  .transform((val) => val.toLowerCase().trim());

export const usernameRules = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username cannot exceed 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
  .transform((val) => val.toLowerCase().trim());

export const registerSchema = z.object({
  username: usernameRules,
  email: emailRules,
  password: passwordRules,
});
export type RegisterFormValues = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailRules,
  password: z.string().min(1, 'Password is required'), // note: NO complexity check on login — only on register/reset
});
export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email: emailRules });

export const resetPasswordSchema = z
  .object({
    password: passwordRules,
    passwordConfirm: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  });
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const resendVerificationSchema = z.object({ email: emailRules });
```

**Important asymmetry to preserve:** `loginSchema.password` is only `min(1)` — the full `passwordRules` complexity check is deliberately **not** applied at login (a user's existing password may predate a rules change, or simply shouldn't be re-validated client-side at the login step — the backend agrees: `loginSchema` in `auth.validator.js` uses a bare `z.string().min(1, ...)` too). Don't "fix" this by applying `passwordRules` to the login form — that would reject valid existing credentials that happen to predate stricter rules, and would diverge from the backend's own validator.

A UI nicety worth building given the multi-regex password rules: a live checklist next to the password field on register/reset showing each rule (8+ chars, uppercase, lowercase, number, special char) ticking green as satisfied — Zod's `.regex()` chain gives you exactly the granularity to drive this by running each sub-check independently in the form's `watch()`, not by parsing Zod's aggregated error array.

---

## 8. Screen-by-Screen Notes

### 8.1 Register (`/register`)
- On success (201), the backend does **not** log the user in — it returns the created user but no tokens (`register` never calls `issueTokens`). Redirect to a "check your email to verify" screen or straight to `/login` with a success toast — **do not** attempt to auto-authenticate after register; there's no token in the response to do so with.

### 8.2 Login (`/login`)
- On success, response body has `{ user, accessToken, refreshToken }`. Call `useAuthStore.getState().setSession(user, accessToken)`; ignore the body's `refreshToken` value client-side (§1) — the cookie already has it.
- Handle the specific 403 messages for banned/suspended accounts distinctly from the generic 401 "Incorrect email or password" (§4.4's message-surfacing guidance applies here too, even on the initial login attempt, not just mid-session).

### 8.3 Forgot Password (`/forgot-password`) → Reset Password (`/reset-password/:token`)
- Forgot-password form always shows the generic success message on 200 (§3.1).
- The reset-password screen reads `:token` from the URL (react-router param), never from a form field — pass it straight to `useResetPassword()` as a path param, with `password`/`passwordConfirm` as the only form inputs.
- On success, the backend revokes **every** existing refresh token for that user (`RefreshToken.deleteMany`) — meaning even the browser tab that just performed the reset has a now-dead session if it was logged in elsewhere. Don't auto-login after reset; redirect to `/login` with a "Password reset — please log in again" message, matching the backend's own response message.
- On invalid/expired token (400), show that inline on the reset form, with a link back to `/forgot-password` to request a new one.

### 8.4 Email Verification (`/verify-email/:token`)
- A route that, on mount, immediately fires `useVerifyEmail()` with the URL's `:token` — no form, just a landing page with a loading state → success/error state. On success, if the user happens to already be logged in (e.g. they verified from the same browser), you may optimistically flip `user.isVerified` in the Zustand store to dismiss the nudge banner (§6.1) without waiting for a full re-fetch; otherwise just show a "verified — you can log in now" confirmation with a link to `/login`.
- On invalid/expired token (400), offer a way to trigger `useResendVerification()` — but that endpoint needs an *email*, not the token, so this means prompting for the email address here (the failed verification link doesn't tell you whose it was).

### 8.5 Logout
- `useLogout()` should read the current refresh token situation the same way login relies on the cookie — actually, since the cookie is httpOnly, the frontend **cannot read it to put in the request body**. Rely on the cookie being sent automatically (`withCredentials: true`) for the `/logout` call; don't try to extract a refresh token value from JS to include in the body (you structurally can't, and don't need to — the backend already accepts the cookie alone: `req.body.refreshToken || req.cookies?.refreshToken`).
- On success (or even on network failure — logout should be resilient), clear the Zustand auth store and redirect to `/login`. Don't block the client-side logout UX on the server call succeeding; clear local state immediately and fire the request, since a user's intent to log out locally shouldn't hinge on network conditions.

---

## 9. Business Rules Summary (mirrored from backend)

1. Access token: JWT, memory-only, sent via `Authorization: Bearer`. Refresh token: opaque, httpOnly cookie (`path: /api/auth`), 7-day TTL, rotated (old deleted, new issued) on every refresh.
2. `forgotPassword` / `resendVerification` are enumeration-safe — always 200, generic message, regardless of whether the account exists/is already verified.
3. `login`, `forgotPassword`, `resendVerification` are rate-limited — expect and gracefully handle 429.
4. Banned/suspended accounts are rejected at login (403, specific message), at `protect` on every subsequent request (403), and at token refresh (403) — treat any of these as an immediate hard logout with the server's specific message shown.
5. Registration does not auto-login (no tokens returned) — separate step by design.
6. Password reset revokes **all** sessions for that user, not just the current one.
7. `isVerified` is not currently a route-level access gate anywhere in this backend — treat it as a UX nudge only, not a wall.
8. Login's password field has no client-side complexity validation (matches backend); register/reset both do, with the exact 5-rule regex set in §7.
9. Never store either token in `localStorage`/`sessionStorage`. Access token in memory (Zustand, non-persisted); refresh token is invisible to JS by design (httpOnly cookie) — don't work around that.

---

## 10. State Management Split

| Concern | Owner |
|---|---|
| `accessToken`, `user`, auth `status` | **Zustand** (`useAuthStore`), in-memory; `user` may be lightly persisted for flash-avoidance only, per §5 |
| `/auth/me` boot-check | **TanStack Query**, feeding the Zustand store on settle (§4.3) |
| Register/login/forgot/reset/verify/resend mutations | **TanStack Query** `useMutation`s, each updating the Zustand store on success where relevant |
| Refresh-token orchestration | **Axios response interceptor**, not a component-level hook or a Query/Zustand concern (§4.2) |
| Route protection | A `RequireAuth` component reading Zustand `status`, not a Query hook re-checked per-route |

---

## 11. Suggested File Structure

```
src/
  types/
    user.ts
  schemas/
    auth.schema.ts
  lib/
    api-client.ts             # withCredentials: true, request/response interceptors
  api/
    auth.api.ts                # thin axios wrappers per endpoint
  store/
    auth.store.ts
  hooks/
    useRegister.ts
    useLogin.ts
    useLogout.ts
    useForgotPassword.ts
    useResetPassword.ts
    useVerifyEmail.ts
    useResendVerification.ts
    useAuthBootstrap.ts        # the /auth/me boot-time query from §4.3
  components/
    auth/
      RequireAuth.tsx
      PasswordRulesChecklist.tsx  # live-validated checklist, §7
      VerificationBanner.tsx      # dismissible nudge, §6.1
  routes/
    auth/
      LoginPage.tsx
      RegisterPage.tsx
      ForgotPasswordPage.tsx
      ResetPasswordPage.tsx      # reads :token param
      VerifyEmailPage.tsx        # reads :token param, auto-fires on mount
```

---

## 12. Implementation Order (recommended)

1. `types/user.ts`, `schemas/auth.schema.ts`, `store/auth.store.ts` (§2, §5, §7) — the shared foundation.
2. `lib/api-client.ts` with `withCredentials: true` and the request interceptor attaching `Authorization` from the Zustand store (write the refresh-retry interceptor in the same pass — it's small and everything after this depends on 401s being handled correctly, §4.2).
3. `useLogin` + `LoginPage` + `RequireAuth` (§6, §8.2) — get one full authenticated round-trip working end-to-end before building anything else, since every other feature in this app depends on this loop being correct.
4. `useAuthBootstrap` wired at the app root (§4.3) — confirm reloading the page preserves the session via cookie + silent refresh, not just the initial login.
5. `useRegister` + `RegisterPage` (§8.1), `useLogout` (§8.5).
6. `useForgotPassword`/`useResetPassword` + their two pages (§8.3).
7. `useVerifyEmail`/`useResendVerification` + `VerifyEmailPage` + `VerificationBanner` (§8.4, §6.1).
8. Polish: password rules live-checklist (§7), 429 rate-limit messaging (§3.2), banned/suspended message surfacing (§4.4).

---

## 13. Open Items to Confirm Before/While Coding

- ~~Socket.io auth handshake~~ — **resolved, backend fixed.** `config/socket.js` now verifies the access-token JWT during the connection handshake (`io.use(...)`, mirroring `protect`) and derives `socket.userId` server-side instead of trusting a client-emitted `register_user(userId)`. The frontend must connect with `auth: { token }` and re-handshake (disconnect/reconnect) whenever the Axios interceptor rotates the access token — see §4.5, points 1–3.
- **Room re-registration on reconnect** — still required for everything except the now-automatic personal room: `register_following_rooms` and each feature's own `join_conversation`/`join_post_room` must re-fire on every `connect` event, not just the first (§4.5, point 4).
- **`register_following_rooms` data source**: confirm which existing hook/cache (presumably from a follow/social feature not covered by this spec) supplies the list of followed-account ids referenced in §4.5's `registerFollowingRooms()` sketch — don't build a new fetch for this from inside the auth/socket layer.
- **Socket URL / env var**: confirm the `SOCKET_URL` constant referenced in §4.5's `lib/socket-client.ts` sketch against whatever env var convention the rest of this frontend uses for the API base URL (likely a sibling of `VITE_API_URL` or similar) — not specified in the provided backend files.
- **Landing route after login**: confirm the default post-login redirect target (dashboard/feed/etc.) — not specified in the provided backend files.
- **CORS/cookie domain setup**: `withCredentials: true` requires the backend's CORS config to set a specific (non-wildcard) `Access-Control-Allow-Origin` and `Access-Control-Allow-Credentials: true` — confirm this is already configured in `app.js`/CORS middleware (not included in this file set) before assuming the cookie flow will work across the frontend's actual deployed origin.
