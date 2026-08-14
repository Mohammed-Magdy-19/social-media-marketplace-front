import { create } from "zustand"

export type MobileTab = "social" | "marketplace"

interface LayoutState {
  activeMobileTab: MobileTab
  isNavDrawerOpen: boolean
  isDiscoveryDrawerOpen: boolean
  setActiveMobileTab: (tab: MobileTab) => void
  setNavDrawerOpen: (open: boolean) => void
  setDiscoveryDrawerOpen: (open: boolean) => void
}

export const useLayoutStore = create<LayoutState>()((set) => ({
  activeMobileTab: "social",
  isNavDrawerOpen: false,
  isDiscoveryDrawerOpen: false,
  setActiveMobileTab: (activeMobileTab) => set({ activeMobileTab }),
  setNavDrawerOpen: (isNavDrawerOpen) => set({ isNavDrawerOpen }),
  setDiscoveryDrawerOpen: (isDiscoveryDrawerOpen) =>
    set({ isDiscoveryDrawerOpen }),
}))
