import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Spinner } from "../components/ui";
import { formatDate } from "../lib/format";

export default function Reports() {
  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => (await api.get("/reports")).data,
  });

  return (
    <div className="space-y-4">
      <div>
        <Link to="/settings" className="text-sm font-medium text-brand-700 hover:underline">
          ← Back to settings
        </Link>
        <h1 className="mt-1 text-xl font-bold text-gray-900">Reports</h1>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Active clients" value={data.activeClientCount} />
            <Stat label="Total visits" value={data.visitsInRange} />
            <Stat label="Need follow-up" value={data.clientsNeedingFollowUp} />
            <Stat label="Open action items" value={data.openActionItems} />
            <Stat label="Overdue action items" value={data.overdueActionItems} />
          </div>

          <div className="card">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Recent consultations</h2>
            <ul className="divide-y divide-gray-100">
              {data.recentVisits.map((v: any) => (
                <li key={v.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-gray-900">{v.client.fullName}</span>
                  <span className="text-gray-500">{formatDate(v.visitDate)}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
