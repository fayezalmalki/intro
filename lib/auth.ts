import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { env } from "cloudflare:workers";
import { resolveDb } from "./db";
import { authAccounts, authRateLimits, authSessions, authUsers, authVerifications } from "./db/schema";
import { sendOtpEmail } from "./mailer";

type AuthEnv = {
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};

const OTP_TTL_SECONDS = 10 * 60;

function createAuth() {
  const e = env as unknown as AuthEnv;
  const google = e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
    : {};

  return betterAuth({
    secret: e.BETTER_AUTH_SECRET,
    baseURL: e.BETTER_AUTH_URL,
    database: drizzleAdapter(resolveDb(), {
      provider: "sqlite",
      schema: {
        user: authUsers,
        session: authSessions,
        account: authAccounts,
        verification: authVerifications,
        rateLimit: authRateLimits,
      },
    }),
    socialProviders: google,
    // Rate limits are keyed by client IP. Cloudflare puts the real client IP
    // in cf-connecting-ip; without naming it, Better Auth cannot resolve an IP
    // and falls back to ONE bucket shared by every visitor — a limit of three
    // codes a minute for the whole site.
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    // Database-backed, not in-memory: Worker isolates do not share memory, so
    // an in-memory counter would reset per isolate and limit nothing.
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: {
        "/email-otp/send-verification-otp": { window: 60, max: 3 },
        "/sign-in/email-otp": { window: 60, max: 5 },
      },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: OTP_TTL_SECONDS,
        allowedAttempts: 5,
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp }) {
          await sendOtpEmail(email, otp);
        },
      }),
      // Lets server actions set the session cookie. Must stay last.
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
let cached: { db: unknown; auth: Auth } | undefined;

/**
 * The Better Auth instance for the current Worker. Created lazily because the
 * D1 binding and secrets are only readable from `cloudflare:workers` env, and
 * rebuilt if the binding changes (tests run several isolated databases).
 */
export function getAuth(): Auth {
  const database = resolveDb();
  if (cached?.db !== database) cached = { db: database, auth: createAuth() };
  return cached.auth;
}

export const googleEnabled = () => {
  const e = env as unknown as AuthEnv;
  return Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET);
};

/** The signed-in user, or null. */
export async function getSessionUser(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
}
