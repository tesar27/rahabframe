"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

type Locale = "en" | "ru";

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  messages: Record<string, any>;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [messages, setMessages] = useState<Record<string, any>>({});

  useEffect(() => {
    // Load initial messages
    loadMessages("en");
  }, []);

  const loadMessages = async (newLocale: Locale) => {
    try {
      const res = await fetch(`/messages/${newLocale}.json`);
      const data = await res.json();
      setMessages(data);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    loadMessages(newLocale);
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, messages }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useLocale must be used within I18nProvider");
  return context.locale;
}

export function useSetLocale() {
  const context = useContext(I18nContext);
  if (!context)
    throw new Error("useSetLocale must be used within I18nProvider");
  return context.setLocale;
}

export function useTranslations(namespace?: string) {
  const context = useContext(I18nContext);
  if (!context)
    throw new Error("useTranslations must be used within I18nProvider");

  const t = (key: string, params?: Record<string, any>): string => {
    const keys = namespace ? `${namespace}.${key}` : key;
    let value: any = keys
      .split(".")
      .reduce((obj, k) => obj?.[k], context.messages);
    if (typeof value === "string" && params) {
      Object.entries(params).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v));
      });
    }
    return typeof value === "string" ? value : key;
  };

  return t;
}
