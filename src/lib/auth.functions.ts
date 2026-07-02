import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const { getOptionalCurrentUser } = await import('./server/auth-context')
  return getOptionalCurrentUser()
})

export const requirePrivateUser = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireCurrentUser } = await import('./server/auth-context')
  return requireCurrentUser()
})

export const getAuthBootstrapStatus = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDatabase } = await import('./db/client')
  const existingUser = await getDatabase().selectFrom('auth_users').select('id').limit(1).executeTakeFirst()

  return {
    requiresSetup: !existingUser,
  }
})

const bootstrapAdminInput = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
})

export const bootstrapInitialAdmin = createServerFn({ method: 'POST' })
  .validator(bootstrapAdminInput)
  .handler(async ({ data }) => {
    const [{ auth }, { getDatabase }] = await Promise.all([
      import('./auth'),
      import('./db/client'),
    ])
    const existingUser = await getDatabase().selectFrom('auth_users').select('id').limit(1).executeTakeFirst()

    if (existingUser) {
      throw new Error('Initial setup has already been completed.')
    }

    const result = await auth.api.signUpEmail({
      body: {
        email: data.email,
        name: data.name,
        password: data.password,
      },
      headers: getRequest().headers,
    })

    const adminRole = await getDatabase()
      .selectFrom('roles')
      .select('id')
      .where('name', '=', 'admin')
      .executeTakeFirstOrThrow()

    await getDatabase()
      .insertInto('user_roles')
      .values({
        user_id: result.user.id,
        role_id: adminRole.id,
      })
      .execute()

    return {
      email: result.user.email,
      name: result.user.name,
      userId: result.user.id,
    }
  })
