import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Bell, LayoutDashboard, LogOut, Menu, MessageCircle, Moon, Sun } from "lucide-react"
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

  const onSearch = (values: SearchValues) => {
    const query = values.query.trim()
    void navigate(query ? `/?q=${encodeURIComponent(query)}` : "/")
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
        onClick={() => void navigate("/")}
        className="flex items-center gap-2 outline-none"
        aria-label="Vendo home"
      >
        <Logo size={28} showWordmark className="hidden sm:inline-flex" />
        <Logo size={28} className="sm:hidden" />
      </button>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSearch)}
          className="mx-auto w-full max-w-xl px-2"
          role="search"
        >
          <FormField
            control={form.control}
            name="query"
            render={({ field }) => (
              <FormItem className="grid">
                <FormControl>
                  <Input
                    {...field}
                    type="search"
                    placeholder="Search posts, tags, categories..."
                    aria-label="Search posts, tags, categories"
                    className="h-9 rounded-pill bg-soft"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </form>
      </Form>

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
              {(notifications ?? []).slice(0, 5).map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  className="flex items-start gap-2 whitespace-normal py-2"
                  disabled
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
              ))}
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
