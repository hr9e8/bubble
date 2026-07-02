import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { CurrentUserContext } from './lib/server/auth-context'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    context: {
      currentUser: null as CurrentUserContext | null,
    },
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
