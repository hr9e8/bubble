import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronDown, CircleUserRound, LogOut, PencilLine } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { navigationItems } from '../lib/domain'
import type { CurrentUserContext } from '../lib/server/auth-context'
import { cn } from '../lib/utils'

export function AppShell({
  children,
  currentUser,
}: {
  children: ReactNode
  currentUser: CurrentUserContext | null
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const showNavigation = Boolean(currentUser)
  const [openNavMenu, setOpenNavMenu] = useState<string | null>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navMenuRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userMenuOpen && !openNavMenu) return

    function handlePointerDown(event: PointerEvent) {
      if (openNavMenu && !navMenuRef.current?.contains(event.target as Node)) {
        setOpenNavMenu(null)
      }

      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenNavMenu(null)
        setUserMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openNavMenu, userMenuOpen])

  useEffect(() => {
    setOpenNavMenu(null)
    setUserMenuOpen(false)
  }, [pathname])

  return (
    <div className="app-surface min-h-screen">
      <header className="app-topbar sticky top-0 z-30 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-3 px-4 py-2 sm:flex-nowrap sm:gap-4 sm:py-0 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center" aria-label="OCOC dashboard">
            <img src="/OCOC-Logo.svg" alt="OCOC" className="h-9 w-auto sm:h-10" />
          </Link>

          {showNavigation ? (
            <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] min-w-0 items-center justify-start gap-1 overflow-x-auto border-t border-[#ebebeb] px-4 pt-2 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:justify-center sm:overflow-visible sm:border-t-0 sm:px-2 sm:pt-0">
              {navigationItems.map((item) => {
                const Icon = item.icon
                const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                const hasChildren = Boolean(item.children?.length)

                if (hasChildren) {
                  const menuOpen = openNavMenu === item.href

                  return (
                    <div key={item.href} ref={navMenuRef} className="relative shrink-0">
                      <button
                        type="button"
                        className={cn(
                          'app-nav-link',
                          active && 'app-nav-link-active',
                        )}
                        aria-haspopup="menu"
                        aria-expanded={menuOpen}
                        onClick={() => setOpenNavMenu((open) => open === item.href ? null : item.href)}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                        <ChevronDown
                          className={cn(
                            'h-4 w-4 text-[#616161] transition-transform',
                            menuOpen && 'rotate-180',
                          )}
                          aria-hidden="true"
                        />
                      </button>

                      {menuOpen ? (
                        <div className="popover-surface fixed inset-x-4 top-[7.25rem] z-40 max-h-[calc(100vh-8rem)] overflow-y-auto p-2 sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+0.5rem)] sm:max-h-[min(32rem,calc(100vh-5rem))] sm:w-72" role="menu">
                          <Link to={item.href} className="popover-action" role="menuitem" onClick={() => setOpenNavMenu(null)}>
                            <Icon className="h-4 w-4 text-[#616161]" />
                            Admin overview
                          </Link>
                          <div className="my-2 border-t border-[#ebebeb]" />
                          {item.children?.map((child) => {
                            const ChildIcon = child.icon

                            return (
                              <Link key={child.href} to={child.href} className="popover-action" role="menuitem" onClick={() => setOpenNavMenu(null)}>
                                <ChildIcon className="h-4 w-4 text-[#616161]" />
                                {child.label}
                              </Link>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                }

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      'app-nav-link',
                      active && 'app-nav-link-active',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          ) : (
            <div className="flex-1" />
          )}

          <div className="ml-auto flex shrink-0 items-center gap-3">
            {currentUser ? (
              <div ref={userMenuRef} className="relative">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[#f1f1f1]"
                  aria-label="Open account menu"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen((open) => !open)}
                >
                  <CircleUserRound className="h-9 w-9 rounded-full bg-[#ebebeb] p-1.5 text-[#616161]" />
                  <span className="hidden text-right md:block">
                    <span className="block text-sm font-semibold leading-5 text-[#303030]">{currentUser.name}</span>
                    <span className="block text-xs leading-4 text-[#616161]">{currentUser.roles.join(', ')}</span>
                  </span>
                  <ChevronDown
                    className={cn(
                      'hidden h-4 w-4 text-[#616161] transition-transform sm:block',
                      userMenuOpen && 'rotate-180',
                    )}
                    aria-hidden="true"
                  />
                </button>

                {userMenuOpen ? (
                  <div className="popover-surface absolute right-0 top-[calc(100%+0.5rem)] z-40 p-2" role="menu">
                    <div className="mb-2 border-b border-[#ebebeb] px-2 pb-2 md:hidden">
                      <p className="text-sm font-semibold text-[#303030]">{currentUser.name}</p>
                      <p className="text-xs text-[#616161]">{currentUser.roles.join(', ')}</p>
                    </div>
                    <Link to="/admin/users" className="popover-action" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                      <PencilLine className="h-4 w-4 text-[#616161]" />
                      Edit profile
                    </Link>
                    <Link to="/logout" className="popover-action" role="menuitem" onClick={() => setUserMenuOpen(false)}>
                      <LogOut className="h-4 w-4 text-[#616161]" />
                      Logout
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link to="/login" search={{ redirect: '/' }} className="polaris-button polaris-button-primary">
                Login
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-8">{children}</main>
    </div>
  )
}
