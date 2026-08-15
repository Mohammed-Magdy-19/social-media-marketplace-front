import { NavLink, useLocation } from "react-router-dom"
import {
  Bookmark,
  Home,
  MessageCircle,
  Store,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

type TabDef = {
  label: string
  icon: typeof Home
  to: string
  end?: boolean
}

const tabs: TabDef[] = [
  { label: "Home", icon: Home, to: "/home", end: true },
  { label: "Market", icon: Store, to: "/market", end: true },
  { label: "Chat", icon: MessageCircle, to: "/messages" },
  { label: "Saved", icon: Bookmark, to: "/saved" },
  { label: "Profile", icon: User, to: "/profile" },
]

export function MobileTabBar() {
  const location = useLocation()

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-stretch border-t border-border bg-card md:hidden"
    >
      {tabs.map((tab) => {
        const isActive = tab.end
          ? location.pathname === tab.to
          : location.pathname.startsWith(tab.to)
        return (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
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
