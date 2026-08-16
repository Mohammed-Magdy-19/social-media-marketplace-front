# Frontend Implementation Brief: Conversations, Messages & Negotiation Offers

**Audience:** an engineering agent implementing the *frontend logic* for this feature.
**Stack:** React 19 + TypeScript, Tailwind CSS v4.3, shadcn/ui, React Hook Form + Zod, Zustand, TanStack Query v5, Axios, react-router-dom v6/7, Socket.io Client, `@tanstack/react-virtual`.

This document is derived directly from the backend implementation (controllers, routes, validators). It does not invent new backend behavior — it translates existing REST/Socket contracts into a frontend architecture. Read it fully before writing code; the REST/Socket split below is deliberate and load-bearing, not incidental.

---

## 1. Mental Model — Three Sub-Features, One Hybrid Pattern

| Sub-feature | Transport | Why |
|---|---|---|
| Create/list/read **conversations** | REST only | Standard request/response; not "live" |
| **Send/receive messages**, typing indicators | **Socket.io only** — no REST send endpoint exists | Needs to feel instantaneous; transient events |
| **Read message history**, mark-as-read | REST only | A page of past messages is a cacheable, one-shot query; "mark read" is a deliberate one-time action |
| **Negotiation offers** (accept/reject/counter) | REST for persistence **+** Socket.io broadcast for live updates | Offers are structured, stateful documents (need a real accept/reject/counter state machine) but both parties must see updates instantly |

**Critical constraint for the agent:** there is no `POST /messages` REST endpoint. Sending a message MUST go through the socket emit described in §4. Do not build a mutation hook that POSTs a message — it will hit a 404.

---

## 2. Data Model (TypeScript types to define in `types/`)

```ts
// types/user.ts
export interface UserSummary {
  _id: string;
  username: string;
  avatar?: string;
}

// types/conversation.ts
export interface Conversation {
  _id: string;
  participants: UserSummary[];
  isGroup: boolean;
  title: string;
  lastMessage?: {
    _id: string;
    text: string;
    sender: string;
    createdAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// types/message.ts
export interface Message {
  _id: string;
  conversation: string;
  sender: UserSummary;
  text: string;
  isRead: boolean;
  readBy: { user: string; readAt: string }[];
  createdAt: string;
}

// types/offer.ts
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'countered';
export type OfferAction = 'accept' | 'reject' | 'counter';

export interface Offer {
  _id: string;
  conversation: string;
  post: { _id: string; title: string; media?: string[]; price: number };
  buyer: string;
  seller: string;
  proposedBy: UserSummary;
  amount: number; // integer cents
  status: OfferStatus;
  previousOffer?: string | null;
  createdAt: string;
  updatedAt: string;
}
```

`amount` is **integer cents**, per the backend Zod schema (`z.number().int().nonnegative()`). Format for display with a currency util (`formatCents`); never let the user type decimals into a field bound straight to this value — round/parse to integer cents before submit.

---

## 3. REST Layer (Axios + TanStack Query v5)

