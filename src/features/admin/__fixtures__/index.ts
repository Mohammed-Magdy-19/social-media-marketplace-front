/**
 * Fixture-only seed data mirroring PSD §6 / §10 content-inventory counts
 * (8 posts, 8 users, 5 reports, 6 payments, 9 notifications, 5
 * conversations, 5 categories, 6 audit events, 8 uploads).
 *
 * These back local development / MSW handlers / Storybook stories ONLY.
 * Production components must never import from here — the TanStack Query
 * hooks in the admin domain are the sole wiring point.
 */
import type {
  AppNotification,
  AuditLog,
  Category,
  Conversation,
  Payment,
  Post,
  PublicUser,
  Report,
  Upload,
} from "@/types"

export const fixtureUsers: PublicUser[] = [
  { id: "u1", name: "Amara Okafor", username: "amara", email: "amara@vendo.dev", role: "Admin", status: "Active", joinedAt: "2024-11-02T09:00:00Z", bio: "Marketplace ops lead" },
  { id: "u2", name: "Lucas Meyer", username: "lucas", email: "lucas@vendo.dev", role: "User", status: "Active", joinedAt: "2025-01-14T10:00:00Z", bio: "Photography gear" },
  { id: "u3", name: "Priya Nair", username: "priya", email: "priya@vendo.dev", role: "User", status: "Suspended", joinedAt: "2024-12-03T11:00:00Z" },
  { id: "u4", name: "Diego Ramos", username: "diego", email: "diego@vendo.dev", role: "User", status: "Active", joinedAt: "2025-03-21T12:00:00Z", bio: "Vinyl collector" },
  { id: "u5", name: "Sara Lindqvist", username: "sara", email: "sara@vendo.dev", role: "User", status: "Banned", joinedAt: "2024-10-19T13:00:00Z" },
  { id: "u6", name: "Kenji Tanaka", username: "kenji", email: "kenji@vendo.dev", role: "User", status: "Active", joinedAt: "2025-02-11T14:00:00Z", bio: "Mechanical keyboards" },
  { id: "u7", name: "Fatima El-Sayed", username: "fatima", email: "fatima@vendo.dev", role: "User", status: "Active", joinedAt: "2025-05-08T15:00:00Z" },
  { id: "u8", name: "Oliver Grant", username: "oliver", email: "oliver@vendo.dev", role: "User", status: "Active", joinedAt: "2025-06-30T16:00:00Z" },
]

export const fixtureCategories: Category[] = [
  { id: "c1", slug: "apparel", name: "Apparel", postCount: 2 },
  { id: "c2", slug: "tech", name: "Tech", postCount: 2 },
  { id: "c3", slug: "home", name: "Home", postCount: 2 },
  { id: "c4", slug: "vehicles", name: "Vehicles", postCount: 1 },
  { id: "c5", slug: "digital", name: "Digital", postCount: 1 },
]

export const fixturePosts: Post[] = [
  { id: "p1", author: fixtureUsers[1], caption: "A7 III body only, shutter count 12k", media: [], category: fixtureCategories[1], tags: ["camera", "sony"], price: 1299, currency: "USD", status: "Published", createdAt: "2026-08-12T09:15:00Z", likeCount: 42, commentCount: 6, saveCount: 18, isLiked: false, isSaved: false },
  { id: "p2", author: fixtureUsers[3], caption: "60s jazz records, mint condition", media: [], category: fixtureCategories[3], tags: ["vinyl", "jazz"], price: 240, currency: "USD", status: "Published", createdAt: "2026-08-11T18:40:00Z", likeCount: 31, commentCount: 4, saveCount: 9, isLiked: false, isSaved: false },
  { id: "p3", author: fixtureUsers[5], caption: "Hand-wired split keyboard, GMK keycaps", media: [], category: fixtureCategories[1], tags: ["keyboard", "mechanical"], price: 185, currency: "USD", status: "Published", createdAt: "2026-08-10T12:00:00Z", likeCount: 57, commentCount: 11, saveCount: 26, isLiked: false, isSaved: false },
  { id: "p4", author: fixtureUsers[2], caption: "Down jacket, size L — barely worn", media: [], category: fixtureCategories[0], tags: ["jacket", "winter"], price: 90, currency: "USD", status: "Pending", createdAt: "2026-08-09T08:30:00Z", likeCount: 3, commentCount: 0, saveCount: 1, isLiked: false, isSaved: false },
  { id: "p5", author: fixtureUsers[6], caption: "Desk lamp + wireless charger bundle", media: [], category: fixtureCategories[2], tags: ["desk", "lamp"], price: 45, currency: "USD", status: "Flagged", createdAt: "2026-08-08T20:10:00Z", likeCount: 8, commentCount: 2, saveCount: 0, isLiked: false, isSaved: false },
  { id: "p6", author: fixtureUsers[4], caption: "Software license — photo editing suite", media: [], category: fixtureCategories[4], tags: ["software", "license"], price: 60, currency: "USD", status: "Draft", createdAt: "2026-08-07T14:00:00Z", likeCount: 0, commentCount: 0, saveCount: 0, isLiked: false, isSaved: false },
  { id: "p7", author: fixtureUsers[1], caption: "Tripod + gimbal kit", media: [], category: fixtureCategories[1], tags: ["tripod", "gimbal"], price: 210, currency: "USD", status: "Published", createdAt: "2026-08-06T11:45:00Z", likeCount: 22, commentCount: 3, saveCount: 7, isLiked: false, isSaved: false },
  { id: "p8", author: fixtureUsers[3], caption: "Vintage amplifier, fully serviced", media: [], category: fixtureCategories[2], tags: ["audio", "vintage"], price: 320, currency: "USD", status: "Published", createdAt: "2026-08-05T17:20:00Z", likeCount: 19, commentCount: 5, saveCount: 12, isLiked: false, isSaved: false },
]

