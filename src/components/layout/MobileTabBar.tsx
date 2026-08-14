import { NavLink, useLocation } from "react-router-dom"
import {
  Bookmark,
  Home,
  MessageCircle,
  Store,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useLayoutStore, type MobileTab } from "@/stores/layoutStore"

type TabDef = {
  label: string
  icon: typeof Home
  to: string
  tab: MobileTab
  end?: boolean
}

const tabs: TabDef[] = [
  { label: "Home", icon: Home, to: "/", tab: "social", end: true },
  { label: "Market", icon: Store, to: "/", tab: "marketplace" },
  { label: "Chat", icon: MessageCircle, to: "/messages", tab: "social" },
  { label: "Saved", icon: Bookmark, to: "/saved", tab: "social" },
  { label: "Profile", icon: User, to: "/profile", tab: "social" },
]

export function MobileTabBar() {
  const location = useLocation()
  const activeTab = useLayoutStore((s) => s.activeMobileTab)
  const setActiveMobileTab = useLayoutStore((s) => s.setActiveMobileTab)

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-border bg-card md:hidden"
    >
      {tabs.map((tab) => {
        const isHomeRoute = tab.to === "/"
        const isActive = isHomeRoute
          ? activeTab === tab.tab
          : location.pathname.startsWith(tab.to)
        return (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            onClick={() => setActiveMobileTab(tab.tab)}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors",
              isActive && "text-brand"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <tab.icon className="size-5" />
            <span>{tab.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
