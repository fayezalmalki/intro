import { describe, expect, it } from "vitest";
import { isProtected } from "../routes";

describe("isProtected", () => {
  it("protects the intake page", () => {
    // Regression: app/page.tsx resolves the session, so leaving "/" open made
    // the product's front door throw a 500 for every signed-out visitor.
    expect(isProtected("/")).toBe(true);
  });

  it("protects the requester and account-manager areas", () => {
    expect(isProtected("/requests")).toBe(true);
    expect(isProtected("/requests/abc")).toBe(true);
    expect(isProtected("/am")).toBe(true);
    expect(isProtected("/am/requests/abc/pipeline")).toBe(true);
  });

  it("leaves the sign-in page open", () => {
    // If "/" were matched as a prefix this would be true, and every redirect
    // to /login would bounce straight back to /login.
    expect(isProtected("/login")).toBe(false);
  });

  it("leaves sign-out open, so a stale session can always be cleared", () => {
    expect(isProtected("/signout")).toBe(false);
  });
});
