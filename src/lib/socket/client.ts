import { io, type Socket } from "socket.io-client"

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? undefined

/**
 * Single shared socket singleton. Components must never call `io()`
 * directly — access via `useSocket()`.
 *
 * The access token is attached at connect time via `auth` (the backend
 * handshake middleware verifies it); `useSocketLifecycle` sets
 * `socket.auth = { token }` right before the initial `connect()`, and
 * `useAuthStore.setAccessToken` pushes rotated tokens + forces a clean
 * re-handshake. Never connect before the session resolves.
 */
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  transports: ["websocket", "polling"],
  auth: { token: null },
})

export function useSocket(): Socket {
  return socket
}
