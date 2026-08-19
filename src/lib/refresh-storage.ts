/**
 * Fallback transport for the refresh token.
 *
 * The backend sets the refresh token as an httpOnly, `SameSite=Strict`
 * cookie — which is the preferred transport on a top-level origin. However,
 * when the app runs inside a cross-site iframe (the platform's preview
 * embed), the browser refuses to store those cookies, so a page refresh
 * silently loses the session and bounces to /login.
 *
 * The backend explicitly supports a non-cookie client path: it returns the
 * refresh token in every login/refresh JSON body and accepts it in the
 * request body (`req.body.refreshToken || req.cookies?.refreshToken`).
 * This module mirrors the cookie lifecycle in localStorage so boot-time and
 * mid-session refreshes can keep working through the body transport.
 *
 * Only the refresh token lives here (the access token stays in-memory in
 * Zustand per spec §1); the value is treated as an untrusted marker too —
 * presence just means "a session may exist, attempt a silent restore".
 */
const REFRESH_TOKEN_KEY = "smm.refreshToken"

export function getStoredRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setStoredRefreshToken(token: string): void {
  try {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token)
  } catch {
    // Storage unavailable — the cookie transport still covers top-level use.
  }
}

export function clearStoredRefreshToken(): void {
  try {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // noop
  }
}
