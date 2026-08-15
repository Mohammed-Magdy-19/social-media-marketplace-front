import { create } from "zustand"

export type FeedSort = "newest" | "oldest" | "most_liked" | "most_commented"

interface FilterState {
  category: string | null
  tag: string | null
  author: string | null
  sort: FeedSort
  setCategory: (category: string | null) => void
  setTag: (tag: string | null) => void
  setAuthor: (author: string | null) => void
  setSort: (sort: FeedSort) => void
  reset: () => void
}

export const useFilterStore = create<FilterState>()((set) => ({
  category: null,
  tag: null,
  author: null,
  sort: "newest",
  setCategory: (category) => set({ category }),
  setTag: (tag) => set({ tag }),
  setAuthor: (author) => set({ author }),
  setSort: (sort) => set({ sort }),
  reset: () => set({ category: null, tag: null, author: null, sort: "newest" }),
}))
