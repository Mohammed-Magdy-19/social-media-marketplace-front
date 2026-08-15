import { useMutation, useQueryClient } from "@tanstack/react-query"
import { apiDelete, apiPost } from "@/lib/api/client"
import {
  restorePostsInCache,
  snapshotPostsInCache,
  updatePostInCache,
} from "./postCache"
import { queryKeys } from "@/api/queryKeys"
import type { ApiResponse, Post } from "@/types"

export function useToggleLike() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, isLiked }: { postId: string; isLiked: boolean }) =>
      isLiked
        ? apiDelete<ApiResponse<{ ok: true }>>(`/posts/${postId}/like`)
        : apiPost<ApiResponse<{ ok: true }>>(`/posts/${postId}/like`),
    onMutate: async ({ postId, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.all })
      await queryClient.cancelQueries({ queryKey: queryKeys.users.feed() })
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.feed() })
    },
  })
}

export function useSavePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, isSaved }: { postId: string; isSaved: boolean }) =>
      isSaved
        ? apiDelete<ApiResponse<{ ok: true }>>(`/posts/${postId}/save`)
        : apiPost<ApiResponse<{ ok: true }>>(`/posts/${postId}/save`),
    onMutate: async ({ postId, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.posts.all })
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
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.users.savedPosts(),
      })
    },
  })
}

export function useCreateComment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ postId, text }: { postId: string; text: string }) =>
      apiPost<ApiResponse<{ comment: Post }>>(`/posts/${postId}/comments`, {
        text,
      }),
    onSettled: (_data, _error, vars) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.posts.comments(vars.postId),
      })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.posts.detail(vars.postId),
      })
    },
  })
}

export function useCreateReply() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, text }: { commentId: string; text: string }) =>
      apiPost<ApiResponse<{ comment: Post }>>(`/comments/${commentId}/replies`, {
        text,
      }),
    onSettled: (_data, _error, vars) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.comments.detail(vars.commentId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
    },
  })
}

export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { caption: string; categoryId: string; tags: string[] }) =>
      apiPost<ApiResponse<{ post: Post }>>("/posts", input),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.feed() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.categories.all() })
    },
  })
}
