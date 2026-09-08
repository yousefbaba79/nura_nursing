import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Spinner, EmptyState } from "../components/ui";
import { formatDateTime } from "../lib/format";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditLog() {
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => (await api.get("/audit-log", { params: { limit: 200 } })).data.entries as AuditEntry[],
  });

  return (
    <div className="space-y-4">
      <div>
        <Link to="/settings" className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to settings
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Audit log</h1>
        <p className="text-sm text-gray-500">A record of sensitive actions on your account. This log cannot be edited.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="No audit entries yet" />
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">When</th>
                <th className="px-4 py-2">Action</th>
                <th className="px-4 py-2">Entity</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{formatDateTime(e.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-gray-900">{e.action.replace(/_/g, " ")}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-gray-500">{e.entityType}</td>
                  <td className="px-4 py-2 text-gray-500">{e.details || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
