import { create } from "zustand"

interface UploadProgressState {
  /** client-generated upload id -> percentage 0-100 */
  uploads: Record<string, number>
  setProgress: (uploadId: string, percent: number) => void
  remove: (uploadId: string) => void
}

export const useUploadProgressStore = create<UploadProgressState>()((set) => ({
  uploads: {},
  setProgress: (uploadId, percent) =>
    set((state) => ({ uploads: { ...state.uploads, [uploadId]: percent } })),
  remove: (uploadId) =>
    set((state) => {
      const next = { ...state.uploads }
      delete next[uploadId]
      return { uploads: next }
    }),
}))
