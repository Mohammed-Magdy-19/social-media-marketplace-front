import { create } from "zustand"

interface NegotiationUiState {
  activeConversationId: string | null
  /** conversationId -> senderIds currently typing */
  typingUserIds: Record<string, string[]>
  setActiveConversation: (id: string | null) => void
  setTyping: (conversationId: string, senderId: string, typing: boolean) => void
}

export const useNegotiationUiStore = create<NegotiationUiState>()((set) => ({
  activeConversationId: null,
  typingUserIds: {},
  setActiveConversation: (activeConversationId) => set({ activeConversationId }),
  setTyping: (conversationId, senderId, typing) =>
    set((state) => {
      const current = state.typingUserIds[conversationId] ?? []
      const next = typing
        ? current.includes(senderId)
          ? current
          : [...current, senderId]
        : current.filter((id) => id !== senderId)
      return { typingUserIds: { ...state.typingUserIds, [conversationId]: next } }
    }),
}))
