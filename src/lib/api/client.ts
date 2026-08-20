import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios"
import { useAuthStore } from "@/stores/authStore"
import { ApiError, type ApiErrorBody, type ApiResponse } from "@/types"
import { router } from "@/router"
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  setStoredRefreshToken,
} from "@/lib/refresh-storage"

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api"

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiErrorBody | undefined
    return new ApiError(
      error.response?.status ?? 0,
      data?.message ?? "",
      data?.fieldErrors
    )
  }
  return new ApiError(0, error instanceof Error ? error.message : "")
}

function attachToken(config: InternalAxiosRequestConfig) {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

api.interceptors.request.use(attachToken)

let refreshPromise: Promise<string> | null = null

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const stored = getStoredRefreshToken()
      const body = stored ? { refreshToken: stored } : {}
      const res = await refreshClient.post<{
        status: string
        data: { accessToken: string; refreshToken?: string }
      }>("/auth/refresh-token", body)
      const { accessToken, refreshToken } = res.data.data
      // The backend rotates the refresh token on every refresh and returns the
      // new one in the body; mirror it so the localStorage fallback stays in
      // sync with the cookie lifecycle (§refresh-storage).
      if (refreshToken) setStoredRefreshToken(refreshToken)
      useAuthStore.getState().setAccessToken(accessToken)
      return accessToken
    } catch (error) {
      // The stored copy is stale/invalidated — stop trying to restore with it.
      clearStoredRefreshToken()
      throw error
    }
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

const HARD_LOGOUT_MESSAGES = [
  "This account has been banned. Access denied.",
  "This account is currently suspended.",
  "This account no longer has access.",
]

function isHardLogoutError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  const message = (error.response?.data as { message?: string } | undefined)
    ?.message
  return (
    typeof message === "string" &&
    HARD_LOGOUT_MESSAGES.some((m) => message.includes(m))
  )
}

function hardLogout(message?: string) {
  useAuthStore.getState().clear()
  if (message) useAuthStore.getState().setNotice(message)
  void router.navigate("/login", { replace: true })
}

function normalizeIds(obj: unknown): unknown {
  if (!obj || typeof obj !== "object") return obj
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      normalizeIds(obj[i])
    }
    return obj
  }
  const record = obj as Record<string, unknown>
  if (record._id && !record.id) {
    record.id = String(record._id)
  }
  for (const key of Object.keys(record)) {
    if (record[key] && typeof record[key] === "object") {
      normalizeIds(record[key])
    }
  }
  return record
}

api.interceptors.response.use(
  (response) => {
    if (response.data) {
      normalizeIds(response.data)
    }
    return response
  },
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined
    const status = error.response?.status

    if (status === 403 && isHardLogoutError(error)) {
      hardLogout(
        (error.response?.data as { message?: string } | undefined)?.message
      )
      return Promise.reject(toApiError(error))
    }

    // Never retry `/auth/*` requests themselves on a 401 — a wrong-password
    // login response (401) must not trigger a refresh-and-retry, and the
    // boot-time restore handles `/auth/me` explicitly (§4.2).
    const isAuthRequest = original?.url?.includes("/auth/")
    const wasAuthenticated = !!original?.headers?.Authorization
    if (
      status === 401 &&
      original &&
      !original._retried &&
      !isAuthRequest &&
      wasAuthenticated
    ) {
      original._retried = true
      try {
        const token = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${token}`
        return await api(original)
      } catch (refreshError) {
        hardLogout(
          isHardLogoutError(refreshError)
            ? (
                (refreshError as AxiosError).response?.data as
                  | { message?: string }
                  | undefined
              )?.message
            : undefined
        )
        return Promise.reject(toApiError(refreshError))
      }
    }
    return Promise.reject(toApiError(error))
  }
)

export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.get<T>(url, config)
  return res.data
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.post<T>(url, body, config)
  return res.data
}

export async function apiPatch<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.patch<T>(url, body, config)
  return res.data
}

export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig
): Promise<T> {
  const res = await api.delete<T>(url, config)
  return res.data
}

/* ---------------- Upload transport ---------------- */

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const POST_MEDIA_MAX_FILES = 10
export const POST_MEDIA_MAX_BYTES = 10 * 1024 * 1024
/** Multer on the backend accepts at most 5 images per request. */
export const POST_MEDIA_UPLOAD_BATCH = 5

/**
 * Upload transport. The `Content-Type` header is intentionally left unset for
 * multipart requests: browsers must generate the boundary themselves, so a
 * hand-set `multipart/form-data` header would break request parsing (400s).
 */
export const uploadClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

uploadClient.interceptors.request.use(attachToken)

type ProgressCallback = (percent: number) => void

function onUploadProgress(
  callback?: ProgressCallback
): AxiosRequestConfig["onUploadProgress"] {
  return (event) => {
    if (!callback || !event.total) return
    callback(Math.round((event.loaded / event.total) * 100))
  }
}

export async function uploadAvatar(
  file: File,
  signal?: AbortSignal,
  onProgress?: ProgressCallback
): Promise<{ url: string }> {
  if (file.size > AVATAR_MAX_BYTES) {
    throw new ApiError(400, "Avatar must be 2MB or smaller")
  }
  const form = new FormData()
  form.append("avatar", file)
  const res = await uploadClient.post<
    ApiResponse<{ avatar: string; file: unknown }>
  >("/uploads/avatar", form, {
    signal,
    onUploadProgress: onUploadProgress(onProgress),
  })
  return { url: res.data.data.avatar }
}

export async function uploadPostMedia(
  postId: string,
  files: File[],
  signal?: AbortSignal,
  onProgress?: ProgressCallback
): Promise<{ media: string[] }> {
  if (files.length > POST_MEDIA_MAX_FILES) {
    throw new ApiError(400, `Upload up to ${POST_MEDIA_MAX_FILES} files`)
  }
  if (files.some((f) => f.size > POST_MEDIA_MAX_BYTES)) {
    throw new ApiError(400, "Each file must be 10MB or smaller")
  }
  const media: string[] = []
  for (let i = 0; i < files.length; i += POST_MEDIA_UPLOAD_BATCH) {
    const batch = files.slice(i, i + POST_MEDIA_UPLOAD_BATCH)
    const form = new FormData()
    batch.forEach((f) => form.append("images", f))
    const res = await uploadClient.post<
      ApiResponse<{ media: string[]; files: unknown[] }>
    >(`/uploads/posts/${postId}`, form, {
      signal,
      onUploadProgress: onUploadProgress(
        onProgress
          ? (percent) =>
              onProgress(
                Math.round(
                  ((i + percent / 100) / files.length) * 100
                )
              )
          : undefined
      ),
    })
    media.push(...res.data.data.media)
  }
  return { media }
}
