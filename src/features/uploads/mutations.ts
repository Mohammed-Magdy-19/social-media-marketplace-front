import { useMutation } from "@tanstack/react-query"
import { uploadAvatar, uploadPostMedia } from "@/lib/api/client"
import { useUploadProgressStore } from "@/stores/uploadProgressStore"
import { useAuthStore } from "@/stores/authStore"

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async (file: File) => {
      const id = `avatar:${crypto.randomUUID()}`
      useUploadProgressStore.getState().setProgress(id, 0)
      try {
        const res = await uploadAvatar(file, undefined, (percent) =>
          useUploadProgressStore.getState().setProgress(id, percent)
        )
        const user = useAuthStore.getState().user
        if (user) {
          useAuthStore.getState().setUser({ ...user, avatar: res.url })
        }
        return res
      } finally {
        useUploadProgressStore.getState().remove(id)
      }
    },
  })
}

export function useUploadPostMedia(postId: string) {
  return useMutation({
    mutationFn: async (files: File[]) => {
      const id = `media:${crypto.randomUUID()}`
      useUploadProgressStore.getState().setProgress(id, 0)
      try {
        return await uploadPostMedia(postId, files, undefined, (percent) =>
          useUploadProgressStore.getState().setProgress(id, percent)
        )
      } finally {
        useUploadProgressStore.getState().remove(id)
      }
    },
  })
}
