import { describe, expect, it } from "vitest";
import { isProtected } from "../routes";

describe("isProtected", () => {
  it("leaves the landing open", () => {
    // "/" is the public pitch. It was briefly protected, which sent every
    // first-time visitor to a sign-in wall instead of the product's case for
    // itself — and, before that, threw a 500 because the page resolved a
    // session it could not have.
    expect(isProtected("/")).toBe(false);
  });

  it("protects intake", () => {
    // A request belongs to an account the moment it is created.
    expect(isProtected("/new")).toBe(true);
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

  it("protects the GTM flow", () => {
    // A run belongs to an account from the moment the website is submitted,
    // and everything under it is that account's data — including rows it paid
    // vendor credits for.
    expect(isProtected("/gtm")).toBe(true);
    expect(isProtected("/gtm/abc")).toBe(true);
    expect(isProtected("/gtm/abc/review")).toBe(true);
    expect(isProtected("/gtm/pay/test")).toBe(true);
  });

  it("leaves the worked examples open", () => {
    // It renders the composer over hand-written fixtures and reads nothing
    // from the database, so there is no account data on it — and it is the one
    // page that shows a stranger what the drafts actually read like.
    expect(isProtected("/examples")).toBe(false);
  });
});
