"use client";

import { useLocale } from "next-intl";

export function LanguageSwitcher() {
  const locale = useLocale();
  const currentShort = locale === "en" ? "EN" : "РУС";

  return (
    <button
      type="button"
      disabled
      title="Language switching is temporarily disabled"
      className="rounded-full border border-line bg-white/60 px-4 py-2 text-sm font-semibold text-muted opacity-80"
      aria-label="Language switching temporarily disabled"
    >
      {currentShort}
    </button>
  );
}
