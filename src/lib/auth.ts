import { betterAuth } from 'better-auth'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { getDatabase } from './db/client'

function configuredTrustedOrigins(): string[] {
  return Array.from(
    new Set([
      process.env.BETTER_AUTH_URL,
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',') ?? []),
    ].flatMap((origin) => {
      const trimmed = origin?.trim()
      return trimmed ? [trimmed] : []
    })),
  )
}

export const auth = betterAuth({
  database: {
    db: getDatabase(),
    type: 'postgres',
  },
  emailAndPassword: {
    enabled: true,
  },
  experimental: {
    joins: true,
  },
  user: {
    modelName: 'auth_users',
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  session: {
    modelName: 'auth_sessions',
    fields: {
      userId: 'user_id',
      expiresAt: 'expires_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  account: {
    modelName: 'auth_accounts',
    fields: {
      providerId: 'provider_id',
      accountId: 'account_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'auth_verifications',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  plugins: [tanstackStartCookies()],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: configuredTrustedOrigins(),
})
