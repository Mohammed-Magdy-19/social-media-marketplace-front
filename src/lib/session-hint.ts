/**
 * Read-only hint cookie the backend sets (non-httpOnly, `path: "/"`)
 * alongside the real `refreshToken` cookie, mirroring its set/clear
 * lifecycle. It lets the frontend cheaply know whether a silent session
 * restore is worth attempting on boot, without exposing the actual refresh
 * token. It is never written by the frontend and never trusted as a
 * credential — at worst a stale value causes one wasted request.
 */
export function hasSessionHint(): boolean {
  return document.cookie.split("; ").some((c) => c === "hasSession=1")
}
