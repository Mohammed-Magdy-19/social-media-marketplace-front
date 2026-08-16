import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios"
import { useAuthStore } from "@/stores/authStore"
import { ApiError, type ApiErrorBody, type ApiResponse } from "@/types"
import { router } from "@/router"

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
    const refreshToken = useAuthStore.getState().refreshToken
    const res = await refreshClient.post<{
      status: string
      data: { accessToken: string; refreshToken?: string }
    }>("/auth/refresh-token", refreshToken ? { refreshToken } : {})
    const { accessToken, refreshToken: nextRefreshToken } = res.data.data
    useAuthStore
      .getState()
      .setSession(
        useAuthStore.getState().user,
        accessToken,
        nextRefreshToken ?? refreshToken
      )
    return accessToken
  })().finally(() => {
    refreshPromise = null
  })
  return refreshPromise
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retried?: boolean })
      | undefined
    const isRefreshCall = original?.url?.includes("/auth/refresh-token")
    const wasAuthenticated = !!original?.headers?.Authorization
    if (
      error.response?.status === 401 &&
      original &&
      !original._retried &&
      !isRefreshCall &&
      wasAuthenticated
    ) {
      original._retried = true
      try {
        const token = await refreshAccessToken()
        original.headers.Authorization = `Bearer ${token}`
        return await api(original)
      } catch {
        useAuthStore.getState().logout()
        void router.navigate("/login", { replace: true })
        return Promise.reject(error)
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
): Promise<{ assets: { id: string; url: string; kind: "image" | "video" }[] }> {
  if (files.length > POST_MEDIA_MAX_FILES) {
    throw new ApiError(400, `Upload up to ${POST_MEDIA_MAX_FILES} files`)
  }
  if (files.some((f) => f.size > POST_MEDIA_MAX_BYTES)) {
    throw new ApiError(400, "Each file must be 10MB or smaller")
  }
  const form = new FormData()
  files.forEach((f) => form.append("images", f))
  const res = await uploadClient.post<
    ApiResponse<{ media: string[]; files: unknown[] }>
  >(`/uploads/posts/${postId}`, form, {
    signal,
    onUploadProgress: onUploadProgress(onProgress),
  })
  return {
    assets: res.data.data.media.map((url) => ({
      id: url,
      url,
      kind: "image",
    })),
  }
}
