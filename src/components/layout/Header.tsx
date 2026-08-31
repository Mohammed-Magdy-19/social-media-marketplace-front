import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  Bell,
  Hash,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageCircle,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useNavigate } from "react-router-dom"
import { Logo } from "@/components/shared/Logo"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useAuthStore } from "@/stores/authStore"
import { useLayoutStore } from "@/stores/layoutStore"
import { useCurrentUser } from "@/features/auth/queries"
import { useLogoutMutation } from "@/features/auth/mutations"
import { useNotifications } from "@/features/notifications/queries"
import { useSearchUsers } from "@/features/users/queries"
import { searchSchema } from "@/features/search/schemas"
import type { z } from "zod"

type SearchValues = z.infer<typeof searchSchema>

export function Header() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const setNavDrawerOpen = useLayoutStore((s) => s.setNavDrawerOpen)
  const { theme, setTheme } = useTheme()
  const logout = useLogoutMutation()
  const { data: notifications } = useNotifications()

  useCurrentUser()

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0

  const form = useForm<SearchValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { query: "" },
  })

  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false)
  const searchContainerRef = React.useRef<HTMLDivElement>(null)

  const rawQuery = form.watch("query") ?? ""
  const isTagSearch = rawQuery.trim().startsWith("#")
  const isUserSearch = rawQuery.trim().startsWith("@")
  const cleanQuery = rawQuery.trim().replace(/^[#@]+/, "").trim()

  const { data: userResults = [], isFetching: isSearchingUsers } = useSearchUsers(
    isTagSearch ? "" : cleanQuery
  )

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelectTag = (tag: string) => {
    setIsDropdownOpen(false)
    form.setValue("query", `#${tag}`)
    void navigate(`/market?tag=${encodeURIComponent(tag)}`)
  }

  const handleSelectUser = (userId: string) => {
    setIsDropdownOpen(false)
    form.setValue("query", "")
    void navigate(`/users/${userId}`)
  }

  const handleSearchListings = (q: string) => {
    setIsDropdownOpen(false)
    void navigate(`/market?q=${encodeURIComponent(q)}`)
  }

  const onSearch = (values: SearchValues) => {
    const raw = values.query.trim()
    if (!raw) return
    setIsDropdownOpen(false)

    // Tag search: #minimalist or ##minimalist
    if (raw.startsWith("#")) {
      const tag = raw.replace(/^#+/, "").trim()
      if (tag) {
        void navigate(`/market?tag=${encodeURIComponent(tag)}`)
        return
      }
    }

    // User search: @username
    if (raw.startsWith("@")) {
      const username = raw.replace(/^@+/, "").trim().toLowerCase()
      const exactMatch = userResults.find(
        (u) => u.username.toLowerCase() === username
      )
      if (exactMatch) {
        void navigate(`/users/${exactMatch.id}`)
        return
      }
      if (username) {
        void navigate(`/market?q=${encodeURIComponent(username)}`)
        return
      }
    }

    // Default search across listings
    void navigate(`/market?q=${encodeURIComponent(raw)}`)
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-card px-3 md:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="md:hidden"
        onClick={() => setNavDrawerOpen(true)}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <button
        type="button"
        onClick={() => void navigate("/home")}
        className="flex items-center gap-2 outline-none"
        aria-label="Vendo home"
      >
        <Logo size={28} showWordmark className="hidden sm:inline-flex" />
        <Logo size={28} className="sm:hidden" />
      </button>

      <div ref={searchContainerRef} className="relative mx-auto min-w-0 max-w-xl flex-1 px-2">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSearch)}
            role="search"
            className="relative"
          >
            <FormField
              control={form.control}
              name="query"
              render={({ field }) => (
                <FormItem className="grid">
                  <FormControl>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      <Input
                        {...field}
                        type="search"
                        placeholder="Search users (@alex), tags (#minimalist), listings..."
                        aria-label="Search users, tags, or listings"
                        className="h-9 pl-9 pr-8 rounded-pill bg-soft text-xs transition-all focus:bg-background"
                        onFocus={() => {
                          if (rawQuery.trim()) setIsDropdownOpen(true)
                        }}
                        onChange={(e) => {
                          field.onChange(e)
                          setIsDropdownOpen(Boolean(e.target.value.trim()))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setIsDropdownOpen(false)
                          }
                        }}
                      />
                      {rawQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            form.setValue("query", "")
                            setIsDropdownOpen(false)
                          }}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                          aria-label="Clear search"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />
          </form>
        </Form>

        {/* Live Search Autocomplete Dropdown */}
        {isDropdownOpen && cleanQuery && (
          <div className="absolute left-2 right-2 top-full mt-1.5 z-50 overflow-hidden rounded-2xl bg-card border border-border shadow-xl ring-1 ring-black/5 animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="p-1.5 flex flex-col gap-1 max-h-80 overflow-y-auto no-scrollbar">
              {/* Tag Search Action */}
              <button
                type="button"
                onClick={() => handleSelectTag(cleanQuery)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-brand/10 hover:text-brand cursor-pointer"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                  <Hash className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-foreground">Filter by tag: </span>
                  <span className="font-mono text-brand font-bold">#{cleanQuery}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Marketplace</span>
              </button>

              {/* General Listings Search Action */}
              {!isTagSearch && !isUserSearch && (
                <button
                  type="button"
                  onClick={() => handleSearchListings(cleanQuery)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-muted cursor-pointer"
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Search className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-muted-foreground">Search listings for </span>
                    <span className="font-semibold text-foreground">&ldquo;{cleanQuery}&rdquo;</span>
                  </div>
                </button>
              )}

              {/* User Results Section */}
              {!isTagSearch && (
                <div className="pt-1">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    People & Creators
                  </div>
                  {isSearchingUsers ? (
                    <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin text-brand" />
                      <span>Searching users…</span>
                    </div>
                  ) : userResults.length > 0 ? (
                    userResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u.id)}
                        className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-left text-xs transition-colors hover:bg-muted cursor-pointer"
                      >
                        <AvatarWithFallback
                          name={u.name || u.username}
                          src={u.avatar}
                          size="sm"
                          className="size-7"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-foreground leading-tight">
                            {u.name || u.username}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            @{u.username}
                          </p>
                        </div>
                        {u.role === "admin" && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                            Admin
                          </Badge>
                        )}
                      </button>
                    ))
                  ) : isUserSearch ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No users found matching @{cleanQuery}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              />
            }
            aria-label="Toggle canvas mode"
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </TooltipTrigger>
          <TooltipContent>Canvas mode</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="hidden md:inline-flex"
                onClick={() => void navigate("/messages")}
              />
            }
            aria-label="Messages"
          >
            <MessageCircle />
          </TooltipTrigger>
          <TooltipContent>Messages</TooltipContent>
        </Tooltip>

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" className="relative" />}
              aria-label="Notifications"
            >
              <Bell />
              {unreadCount > 0 && (
                <Badge
                  className="absolute -top-1 -right-1 h-4 min-w-4 rounded-pill px-1 text-[10px]"
                  variant="destructive"
                >
                  {unreadCount}
                </Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications && notifications.length > 0 ? (
                notifications.slice(0, 5).map((n, idx) => (
                  <DropdownMenuItem
                    key={n.id || `${idx}-${n.createdAt}`}
                    className="flex items-start gap-2 whitespace-normal py-2 cursor-pointer"
                    onClick={() =>
                      void navigate(
                        user.role === "admin" ? "/admin/notifications" : "/profile"
                      )
                    }
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {n.title}
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {n.body}
                      </span>
                    </span>
                    {!n.read && (
                      <span className="mt-1.5 ml-auto size-2 shrink-0 rounded-full bg-brand" />
                    )}
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  No notifications yet
                </div>
              )}
              {notifications && notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      void navigate(
                        user.role === "admin" ? "/admin/notifications" : "/profile"
                      )
                    }
                  >
                    View all
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button variant="ghost" size="icon-sm" aria-label="Notifications">
            <Bell />
          </Button>
        )}

        <Separator orientation="vertical" className="mx-1 h-6" />

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" />}
              aria-label="Account menu"
            >
              <AvatarWithFallback name={user.name} src={user.avatar} size="sm" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>
                <span className="block text-sm">{user.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  @{user.username}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void navigate("/profile")}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void navigate("/saved")}>
                Saved posts
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void navigate("/messages")}>
                Messages
              </DropdownMenuItem>
              {user.role === "admin" && (
                <DropdownMenuItem onClick={() => void navigate("/admin")}>
                  <LayoutDashboard />
                  Admin console
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => logout.mutate()}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => void navigate("/login")}>
              Log in
            </Button>
            <Button size="sm" onClick={() => void navigate("/register")}>
              Sign up
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
