import i18n from "../i18n";

// Arabic's `ar` locale defaults to Eastern Arabic-Indic digits in most
// browsers; force standard Western digits (-u-nu-latn) so numbers stay
// consistent and unambiguous throughout the app regardless of language.
function intlLocale(): string {
  const lang = i18n.resolvedLanguage || i18n.language || "en";
  return lang === "ar" ? "ar-u-nu-latn" : lang;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(intlLocale(), { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString(intlLocale(), { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatTime(value?: string | Date | null): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(intlLocale(), { hour: "numeric", minute: "2-digit" });
}

export function formatRelativeDay(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
  if (diffDays === 0) return i18n.t("common.today");
  if (diffDays === 1) return i18n.t("common.tomorrow");
  if (diffDays === -1) return i18n.t("common.yesterday");
  return formatDate(value);
}

export function isOverdue(dueDate?: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}
