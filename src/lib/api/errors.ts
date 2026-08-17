import type { FieldValues, Path, UseFormSetError } from "react-hook-form"
import { ApiError } from "@/types"

const GENERIC_MESSAGE = "Something went wrong. Please try again."
const NETWORK_MESSAGE =
  "Unable to reach the server. Please check your connection and try again."

/** Axios falls back to this text when the server omits an error body. */
function isRawAxiosMessage(message: string): boolean {
  return /request failed with status code/i.test(message)
}

/**
 * Maps any thrown value to a human-readable message. Prefers the server's own
 * wording when it is meaningful, otherwise falls back to a status-specific
 * message so users never see raw HTTP codes or stack traces.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const { status, message, fieldErrors } = error
    const serverMessage =
      message && !isRawAxiosMessage(message) ? message : undefined
    const firstFieldError = fieldErrors
      ? Object.values(fieldErrors)[0]
      : undefined

    switch (true) {
      case status === 0:
        return NETWORK_MESSAGE
      case status === 401:
        return (
          serverMessage ??
          "Your session has expired. Please sign in again."
        )
      case status === 403:
        return "You don't have permission to do this."
      case status === 404:
        return "The requested item could not be found."
      case status >= 500:
        return "Something went wrong on our servers. Please try again later."
      case status === 400 || status === 422:
        return (
          serverMessage ??
          firstFieldError ??
          "Invalid input. Please check your details and try again."
        )
      default:
        return serverMessage ?? firstFieldError ?? GENERIC_MESSAGE
    }
  }
  if (error instanceof Error && !isRawAxiosMessage(error.message)) {
    return error.message
  }
  return GENERIC_MESSAGE
}

/**
 * Attaches server-side field errors to a react-hook-form form. Falls back to a
 * root-level message when the error has no per-field details.
 * @returns `true` when per-field errors were attached to the form.
 */
export function applyFieldErrors<TFieldValues extends FieldValues>(
  setError: UseFormSetError<TFieldValues>,
  error: unknown,
  rootMessage?: string
): boolean {
  if (error instanceof ApiError && error.fieldErrors) {
    for (const [field, message] of Object.entries(error.fieldErrors)) {
      setError(field as Path<TFieldValues>, { type: "server", message })
    }
    return true
  }
  if (rootMessage) {
    setError("root" as Path<TFieldValues>, {
      type: "server",
      message: rootMessage,
    })
  }
  return false
}
