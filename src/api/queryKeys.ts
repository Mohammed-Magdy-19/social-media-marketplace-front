/**
 * Single source of truth for every TanStack Query cache key (handbook §3).
 * All `useQuery` / `useMutation` hooks MUST pull their keys from here —
 * inline string arrays are forbidden.
 *
 * The keys below mirror the handbook factory exactly (including optional
 * `page`/`cursor`/`filters` tail segments) plus the admin/uploads/reports
 * extensions this frontend actually queries.
 */

export const queryKeys = {
    auth: {
        me: () => ["auth", "me"] as const,
    },
    users: {
        all: ["users"] as const,
        list: (filters?: object) => ["users", "list", filters] as const,
        detail: (id: string) => ["users", "detail", id] as const,
        posts: (userId: string, filters?: object) =>
            ["users", userId, "posts", filters] as const,
        followers: (id: string, page?: number) =>
            ["users", id, "followers", page] as const,
        following: (id: string, page?: number) =>
            ["users", id, "following", page] as const,
        savedPosts: (page?: number) => ["users", "me", "saved-posts", page] as const,
        feed: (page?: number) => ["users", "me", "feed", page] as const,
    },
    posts: {
        all: ["posts"] as const,
        list: (filters?: object) => ["posts", "list", filters] as const,
        detail: (id: string) => ["posts", "detail", id] as const,
        likes: (id: string, page?: number) => ["posts", id, "likes", page] as const,
        comments: (postId: string) => ["posts", postId, "comments"] as const,
    },
    comments: {
        detail: (id: string) => ["comments", id] as const,
    },
    categories: {
        all: () => ["categories"] as const,
        detail: (id: string) => ["categories", id] as const,
    },
    conversations: {
        all: () => ["conversations"] as const,
        detail: (id: string) => ["conversations", id] as const,
        messages: (conversationId: string, cursor?: string) =>
            ["conversations", conversationId, "messages", cursor] as const,
    },
    notifications: {
        all: (page?: number) => ["notifications", "list", page] as const,
        unreadCount: () => ["notifications", "unread-count"] as const,
    },
    payments: {
        my: (page?: number) => ["payments", "me", page] as const,
        detail: (id: string) => ["payments", id] as const,
    },
    uploads: {
        all: (filters?: object) => ["uploads", filters] as const,
    },
    reports: {
        all: (filters?: object) => ["reports", filters] as const,
    },
    admin: {
        users: (filters?: object) => ["admin", "users", filters] as const,
        dashboard: () => ["admin", "dashboard"] as const,
        auditLogs: (filters?: object) => ["admin", "audit-logs", filters] as const,
        reports: (filters?: object) => ["admin", "reports", filters] as const,
        posts: (filters?: object) => ["admin", "posts", filters] as const,
        payments: (filters?: object) => ["admin", "payments", filters] as const,
        conversations: () => ["admin", "conversations"] as const,
        uploads: (filters?: object) => ["admin", "uploads", filters] as const,
    },
}
