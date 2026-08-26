import type { Account, Db, Person } from "../types";
import type { SendRequest } from "../gate";

export const BODY =
  "هلا نورة، تابعت توسع فريق المنتج عندكم بعد الجولة الأخيرة وحبيت أتواصل معك بخصوص دور قيادي.";
export const OTHER =
  "هلا طارق، أعمل على منصة مدفوعات تتكامل مع قنوات Open Banking وعندي حالة استخدام محددة.";

const account: Account = {
  id: "a1",
  userId: "u1",
  role: "requester",
  displayName: "فيصل",
  initial: "F",
  email: "f@x.sa",
  state: "verified",
  dailyCap: 10,
  createdAt: "2026-08-01T00:00:00.000Z",
};

const person = (over: Partial<Person> & Pick<Person, "id" | "latin">): Person => ({
  firstAr: "س",
  title: "t",
  company: "c",
  geo: "الرياض",
  industries: [],
  seniority: "head",
  emailVerified: false,
  openToIntros: false,
  source: "seed",
  ...over,
});

export function db(over: Partial<Db> = {}): Db {
  return {
    accounts: [{ ...account }],
    people: [
      person({ id: "p1", latin: "NOURA A.", firstAr: "نورة", email: "noura@example.sa", emailVerified: true, openToIntros: true }),
      person({ id: "p2", latin: "TARIQ B.", firstAr: "طارق", email: "tariq@example.sa", emailVerified: true }),
      person({ id: "p3", latin: "NO MAIL" }),
    ],
    requests: [],
    pipelines: [],
    outreach: [],
    lists: [],
    ledger: [{ id: "l1", accountId: "a1", delta: 5, reason: "grant", at: "2026-08-01T00:00:00.000Z" }],
    suppressions: [],
    sendAttempts: [],
    audit: [],
    ...over,
  };
}

export const send = (over: Partial<SendRequest> = {}): SendRequest => ({
  accountId: "a1",
  requestId: "r1",
  personId: "p1",
  channel: "email",
  body: BODY,
  ...over,
});
