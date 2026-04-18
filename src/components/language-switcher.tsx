"use client";

import { useLocale } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import { useState, useRef, useEffect } from "react";

const LOCALES = [
  { code: "ru", label: "Русский", short: "РУС" },
  { code: "en", label: "English", short: "EN" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-sage hover:bg-white"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {current.short}
        <svg
          className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_32px_rgba(0,0,0,0.10)]"
        >
          {LOCALES.map((l) => (
            <Link
              key={l.code}
              href={pathname}
              locale={l.code}
              role="option"
              aria-selected={l.code === locale}
              onClick={() => setOpen(false)}
              className={[
                "flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-[#f7efe4]",
                l.code === locale
                  ? "bg-[#fbf4ea] text-accent font-semibold"
                  : "text-foreground",
              ].join(" ")}
            >
              {l.label}
              {l.code === locale && (
                <svg
                  className="h-3.5 w-3.5 text-accent"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 8l4 4 6-6" />
                </svg>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
