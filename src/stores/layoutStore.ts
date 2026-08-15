import { create } from "zustand"

interface LayoutState {
  isNavDrawerOpen: boolean
  isDiscoveryDrawerOpen: boolean
  setNavDrawerOpen: (open: boolean) => void
  setDiscoveryDrawerOpen: (open: boolean) => void
}

export const useLayoutStore = create<LayoutState>()((set) => ({
  isNavDrawerOpen: false,
  isDiscoveryDrawerOpen: false,
  setNavDrawerOpen: (isNavDrawerOpen) => set({ isNavDrawerOpen }),
  setDiscoveryDrawerOpen: (isDiscoveryDrawerOpen) =>
    set({ isDiscoveryDrawerOpen }),
}))
