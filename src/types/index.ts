/**
 * Domain models — the shared contract between the TanStack Query layer
 * and the REST / Socket.io transports. Types are defined once here and
 * consumed everywhere; form value types come from `z.infer` instead.
 */

export type UserRole = "user" | "moderator" | "admin"
export type UserStatus = "active" | "suspended" | "banned"
export type PostSortOption = "newest" | "oldest" | "most_liked" | "most_commented"

export interface PublicUser {
  id: string
  name: string
  username: string
  email: string
  avatar?: string | null
  role: UserRole
  status: UserStatus
  bio?: string
  createdAt: string
  isFollowing?: boolean
}

export interface Category {
  id: string
  slug: string
  name: string
  icon?: string
  postCount?: number
}

export type PostStatus = "active" | "hidden" | "flagged"

export interface MediaAsset {
  id: string
  url: string
  kind: "image" | "video"
  width?: number
  height?: number
  size?: number
}

export interface Post {
  id: string
  author: PublicUser
  title: string
  content: string
  media: string[]
  category: Category
  tags: string[]
  price?: number
  currency?: string
  status: PostStatus
  createdAt: string
  likesCount: number
  commentsCount: number
  saveCount: number
  isLiked: boolean
  isSaved: boolean
}

export interface PostComment {
  id: string
  postId: string
  parentId?: string
  author: PublicUser
  text: string
  createdAt: string
  likeCount: number
  isLiked: boolean
  replies: PostComment[]
}

export interface Conversation {
  id: string
  post?: Post
  participants: PublicUser[]
  lastMessage?: MessageSummary
  lastMessageAt?: string
  unreadCount: number
}

export interface MessageSummary {
  id: string
  senderId: string
  body: string
  createdAt: string
}

export interface Message {
  id: string
  messageId: string
  conversationId: string
  senderId: string
  body: string
  createdAt: string
  /** Echoed back by the server on the receive_message broadcast to reconcile optimistic inserts. */
  clientMessageId?: string
}

/** Cursor-paginated page of messages (handbook §5.6 — `data.messages` + `nextCursor`). */
export interface MessageCursorPage {
  messages: Message[]
  nextCursor: string | null
}

export type PaymentStatus =
  | "succeeded"
  | "pending"
  | "failed"
  | "refunded"

export interface Payment {
  id: string
  userId: string
  postId?: string
  amount: number
  currency: string
  status: PaymentStatus
  method: string
  createdAt: string
}

export interface PaymentIntent {
  id: string
  clientSecret: string
  amount: number
  currency: string
}

export type ReportTargetType = "post" | "user" | "message"
export type ReportStatus = "pending" | "reviewed" | "resolved" | "dismissed"

export interface Report {
  id: string
  targetType: ReportTargetType
  targetId: string
  targetSummary?: string
  reason: string
  detail?: string
  status: ReportStatus
  reporter: PublicUser
  createdAt: string
}

export type NotificationType =
  | "like"
  | "comment"
  | "follow"
  | "message"
  | "system"
  | "moderation"

export interface AppNotification {
  id: string
  type: NotificationType
  actor?: PublicUser | null
  title: string
  body: string
  read: boolean
  createdAt: string
  transport: "socket" | "hybrid"
}

export interface AuditLog {
  id: string
  actorName: string
  action: string
  target?: string
  ip?: string
  meta?: Record<string, string>
  createdAt: string
}

export type UploadKind = "image" | "video" | "avatar" | "document"

export interface Upload {
  id: string
  name: string
  kind: UploadKind
  size: number
  url: string
  owner: PublicUser
  createdAt: string
}

export interface DashboardKpis {
  revenue30d: number
  revenueDeltaPct: number
  activeUsers: number
  activeUsersDeltaPct: number
  postsToday: number
  postsTodayDeltaPct: number
  pendingReports: number
  conversionRatePct: number
}

export interface RevenuePoint {
  label: string
  revenue: number
}

export interface CategoryActivity {
  category: string
  posts: number
}

export interface AdminDashboard {
  kpis: DashboardKpis
  revenueSeries: RevenuePoint[]
  categoryActivity: CategoryActivity[]
  moderationQueue: Report[]
  recentReports: Report[]
  recentAudit: AuditLog[]
  storageUsedBytes: number
}

/** Cursor-paginated envelope used by every list endpoint. */
export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

/** Generic envelope returned by every non-list endpoint. */
export interface ApiResponse<T> {
  status: "success" | "fail" | "error"
  message?: string
  results?: number
  data: T
}

/** Pagination metadata returned by list endpoints. */
export interface PaginationMeta {
  page: number
  limit: number
  hasMore: boolean
  nextPage: string | number | null
}

/** Envelope returned by every paginated list endpoint. */
export interface PaginatedResponse<T> {
  status: "success"
  results: number
  data: T[]
  pagination: PaginationMeta
}

export interface ApiErrorBody {
  message?: string
  fieldErrors?: Record<string, string>
}

export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string>

  constructor(status: number, message: string, fieldErrors?: Record<string, string>) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.fieldErrors = fieldErrors
  }
}
