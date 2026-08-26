import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, gt } from "drizzle-orm";
import { authConfig } from "../auth.config";
import { db } from "./db";
import {
  authAccounts, authSessions, authUsers, authVerificationTokens, otpCodes,
} from "./db/schema";
import { sendMagicLinkEmail } from "./mailer";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: authUsers,
    accountsTable: authAccounts,
    sessionsTable: authSessions,
    verificationTokensTable: authVerificationTokens,
  }),
  providers: [
    /**
     * Google is here for sequencing, not convenience: asking for gmail.send
     * later is an incremental grant on an account already connected rather
     * than a cold OAuth prompt. It is also a much stronger signal for the
     * `verified` account state than a self-asserted address.
     */
    ...(process.env.AUTH_GOOGLE_ID
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    ...(process.env.SMTP_PASSWORD
      ? [
          Nodemailer({
            server: {
              host: "smtp.improvmx.com",
              port: 587,
              secure: false,
              requireTLS: true,
              auth: { user: "noreply@intro.sa", pass: process.env.SMTP_PASSWORD },
            },
            from: "Intro <noreply@intro.sa>",
            sendVerificationRequest: async ({ identifier, url }) => {
              await sendMagicLinkEmail(identifier, url);
            },
          }),
        ]
      : []),

    /** Verifies a six-digit code issued by /api/auth/send-otp. */
    Credentials({
      id: "email-otp",
      name: "Email OTP",
      credentials: {
        email: { label: "Email", type: "email" },
        code: { label: "Code", type: "text" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
        const code = credentials?.code as string | undefined;
        if (!email || !code) return null;

        const [otp] = await db
          .select().from(otpCodes)
          .where(and(eq(otpCodes.email, email), eq(otpCodes.code, code), gt(otpCodes.expiresAt, new Date())))
          .limit(1);
        if (!otp) return null;

        // One-time use, consumed before the session exists.
        await db.delete(otpCodes).where(eq(otpCodes.id, otp.id));

        let [user] = await db.select().from(authUsers).where(eq(authUsers.email, email)).limit(1);
        if (!user) {
          [user] = await db
            .insert(authUsers).values({ email, emailVerified: new Date() }).returning();
        } else if (!user.emailVerified) {
          await db.update(authUsers).set({ emailVerified: new Date() }).where(eq(authUsers.id, user.id));
        }
        return { id: user.id, email: user.email! };
      },
    }),

    /**
     * Development only, and gated so it cannot exist in a deploy. This is what
     * lets scripts/e2e.mjs sign in as a requester and an account manager
     * without real credentials.
     */
    ...(process.env.NODE_ENV === "development"
      ? [
          Credentials({
            id: "dev-email",
            name: "Dev Email",
            credentials: { email: { label: "Email", type: "email" } },
            async authorize(credentials) {
              const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
              if (!email) return null;
              let [user] = await db.select().from(authUsers).where(eq(authUsers.email, email)).limit(1);
              if (!user) {
                [user] = await db
                  .insert(authUsers).values({ email, emailVerified: new Date() }).returning();
              }
              return { id: user.id, email: user.email! };
            },
          }),
        ]
      : []),
  ],
});
