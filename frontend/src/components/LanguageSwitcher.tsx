import { useTranslation } from "react-i18next";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type SupportedLanguage } from "../i18n";

interface Props {
  className?: string;
}

export default function LanguageSwitcher({ className = "" }: Props) {
  const { i18n, t } = useTranslation();
  const { consultant, setConsultant } = useAuth();

  async function handleChange(lang: SupportedLanguage) {
    await i18n.changeLanguage(lang);
    if (consultant) {
      setConsultant({ ...consultant, defaultLanguage: lang });
      try {
        await api.put("/settings/profile", { defaultLanguage: lang });
      } catch {
        // Non-blocking: the UI has already switched and localStorage has the
        // preference; the account-level save can be retried next time.
      }
    }
  }

  return (
    <select
      aria-label={t("language.ariaLabel")}
      data-testid="language-switcher"
      className={`rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 ${className}`}
      value={i18n.resolvedLanguage || i18n.language}
      onChange={(e) => handleChange(e.target.value as SupportedLanguage)}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {LANGUAGE_LABELS[lang]}
        </option>
      ))}
    </select>
  );
}
