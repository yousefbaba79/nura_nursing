import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../api/client";
import { Spinner, ErrorBanner } from "../../components/ui";
import { formatDate } from "../../lib/format";

interface SummaryData {
  clientName: string;
  babyNames: string[];
  visitDate: string;
  visitType: string;
  clientQuestions: string | null;
  solutionsDiscussed: string | null;
  recommendations: { id: string; title: string; instructions: string | null }[];
  actionItems: { id: string; title: string; instructions: string | null; dueDate: string | null }[];
  followUpPlan: string | null;
  followUpDate: string | null;
  warningSignsDiscussed: string | null;
  consultant: { fullName: string; professionalTitle: string | null; phone: string | null; email: string | null; clinicName: string | null } | null;
}

export default function VisitSummary() {
  const { visitId } = useParams<{ visitId: string }>();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const [includeQuestions, setIncludeQuestions] = useState(true);
  const [includeSolutions, setIncludeSolutions] = useState(true);
  const [includeFollowUp, setIncludeFollowUp] = useState(true);
  const [includeWarningSigns, setIncludeWarningSigns] = useState(true);
  const [selectedRecs, setSelectedRecs] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  useEffect(() => {
    if (!visitId) return;
    api
      .get(`/visits/${visitId}/summary`)
      .then((res) => {
        const s: SummaryData = res.data.summary;
        setSummary(s);
        setSelectedRecs(s.recommendations.map((r) => r.id));
        setSelectedItems(s.actionItems.map((a) => a.id));
      })
      .catch(() => setError("Could not load this visit's summary."))
      .finally(() => setLoading(false));
  }, [visitId]);

  const previewText = useMemo(() => {
    if (!summary) return "";
    const lines: string[] = [];
    lines.push(`Visit Summary — ${summary.clientName}`);
    if (summary.babyNames.length) lines.push(`Baby/Babies: ${summary.babyNames.join(", ")}`);
    lines.push(`Visit date: ${formatDate(summary.visitDate)}`);
    lines.push("");
    if (includeQuestions && summary.clientQuestions) {
      lines.push("Questions Discussed:");
      lines.push(summary.clientQuestions, "");
    }
    if (includeSolutions && summary.solutionsDiscussed) {
      lines.push("Recommendations Discussed:");
      lines.push(summary.solutionsDiscussed, "");
    }
    const recs = summary.recommendations.filter((r) => selectedRecs.includes(r.id));
    if (recs.length) {
      lines.push("Recommendations:");
      recs.forEach((r) => lines.push(`- ${r.title}${r.instructions ? `: ${r.instructions}` : ""}`));
      lines.push("");
    }
    const items = summary.actionItems.filter((a) => selectedItems.includes(a.id));
    if (items.length) {
      lines.push("Action Items:");
      items.forEach((a) => lines.push(`- ${a.title}${a.dueDate ? ` (due ${formatDate(a.dueDate)})` : ""}${a.instructions ? `: ${a.instructions}` : ""}`));
      lines.push("");
    }
    if (includeWarningSigns && summary.warningSignsDiscussed) {
      lines.push("Warning Signs to Watch For:");
      lines.push(summary.warningSignsDiscussed, "");
    }
    if (includeFollowUp && (summary.followUpPlan || summary.followUpDate)) {
      lines.push("Follow-Up Plan:");
      if (summary.followUpDate) lines.push(`Next follow-up: ${formatDate(summary.followUpDate)}`);
      if (summary.followUpPlan) lines.push(summary.followUpPlan);
      lines.push("");
    }
    if (summary.consultant) {
      lines.push("Prepared by:");
      lines.push(`${summary.consultant.fullName}${summary.consultant.professionalTitle ? `, ${summary.consultant.professionalTitle}` : ""}`);
      if (summary.consultant.clinicName) lines.push(summary.consultant.clinicName);
      if (summary.consultant.phone) lines.push(summary.consultant.phone);
      if (summary.consultant.email) lines.push(summary.consultant.email);
    }
    return lines.join("\n");
  }, [summary, includeQuestions, includeSolutions, includeFollowUp, includeWarningSigns, selectedRecs, selectedItems]);

  async function handleCopy() {
    await navigator.clipboard.writeText(previewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadPdf() {
    if (!visitId) return;
    setDownloading(true);
    try {
      const res = await api.post(
        `/visits/${visitId}/summary/pdf`,
        {
          clientQuestions: includeQuestions,
          solutionsDiscussed: includeSolutions,
          followUpPlan: includeFollowUp,
          warningSignsDiscussed: includeWarningSigns,
          recommendationIds: selectedRecs,
          actionItemIds: selectedItems,
        },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `visit-summary-${visitId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("Could not generate the PDF summary.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading || !summary) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/visits/${visitId}`} className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to visit
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Client visit summary</h1>
        <p className="text-sm text-gray-500">
          Choose exactly what to share. Private professional notes and internal assessments are never included.
        </p>
      </div>

      <ErrorBanner message={error} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">What to include</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={includeQuestions} onChange={(e) => setIncludeQuestions(e.target.checked)} disabled={!summary.clientQuestions} />
            Questions discussed {!summary.clientQuestions && <span className="text-gray-400">(none recorded)</span>}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={includeSolutions} onChange={(e) => setIncludeSolutions(e.target.checked)} disabled={!summary.solutionsDiscussed} />
            Recommendations discussed (narrative) {!summary.solutionsDiscussed && <span className="text-gray-400">(none recorded)</span>}
          </label>

          {summary.recommendations.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Recommendations</p>
              {summary.recommendations.map((r) => (
                <label key={r.id} className="flex items-center gap-2 pl-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedRecs.includes(r.id)}
                    onChange={(e) => setSelectedRecs((cur) => (e.target.checked ? [...cur, r.id] : cur.filter((id) => id !== r.id)))}
                  />
                  {r.title}
                </label>
              ))}
            </div>
          )}

          {summary.actionItems.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">Action items</p>
              {summary.actionItems.map((a) => (
                <label key={a.id} className="flex items-center gap-2 pl-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(a.id)}
                    onChange={(e) => setSelectedItems((cur) => (e.target.checked ? [...cur, a.id] : cur.filter((id) => id !== a.id)))}
                  />
                  {a.title}
                </label>
              ))}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={includeWarningSigns} onChange={(e) => setIncludeWarningSigns(e.target.checked)} disabled={!summary.warningSignsDiscussed} />
            Warning signs to watch for {!summary.warningSignsDiscussed && <span className="text-gray-400">(none recorded)</span>}
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={includeFollowUp}
              onChange={(e) => setIncludeFollowUp(e.target.checked)}
              disabled={!summary.followUpPlan && !summary.followUpDate}
            />
            Follow-up plan {!summary.followUpPlan && !summary.followUpDate && <span className="text-gray-400">(none recorded)</span>}
          </label>
        </div>

        <div className="card flex flex-col">
          <h2 className="mb-2 text-sm font-semibold text-gray-900">Preview</h2>
          <pre className="max-h-[420px] flex-1 overflow-auto whitespace-pre-wrap rounded-md bg-gray-50 p-3 text-sm text-gray-800">{previewText}</pre>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy to clipboard"}
            </button>
            <button className="btn-primary" onClick={handleDownloadPdf} disabled={downloading}>
              {downloading ? "Preparing PDF…" : "Download PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
