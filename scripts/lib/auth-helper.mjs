/**
 * Signs a Playwright browser context in through the dev-only `dev-email`
 * credentials provider, which exists only when NODE_ENV=development.
 *
 * NextAuth's credentials callback is CSRF-protected, so this is a two-step
 * dance: fetch the token, then post it back alongside the email. Posting with
 * `json: "true"` makes NextAuth answer with a JSON body instead of a 302, which
 * is what lets us tell a failed sign-in from a successful one — a redirect to
 * the error page looks a lot like a redirect to the callback URL otherwise.
 */
export async function signIn(context, baseUrl, email) {
  const csrfResponse = await context.request.get(`${baseUrl}/api/auth/csrf`);
  if (!csrfResponse.ok()) {
    throw new Error(`csrf endpoint returned ${csrfResponse.status()} — is the dev server up?`);
  }
  const { csrfToken } = await csrfResponse.json();

  const callbackResponse = await context.request.post(`${baseUrl}/api/auth/callback/dev-email`, {
    form: { email, csrfToken, callbackUrl: baseUrl, json: "true" },
  });
  if (!callbackResponse.ok()) {
    throw new Error(`sign-in for ${email} returned ${callbackResponse.status()}`);
  }

  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name.endsWith("authjs.session-token"));
  if (!session) {
    // The dev-email provider is absent unless NODE_ENV=development, and its
    // absence shows up here rather than as an HTTP error.
    throw new Error(
      `no session cookie after signing in as ${email}. ` +
        `The dev-email provider only exists when the server runs with NODE_ENV=development.`,
    );
  }
  return session;
}
