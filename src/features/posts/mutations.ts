import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiPost } from "@/lib/api/client"
import {
  restorePostsInCache,
  snapshotPostsInCache,
  updatePostInCache,
} from "./postCache"
import type { Post } from "@/types"

export function useToggleLike() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, isLiked }: { postId: string; isLiked: boolean }) =>
      isLiked
        ? apiDelete<{ ok: true }>(`/posts/${postId}/like`)
        : apiPost<{ ok: true }>(`/posts/${postId}/like`),
    onMutate: async ({ postId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] })
      await queryClient.cancelQueries({ queryKey: ["users", "me", "feed"] })
      const snapshot = snapshotPostsInCache(queryClient)
      updatePostInCache(queryClient, postId, (post) => ({
        ...post,
        isLiked: !isLiked,
        likeCount: Math.max(0, post.likeCount + (isLiked ? -1 : 1)),
      }))
      return snapshot
    },
    onError: (_error, _vars, snapshot) => {
      if (snapshot) restorePostsInCache(queryClient, snapshot)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] })
      void queryClient.invalidateQueries({ queryKey: ["users", "me", "feed"] })
    },
  })
}

export function useSavePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, isSaved }: { postId: string; isSaved: boolean }) =>
      isSaved
        ? apiDelete<{ ok: true }>(`/posts/${postId}/save`)
        : apiPost<{ ok: true }>(`/posts/${postId}/save`),
    onMutate: async ({ postId, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] })
      const snapshot = snapshotPostsInCache(queryClient)
      updatePostInCache(queryClient, postId, (post) => ({
        ...post,
        isSaved: !isSaved,
        saveCount: Math.max(0, post.saveCount + (isSaved ? -1 : 1)),
      }))
      return snapshot
    },
    onError: (_error, _vars, snapshot) => {
      if (snapshot) restorePostsInCache(queryClient, snapshot)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] })
      void queryClient.invalidateQueries({ queryKey: ["users", "me", "saved-posts"] })
    },
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, body }: { postId: string; body: string }) =>
      apiPost<{ ok: true }>(`/posts/${postId}/comments`, { body }),
    onSettled: (_data, _error, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "detail", vars.postId] })
    },
  })
}

export function useCreateReply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      commentId,
      body,
    }: {
      commentId: string
      body: string
    }) => apiPost<{ ok: true }>(`/comments/${commentId}/replies`, { body }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts", "detail"] })
    },
  })
}

export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { caption: string; categoryId: string; tags: string[] }) =>
      apiPost<Post>("/posts", input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["posts"] })
      void queryClient.invalidateQueries({ queryKey: ["users", "me", "feed"] })
      void queryClient.invalidateQueries({ queryKey: ["categories"] })
    },
  })
}
