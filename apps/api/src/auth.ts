import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { appUrl, authSecret, type DatabaseContext } from './database';
import * as schema from './schema';

export function createAuth(db: DatabaseContext['db'], secret = authSecret()) {
  return betterAuth({
    appName: 'MatchPlay',
    baseURL: appUrl,
    basePath: '/api/auth',
    secret,
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    trustedOrigins: [appUrl],
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'player', input: false },
        banned: { type: 'boolean', defaultValue: false, input: false },
        city: { type: 'string', defaultValue: 'Riga', input: false },
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === '/sign-in/email') {
          const email = String(ctx.body?.email ?? '').toLowerCase();
          const person = db.select().from(schema.user).where(eq(schema.user.email, email)).get();
          if (person?.banned)
            throw new APIError('FORBIDDEN', {
              message: 'This account is inactive. Contact your organiser.',
            });
        }
      }),
    },
  });
}
