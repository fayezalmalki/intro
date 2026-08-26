/**
 * Edge-safe NextAuth config.
 *
 * No providers here: Nodemailer and Credentials use Node built-ins that the
 * Edge Runtime used by middleware.ts does not have. The full config, with
 * providers, lives in lib/auth.ts.
 */
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id ?? user.email;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
};