### 3.1 Axios client
Single configured instance in `lib/api-client.ts` (base URL, auth interceptor attaching the bearer token / cookie, a response interceptor that unwraps `{ status, data }` and rejects with the server's `message` on non-2xx). All hooks below call through it — don't call `axios` directly in components.

### 3.2 Endpoints to wrap

| Method | Path | Purpose | Query hook |
|---|---|---|---|
| POST | `/api/conversations` | Create or reuse a 1:1 conversation | `useCreateConversation()` (mutation) |
| GET | `/api/conversations` | List my conversations, paginated, sorted by `updatedAt` | `useConversations(page)` (infinite or paginated query) |
| GET | `/api/conversations/:id` | Single conversation metadata | `useConversation(id)` |
| GET | `/api/conversations/:conversationId/messages` | Cursor-paginated message history, **newest-first** | `useMessages(conversationId)` (`useInfiniteQuery`) |
| PATCH | `/api/conversations/:conversationId/messages/read` | Mark all unread (not-mine) messages read | `useMarkMessagesRead(conversationId)` (mutation) |
| POST | `/api/conversations/:conversationId/offers` | Open a new negotiation | `useCreateOffer(conversationId)` (mutation) |
| GET | `/api/conversations/:conversationId/offers` | Full offer history, **oldest-first** | `useOffers(conversationId)` |
| PATCH | `/api/conversations/:conversationId/offers/:offerId` | Accept / reject / counter | `useRespondToOffer(conversationId)` (mutation) |

Admin-only `GET /api/admin/conversations` exists but is out of scope for this feature's user-facing frontend — only wire it if building the admin panel; same shape as `useConversations` with `{ path: '/api/admin/conversations' }`.

### 3.3 Pagination — two different strategies, don't mix them up

- **Conversation list**: offset pagination (`page`, `limit`, `skip` on the backend). Use `useQuery` with a `page` param in a Zustand or URL search-param state, or `useInfiniteQuery` with `getNextPageParam` returning `page + 1` while `hasNextPage` (server returns one extra row over `limit` to signal more pages — check the shared `buildPaginatedResponse` shape and slice accordingly).
- **Message history**: **cursor pagination** on `createdAt`, newest page first, scrolling *up* loads older messages. Use `useInfiniteQuery` with:
  - `initialPageParam: undefined`
  - `getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined`
  - Reverse each page's array before rendering (backend returns newest-first per page; the chat window wants oldest-at-top, newest-at-bottom).
  - Pair with `@tanstack/react-virtual` for the scrollback list — a busy conversation can have thousands of messages; do not render the full array unvirtualized.

### 3.4 Query key conventions

```ts
export const qk = {
  conversations: (page: number) => ['conversations', page] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  offers: (conversationId: string) => ['offers', conversationId] as const,
};
```

Invalidate `qk.conversations` on new-message socket events (updates `lastMessage`/order) and on `createConversation` success. Invalidate `qk.offers(conversationId)` is **not needed** on socket `offer_created`/`offer_updated` — instead directly patch the cache (see §4.3) to avoid a refetch race with the optimistic UI.

---

## 4. Socket.io Layer

### 4.1 Connection lifecycle

- One socket instance per authenticated session, created in a Zustand store or a dedicated `SocketProvider` (prefer Zustand store + a thin provider that calls `connect()`/`disconnect()` on auth state change, so any hook can read `useSocketStore.getState().socket` without prop drilling).
- On entering a conversation's chat screen, emit `join_conversation` with the conversation id (room naming on the server is `conversation_${conversationId}`, mirrored by `offer_created`/`offer_updated` emits in the offer controller — join must happen before offer/message events for that room will be received).
- Leave/unsubscribe listeners on unmount or on navigating to a different conversation to avoid duplicate handlers stacking up across remounts (React 19 StrictMode double-invokes effects in dev — guard with a ref or an idempotent `off()` before `on()`).

### 4.2 Messaging events

| Event | Direction | Payload (client → server / server → client) |
|---|---|---|
| `join_conversation` | emit | `{ conversationId }` |
| `send_message` | emit | `{ conversationId, text }` |
| `receive_message` | listen | `Message` |
| `typing_message` | emit (on input change, debounced) | `{ conversationId }` |
| `stop_typing_message` | emit (on blur / debounce timeout) | `{ conversationId }` |
| (typing broadcast back) | listen | mirror event name the server re-emits (confirm exact name against `config/socket.js`; treat as `{ conversationId, user }`) |

**Sending a message (no REST fallback):**
1. Optimistically append a locally-constructed `Message` (temp id, `sender` = current user, `isRead: false`) to the `qk.messages(conversationId)` cache via `queryClient.setQueryData` on the *first* page.
2. `socket.emit('send_message', { conversationId, text })`.
3. On `receive_message` for this conversation, reconcile: replace the optimistic temp message (match by a client-generated `clientId` you send alongside `text` if the backend echoes it back, otherwise match by sender+text+approx timestamp as a fallback) with the authoritative server message.
4. On socket `connect_error` or emit timeout, mark the optimistic message as failed (`status: 'failed'`) so the UI can offer retry — don't silently drop it.

**Receiving:** any `receive_message` for a conversation not currently open should still update that conversation's `lastMessage`/ordering in the `qk.conversations` cache (unshift-and-resort or `invalidateQueries`) so the conversation list stays live without a poll.

**Typing indicator:** local ephemeral UI state only — a Zustand slice (or `useState` if scoped to one chat window) keyed by conversation id, cleared after ~3s of inactivity or on `stop_typing_message`/`receive_message`. Never put this in TanStack Query — it's not server-cacheable data.

### 4.3 Offer events

| Event | Direction | Payload |
|---|---|---|
| `offer_created` | listen (room `conversation_${conversationId}`) | `Offer` (the raw Mongoose doc as emitted — not populated the same way the GET response is; treat fields defensively, e.g. `proposedBy` may be an id string here vs. a populated object from REST) |
| `offer_updated` | listen | `{ offer: Offer, newOffer?: Offer }` — `newOffer` present only on `action: 'counter'` |

On both events, patch `qk.offers(conversationId)` directly (append for `offer_created`; update the matching offer + append `newOffer` if present for `offer_updated`) rather than invalidating — this keeps the optimistic REST response and the socket echo from producing a flicker or a duplicate. Since the REST mutation (`useCreateOffer`/`useRespondToOffer`) already receives the created/updated offer in its response, **the mutation's `onSuccess` is the primary source of truth for the acting user**; the socket listener exists for the *other* participant and should be de-duped by `_id` before appending.

---

## 5. Business Rules the Frontend Must Enforce/Reflect (mirrored from backend)

These are enforced server-side (400/403/404/409 `AppError`s) — the frontend should pre-validate where cheap, and always render the server error message on failure rather than swallowing it, but should not assume it caught every case:

1. **Conversation creation**: `participantIds` must be non-empty; a 1:1 with an already-existing thread returns the *existing* conversation (200, not 201) — the UI should still just navigate into the returned conversation either way, don't branch UI on status code.
2. **1:1-only offers**: negotiation UI (the "Make an offer" affordance) must only render inside a conversation where `isGroup === false`. Hide it entirely in group chats rather than letting the request 400.
3. **One pending offer per (conversation, post)**: disable/hide "Make an offer" while an offer with `status: 'pending'` already exists for that post in that conversation; surface the existing pending offer's card instead (409 on the backend if bypassed).
4. **Can't respond to your own offer**: if `offer.proposedBy._id === currentUser.id`, render the offer as "Waiting for a response" with no accept/reject/counter controls at all — don't render disabled buttons, don't attempt the request (403 on the backend if bypassed).
5. **Only pending offers are actionable**: once `status !== 'pending'`, render a static status badge (Accepted / Rejected / Countered) instead of action buttons.
6. **Counter requires an amount**: the "counter" action in the UI must force an amount input before submit — mirror the backend's Zod `refine` (`amount` required iff `action === 'counter'`) client-side with the same Zod schema shape (see §6) so the form can't even submit invalid state.
7. **Seller/buyer resolution**: the frontend never picks buyer/seller — it's derived server-side from `post.author` vs. the other participant. Don't try to infer or display "you are the seller" from anything other than comparing `offer.seller`/`offer.buyer` to the current user id after the offer already exists.
8. **Listing must be active & priced**: "Make an offer" should only be offered on posts where `post.price` is a number and `post.status === 'active'` — check this before showing the entry point, not just on submit.
9. **Read receipts**: `markMessagesAsRead` should fire once, on chat-window open/focus (not on every scroll or every incoming message) — call it in a `useEffect` keyed on `conversationId` mount, and again on window focus if you want "seen while tab was backgrounded" accuracy. It only affects messages *not* sent by the current user.
10. **Participant-only access**: any conversation/messages/offers screen should treat a 403 from the backend as "not a participant" and redirect to the conversation list — the backend is the source of truth for membership; don't gate routes purely on client-cached participant lists that might be stale.

---

## 6. Validation (React Hook Form + Zod)

Mirror the backend Zod schemas exactly so client-side errors match server-side ones and the same messages can be reused. Put these in `schemas/` and share the `objectIdRegex` constant.

```ts
// schemas/conversation.schema.ts
import { z } from 'zod';

export const createConversationFormSchema = z.object({
  participantIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1),
  isGroup: z.boolean().default(false),
  title: z.string().trim().max(100).default(''),
});
export type CreateConversationFormValues = z.infer<typeof createConversationFormSchema>;
```

```ts
// schemas/offer.schema.ts
import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/);

export const createOfferFormSchema = z.object({
  postId: objectId,
  amount: z.number().int().nonnegative(),
});

export const respondOfferFormSchema = z
  .object({
    action: z.enum(['accept', 'reject', 'counter']),
    amount: z.number().int().nonnegative().optional(),
  })
  .refine((d) => d.action !== 'counter' || typeof d.amount === 'number', {
    message: 'amount is required when action is "counter"',
    path: ['amount'],
  });
export type RespondOfferFormValues = z.infer<typeof respondOfferFormSchema>;
```

If the amount input is a dollar-denominated `<input type="number" step="0.01">` for UX, convert to integer cents in the RHF `resolver`'s transform step (or a `zod.transform`) *before* it hits `amount` — don't store dollars anywhere in state that eventually gets sent to the API.

---

## 7. State Management Split (Zustand vs. TanStack Query)

| Concern | Owner |
|---|---|
| Conversation list, conversation detail, message pages, offer history (server data) | **TanStack Query** |
| Socket connection instance, connection status | **Zustand** (`useSocketStore`) |
| Typing-indicator state, "currently open conversation id", draft message text per conversation | **Zustand** (ephemeral, non-cacheable UI state) |
| Optimistic/failed message queue reconciliation | Lives inside the TanStack Query cache (via `setQueryData`), coordinated by a `useSendMessage` hook that wraps the socket emit — not a separate store |
| Auth/current user | Whatever the app's existing auth store is (out of scope here; assumed to already exist and expose `currentUser.id`) |

Do not duplicate server data (messages, offers, conversations) into Zustand "for convenience" — it will drift from the Query cache and from socket-patched state. Zustand owns only what TanStack Query structurally cannot (live sockets, transient UI).

---

## 8. Suggested File Structure

```
src/
  types/
    conversation.ts
    message.ts
    offer.ts
    user.ts
  schemas/
    conversation.schema.ts
    offer.schema.ts
  lib/
    api-client.ts
    query-keys.ts
    socket-client.ts        # creates/exports the socket.io-client instance
  api/
    conversations.api.ts    # thin axios wrapper functions
    messages.api.ts
    offers.api.ts
  hooks/
    useConversations.ts
    useConversation.ts
    useCreateConversation.ts
    useMessages.ts          # useInfiniteQuery, cursor-based
    useSendMessage.ts        # socket emit + optimistic cache patch
    useMarkMessagesRead.ts
    useTypingIndicator.ts    # Zustand-backed
    useOffers.ts
    useCreateOffer.ts
    useRespondToOffer.ts
    useConversationSocketSync.ts  # joins room, wires receive_message/offer_* listeners into caches
  store/
    socket.store.ts
    chat-ui.store.ts         # typing state, active conversation id, draft text
  components/
    conversations/
      ConversationList.tsx
      ConversationListItem.tsx
      NewConversationDialog.tsx
    chat/
      ChatWindow.tsx
      MessageList.tsx        # react-virtual
      MessageBubble.tsx
      MessageComposer.tsx
      TypingIndicator.tsx
    offers/
      OfferCard.tsx
      MakeOfferDialog.tsx
      CounterOfferForm.tsx
  routes/
    conversations/
      ConversationsPage.tsx
      ConversationPage.tsx   # :conversationId — hosts ChatWindow + offer panel
```

---

## 9. Implementation Order (recommended)

1. Types + Axios wrappers + query keys (§2, §3).
2. `useConversations` / `useConversation` / `useCreateConversation` + `ConversationList` — get navigation working with zero real-time yet.
3. Socket client + `useConversationSocketSync` (join room, no-op listeners) — wire connection lifecycle before building any feature on top of it.
4. `useMessages` (cursor `useInfiniteQuery`) + virtualized `MessageList` — static history first.
5. `useSendMessage` (socket emit + optimistic patch) + `receive_message` reconciliation — now chat is live.
6. `useMarkMessagesRead` on chat open.
7. Typing indicator (Zustand + `typing_message`/`stop_typing_message`).
8. Offers: `useOffers`, `OfferCard`, `MakeOfferDialog` (§5 rules 2–4, 8), `useCreateOffer`.
9. `useRespondToOffer` (accept/reject/counter) + `offer_updated` socket patch + counter form (§6 `respondOfferFormSchema`).
10. Polish: failed-message retry UI, empty states, admin conversation list if in scope.

---

## 10. Open Items to Confirm Against `config/socket.js` Before Coding

The controllers reference `config/socket.js` for the actual event handler implementations but it wasn't included in the provided files. Before implementing §4, confirm against that file:
- Exact payload shape emitted back on `send_message` acknowledgment (does it echo a client-generated id for optimistic reconciliation, or must the frontend match by sender+text+timestamp?).
- Exact event name/payload the server re-broadcasts for typing (`typing_message` vs. some `user_typing` variant), and whether it includes the typing user's id/username or just the conversation id.
- Auth handshake mechanism for the socket connection (token in `auth` payload vs. cookie-based) — determines what `socket-client.ts` needs to pass on `io(url, { auth: {...} })`.
