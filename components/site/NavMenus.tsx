"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Desktop primary navigation with mega-menus (disclosure pattern), ported from
 * the inbox.sa landing.
 * Panels are rendered on the server and passed in; this component only manages
 * which one is open. Opens on click and on hover (fine pointers), closes on
 * Escape, outside click, link activation, or when the pointer leaves.
 */
export function NavMenus({
  label,
  menus,
  links,
  chevrons,
}: {
  label: string;
  menus: { id: string; label: string; panel: ReactNode }[];
  links: { label: string; href: string }[];
  chevrons: { down: ReactNode; up: ReactNode };
}) {
  const [open, setOpen] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Menu opened by hover (not yet "pinned" by a click).
  const hovered = useRef<string | null>(null);
  const base = useId();

  const close = useCallback((focusButton?: string | null) => {
    hovered.current = null;
    setOpen(null);
    if (focusButton) buttons.current[focusButton]?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(open);
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && close();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, close]);

  const hoverOpen = (id: string) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (open !== id) hovered.current = id;
    setOpen(id);
  };
  const hoverClose = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    closeTimer.current = setTimeout(() => {
      hovered.current = null;
      setOpen(null);
    }, 150);
  };

  return (
    <div ref={root} className="hidden lg:block" onPointerLeave={hoverClose}>
      <nav aria-label={label}>
        <ul className="flex items-center gap-[30px]">
          {menus.map((m) => {
            const isOpen = open === m.id;
            return (
              <li key={m.id} onPointerEnter={hoverOpen(m.id)}>
                <button
                  ref={(el) => {
                    buttons.current[m.id] = el;
                  }}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`${base}-${m.id}`}
                  data-menu={m.id}
                  onClick={() => {
                    // A click on a menu that hover just opened pins it instead of closing it.
                    if (isOpen && hovered.current === m.id) hovered.current = null;
                    else setOpen(isOpen ? null : m.id);
                  }}
                  className="flex cursor-pointer items-center gap-[5px] text-[15px] font-medium text-ink hover:text-brand-2"
                >
                  {m.label}
                  {isOpen ? chevrons.up : chevrons.down}
                </button>
              </li>
            );
          })}
          {links.map((l) => (
            <li key={l.label} onPointerEnter={hoverClose}>
              <a href={l.href} className="text-[15px] font-medium text-ink hover:text-brand-2">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {menus.map((m) => (
        <div
          key={m.id}
          id={`${base}-${m.id}`}
          data-menu-panel={m.id}
          hidden={open !== m.id}
          onPointerEnter={() => closeTimer.current && clearTimeout(closeTimer.current)}
          onClick={(e) => (e.target as HTMLElement).closest("a") && close()}
          className="absolute inset-x-0 top-full z-30"
        >
          <div className="mx-auto max-w-[1152px] px-4 pt-2">{m.panel}</div>
        </div>
      ))}
    </div>
  );
}
