import type { IconKey } from "@/components/site/ui";

/**
 * The app's map: what lives where, in the order people use it — find, then
 * work what you found. Adding a view (jobs, chat) is an entry here, not a
 * layout change: the sidebar, the phone tab bar and Home's flow all read it.
 */

export type NavId = "home" | "search" | "leads" | "requests" | "billing";

export interface NavItem {
  id: NavId;
  href: string;
  icon: IconKey;
  en: string;
  ar: string;
  /** One line for Home's "how it connects" strip. */
  hint: { en: string; ar: string };
  /** On the phone tab bar. */
  tab?: boolean;
}

export interface NavGroup {
  id: string;
  en: string;
  ar: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    id: "start", en: "", ar: "",
    items: [
      { id: "home", href: "/home", icon: "home", en: "Home", ar: "الرئيسية", tab: true, hint: { en: "Start here", ar: "ابدأ من هنا" } },
    ],
  },
  {
    id: "find", en: "Find", ar: "ابحث",
    items: [
      { id: "search", href: "/search", icon: "search", en: "Search", ar: "البحث", tab: true, hint: { en: "Companies, people, a person, news", ar: "شركات، أشخاص، شخص محدد، أخبار" } },
      { id: "requests", href: "/requests", icon: "file-text", en: "Requests", ar: "الطلبات", tab: true, hint: { en: "Describe a goal — we source it", ar: "اكتب هدفك ونجهّزه لك" } },
    ],
  },
  {
    id: "work", en: "Work", ar: "تابع",
    items: [
      { id: "leads", href: "/leads", icon: "users", en: "Leads", ar: "العملاء المحتملون", tab: true, hint: { en: "Saved people, verified emails, drafts", ar: "المحفوظون، البريد الموثّق، المسودات" } },
    ],
  },
  {
    id: "account", en: "Account", ar: "الحساب",
    items: [
      { id: "billing", href: "/billing", icon: "sparkles", en: "Credits & billing", ar: "الرصيد والفواتير", hint: { en: "Top up, usage", ar: "الشحن والاستهلاك" } },
    ],
  },
];

/** The ways to search, as deep links (the sidebar shows them under Search). */
export const SEARCH_MODES: { mode: "companies" | "people" | "person" | "news"; icon: IconKey; en: string; ar: string }[] = [
  { mode: "companies", icon: "building", en: "Companies", ar: "الشركات" },
  { mode: "people", icon: "users", en: "People", ar: "الأشخاص" },
  { mode: "person", icon: "user-search", en: "A specific person", ar: "شخص محدد" },
  { mode: "news", icon: "trend", en: "News & signals", ar: "الأخبار والإشارات" },
];

export const navItems = (): NavItem[] => NAV.flatMap((g) => g.items);
