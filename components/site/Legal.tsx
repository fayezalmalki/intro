import { Wordmark } from "./ui";
import "../../app/site.css";

export interface LegalDoc { title: string; updated: string; intro: string; sections: { h: string; p: string[] }[]; contact: string }

/** A plain, readable legal page in one language; the other language is one click away. */
export function Legal({ doc, lang, other }: { doc: LegalDoc; lang: "ar" | "en"; other: { href: string; label: string } }) {
  return (
    <div lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} data-dir={lang === "ar" ? "rtl" : "ltr"} className="site min-h-dvh bg-surface-3">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-16 max-w-[760px] items-center gap-4 px-5">
          <a href={lang === "ar" ? "/ar" : "/"}><Wordmark lang={lang} className={lang === "ar" ? "h-[28px]" : "h-[22px]"} /></a>
          <span className="flex-1" />
          <a href={other.href} className="text-[13.5px] font-medium text-muted hover:text-ink">{other.label}</a>
        </div>
      </header>
      <main className="mx-auto flex max-w-[760px] flex-col gap-6 px-5 py-12">
        <div className="flex flex-col gap-2">
          <h1 className="display font-display text-[34px] font-medium tracking-[-1px] text-ink rtl:tracking-normal">{doc.title}</h1>
          <span className="text-[13px] text-subtle">{doc.updated}</span>
        </div>
        <p className="text-[16px] leading-[27px] text-ink-2 rtl:leading-[30px]">{doc.intro}</p>
        {doc.sections.map((s) => (
          <section key={s.h} className="flex flex-col gap-2">
            <h2 className="text-[18px] font-semibold text-ink">{s.h}</h2>
            {s.p.map((x, i) => <p key={i} className="text-[15px] leading-[26px] text-ink-2 rtl:leading-[29px]">{x}</p>)}
          </section>
        ))}
        <p className="border-t border-line pt-5 text-[14.5px] text-muted">{doc.contact}</p>
      </main>
    </div>
  );
}
