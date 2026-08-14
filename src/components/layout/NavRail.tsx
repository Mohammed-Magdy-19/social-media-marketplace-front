import { NavLink, useNavigate } from "react-router-dom"
import {
  Bookmark,
  Home,
  LayoutDashboard,
  MessageCircle,
  Store,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { useAuthStore } from "@/stores/authStore"
import { useLayoutStore } from "@/stores/layoutStore"
import type { PublicUser } from "@/types"

export function VipProfileCard({ user }: { user: PublicUser | null }) {
  const navigate = useNavigate()

  return (
    <Card className="overflow-hidden rounded-card bg-gradient-to-br from-brand via-brand-2 to-ink text-white ring-0">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <AvatarWithFallback
            name={user?.name ?? "Guest"}
            src={user?.avatar ?? null}
            className="size-10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">
              {user ? user.name : "Join Vendo"}
            </p>
            <p className="truncate text-xs text-white/70">
              {user ? `@${user.username}` : "Discover the market"}
            </p>
          </div>
        </div>
        {user ? (
          <div className="flex items-center gap-1.5">
            <Badge className="bg-white/15 text-white ring-1 ring-white/20">
              {user.role === "Admin" ? "Admin" : "Member"}
            </Badge>
            <Badge className="bg-ink/30 text-brand-3 ring-1 ring-brand-3/30">
              VIP
            </Badge>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-white text-ink hover:bg-white/90"
              onClick={() => void navigate("/login")}
            >
              Log in
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-white hover:bg-white/10 hover:text-white"
              onClick={() => void navigate("/register")}
            >
              Sign up
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const navItems: Array<{
  label: string
  to: string
  icon: typeof Home
  end: boolean
  tab?: "social" | "marketplace"
}> = [
  { label: "Home", to: "/", icon: Home, end: true, tab: "social" },
  { label: "Market", to: "/", icon: Store, end: false, tab: "marketplace" },
  { label: "Messages", to: "/messages", icon: MessageCircle, end: false },
  { label: "Saved", to: "/saved", icon: Bookmark, end: false },
  { label: "Profile", to: "/profile", icon: User, end: false },
]

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const user = useAuthStore((s) => s.user)
  const setActiveMobileTab = useLayoutStore((s) => s.setActiveMobileTab)
  const isAdmin = user?.role === "Admin"

  return (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {navItems.map((item) => (
        <NavLink
          key={item.label}
          to={item.to}
          end={item.end}
          onClick={() => {
            if (item.tab) {
              setActiveMobileTab(item.tab)
            }
            onNavigate?.()
          }}
          className={({ isActive }) =>
            cn(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground"
            )
          }
        >
          <item.icon className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink
          to="/admin"
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground"
            )
          }
        >
          <LayoutDashboard className="size-4 shrink-0" />
          <span className="truncate">Admin desk</span>
        </NavLink>
      )}
    </nav>
  )
}

export function NavRail() {
  const user = useAuthStore((s) => s.user)

  return (
    <aside className="sticky top-14 hidden h-[calc(100svh-3.5rem)] w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-3 lg:flex">
      <NavLinks />
      <Separator />
      <VipProfileCard user={user} />
    </aside>
  )
}
