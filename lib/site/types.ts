import type { IconKey } from "@/components/site/ui";

export type Locale = "en" | "ar";
export type Tone = "accent" | "neutral" | "success";

/** The six goals intro.sa is built around (docs/plans/2026-11-25-intro-cloudflare-rebuild.md). */
export type UseCaseId = "sell" | "hire-me" | "hire" | "partner" | "invest" | "enter-market";

export interface BoardCard { company: string; person: string; tag?: string; tagIcon?: IconKey; quote?: string }

/** The workspace shown for one use case in the demo tabs. */
export interface Preview {
  url: string;
  goal: string;
  sectorsLabel: string;
  sectors: string[];
  routeLabel: string;
  routes: { icon: IconKey; label: string }[];
  list: { title: string; count: string; items: { initial: string; name: string; role: string; tag: string; tagTone: Tone; active?: boolean }[] };
  detail: {
    initial: string;
    name: string;
    meta: [string, string];
    badge: { label: string; tone: Tone };
    fields: { key: string; value: string }[];
    steps: { label: string; status: string; state: "done" | "active" | "pending" }[];
    evidence: { source: string; title: string; date: string };
    draft: { label: string; text: string };
    primary: string;
    secondary: string;
  };
}

export interface UseCase {
  id: UseCaseId;
  icon: IconKey;
  name: string;
  job: string;
  route: string;
  example: string;
  /** Prefills the request box at /new. */
  seed: string;
}

export interface Dictionary {
  locale: Locale;
  dir: "ltr" | "rtl";
  meta: { title: string; description: string };
  skip: string;
  nav: {
    home: string;
    product: string;
    useCases: string;
    howItWorks: string;
    pricing: string;
    faq: string;
    language: { label: string; href: string; lang: Locale };
    signIn: string;
    myRequests: string;
    cta: string;
    menu: string;
    teams: string;
    individuals: string;
    productItems: { icon: IconKey; name: string; desc: string; href: string }[];
    guide: { title: string; body: string; action: string };
  };
  hero: {
    pill: string;
    headline: [string, string];
    subhead: string;
    primary: string;
    secondary: string;
    proof: { icon: IconKey; label: string }[];
    board: {
      url: string;
      title: string;
      period: string;
      filters: string[];
      columns: { title: string; icon: IconKey; count: string; booked?: boolean; cards: BoardCard[] }[];
    };
  };
  sectors: { lead: string; items: string[] };
  demo: {
    chip: string;
    heading: string;
    body: string;
    cta: string;
    hint: string;
    tabsLabel: string;
    previews: Record<UseCaseId, Preview>;
  };
  statement: { heading: [string, string]; body: string };
  useCases: {
    heading: string;
    body: string;
    teams: string;
    individuals: string;
    items: UseCase[];
    guide: { title: string; body: string; action: string };
  };
  stories: {
    heading: string;
    evidence: {
      chip: string; heading: string; body: string; rows: string[];
      card: { name: string; role: string; fit: string; why: string; sources: { source: string; title: string; date: string }[]; blocked: string };
    };
    intro: {
      chip: string; heading: string; body: string; rows: string[];
      card: { subject: string; from: string; body: string; accept: string; decline: string; note: string };
    };
    inbox: {
      chip: string; heading: string; body: string; rows: string[];
      card: { subject: string; badge: string; from: string; reply: string; draftLabel: string; draft: string; approve: string; edit: string };
    };
  };
  limits: { heading: string; body: string; items: { value: string; label: string }[] };
  principles: {
    heading: string;
    main: { numeral: string; title: string; body: string };
    chips: { icon: IconKey; label: string }[];
    side: { numeral: string; title: string; body: string }[];
  };
  pricing: {
    heading: string;
    body: string;
    plans: { name: string; price: string; desc: string; features: string[]; cta: string; href: string; featured?: boolean }[];
    note: string;
  };
  faq: { eyebrow: string; items: { q: string; a: string }[] };
  invitation: { heading: [string, string]; body: string; placeholder: string; label: string; submit: string; note: string };
  footer: { tagline: string; made: string; columns: { title: string; links: { label: string; href: string }[] }[] };
}
