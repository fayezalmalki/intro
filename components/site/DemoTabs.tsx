"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * Accessible tabs (WAI-ARIA tabs, automatic activation), ported from the
 * inbox.sa landing. Faces and panels render on the server; this only holds the
 * selection. `#demo-<use case>` links (nav, footer, use-case cards) select a tab.
 */
export function DemoTabs({
  label,
  tabs,
  panels,
  dir,
}: {
  label: string;
  tabs: { id: string; active: ReactNode; idle: ReactNode }[];
  panels: ReactNode[];
  dir: "ltr" | "rtl";
}) {
  const [index, setIndex] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const base = useId();

  useEffect(() => {
    const sync = () => {
      const m = /^#demo-(.+)$/.exec(window.location.hash);
      const i = m ? tabs.findIndex((t) => t.id === m[1]) : -1;
      if (i >= 0) setIndex(i);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [tabs]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const last = tabs.length - 1;
    const next = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const prev = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let to: number | null = null;
    if (e.key === next) to = index === last ? 0 : index + 1;
    else if (e.key === prev) to = index === 0 ? last : index - 1;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = last;
    if (to === null) return;
    e.preventDefault();
    setIndex(to);
    refs.current[to]?.focus();
  }

  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex h-16 w-full shrink-0 snap-x overflow-x-auto shadow-[inset_0_-1px_0_#d6d8d1] [scrollbar-width:none]"
      >
        {tabs.map((tab, i) => {
          const selected = i === index;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${base}-tab-${tab.id}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${base}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setIndex(i)}
              className={
                "flex h-16 min-w-[150px] flex-1 cursor-pointer snap-start flex-col gap-1 rounded-t-xl border-b-2 px-3 pt-3 text-start transition-colors " +
                (selected ? "border-brand bg-white" : "border-transparent bg-surface hover:bg-hover")
              }
            >
              {selected ? tab.active : tab.idle}
            </button>
          );
        })}
      </div>
      {panels.map((panel, i) => (
        <div
          key={tabs[i].id}
          id={`${base}-panel-${tabs[i].id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${tabs[i].id}`}
          hidden={i !== index}
          className="w-full"
        >
          {panel}
        </div>
      ))}
    </>
  );
}
