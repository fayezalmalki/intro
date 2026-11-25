"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient } from "better-auth/client/plugins";

/** Browser-side Better Auth client. Same origin, so no baseURL is needed. */
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
