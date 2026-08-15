# 🚀 Frontend Integration & API Specification Handbook

> **Target Frontend Stack**: React 19 (TS) · Tailwind CSS v4.3 · shadcn/ui · React Hook Form + Zod · Zustand · TanStack Query v5 · Axios · react-router-dom v6/7 · Socket.io Client · `@tanstack/react-virtual`  
> **Environment Base URL Configuration Variable**: `import.meta.env.VITE_API_BASE_URL`

---

## 📑 Table of Contents
1. [TypeScript Interfaces & DTO Models](#1-typescript-interfaces--dto-models)
2. [Axios Interceptor & Zustand Auth Setup (`client.ts`)](#2-axios-interceptor--zustand-auth-setup-clientts)
3. [TanStack Query Keys Factory (`queryKeys.ts`)](#3-tanstack-query-keys-factory-querykeysts)
4. [Socket.io Real-Time Event Protocol Specs](#4-socketio-real-time-event-protocol-specs)
5. [Exhaustive Backend Endpoint Reference](#5-exhaustive-backend-endpoint-reference)
   - [Authentication (`/api/auth`)](#51-authentication-apiauth)
   - [Users & Profiles (`/api/users`)](#52-users--profiles-apiusers)
   - [Posts & Feed (`/api/posts`)](#53-posts--feed-apiposts)
   - [Comments & Replies (`/api/comments`)](#54-comments--replies-apicomments)
   - [Categories (`/api/categories`)](#55-categories-apicategories)
   - [Conversations & Messages (`/api/conversations`)](#56-conversations--messages-apiconversations)
   - [Notifications (`/api/notifications`)](#57-notifications-apinotifications)
   - [Payments & Ledger (`/api/payments`)](#58-payments--ledger-apipayments)
   - [Uploads & Media (`/api/uploads`)](#59-uploads--media-apiuploads)
   - [Content Moderation Reports (`/api/reports`)](#510-content-moderation-reports-apireports)
   - [Admin Management (`/api/admin`)](#511-admin-management-apiadmin)
   - [Health Check (`/health`)](#512-health-check-health)
6. [🤖 Strict AI Audit Prompt for Frontend Route Verification](#6-strict-ai-audit-prompt-for-frontend-route-verification)

---

## 1. 📘 TypeScript Interfaces & DTO Models

Place these types in `src/types/api.ts` to maintain strict compatibility with MongoDB models and Zod schemas.

```typescript
// ==========================================
// Enums & Literal Unions
// ==========================================

export type UserRole = 'user' | 'moderator' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'banned';
export type PostSortOption = 'newest' | 'oldest' | 'most_liked' | 'most_commented';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type ReportTargetType = 'post' | 'comment' | 'user';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'resolved';
export type NotificationType = 'FOLLOW' | 'LIKE' | 'COMMENT' | 'MESSAGE' | 'SYSTEM';

// ==========================================
// Core Entities
// ==========================================

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  avatar: string;
  bio: string;
  isVerified: boolean;
  followerCount?: number;
  followingCount?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  media: string[];
  category: Category | string;
  tags: string[];
  author: User | string;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isSaved?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Comment {
  id: string;
  post: string;
  author: User | string;
  text: string; // NOTE: Field name is 'text' (max 2000 chars)
  parentComment?: Comment | string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface Conversation {
  id: string;
  participants: (User | string)[];
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversation: string;
  sender: User | string;
  content: string;
  readBy: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  recipient: string;
  sender?: User;
  type: NotificationType;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Payment {
  id: string;
  buyer: User | string;
  seller?: User | string;
  post?: Post | string;
  amount: number; // In cents (smallest currency unit)
  currency: string;
  provider: string;
  status: PaymentStatus;
  transactionId: string;
  createdAt: string;
}

export interface Report {
  id: string;
  reporter: User | string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
  adminNotes?: string;
  createdAt: string;
}

export interface File {
  id: string;
  url: string;
  publicId: string;
  mimeType: string;
  fileSize: number;
  owner: User | string;
  resourceType: 'image' | 'video' | 'raw' | 'auto';
  associatedPost?: string | null;
  associatedEntity: 'avatar' | 'post' | 'message' | 'other';
  createdAt: string;
}

// ==========================================
// Response Envelopes
// ==========================================

export interface ApiResponse<T> {
  status: 'success' | 'fail' | 'error';
  message?: string;
  data: T;
  results?: number;
}

export interface PaginatedResponse<T> {
  status: 'success';
  data: {
    [key: string]: T[] | number | boolean | object;
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiErrorResponse {
  status: 'fail' | 'error';
  message: string;
}
```

---

## 2. ⚡ Axios Interceptor & Zustand Auth Setup (`client.ts`)

### `src/store/useAuthStore.ts`
```typescript
import { create } from 'zustand';
import { User } from '../types/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),
  setAccessToken: (accessToken) => set({ accessToken }),
  logout: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),
}));
```

### `src/api/client.ts`
```typescript
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import { ApiResponse } from '../types/api';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Access Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Queue-based Auto-Refresh on 401
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiResponse<null>>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (
        originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/refresh-token')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (token: string) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(apiClient(originalRequest));
            },
            reject: (err) => reject(err),
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post<ApiResponse<{ accessToken: string }>>(
          `${import.meta.env.VITE_API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

---

## 3. 🔑 TanStack Query Keys Factory (`queryKeys.ts`)

```typescript
// src/api/queryKeys.ts

export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (filters?: object) => ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
    posts: (userId: string, filters?: object) => ['users', userId, 'posts', filters] as const,
    followers: (id: string, page?: number) => ['users', id, 'followers', page] as const,
    following: (id: string, page?: number) => ['users', id, 'following', page] as const,
    savedPosts: (page?: number) => ['users', 'me', 'saved-posts', page] as const,
    feed: (page?: number) => ['users', 'me', 'feed', page] as const,
  },
  posts: {
    all: ['posts'] as const,
    list: (filters?: object) => ['posts', 'list', filters] as const,
    detail: (id: string) => ['posts', 'detail', id] as const,
    likes: (id: string, page?: number) => ['posts', id, 'likes', page] as const,
    comments: (postId: string) => ['posts', postId, 'comments'] as const,
  },
  comments: {
    detail: (id: string) => ['comments', id] as const,
  },
  categories: {
    all: () => ['categories'] as const,
    detail: (id: string) => ['categories', id] as const,
  },
  conversations: {
    all: () => ['conversations'] as const,
    detail: (id: string) => ['conversations', id] as const,
    messages: (conversationId: string, cursor?: string) => ['conversations', conversationId, 'messages', cursor] as const,
  },
  notifications: {
    all: (page?: number) => ['notifications', 'list', page] as const,
    unreadCount: () => ['notifications', 'unread-count'] as const,
  },
  payments: {
    my: (page?: number) => ['payments', 'me', page] as const,
    detail: (id: string) => ['payments', id] as const,
  },
  admin: {
    users: (filters?: object) => ['admin', 'users', filters] as const,
    dashboard: () => ['admin', 'dashboard'] as const,
    auditLogs: (filters?: object) => ['admin', 'audit-logs', filters] as const,
    reports: (filters?: object) => ['admin', 'reports', filters] as const,
  },
};
```

---

## 4. 📡 Socket.io Real-Time Event Protocol Specs

Initialize socket client dynamically:

```typescript
import { io, Socket } from 'socket.io-client';

export const socket: Socket = io(import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_BASE_URL.replace(/\/api$/, ''), {
  autoConnect: false,
  withCredentials: true,
});
```

### Client Emission Protocol (Client ➔ Server)

| Event Name | Parameter Type | Description |
| --- | --- | --- |
| `register_user` | `userId: string` | Registers socket into `user_<userId>` room for personal alerts. |
| `join_post_room` | `postId: string` | Enters `post_<postId>` room for live post comments/likes. |
| `leave_post_room` | `postId: string` | Leaves `post_<postId>` room when component unmounts. |
| `register_following_rooms` | `followingIds: string[]` | Subscribes to `feed_<authorId>` rooms for instant feed alerts. |
| `join_conversation` | `conversationId: string` | Subscribes to `conversation_<conversationId>` chat room. |
| `typing_message` | `{ conversationId: string, userId: string }` | Broadcasts typing status to chat participants. |
| `stop_typing_message` | `{ conversationId: string, userId: string }` | Broadcasts typing stop. |
| `typing_comment` | `{ postId: string, userId: string }` | Broadcasts typing status to post view room. |
| `stop_typing_comment` | `{ postId: string, userId: string }` | Broadcasts comment typing stop. |

### Server Event Catalog (Server ➔ Client)

| Event Name | Payload Structure | Recommended Action |
| --- | --- | --- |
| `new_notification` | `Notification` object | Increment unread badge & trigger toast notification. |
| `new_comment` | `Comment` object | Prepend to comments query cache for the active post. |
| `comment_updated` | `Comment` object | Replace comment object in post comments cache. |
| `comment_deleted` | `{ commentId: string, replyIds: string[] }` | Remove main comment & associated reply IDs from cache. |
| `reply_created` | `Comment` object | Append reply under parent comment in UI tree. |
| `like_updated` | `{ postId: string, likesCount: number }` | Invalidate/update post like count state. |
| `feed_update_available` | `{ authorId: string, postId: string }` | Show top floating alert: *"New posts available. Click to refresh."* |
| `payment_updated` | `{ paymentId: string, status: PaymentStatus }` | Emitted to the buyer's `user_<buyerId>` room after a Stripe webhook confirms/fails a charge, or after an admin refund. Invalidate/refetch `usePaymentLedger` so the checkout/ledger UI reflects the real status without polling. |
| `typing_message` | `{ userId: string }` | Render typing indicator in active chat window. |
| `stop_typing_message` | `{ userId: string }` | Clear typing indicator in active chat window. |

---

## 5. Exhaustive Backend Endpoint Reference

### 5.1. Authentication (`/api/auth`)

#### `POST /api/auth/register`
- **Auth**: Public
- **Zod Form Validation**:
  ```typescript
  export const registerSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Alphanumeric and underscores only').transform(v => v.toLowerCase().trim()),
    email: z.string().min(1).email().max(254).transform(v => v.toLowerCase().trim()),
    password: z.string().min(8).max(128).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
  });
  ```
- **Response `201 Created`**:
  ```json
  {
    "status": "success",
    "message": "Account registered. Please check your email to verify your account."
  }
  ```

#### `POST /api/auth/login`
- **Auth**: Public (Rate-limited by IP)
- **Zod Form Validation**:
  ```typescript
  export const loginSchema = z.object({
    email: z.string().min(1).email().transform(v => v.toLowerCase().trim()),
    password: z.string().min(1, 'Password is required'),
  });
  ```
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "data": {
      "user": {
        "id": "64d3f7b2e1a4c80012a34567",
        "username": "john_doe",
        "email": "john@example.com",
        "role": "user",
        "status": "active",
        "avatar": "https://res.cloudinary.com/...",
        "bio": "",
        "isVerified": false,
        "createdAt": "2026-08-15T00:00:00.000Z"
      },
      "accessToken": "eyJhbGci...",
      "refreshToken": "4a9d7e..."
    }
  }
  ```

#### `POST /api/auth/refresh-token`
- **Auth**: Public (Reads `refreshToken` cookie or `req.body.refreshToken`)
- **Response `200 OK`**: `ApiResponse<{ accessToken: string }>`

#### `POST /api/auth/logout`
- **Auth**: Public / Protected
- **Request Body**: `{ "refreshToken": "string" }`
- **Response `200 OK`**: `{ "status": "success", "message": "Logged out successfully." }`

#### `POST /api/auth/forgot-password`
- **Auth**: Public
- **Request Body**: `{ "email": "john@example.com" }`
- **Response `200 OK`**: `{ "status": "success", "message": "If that email is registered..." }`

#### `POST /api/auth/reset-password/:token`
- **Auth**: Public
- **Path Params**: `token` (String)
- **Zod Form Validation**:
  ```typescript
  export const resetPasswordSchema = z.object({
    password: passwordRules,
    passwordConfirm: z.string().min(1),
  }).refine((data) => data.password === data.passwordConfirm, {
    message: 'Passwords do not match',
    path: ['passwordConfirm'],
  });
  ```
- **Response `200 OK`**: `{ "status": "success", "message": "Password reset successfully..." }`

#### `POST /api/auth/verify-email/:token`
- **Auth**: Public
- **Response `200 OK`**: `{ "status": "success", "message": "Email verified successfully." }`

#### `POST /api/auth/resend-verification`
- **Auth**: Public
- **Request Body**: `{ "email": "john@example.com" }`
- **Response `200 OK`**: `{ "status": "success", "message": "Verification link sent..." }`

#### `GET /api/auth/me`
- **Auth**: Protected
- **Response `200 OK`**: `ApiResponse<{ user: User }>`

---

### 5.2. Users & Profiles (`/api/users`)

#### `PATCH /api/users/me`
- **Auth**: Protected
- **Zod Form Validation**:
  ```typescript
  export const updateProfileSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
    bio: z.string().max(160).optional().or(z.literal('')),
    avatar: z.string().url().optional(),
  });
  ```
- **Response `200 OK`**: `ApiResponse<{ user: User }>`

#### `PATCH /api/users/me/password`
- **Auth**: Protected
- **Zod Form Validation**:
  ```typescript
  export const updatePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: passwordRules,
    newPasswordConfirm: z.string().min(1),
  }).refine((data) => data.newPassword === data.newPasswordConfirm, {
    message: 'New passwords do not match',
    path: ['newPasswordConfirm'],
  });
  ```
- **Response `200 OK`**: `{ "status": "success", "message": "Password updated successfully." }`

#### `DELETE /api/users/me`
- **Auth**: Protected
- **Response `200 OK`**: `{ "status": "success", "message": "Account deactivated successfully." }`

#### `GET /api/users/me/feed`
- **Auth**: Protected
- **Query Params**: `page?: number` (default 1), `limit?: number` (default 20)
- **Response `200 OK`**: `PaginatedResponse<Post>`

#### `GET /api/users/me/saved-posts`
- **Auth**: Protected
- **Query Params**: `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<Post>`

#### `POST /api/users/:id/follow`
- **Auth**: Protected
- **Path Params**: `id` (Target User ID)
- **Response `200 OK`**: `{ "status": "success", "message": "User followed successfully." }`

#### `DELETE /api/users/:id/follow`
- **Auth**: Protected
- **Response `200 OK`**: `{ "status": "success", "message": "User unfollowed successfully." }`

#### `GET /api/users/:id/followers`
- **Auth**: Public
- **Query Params**: `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<User>`

#### `GET /api/users/:id/following`
- **Auth**: Public
- **Query Params**: `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<User>`

#### `GET /api/users/:userId/posts`
- **Auth**: Public
- **Path Params**: `userId` (Author ObjectId)
- **Query Params**: `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<Post>`

#### `GET /api/users/:id`
- **Auth**: Public
- **Response `200 OK`**: `ApiResponse<{ user: User }>` (Includes `followerCount` & `followingCount` virtuals)

#### `GET /api/users`
- **Auth**: Public
- **Query Params**: `search?: string`, `role?: UserRole`, `status?: UserStatus`, `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<User>`

---

### 5.3. Posts & Feed (`/api/posts`)

#### `POST /api/posts`
- **Auth**: Protected
- **Zod Form Validation**:
  ```typescript
  export const createPostSchema = z.object({
    title: z.string().min(1).max(100).trim(),
    content: z.string().min(1).trim(),
    category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
    tags: z.array(z.string().min(1).max(30)).max(20).optional().default([]),
  });
  ```
- **Response `201 Created`**: `ApiResponse<{ post: Post }>`

#### `GET /api/posts`
- **Auth**: Public
- **Query Params**:
  ```typescript
  export interface SearchPostsQuery {
    search?: string;
    category?: string;
    tag?: string;
    author?: string;
    sort?: 'newest' | 'oldest' | 'most_liked' | 'most_commented'; // Default: newest
    page?: number;  // Default 1
    limit?: number; // Default 10, max 50
  }
  ```
- **Response `200 OK`**: `PaginatedResponse<Post>`

#### `GET /api/posts/:id`
- **Auth**: Public
- **Response `200 OK`**: `ApiResponse<{ post: Post }>`

#### `PATCH /api/posts/:id`
- **Auth**: Protected (Author **or** Admin) — admin override added so the admin dashboard's post moderation actions can act on posts they don't own, matching the same ownership pattern `DELETE /api/posts/:id` already used.
- **Request Body**: Partial `createPostSchema`
- **Response `200 OK`**: `ApiResponse<{ post: Post }>`

#### `DELETE /api/posts/:id`
- **Auth**: Protected (Author/Admin)
- **Response `200 OK`**: `{ "status": "success", "message": "Post deleted successfully." }`

#### `POST /api/posts/:id/like`
- **Auth**: Protected
- **Response `200 OK`**: `{ "status": "success", "data": { "liked": true, "likesCount": 15 } }`

#### `DELETE /api/posts/:id/like`
- **Auth**: Protected
- **Response `200 OK`**: `{ "status": "success", "data": { "liked": false, "likesCount": 14 } }`

#### `GET /api/posts/:id/likes`
- **Auth**: Public
- **Response `200 OK`**: `PaginatedResponse<User>`

#### `POST /api/posts/:id/save`
- **Auth**: Protected
- **Response `200 OK`**: `{ "status": "success", "message": "Post saved." }`

#### `DELETE /api/posts/:id/save`
- **Auth**: Protected
- **Response `200 OK`**: `{ "status": "success", "message": "Post unsaved." }`

#### `POST /api/posts/:postId/comments`
- **Auth**: Protected
- **Zod Form Validation**:
  ```typescript
  export const createCommentSchema = z.object({
    text: z.string().min(1, 'Comment text is required').max(2000, 'Max 2000 characters').trim(),
  });
  ```
- **Response `201 Created`**: `ApiResponse<{ comment: Comment }>`

#### `GET /api/posts/:postId/comments`
- **Auth**: Public
- **Query Params**: `page?: number`, `limit?: number`
- **Response `200 OK`**: `ApiResponse<{ comments: Comment[], results: number }>`

---

### 5.4. Comments & Replies (`/api/comments`)

#### `GET /api/comments/:id`
- **Auth**: Public
- **Response `200 OK`**: `ApiResponse<{ comment: Comment }>`

#### `PATCH /api/comments/:id`
- **Auth**: Protected (Author only)
- **Request Body**: `{ "text": "Updated comment text" }`
- **Response `200 OK`**: `ApiResponse<{ comment: Comment }>`

#### `DELETE /api/comments/:id`
- **Auth**: Protected (Author / Post Owner / Admin)
- **Response `200 OK`**: `{ "status": "success", "message": "Comment and X replies deleted." }`

#### `POST /api/comments/:id/replies`
- **Auth**: Protected
- **Request Body**: `{ "text": "Replying to this comment..." }`
- **Response `201 Created`**: `ApiResponse<{ reply: Comment }>`

---

### 5.5. Categories (`/api/categories`)

#### `GET /api/categories`
- **Auth**: Public
- **Response `200 OK`**: `ApiResponse<{ categories: Category[] }>`

#### `POST /api/categories` [Admin]
- **Auth**: Protected (Admin)
- **Request Body**: `{ "name": "Electronics", "description": "Gadgets and tech" }`
- **Response `201 Created`**: `ApiResponse<{ category: Category }>`

#### `GET /api/categories/:id`
- **Auth**: Public
- **Response `200 OK`**: `ApiResponse<{ category: Category }>`

#### `PATCH /api/categories/:id` [Admin]
- **Auth**: Protected (Admin)
- **Response `200 OK`**: `ApiResponse<{ category: Category }>`

#### `DELETE /api/categories/:id` [Admin]
- **Auth**: Protected (Admin)
- **Response `200 OK`**: `{ "status": "success", "message": "Category deleted." }`

---

### 5.6. Conversations & Messages (`/api/conversations`)

#### `POST /api/conversations`
- **Auth**: Protected
- **Request Body**: `{ "participantId": "64d3f7b2e1a4c80012a34599" }`
- **Response `200 / 201`**: `ApiResponse<{ conversation: Conversation }>`

#### `GET /api/conversations`
- **Auth**: Protected
- **Response `200 OK`**: `ApiResponse<{ conversations: Conversation[] }>`

#### `GET /api/conversations/:id`
- **Auth**: Protected (Participant only)
- **Response `200 OK`**: `ApiResponse<{ conversation: Conversation }>`

#### `GET /api/conversations/:conversationId/messages`
- **Auth**: Protected (Participant only)
- **Query Params**: `cursor?: string` (Message ID), `limit?: number` (default 50)
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "data": {
      "messages": [
        {
          "id": "64d3f7b2e1a4c80012a88888",
          "conversation": "64d3f7b2e1a4c80012a99999",
          "sender": { "id": "...", "username": "...", "avatar": "..." },
          "content": "Hey there!",
          "readBy": ["64d3f7b2e1a4c80012a34567"],
          "createdAt": "2026-08-15T01:25:00.000Z"
        }
      ],
      "nextCursor": "64d3f7b2e1a4c80012a88887"
    }
  }
  ```

#### `PATCH /api/conversations/:conversationId/messages/read`
- **Auth**: Protected (Participant only)
- **Response `200 OK`**: `{ "status": "success", "message": "Messages marked as read." }`

---

### 5.7. Notifications (`/api/notifications`)

#### `GET /api/notifications`
- **Auth**: Protected
- **Query Params**: `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<Notification>`

#### `GET /api/notifications/unread-count`
- **Auth**: Protected
- **Response `200 OK`**: `ApiResponse<{ unreadCount: number }>`

#### `PATCH /api/notifications/:id/read`
- **Auth**: Protected
- **Response `200 OK`**: `ApiResponse<{ notification: Notification }>`

#### `PATCH /api/notifications/read-all`
- **Auth**: Protected
- **Response `200 OK`**: `{ "status": "success", "message": "All notifications marked as read." }`

#### `DELETE /api/notifications/:id`
- **Auth**: Protected
- **Response `200 OK`**: `{ "status": "success", "message": "Notification deleted." }`

---

### 5.8. Payments & Ledger (`/api/payments`)

#### `POST /api/payments/create-intent`
- **Auth**: Protected
- **Zod Form Validation**:
  ```typescript
  export const createPaymentIntentSchema = z.object({
    amount: z.number().int().positive('Amount in cents is required'),
    currency: z.string().default('usd'),
    postId: z.string().optional(),
  });
  ```
- **Response `201 Created`**:
  ```json
  {
    "status": "success",
    "data": {
      "clientSecret": "pi_3MtwB2LkdIw...",
      "paymentId": "64d3f7b2e1a4c80012a77777"
    }
  }
  ```

#### `GET /api/payments/me`
- **Auth**: Protected
- **Query Params**: `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<Payment>`

#### `GET /api/payments/:id`
- **Auth**: Protected (Buyer / Seller / Admin)
- **Response `200 OK`**: `ApiResponse<{ payment: Payment }>`

#### `POST /api/payments/webhook`
- **Auth**: Unauthenticated (Verified via Stripe Signature Header)

---

### 5.9. Uploads & Media (`/api/uploads`)

#### `GET /api/uploads`
- **Auth**: Protected
- **Query Params**: `owner?: string` (admin-only — ignored for non-admins, who are always pinned to their own files), `resourceType?: 'image' | 'video' | 'raw' | 'auto'`, `associatedEntity?: 'avatar' | 'post' | 'message' | 'other'`, `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<File>`
- Backs both a personal "my uploads" view and the admin Uploads asset grid — non-admins can never widen the query to another user's files, even by passing `owner`.

#### `POST /api/uploads/avatar`
- **Auth**: Protected
- **Content-Type**: `multipart/form-data`
- **Form Field**: `avatar` (single image, max 2MB) — *not* `file`; must match Multer's `.single("avatar")` config in `upload.middleware.js`.
- **Response `201 Created`**: `ApiResponse<{ avatar: string; file: File }>`
  ```json
  {
    "status": "success",
    "data": {
      "avatar": "https://res.cloudinary.com/utbxocbj/image/upload/social-marketplace/avatars/xyz.jpg",
      "file": {
        "id": "64d3f7b2e1a4c80012a11111",
        "url": "https://res.cloudinary.com/utbxocbj/image/upload/social-marketplace/avatars/xyz.jpg",
        "publicId": "social-marketplace/avatars/xyz",
        "mimeType": "image/jpeg",
        "fileSize": 48213,
        "owner": "64d3f7b2e1a4c80012a34567",
        "resourceType": "image",
        "associatedEntity": "avatar",
        "createdAt": "2026-08-15T00:00:00.000Z"
      }
    }
  }
  ```

#### `POST /api/uploads/posts/:postId`
- **Auth**: Protected (Post Owner / Admin)
- **Content-Type**: `multipart/form-data`
- **Form Field**: `images` (max 5 images, max 10MB per file) — *not* `files`; must match Multer's `.array("images", 5)` config in `upload.middleware.js`.
- **Response `201 Created`**: `ApiResponse<{ media: string[]; files: File[] }>`
  ```json
  {
    "status": "success",
    "data": {
      "media": ["https://res.cloudinary.com/utbxocbj/image/upload/social-marketplace/posts/a.jpg"],
      "files": [{ "id": "64d3f7b2e1a4c80012a22222", "url": "...", "publicId": "...", "mimeType": "image/jpeg", "fileSize": 102400, "owner": "...", "associatedPost": "...", "associatedEntity": "post" }]
    }
  }
  ```

#### `GET /api/uploads/:id`
- **Auth**: Protected (Owner / Admin)
- **Response `200 OK`**: `ApiResponse<{ file: File }>` — *not* `{ upload: object }`; controller returns the key `file`.

#### `DELETE /api/uploads/:id`
- **Auth**: Protected (Uploader / Admin)
- **Response `200 OK`**: `{ "status": "success", "data": null }`

---

### 5.10. Content Moderation Reports (`/api/reports`)

#### `POST /api/reports`
- **Auth**: Protected
- **Zod Form Validation**:
  ```typescript
  export const createReportSchema = z.object({
    targetType: z.enum(['post', 'comment', 'user']),
    targetId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid target ID format'),
    reason: z.string().min(5).max(500).trim(),
  });
  ```
- **Response `201 Created`**: `{ "status": "success", "message": "Report submitted for review." }`

#### `GET /api/reports` [Admin]
- **Auth**: Protected (Admin)
- **Query Params**: `status?: ReportStatus`, `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<Report>`

#### `PATCH /api/reports/:id` [Admin]
- **Auth**: Protected (Admin)
- **Zod Form Validation**:
  ```typescript
  export const updateReportSchema = z.object({
    status: z.enum(['pending', 'reviewed', 'dismissed', 'resolved']),
    notes: z.string().max(1000).optional(),
  });
  ```
- **Response `200 OK`**: `ApiResponse<{ report: Report }>`

#### `DELETE /api/reports/:id` [Admin]
- **Auth**: Protected (Admin)
- **Response `200 OK`**: `{ "status": "success", "message": "Report deleted." }`

---

### 5.11. Admin Management (`/api/admin`)

#### `GET /api/admin/users` [Admin]
- **Auth**: Protected (Admin)
- **Query Params**: `search?: string`, `role?: UserRole`, `status?: UserStatus`, `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<User>`

#### `PATCH /api/admin/users/:id/role` [Admin]
- **Auth**: Protected (Admin)
- **Request Body**: `{ "role": "user" | "moderator" | "admin" }`
- **Response `200 OK`**: `ApiResponse<{ user: User }>`

#### `PATCH /api/admin/users/:id/status` [Admin]
- **Auth**: Protected (Admin)
- **Request Body**: `{ "status": "active" | "suspended" | "banned" }`
- **Response `200 OK`**: `ApiResponse<{ user: User }>`

#### `GET /api/admin/dashboard` [Admin]
- **Auth**: Protected (Admin)
- **Response `200 OK`**:
  ```json
  {
    "status": "success",
    "data": {
      "totalUsers": 1250,
      "totalPosts": 3400,
      "totalPayments": 890,
      "totalVolumeCents": 4500000
    }
  }
  ```

#### `GET /api/admin/audit-logs` [Admin]
- **Auth**: Protected (Admin)
- **Query Params**: `actor?: string`, `action?: string`, `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<object>`

Payments (global scope)

#### `GET /api/admin/payments` [Admin]
- **Auth**: Protected (Admin)
- **Query Params**: `status?: PaymentStatus`, `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<Payment>`
- Global transaction listing across every buyer — unlike `GET /api/payments/me`, this is **not** scoped to the requester; access is gated entirely by `restrictTo('admin')` at the route level.

#### `POST /api/admin/payments/:id/refund` [Admin]
- **Auth**: Protected (Admin)
- **Response `200 OK`**: `ApiResponse<{ payment: Payment }>`
- Calls Stripe directly (never trusts a client-supplied "refunded" flag) and updates the ledger. Only completed payments can be refunded — a `400` is returned otherwise.

Conversations (global scope)

#### `GET /api/admin/conversations` [Admin]
- **Auth**: Protected (Admin)
- **Query Params**: `page?: number`, `limit?: number`
- **Response `200 OK`**: `PaginatedResponse<Conversation>`
- Lists every conversation on the platform (moderation visibility), sorted by `lastMessage` activity — unlike `GET /api/conversations`, which is scoped to the requester's own threads.

---

### 5.12. Health Check (`/health`)

#### `GET /health`
- **Auth**: Public
- **Response `200 OK`**: `{ "status": "ok", "uptime": 3600.45 }`

---

## 6. 🤖 Strict AI Audit Prompt for Frontend Route Verification

Use the following strict prompt when auditing or generating frontend code to ensure 100% compliance with this API Handbook:

```markdown
You are an expert Frontend Code Auditor enforcing strict API alignment with the Backend Handbook.

### MANDATORY AUDIT RULES:
1. ENVIRONMENT BASE URL:
   - Verify that all API calls reference `import.meta.env.VITE_API_BASE_URL` (never hardcode base URLs or legacy `VITE_API_URL`).

2. EXACT FIELD NAME VERIFICATION:
   - Comment & Reply creation/update MUST use property `text` (NOT `content`).
   - Password change MUST use `currentPassword`, `newPassword`, `newPasswordConfirm` (NOT `oldPassword` or `confirmPassword`).
   - Post Query Sort parameter MUST accept only `'newest' | 'oldest' | 'most_liked' | 'most_commented'`.
   - User Role MUST be one of `'user' | 'moderator' | 'admin'`. User Status MUST be one of `'active' | 'suspended' | 'banned'`.

3. TS DTO & TANSTACK QUERY MATCHING:
   - Every `useQuery` / `useMutation` MUST pull keys from `queryKeys.ts`.
   - Data types must match the envelope response shapes `ApiResponse<T>` or `PaginatedResponse<T>`.

4. SOCKET.IO EVENT MATCHING:
   - `join_post_room` and `leave_post_room` MUST be invoked in post detail views.
   - `register_user` MUST be emitted upon authentication with `user.id`.
   - `register_following_rooms` MUST pass an array of author IDs.
   - Real-time comment events MUST listen for `new_comment`, `comment_updated`, `comment_deleted`, and `reply_created`.

Audit the target frontend file line-by-line against these rules. Highlight any discrepancy immediately as a CRITICAL FAULT with the required diff fix.
```