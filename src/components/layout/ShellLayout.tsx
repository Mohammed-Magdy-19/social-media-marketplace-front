import { useEffect } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { Header } from "./Header"
import { NavRail, NavLinks, VipProfileCard } from "./NavRail"
import { RightRail } from "./RightRail"
import { MobileTabBar } from "./MobileTabBar"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { useLayoutStore } from "@/stores/layoutStore"
import { useAuthStore } from "@/stores/authStore"

function NavDrawer() {
  const isNavDrawerOpen = useLayoutStore((s) => s.isNavDrawerOpen)
  const setNavDrawerOpen = useLayoutStore((s) => s.setNavDrawerOpen)

  return (
    <Sheet open={isNavDrawerOpen} onOpenChange={setNavDrawerOpen}>
      <SheetContent side="left" className="w-64 gap-0 p-0 sm:max-w-xs">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <NavRailContent />
      </SheetContent>
    </Sheet>
  )
}

function NavRailContent() {
  const user = useAuthStore((s) => s.user)
  const setNavDrawerOpen = useLayoutStore((s) => s.setNavDrawerOpen)

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-3">
      <NavLinks onNavigate={() => setNavDrawerOpen(false)} />
      <VipProfileCard user={user} />
    </div>
  )
}

export default function ShellLayout() {
  const setNavDrawerOpen = useLayoutStore((s) => s.setNavDrawerOpen)
  const location = useLocation()

  useEffect(() => {
    setNavDrawerOpen(false)
    window.scrollTo(0, 0)
  }, [location.pathname, setNavDrawerOpen])

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <Header />
      <div className="mx-auto flex w-full max-w-7xl flex-1 items-start">
        <NavRail />
        <main className="min-w-0 flex-1 px-3 pb-16 md:pb-6">
          <Outlet />
        </main>
        <RightRail />
      </div>
      <MobileTabBar />
      <NavDrawer />
    </div>
  )
}
