import { io, type Socket } from "socket.io-client"

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? undefined

/**
 * Single shared socket singleton. Components must never call `io()`
 * directly — access via `useSocket()`.
 */
export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
})

export function useSocket(): Socket {
  return socket
}
