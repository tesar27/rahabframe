"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTransition } from "react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("languageSwitcher");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const nextLocale = locale === "ru" ? "en" : "ru";

  function handleSwitch() {
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <button
      type="button"
      onClick={handleSwitch}
      disabled={isPending}
      className="rounded-full border border-line bg-white/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:border-sage hover:bg-white disabled:opacity-50"
      aria-label={`Switch to ${nextLocale === "ru" ? "Russian" : "English"}`}
    >
      {t(nextLocale)}
    </button>
  );
}
