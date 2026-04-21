"use client";

import { useLocale, useSetLocale } from "@/lib/i18n-context";
import { useState, useRef, useEffect } from "react";

const LOCALES = [
  { code: "en", label: "English", short: "EN" },
  { code: "ru", label: "Русский", short: "РУС" },
] as const;

type LocaleCode = (typeof LOCALES)[number]["code"];

export function LanguageSwitcher() {
  const locale = useLocale();
  const setLocale = useSetLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
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
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select language"
          className="absolute right-0 z-50 mt-2 w-36 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_8px_32px_rgba(0,0,0,0.10)]"
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              role="option"
              aria-selected={l.code === locale}
              onClick={() => {
                setLocale(l.code);
                setOpen(false);
              }}
              className={[
                "flex w-full items-center justify-between px-4 py-3 text-sm font-medium transition-colors hover:bg-[#f7efe4]",
                l.code === locale
                  ? "bg-[#fbf4ea] font-semibold text-accent"
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
                  aria-hidden="true"
                >
                  <path d="M3 8l4 4 6-6" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