export const fixtureReports: Report[] = [
  { id: "r1", targetType: "post", targetId: "p5", targetSummary: "Desk lamp + wireless charger bundle", reason: "Prohibited item", detail: "Claims to be authentic but looks like a replica.", status: "Pending", reporter: fixtureUsers[2], createdAt: "2026-08-12T07:00:00Z" },
  { id: "r2", targetType: "user", targetId: "u5", targetSummary: "Sara Lindqvist", reason: "Harassment", detail: "Repeated abusive messages.", status: "Pending", reporter: fixtureUsers[6], createdAt: "2026-08-12T06:30:00Z" },
  { id: "r3", targetType: "post", targetId: "p3", targetSummary: "Hand-wired split keyboard", reason: "Misleading", detail: "Keycaps not included as described.", status: "Resolved", reporter: fixtureUsers[0], createdAt: "2026-08-11T15:00:00Z" },
  { id: "r4", targetType: "message", targetId: "m9", targetSummary: "Negotiation message", reason: "Spam", status: "Dismissed", reporter: fixtureUsers[3], createdAt: "2026-08-10T10:00:00Z" },
  { id: "r5", targetType: "post", targetId: "p6", targetSummary: "Software license — photo editing suite", reason: "Counterfeit", status: "Pending", reporter: fixtureUsers[1], createdAt: "2026-08-12T09:45:00Z" },
]

export const fixturePayments: Payment[] = [
  { id: "pay1", userId: "u2", postId: "p1", amount: 1299, currency: "USD", status: "Succeeded", method: "card", createdAt: "2026-08-12T10:00:00Z" },
  { id: "pay2", userId: "u4", postId: "p2", amount: 240, currency: "USD", status: "Succeeded", method: "card", createdAt: "2026-08-11T19:00:00Z" },
  { id: "pay3", userId: "u6", postId: "p3", amount: 185, currency: "USD", status: "Pending", method: "bank", createdAt: "2026-08-10T13:00:00Z" },
  { id: "pay4", userId: "u7", postId: "p7", amount: 210, currency: "USD", status: "Failed", method: "card", createdAt: "2026-08-09T15:00:00Z" },
  { id: "pay5", userId: "u2", postId: "p8", amount: 320, currency: "USD", status: "Succeeded", method: "card", createdAt: "2026-08-08T18:00:00Z" },
  { id: "pay6", userId: "u3", postId: "p4", amount: 90, currency: "USD", status: "Refunded", method: "card", createdAt: "2026-08-07T09:00:00Z" },
]

export const fixtureNotifications: AppNotification[] = [
  { id: "n1", type: "like", actor: fixtureUsers[3], title: "Diego liked your listing", body: "A7 III body only, shutter count 12k", read: false, createdAt: "2026-08-12T09:20:00Z", transport: "hybrid" },
  { id: "n2", type: "comment", actor: fixtureUsers[5], title: "Kenji commented", body: "Would you take 180?", read: false, createdAt: "2026-08-12T08:50:00Z", transport: "hybrid" },
  { id: "n3", type: "follow", actor: fixtureUsers[6], title: "Fatima followed you", body: "", read: false, createdAt: "2026-08-12T07:30:00Z", transport: "hybrid" },
  { id: "n4", type: "message", actor: fixtureUsers[1], title: "New message from Lucas", body: "Is it still available?", read: false, createdAt: "2026-08-11T21:00:00Z", transport: "hybrid" },
  { id: "n5", type: "system", title: "Payment received", body: "$1,299.00 from Lucas Meyer", read: false, createdAt: "2026-08-11T19:10:00Z", transport: "socket" },
  { id: "n6", type: "moderation", title: "Report resolved", body: "Your report on p5 was marked Resolved", read: true, createdAt: "2026-08-11T15:30:00Z", transport: "socket" },
  { id: "n7", type: "like", actor: fixtureUsers[2], title: "Priya liked your listing", body: "Down jacket, size L", read: true, createdAt: "2026-08-10T14:00:00Z", transport: "hybrid" },
  { id: "n8", type: "comment", actor: fixtureUsers[3], title: "Diego commented", body: "Shipping included?", read: true, createdAt: "2026-08-09T12:00:00Z", transport: "hybrid" },
  { id: "n9", type: "system", title: "Welcome to Vendo", body: "Your store is ready to go", read: true, createdAt: "2026-08-08T09:00:00Z", transport: "socket" },
]

