import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import he from "./locales/he.json";
import ar from "./locales/ar.json";

export const SUPPORTED_LANGUAGES = ["en", "he", "ar"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  he: "עברית",
  ar: "العربية",
};

export const RTL_LANGUAGES: SupportedLanguage[] = ["he", "ar"];

export function isRtl(lang: string): boolean {
  return RTL_LANGUAGES.includes(lang as SupportedLanguage);
}

export function applyDocumentDirection(lang: string) {
  document.documentElement.lang = lang;
  document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      he: { translation: he },
      ar: { translation: ar },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "nura_language",
      caches: ["localStorage"],
    },
  });

applyDocumentDirection(i18n.resolvedLanguage || i18n.language || "en");

i18n.on("languageChanged", (lang) => {
  applyDocumentDirection(lang);
});

export default i18n;
