import { HeadContent, Link, Scripts, createRootRouteWithContext, redirect } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { AppShell } from '../components/app-shell'
import { getCurrentUser } from '../lib/auth.functions'
import type { CurrentUserContext } from '../lib/server/auth-context'

import appCss from '../styles.css?url'

type RouterContext = {
  currentUser: CurrentUserContext | null
}

const publicPathPrefixes = ['/api/', '/login', '/unauthorized']

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ location }) => {
    const currentUser = await getCurrentUser()
    const isPublicPath = publicPathPrefixes.some((prefix) => location.pathname.startsWith(prefix))

    if (!currentUser && !isPublicPath) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }

    return {
      currentUser,
    }
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'HQ OCOC',
      },
      {
        name: 'description',
        content: 'OCOC sales order, stock, finance, and warehouse operations rebuilt from Bubble.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/OCOC-Logo.svg',
      },
    ],
  }),
  notFoundComponent: RootNotFound,
  shellComponent: RootDocument,
})

function RootNotFound() {
  return (
    <main className="app-page">
      <section className="section-card">
        <h1 className="page-title">Page not found</h1>
        <p className="page-description">The page you requested does not exist or is outside your current workspace.</p>
        <div className="mt-5">
          <Link to="/" className="polaris-button polaris-button-primary">
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { currentUser } = Route.useRouteContext()

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AppShell currentUser={currentUser}>{children}</AppShell>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
