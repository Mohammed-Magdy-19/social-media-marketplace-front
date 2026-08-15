import * as React from "react"
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import {
  BarChart3,
  Bell,
  Command as CommandIcon,
  FileText,
  FolderTree,
  Images,
  LayoutGrid,
  ListOrdered,
  LogOut,
  MessagesSquare,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react"
import type { z } from "zod"
import { ADMIN_VIEWS, useAdminUiStore } from "@/stores/adminUiStore"
import { useReports } from "@/features/admin/queries"
import { useNotifications } from "@/features/notifications/queries"
import { adminGlobalSearchSchema } from "@/features/admin/schemas"
import { useLogoutMutation } from "@/features/auth/mutations"
import { useAuthStore } from "@/stores/authStore"
import { AvatarWithFallback } from "@/components/shared/AvatarWithFallback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const NAV_GROUPS: {
  label: string
  items: { view: (typeof ADMIN_VIEWS)[number]; label: string; icon: React.ComponentType }[]
}[] = [
  {
    label: "Overview",
    items: [{ view: "overview", label: "Overview", icon: BarChart3 }],
  },
  {
    label: "Content",
    items: [
      { view: "posts", label: "Posts", icon: FileText },
      { view: "categories", label: "Categories", icon: FolderTree },
    ],
  },
  {
    label: "Community",
    items: [
      { view: "users", label: "Users", icon: Users },
      { view: "reports", label: "Reports", icon: ShieldCheck },
      { view: "notifications", label: "Notifications", icon: Bell },
      { view: "conversations", label: "Conversations", icon: MessagesSquare },
    ],
  },
  {
    label: "Commerce",
    items: [{ view: "payments", label: "Payments", icon: ListOrdered }],
  },
  {
    label: "System",
    items: [
      { view: "audit-logs", label: "Audit Logs", icon: ScrollText },
      { view: "uploads", label: "Uploads", icon: Images },
    ],
  },
]

const VIEW_ROUTE: Record<string, string> = {
  overview: "/admin",
  posts: "/admin/posts",
  categories: "/admin/categories",
  users: "/admin/users",
  reports: "/admin/reports",
  notifications: "/admin/notifications",
  conversations: "/admin/conversations",
  payments: "/admin/payments",
  "audit-logs": "/admin/audit-logs",
  uploads: "/admin/uploads",
}

function ReportsBadge() {
  const { data } = useReports()
  const pending = data?.data.filter((r) => r.status === "pending").length ?? 0
  if (pending === 0) return null
  return (
    <Badge
      className="ml-auto h-5 min-w-5 rounded-pill px-1 font-mono text-[10px]"
      variant="destructive"
    >
      {pending}
    </Badge>
  )
}

function NotificationsBadge() {
  const { data } = useNotifications()
  const unread = data?.filter((n) => !n.read).length ?? 0
  if (unread === 0) return null
  return (
    <Badge className="ml-auto h-5 min-w-5 rounded-pill px-1 font-mono text-[10px]">
      {unread}
    </Badge>
  )
}

function AdminSidebar() {
  const location = useLocation()
  const path = location.pathname
  const activeView = (Object.entries(VIEW_ROUTE).find(([, route]) =>
    path === route
  )?.[0] ?? "overview") as (typeof ADMIN_VIEWS)[number]

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link to="/admin" />}
              className="gap-2 px-2"
            >
              <div className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-icon-btn)] bg-brand text-white">
                <LayoutGrid className="size-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-sm font-bold tracking-[-0.02em]">
                  Vendo Admin
                </span>
                <span className="text-[10px] text-mut">Control Center</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.view}>
                      <SidebarMenuButton
                        isActive={activeView === item.view}
                        render={<Link to={VIEW_ROUTE[item.view]} />}
                      >
                        <Icon />
                        <span>{item.label}</span>
                        {item.view === "reports" && <ReportsBadge />}
                        {item.view === "notifications" && <NotificationsBadge />}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/" />}>
              <LayoutGrid />
              <span>Back to marketplace</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()
  const setGlobalSearchQuery = useAdminUiStore((s) => s.setGlobalSearchQuery)
  const form = useForm<z.infer<typeof adminGlobalSearchSchema>>({
    resolver: zodResolver(adminGlobalSearchSchema),
    defaultValues: { query: "" },
  })
  const query = form.watch("query")

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    const t = setTimeout(() => setGlobalSearchQuery(query.trim()), 200)
    return () => clearTimeout(t)
  }, [query, setGlobalSearchQuery])

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return NAV_GROUPS.flatMap((group) =>
      group.items
        .filter((item) => item.label.toLowerCase().includes(q))
        .map((item) => ({ ...item, group: group.label }))
    )
  }, [query])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-56 justify-start gap-2 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <CommandIcon className="size-3.5" />
        <span className="text-xs">Search views…</span>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          ⌘K
        </Badge>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <form
            onSubmit={form.handleSubmit((values) => {
              const target = VIEW_ROUTE[values.query] ?? VIEW_ROUTE.overview
              navigate(target)
              setOpen(false)
            })}
          >
            <CommandInput
              placeholder="Type a view or ⌘K to navigate…"
              value={query}
              onValueChange={(v) => form.setValue("query", v)}
              {...form.register("query")}
            />
          </form>
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Admin views">
              {results.map((item) => {
                const Icon = item.icon
                return (
                  <CommandItem
                    key={item.view}
                    value={item.label}
                    onSelect={() => {
                      navigate(VIEW_ROUTE[item.view])
                      setOpen(false)
                    }}
                  >
                    <Icon />
                    <span>{item.label}</span>
                    <CommandShortcut>{item.group}</CommandShortcut>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}

function AdminTopbar() {
  const user = useAuthStore((s) => s.user)
  const logout = useLogoutMutation()

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border bg-background/80 px-3 backdrop-blur supports-backdrop-filter:bg-background/60 md:px-4">
      <SidebarTrigger />
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" />}>
            <Bell />
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" />}>
            <Settings />
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
        <div className="mx-1 h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <AvatarWithFallback
            name={user?.name ?? "Admin"}
            src={user?.avatar ?? null}
            size="sm"
          />
          <span className="hidden text-sm font-medium lg:block">
            {user?.name ?? "Admin"}
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => logout.mutate()}
              />
            }
          >
            <LogOut />
          </TooltipTrigger>
          <TooltipContent>Log out</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}

export default function AdminRoot() {
  return (
    <div className="min-h-svh bg-bg">
      <SidebarProvider
        style={{ "--sidebar-width": "15.5rem" } as React.CSSProperties}
      >
        <AdminSidebar />
        <SidebarRail />
        <SidebarInset className="bg-bg">
          <AdminTopbar />
          <main className="p-4 md:p-5">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