export const fixtureConversations: Conversation[] = [
  { id: "cv1", post: fixturePosts[0], participants: [fixtureUsers[1], fixtureUsers[0]], lastMessage: { id: "m1", senderId: "u2", body: "Is it still available?", createdAt: "2026-08-12T09:00:00Z" }, lastMessageAt: "2026-08-12T09:00:00Z", unreadCount: 1 },
  { id: "cv2", post: fixturePosts[2], participants: [fixtureUsers[5], fixtureUsers[0]], lastMessage: { id: "m2", senderId: "u6", body: "I can do 170.", createdAt: "2026-08-11T18:00:00Z" }, lastMessageAt: "2026-08-11T18:00:00Z", unreadCount: 0 },
  { id: "cv3", post: fixturePosts[4], participants: [fixtureUsers[6], fixtureUsers[0]], lastMessage: { id: "m3", senderId: "u0", body: "Great, thanks!", createdAt: "2026-08-10T16:00:00Z" }, lastMessageAt: "2026-08-10T16:00:00Z", unreadCount: 0 },
  { id: "cv4", post: fixturePosts[7], participants: [fixtureUsers[3], fixtureUsers[0]], lastMessage: { id: "m4", senderId: "u4", body: "Can you ship internationally?", createdAt: "2026-08-09T12:00:00Z" }, lastMessageAt: "2026-08-09T12:00:00Z", unreadCount: 2 },
  { id: "cv5", post: fixturePosts[6], participants: [fixtureUsers[1], fixtureUsers[0]], lastMessage: { id: "m5", senderId: "u2", body: "Deal.", createdAt: "2026-08-08T10:00:00Z" }, lastMessageAt: "2026-08-08T10:00:00Z", unreadCount: 0 },
]

export const fixtureAuditLogs: AuditLog[] = [
  { id: "a1", actorName: "Amara Okafor", action: "REPORT_RESOLVE", target: "r1", ip: "10.0.0.8", createdAt: "2026-08-12T09:00:00Z" },
  { id: "a2", actorName: "Amara Okafor", action: "USER_STATUS_CHANGE", target: "u3", ip: "10.0.0.8", createdAt: "2026-08-11T16:00:00Z" },
  { id: "a3", actorName: "Oliver Grant", action: "POST_CREATE", target: "p4", ip: "10.0.0.21", createdAt: "2026-08-11T10:00:00Z" },
  { id: "a4", actorName: "Amara Okafor", action: "POST_FLAG", target: "p5", ip: "10.0.0.8", createdAt: "2026-08-10T14:00:00Z" },
  { id: "a5", actorName: "System", action: "PAYMENT_REFUND", target: "pay6", ip: "", createdAt: "2026-08-09T11:00:00Z" },
  { id: "a6", actorName: "Diego Ramos", action: "AUTH_LOGIN", target: "u4", ip: "10.0.0.42", createdAt: "2026-08-09T08:30:00Z" },
]

export const fixtureUploads: Upload[] = [
  { id: "up1", name: "a7-hero.jpg", kind: "image", size: 2_412_000, url: "/media/a7-hero.jpg", owner: fixtureUsers[1], createdAt: "2026-08-12T09:00:00Z" },
  { id: "up2", name: "a7-shutter.jpg", kind: "image", size: 1_880_000, url: "/media/a7-shutter.jpg", owner: fixtureUsers[1], createdAt: "2026-08-12T09:00:00Z" },
  { id: "up3", name: "vinyl-sleeve.jpg", kind: "image", size: 980_000, url: "/media/vinyl-sleeve.jpg", owner: fixtureUsers[3], createdAt: "2026-08-11T18:00:00Z" },
  { id: "up4", name: "kb-front.png", kind: "image", size: 2_100_000, url: "/media/kb-front.png", owner: fixtureUsers[5], createdAt: "2026-08-10T12:00:00Z" },
  { id: "up5", name: "jacket-tag.jpg", kind: "image", size: 640_000, url: "/media/jacket-tag.jpg", owner: fixtureUsers[2], createdAt: "2026-08-09T08:00:00Z" },
  { id: "up6", name: "avatar-lucas.png", kind: "avatar", size: 410_000, url: "/media/avatar-lucas.png", owner: fixtureUsers[1], createdAt: "2026-08-07T12:00:00Z" },
  { id: "up7", name: "amp-demo.mp4", kind: "video", size: 8_900_000, url: "/media/amp-demo.mp4", owner: fixtureUsers[3], createdAt: "2026-08-06T15:00:00Z" },
  { id: "up8", name: "lamp-bundle.jpg", kind: "image", size: 720_000, url: "/media/lamp-bundle.jpg", owner: fixtureUsers[6], createdAt: "2026-08-08T19:00:00Z" },
]
